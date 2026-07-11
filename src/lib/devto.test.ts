import { describe, expect, it, vi } from "vitest";

import {
  CHALLENGE_WINDOW_END,
  CHALLENGE_WINDOW_START,
  DevToApiError,
  fetchChallengeEntries,
} from "./devto";
import {
  challengeArticleDetail,
  challengeArticleSummary,
  makeDetail,
  makeSummary,
} from "./fixtures/devto";

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function mockDevApi(
  summaries: unknown[],
  details: Map<number, unknown>,
): typeof fetch {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );

    if (url.pathname === "/api/articles") {
      return jsonResponse(summaries);
    }

    const id = Number(url.pathname.split("/").at(-1));
    const detail = details.get(id);
    return detail
      ? jsonResponse(detail)
      : jsonResponse({ error: "not found" }, { status: 404 });
  }) as typeof fetch;
}

describe("fetchChallengeEntries", () => {
  it("includes both challenge-window boundaries and filters everything else", async () => {
    const atStart = makeSummary(1, CHALLENGE_WINDOW_START);
    const atEnd = makeSummary(2, CHALLENGE_WINDOW_END);
    const before = makeSummary(3, "2026-07-10T01:59:59.999Z");
    const after = makeSummary(4, "2026-07-13T06:59:00.001Z");
    const wrongTag = makeSummary(5, "2026-07-11T10:00:00Z", {
      tag_list: ["devchallenge", "googleai"],
    });
    const official = makeSummary(6, "2026-07-11T11:00:00Z", {
      url: "https://dev.to/devteam/join-our-dev-weekend-challenge-10j5",
      user: { name: "The DEV Team", username: "devteam" },
    });
    const summaries = [after, official, atEnd, wrongTag, before, atStart];
    const details = new Map(
      [atStart, atEnd].map((summary) => [summary.id, makeDetail(summary)]),
    );

    const entries = await fetchChallengeEntries({
      fetch: mockDevApi(summaries, details),
    });

    expect(entries.map((entry) => entry.devId)).toEqual([1, 2]);
  });

  it("normalizes article data and creates a stable content hash", async () => {
    const fetcher = mockDevApi(
      [challengeArticleSummary],
      new Map([[challengeArticleSummary.id, challengeArticleDetail]]),
    );

    const first = await fetchChallengeEntries({ fetch: fetcher });
    const second = await fetchChallengeEntries({ fetch: fetcher });

    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      devId: 4117067,
      title: "My Abandoned Cricket Kit Confronted Me. So I Built It a Voice",
      description:
        "This is a submission for the DEV Weekend Challenge: Passion Edition.",
      authorName: "Himanshu Kumar",
      authorUsername: "himanshu_748",
      tags: ["ai", "devchallenge", "solana", "weekendchallenge"],
      bodyMarkdown:
        "# The spark\n\nMy cricket kit had been waiting for a voice.",
      reactionCount: 11,
    });
    expect(first[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(second[0].contentHash).toBe(first[0].contentHash);
  });

  it("bounds concurrent article-detail requests", async () => {
    const summaries = Array.from({ length: 7 }, (_, index) =>
      makeSummary(index + 10, `2026-07-11T0${index}:00:00Z`),
    );
    let activeRequests = 0;
    let maximumActiveRequests = 0;

    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );

      if (url.pathname === "/api/articles") {
        return jsonResponse(summaries);
      }

      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeRequests -= 1;

      const id = Number(url.pathname.split("/").at(-1));
      const summary = summaries.find((candidate) => candidate.id === id);
      return jsonResponse(makeDetail(summary!));
    }) as typeof fetch;

    const entries = await fetchChallengeEntries({
      fetch: fetcher,
      detailConcurrency: 2,
    });

    expect(entries).toHaveLength(7);
    expect(maximumActiveRequests).toBe(2);
  });

  it("returns a typed, useful error when DEV is unavailable", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        { error: "Service temporarily unavailable" },
        { status: 503, headers: { "retry-after": "0" } },
      ),
    ) as typeof fetch;

    await expect(fetchChallengeEntries({ fetch: fetcher })).rejects.toMatchObject({
      name: "DevToApiError",
      kind: "http",
      status: 503,
    });

    try {
      await fetchChallengeEntries({ fetch: fetcher });
    } catch (error) {
      expect(error).toBeInstanceOf(DevToApiError);
      expect((error as Error).message).toContain("HTTP 503");
      expect((error as Error).message).toContain(
        "Service temporarily unavailable",
      );
    }
  });

  it("retries a rate-limited detail request", async () => {
    const summary = makeSummary(77, "2026-07-11T10:00:00Z");
    let detailCalls = 0;
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      if (url.pathname === "/api/articles") return jsonResponse([summary]);
      detailCalls += 1;
      if (detailCalls === 1) {
        return jsonResponse(
          { error: "Retry later" },
          { status: 429, headers: { "retry-after": "0" } },
        );
      }
      return jsonResponse(makeDetail(summary));
    }) as typeof fetch;

    const entries = await fetchChallengeEntries({ fetch: fetcher });
    expect(entries).toHaveLength(1);
    expect(detailCalls).toBe(2);
  });

  it("rejects an unexpected API shape as a typed error", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ articles: [] })) as typeof fetch;

    await expect(fetchChallengeEntries({ fetch: fetcher })).rejects.toMatchObject({
      name: "DevToApiError",
      kind: "invalid-response",
      status: 200,
    });
  });
});

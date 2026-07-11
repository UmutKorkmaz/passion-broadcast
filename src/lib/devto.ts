import { createHash } from "node:crypto";

import { z } from "zod";

import type { DevChallengeEntry } from "./types";

export const DEV_TO_BASE_URL = "https://dev.to";
export const CHALLENGE_TAG = "weekendchallenge";
export const CHALLENGE_WINDOW_START = "2026-07-10T02:00:00.000Z";
export const CHALLENGE_WINDOW_END = "2026-07-13T06:59:00.000Z";

const DEFAULT_PER_PAGE = 100;
const DEFAULT_MAX_PAGES = 20;
const DEFAULT_DETAIL_CONCURRENCY = 3;
const MAX_REQUEST_ATTEMPTS = 6;
const REQUEST_TIMEOUT_MS = 20_000;
const OFFICIAL_USERNAME = "devteam";

const dateTimeSchema = z.string().refine(
  (value) => Number.isFinite(Date.parse(value)),
  "Expected an ISO-compatible date-time",
);

const nullableUrlSchema = z.string().url().nullable().optional();

const devUserSchema = z
  .object({
    name: z.string().min(1),
    username: z.string().min(1),
    user_id: z.number().int().positive().optional(),
    profile_image: nullableUrlSchema,
    profile_image_90: nullableUrlSchema,
  })
  .passthrough();

const devOrganizationSchema = z
  .object({
    name: z.string().min(1),
    username: z.string().min(1),
  })
  .passthrough();

const tagListSchema = z
  .union([z.array(z.string()), z.string()])
  .transform((value) =>
    Array.isArray(value) ? value : value.split(",").map((tag) => tag.trim()),
  );

const articleSummarySchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    description: z.string().default(""),
    url: z.string().url(),
    canonical_url: z.string().url().nullable().optional(),
    published_at: dateTimeSchema,
    published_timestamp: dateTimeSchema.optional(),
    edited_at: dateTimeSchema.nullable().optional(),
    tag_list: tagListSchema.optional().transform((tags) => tags ?? []),
    tags: tagListSchema.optional(),
    cover_image: nullableUrlSchema,
    social_image: nullableUrlSchema,
    reading_time_minutes: z.number().int().nonnegative().default(0),
    comments_count: z.number().int().nonnegative().default(0),
    public_reactions_count: z.number().int().nonnegative().default(0),
    positive_reactions_count: z.number().int().nonnegative().optional(),
    user: devUserSchema,
    organization: devOrganizationSchema.nullable().optional(),
  })
  .passthrough();

const articleDetailSchema = articleSummarySchema.extend({
  body_markdown: z.string(),
});

const articleListSchema = z.array(articleSummarySchema);

type DevArticleSummary = z.infer<typeof articleSummarySchema>;
type DevArticleDetail = z.infer<typeof articleDetailSchema>;
type FetchLike = typeof globalThis.fetch;

export type DevToApiErrorKind = "network" | "http" | "invalid-response";

export class DevToApiError extends Error {
  readonly kind: DevToApiErrorKind;
  readonly endpoint: string;
  readonly status: number | null;

  constructor({
    message,
    kind,
    endpoint,
    status = null,
    cause,
  }: {
    message: string;
    kind: DevToApiErrorKind;
    endpoint: string;
    status?: number | null;
    cause?: unknown;
  }) {
    super(message, { cause });
    this.name = "DevToApiError";
    this.kind = kind;
    this.endpoint = endpoint;
    this.status = status;
  }
}

export interface FetchChallengeEntriesOptions {
  fetch?: FetchLike;
  baseUrl?: string;
  tag?: string;
  start?: string;
  end?: string;
  perPage?: number;
  maxPages?: number;
  detailConcurrency?: number;
  signal?: AbortSignal;
}

export interface DevChallengeFetchResult {
  entries: DevChallengeEntry[];
  pagesFetched: number;
  summariesSeen: number;
  candidatesMatched: number;
  fetchedAt: string;
}

interface ResolvedOptions {
  fetch: FetchLike;
  baseUrl: string;
  tag: string;
  startMs: number;
  endMs: number;
  perPage: number;
  maxPages: number;
  detailConcurrency: number;
  signal?: AbortSignal;
}

function assertIntegerWithin(
  value: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }

  return value;
}

function parseBoundary(value: string, name: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`${name} must be an ISO-compatible date-time`);
  }

  return timestamp;
}

function resolveOptions(
  options: FetchChallengeEntriesOptions = {},
): ResolvedOptions {
  const startMs = parseBoundary(
    options.start ?? CHALLENGE_WINDOW_START,
    "start",
  );
  const endMs = parseBoundary(options.end ?? CHALLENGE_WINDOW_END, "end");

  if (startMs > endMs) {
    throw new RangeError("start must be before or equal to end");
  }

  return {
    fetch: options.fetch ?? globalThis.fetch,
    baseUrl: (options.baseUrl ?? DEV_TO_BASE_URL).replace(/\/$/, ""),
    tag: normalizeTag(options.tag ?? CHALLENGE_TAG),
    startMs,
    endMs,
    perPage: assertIntegerWithin(
      options.perPage ?? DEFAULT_PER_PAGE,
      "perPage",
      1,
      100,
    ),
    maxPages: assertIntegerWithin(
      options.maxPages ?? DEFAULT_MAX_PAGES,
      "maxPages",
      1,
      100,
    ),
    detailConcurrency: assertIntegerWithin(
      options.detailConcurrency ?? DEFAULT_DETAIL_CONCURRENCY,
      "detailConcurrency",
      1,
      20,
    ),
    signal: options.signal,
  };
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, "").toLowerCase();
}

function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function normalizeInlineText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeMarkdown(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

function normalizeDateTime(value: string): string {
  return new Date(value).toISOString();
}

function isOfficialArticle(article: DevArticleSummary): boolean {
  if (article.user.username.toLowerCase() === OFFICIAL_USERNAME) {
    return true;
  }

  try {
    return new URL(article.url).pathname
      .toLowerCase()
      .startsWith(`/${OFFICIAL_USERNAME}/`);
  } catch {
    return false;
  }
}

function isChallengeCandidate(
  article: DevArticleSummary,
  options: ResolvedOptions,
): boolean {
  const tags = normalizeTags([...(article.tags ?? []), ...article.tag_list]);
  const publishedAt = Date.parse(
    article.published_timestamp ?? article.published_at,
  );

  return (
    tags.includes(options.tag) &&
    publishedAt >= options.startMs &&
    publishedAt <= options.endMs &&
    !isOfficialArticle(article)
  );
}

function makeRequestUrl(
  baseUrl: string,
  pathname: string,
  query?: Record<string, string>,
): string {
  const url = new URL(pathname, `${baseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return normalizeInlineText((await response.text()).slice(0, 300));
  } catch {
    return "";
  }
}

function retryDelayMs(response: Response | null, attempt: number): number {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return Math.min(1_000 * 2 ** attempt, 15_000);
}

async function waitBeforeRetry(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  if (milliseconds === 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error("DEV API request aborted"));
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

async function requestJson<T>(
  endpoint: string,
  schema: z.ZodType<T>,
  options: ResolvedOptions,
): Promise<T> {
  let response: Response | null = null;
  let lastNetworkError: unknown;

  for (let attempt = 0; attempt < MAX_REQUEST_ATTEMPTS; attempt += 1) {
    const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeoutSignal])
      : timeoutSignal;
    try {
      response = await options.fetch(endpoint, {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "passion-broadcast/0.1 (+https://github.com/UmutKorkmaz/passion-broadcast)",
        },
        cache: "no-store",
        signal,
      });
      lastNetworkError = undefined;
    } catch (cause) {
      lastNetworkError = cause;
      if (attempt < MAX_REQUEST_ATTEMPTS - 1 && !options.signal?.aborted) {
        await waitBeforeRetry(retryDelayMs(null, attempt), options.signal);
        continue;
      }
      throw new DevToApiError({
        message: `Unable to reach the DEV API at ${endpoint}`,
        kind: "network",
        endpoint,
        cause,
      });
    }

    if (
      !response.ok &&
      (response.status === 429 || response.status >= 500) &&
      attempt < MAX_REQUEST_ATTEMPTS - 1
    ) {
      await waitBeforeRetry(retryDelayMs(response, attempt), options.signal);
      continue;
    }
    break;
  }

  if (!response) {
    throw new DevToApiError({
      message: `Unable to reach the DEV API at ${endpoint}`,
      kind: "network",
      endpoint,
      cause: lastNetworkError,
    });
  }

  if (!response.ok) {
    const responseMessage = await readErrorBody(response);
    throw new DevToApiError({
      message: `DEV API request failed with HTTP ${response.status}${
        responseMessage ? `: ${responseMessage}` : ""
      }`,
      kind: "http",
      endpoint,
      status: response.status,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new DevToApiError({
      message: `DEV API returned non-JSON content for ${endpoint}`,
      kind: "invalid-response",
      endpoint,
      status: response.status,
      cause,
    });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new DevToApiError({
      message: `DEV API returned an unexpected response for ${endpoint}: ${z.prettifyError(
        parsed.error,
      )}`,
      kind: "invalid-response",
      endpoint,
      status: response.status,
      cause: parsed.error,
    });
  }

  return parsed.data;
}

async function fetchTagSummaries(
  options: ResolvedOptions,
): Promise<{ summaries: DevArticleSummary[]; pagesFetched: number }> {
  const uniqueSummaries = new Map<number, DevArticleSummary>();
  let pagesFetched = 0;

  for (let page = 1; page <= options.maxPages; page += 1) {
    const endpoint = makeRequestUrl(options.baseUrl, "/api/articles", {
      tag: options.tag,
      per_page: String(options.perPage),
      page: String(page),
    });
    const summaries = await requestJson(endpoint, articleListSchema, options);
    pagesFetched += 1;

    for (const summary of summaries) {
      if (!uniqueSummaries.has(summary.id)) {
        uniqueSummaries.set(summary.id, summary);
      }
    }

    if (summaries.length < options.perPage) {
      break;
    }
  }

  return { summaries: [...uniqueSummaries.values()], pagesFetched };
}

async function fetchArticleDetail(
  articleId: number,
  options: ResolvedOptions,
): Promise<DevArticleDetail> {
  const endpoint = makeRequestUrl(
    options.baseUrl,
    `/api/articles/${articleId}`,
  );
  return requestJson(endpoint, articleDetailSchema, options);
}

async function mapWithConcurrency<T, U>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index], index);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

function createContentHash(
  entry: Omit<DevChallengeEntry, "contentHash">,
): string {
  const hashInput = {
    devId: entry.devId,
    title: entry.title,
    description: entry.description,
    authorName: entry.authorName,
    authorUsername: entry.authorUsername,
    organizationName: entry.organizationName,
    organizationUsername: entry.organizationUsername,
    url: entry.url,
    canonicalUrl: entry.canonicalUrl,
    publishedAt: entry.publishedAt,
    editedAt: entry.editedAt,
    tags: entry.tags,
    coverImageUrl: entry.coverImageUrl,
    socialImageUrl: entry.socialImageUrl,
    readingTimeMinutes: entry.readingTimeMinutes,
    bodyMarkdown: entry.bodyMarkdown,
  };

  return createHash("sha256")
    .update(JSON.stringify(hashInput), "utf8")
    .digest("hex");
}

export function normalizeDevArticle(
  summary: DevArticleSummary,
  detail: DevArticleDetail,
): DevChallengeEntry {
  const tags = normalizeTags([
    ...(detail.tags ?? []),
    ...detail.tag_list,
    ...(summary.tags ?? []),
    ...summary.tag_list,
  ]);
  const publishedAt = normalizeDateTime(
    detail.published_timestamp ??
      detail.published_at ??
      summary.published_timestamp ??
      summary.published_at,
  );
  const editedAt = detail.edited_at ?? summary.edited_at ?? null;
  const entry: Omit<DevChallengeEntry, "contentHash"> = {
    devId: detail.id,
    title: normalizeInlineText(detail.title),
    description: normalizeInlineText(detail.description),
    authorName: normalizeInlineText(detail.user.name),
    authorUsername: detail.user.username.trim().toLowerCase(),
    authorProfileImageUrl:
      detail.user.profile_image_90 ?? detail.user.profile_image ?? null,
    organizationName: detail.organization?.name
      ? normalizeInlineText(detail.organization.name)
      : null,
    organizationUsername:
      detail.organization?.username.trim().toLowerCase() ?? null,
    url: detail.url,
    canonicalUrl: detail.canonical_url ?? detail.url,
    publishedAt,
    editedAt: editedAt ? normalizeDateTime(editedAt) : null,
    tags,
    coverImageUrl: detail.cover_image ?? null,
    socialImageUrl: detail.social_image ?? null,
    readingTimeMinutes: detail.reading_time_minutes,
    commentCount: detail.comments_count,
    reactionCount:
      detail.public_reactions_count ??
      detail.positive_reactions_count ??
      summary.public_reactions_count,
    bodyMarkdown: normalizeMarkdown(detail.body_markdown),
  };

  return { ...entry, contentHash: createContentHash(entry) };
}

export async function fetchChallengeEntriesWithStats(
  input: FetchChallengeEntriesOptions = {},
): Promise<DevChallengeFetchResult> {
  const options = resolveOptions(input);
  const { summaries, pagesFetched } = await fetchTagSummaries(options);
  const candidates = summaries.filter((article) =>
    isChallengeCandidate(article, options),
  );
  const entries = await mapWithConcurrency(
    candidates,
    options.detailConcurrency,
    async (summary) =>
      normalizeDevArticle(
        summary,
        await fetchArticleDetail(summary.id, options),
      ),
  );

  entries.sort(
    (left, right) =>
      left.publishedAt.localeCompare(right.publishedAt) ||
      left.devId - right.devId,
  );

  return {
    entries,
    pagesFetched,
    summariesSeen: summaries.length,
    candidatesMatched: candidates.length,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchChallengeEntries(
  options: FetchChallengeEntriesOptions = {},
): Promise<DevChallengeEntry[]> {
  return (await fetchChallengeEntriesWithStats(options)).entries;
}

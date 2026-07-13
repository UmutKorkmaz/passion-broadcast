import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSnowflakeQuery } = vi.hoisted(() => ({
  mockSnowflakeQuery: vi.fn(),
}));

vi.mock("@/lib/snowflake-core", () => ({
  snowflakeQuery: mockSnowflakeQuery,
}));

import {
  getDashboardSnapshot,
  getLatestBroadcastAudio,
} from "./dashboard-data-core";

describe("broadcast audio identity", () => {
  beforeEach(() => {
    mockSnowflakeQuery.mockReset();
  });

  it("versions the dashboard audio URL with the exact broadcast ID", async () => {
    mockSnowflakeQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          BROADCAST_ID: "7e90cdce-7bac-4e89-9a29-ffd55aec63ca",
          SCRIPT: "The latest broadcast.",
          DURATION_SECONDS: 52,
          GENERATED_AT: "2026-07-13T05:29:37.519Z",
          HAS_AUDIO: true,
        },
      ]);

    const snapshot = await getDashboardSnapshot();

    expect(snapshot.latestBroadcast).toMatchObject({
      audioUrl:
        "/api/audio/latest?id=7e90cdce-7bac-4e89-9a29-ffd55aec63ca",
      generatedAt: "2026-07-13T05:29:37.519Z",
    });
  });

  it("loads the audio belonging to a requested broadcast ID", async () => {
    const broadcastId = "7e90cdce-7bac-4e89-9a29-ffd55aec63ca";
    mockSnowflakeQuery.mockResolvedValueOnce([
      {
        AUDIO_BASE64: Buffer.from("fresh broadcast").toString("base64"),
        AUDIO_MIME: "audio/mpeg",
        GENERATED_AT: "2026-07-13T05:29:37.519Z",
      },
    ]);

    const audio = await getLatestBroadcastAudio(broadcastId);

    expect(mockSnowflakeQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE BROADCAST_ID = ?"),
      [broadcastId],
    );
    expect(Buffer.from(audio?.bytes ?? []).toString()).toBe("fresh broadcast");
  });
});

import { randomUUID } from "node:crypto";

import { fetchChallengeEntriesWithStats } from "@/lib/devto";
import { synthesizeBroadcast } from "@/lib/elevenlabs-core";
import { getProviderEnv } from "@/lib/env-core";
import {
  analyzeChallengeEntries,
  analyzeChallengeEntry,
  generateBroadcastScript,
  type EntryAnalysis,
} from "@/lib/gemini-core";
import { getDashboardSnapshot } from "@/lib/dashboard-data-core";
import {
  ensureSnowflakeSchema,
  snowflakeQuery,
} from "@/lib/snowflake-core";
import type {
  ChallengeEntry,
  DashboardSnapshot,
  DevChallengeEntry,
} from "@/lib/types";

const ANALYSIS_BATCH_SIZE = 8;
const ANALYSIS_CONCURRENCY = 2;

type ExistingEntryRow = { ARTICLE_ID: number; CONTENT_HASH: string };
type ExistingAnalysisRow = { ARTICLE_ID: number; CONTENT_HASH: string };
type CountRow = { COUNT: number };

export type IngestionResult = {
  runId: string;
  status: "SUCCESS" | "PARTIAL";
  sourceCount: number;
  qualifyingCount: number;
  changedCount: number;
  analyzedCount: number;
  failedAnalysisCount: number;
  broadcastGenerated: boolean;
  snapshot: DashboardSnapshot;
};

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[`*_~>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toChallengeEntry(
  entry: DevChallengeEntry,
  fetchedAt: string,
): ChallengeEntry {
  return {
    articleId: entry.devId,
    title: entry.title,
    description: entry.description,
    bodyExcerpt: stripMarkdown(entry.bodyMarkdown).slice(0, 3_000),
    url: entry.url,
    authorName: entry.authorName,
    authorUsername: entry.authorUsername,
    tags: entry.tags,
    publishedAt: entry.publishedAt,
    positiveReactions: entry.reactionCount,
    commentsCount: entry.commentCount,
    readingTimeMinutes: entry.readingTimeMinutes,
    coverImage: entry.coverImageUrl ?? entry.socialImageUrl,
    contentHash: entry.contentHash,
    sourceFetchedAt: fetchedAt,
  };
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/sk_[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/AQ\.[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 800);
}

async function mapWithConcurrency<T, U>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function upsertEntry(entry: ChallengeEntry): Promise<void> {
  await snowflakeQuery(
    `MERGE INTO CHALLENGE_ENTRIES target
      USING (SELECT
        ?::NUMBER AS ARTICLE_ID,
        ?::STRING AS TITLE,
        ?::STRING AS DESCRIPTION,
        ?::STRING AS BODY_MARKDOWN,
        ?::STRING AS BODY_EXCERPT,
        ?::STRING AS URL,
        ?::STRING AS AUTHOR_NAME,
        ?::STRING AS AUTHOR_USERNAME,
        PARSE_JSON(?) AS TAGS,
        TO_TIMESTAMP_TZ(?) AS PUBLISHED_AT,
        ?::NUMBER AS POSITIVE_REACTIONS,
        ?::NUMBER AS COMMENTS_COUNT,
        ?::NUMBER AS READING_TIME_MINUTES,
        ?::STRING AS COVER_IMAGE,
        ?::STRING AS CONTENT_HASH,
        TO_TIMESTAMP_TZ(?) AS SOURCE_FETCHED_AT
      ) source
      ON target.ARTICLE_ID = source.ARTICLE_ID
      WHEN MATCHED THEN UPDATE SET
        TITLE = source.TITLE,
        DESCRIPTION = source.DESCRIPTION,
        BODY_MARKDOWN = source.BODY_MARKDOWN,
        BODY_EXCERPT = source.BODY_EXCERPT,
        URL = source.URL,
        AUTHOR_NAME = source.AUTHOR_NAME,
        AUTHOR_USERNAME = source.AUTHOR_USERNAME,
        TAGS = source.TAGS,
        PUBLISHED_AT = source.PUBLISHED_AT,
        POSITIVE_REACTIONS = source.POSITIVE_REACTIONS,
        COMMENTS_COUNT = source.COMMENTS_COUNT,
        READING_TIME_MINUTES = source.READING_TIME_MINUTES,
        COVER_IMAGE = source.COVER_IMAGE,
        CONTENT_HASH = source.CONTENT_HASH,
        SOURCE_FETCHED_AT = source.SOURCE_FETCHED_AT,
        LAST_SEEN_AT = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT (
        ARTICLE_ID, TITLE, DESCRIPTION, BODY_MARKDOWN, BODY_EXCERPT, URL,
        AUTHOR_NAME, AUTHOR_USERNAME, TAGS, PUBLISHED_AT, POSITIVE_REACTIONS,
        COMMENTS_COUNT, READING_TIME_MINUTES, COVER_IMAGE, CONTENT_HASH,
        SOURCE_FETCHED_AT, LAST_SEEN_AT
      ) VALUES (
        source.ARTICLE_ID, source.TITLE, source.DESCRIPTION, source.BODY_MARKDOWN,
        source.BODY_EXCERPT, source.URL, source.AUTHOR_NAME, source.AUTHOR_USERNAME,
        source.TAGS, source.PUBLISHED_AT, source.POSITIVE_REACTIONS,
        source.COMMENTS_COUNT, source.READING_TIME_MINUTES, source.COVER_IMAGE,
        source.CONTENT_HASH, source.SOURCE_FETCHED_AT, CURRENT_TIMESTAMP()
      )`,
    [
      entry.articleId,
      entry.title,
      entry.description,
      entry.bodyExcerpt,
      entry.bodyExcerpt,
      entry.url,
      entry.authorName,
      entry.authorUsername,
      JSON.stringify(entry.tags),
      entry.publishedAt,
      entry.positiveReactions,
      entry.commentsCount,
      entry.readingTimeMinutes,
      entry.coverImage,
      entry.contentHash,
      entry.sourceFetchedAt,
    ],
  );
}

async function upsertAnalysis(
  entry: ChallengeEntry,
  analysis: EntryAnalysis,
): Promise<void> {
  const env = getProviderEnv();
  await snowflakeQuery(
    `MERGE INTO ENTRY_ANALYSIS target
      USING (SELECT
        ?::NUMBER AS ARTICLE_ID,
        ?::STRING AS CONTENT_HASH,
        ?::STRING AS ARCHETYPE,
        ?::STRING AS DOMAIN,
        ?::STRING AS MOTIVATION,
        ?::STRING AS EMOTIONAL_TONE,
        PARSE_JSON(?) AS TECHNOLOGIES,
        PARSE_JSON(?) AS SPONSOR_TECHNOLOGIES,
        ?::STRING AS GROUNDED_SUMMARY,
        ?::FLOAT AS CONFIDENCE,
        ?::STRING AS MODEL_VERSION,
        PARSE_JSON(?) AS RAW_ANALYSIS
      ) source
      ON target.ARTICLE_ID = source.ARTICLE_ID
      WHEN MATCHED THEN UPDATE SET
        CONTENT_HASH = source.CONTENT_HASH,
        ARCHETYPE = source.ARCHETYPE,
        DOMAIN = source.DOMAIN,
        MOTIVATION = source.MOTIVATION,
        EMOTIONAL_TONE = source.EMOTIONAL_TONE,
        TECHNOLOGIES = source.TECHNOLOGIES,
        SPONSOR_TECHNOLOGIES = source.SPONSOR_TECHNOLOGIES,
        GROUNDED_SUMMARY = source.GROUNDED_SUMMARY,
        CONFIDENCE = source.CONFIDENCE,
        MODEL_VERSION = source.MODEL_VERSION,
        ANALYZED_AT = CURRENT_TIMESTAMP(),
        RAW_ANALYSIS = source.RAW_ANALYSIS
      WHEN NOT MATCHED THEN INSERT (
        ARTICLE_ID, CONTENT_HASH, ARCHETYPE, DOMAIN, MOTIVATION, EMOTIONAL_TONE,
        TECHNOLOGIES, SPONSOR_TECHNOLOGIES, GROUNDED_SUMMARY, CONFIDENCE,
        MODEL_VERSION, ANALYZED_AT, RAW_ANALYSIS
      ) VALUES (
        source.ARTICLE_ID, source.CONTENT_HASH, source.ARCHETYPE, source.DOMAIN,
        source.MOTIVATION, source.EMOTIONAL_TONE, source.TECHNOLOGIES,
        source.SPONSOR_TECHNOLOGIES, source.GROUNDED_SUMMARY, source.CONFIDENCE,
        source.MODEL_VERSION, CURRENT_TIMESTAMP(), source.RAW_ANALYSIS
      )`,
    [
      entry.articleId,
      entry.contentHash,
      analysis.archetype,
      analysis.domain,
      analysis.motivation,
      analysis.emotionalTone,
      JSON.stringify(analysis.technologies),
      JSON.stringify(analysis.sponsorTechnologies),
      analysis.groundedSummary,
      analysis.confidence,
      env.GEMINI_MODEL,
      JSON.stringify(analysis),
    ],
  );
}

async function saveMetricSnapshot(snapshot: DashboardSnapshot): Promise<string> {
  const snapshotId = randomUUID();
  const data = {
    metrics: snapshot.metrics,
    archetypes: snapshot.archetypes,
    technologies: snapshot.technologies,
    sponsorTechnologies: snapshot.sponsorTechnologies,
    timeline: snapshot.timeline,
    analysisCoverage: snapshot.analysisCoverage,
    sourceUpdatedAt: snapshot.sourceUpdatedAt,
  };
  await snowflakeQuery(
    `INSERT INTO METRIC_SNAPSHOTS (
      SNAPSHOT_ID, CAPTURED_AT, ENTRY_COUNT, BUILDER_COUNT, REACTION_COUNT,
      ARCHETYPE_COUNT, DATA
    ) SELECT ?, CURRENT_TIMESTAMP(), ?, ?, ?, ?, PARSE_JSON(?)`,
    [
      snapshotId,
      snapshot.metrics.entries,
      snapshot.metrics.builders,
      snapshot.metrics.reactions,
      snapshot.metrics.archetypes,
      JSON.stringify(data),
    ],
  );
  return snapshotId;
}

async function saveBroadcast(
  snapshotId: string,
  script: string,
  durationSeconds: number,
  audio: Uint8Array | null,
): Promise<void> {
  const env = getProviderEnv();
  await snowflakeQuery(
    `INSERT INTO BROADCASTS (
      BROADCAST_ID, GENERATED_AT, SNAPSHOT_ID, SCRIPT, AUDIO_BASE64, AUDIO_MIME,
      DURATION_SECONDS, GEMINI_MODEL, ELEVENLABS_MODEL
    ) SELECT ?, CURRENT_TIMESTAMP(), ?, ?, ?, ?, ?, ?, ?`,
    [
      randomUUID(),
      snapshotId,
      script,
      audio ? Buffer.from(audio).toString("base64") : null,
      audio ? "audio/mpeg" : null,
      durationSeconds,
      env.GEMINI_MODEL,
      env.ELEVENLABS_MODEL_ID,
    ],
  );
}

async function hasBroadcast(): Promise<boolean> {
  const rows = await snowflakeQuery<CountRow>(
    "SELECT COUNT(*) AS COUNT FROM BROADCASTS",
  );
  return Number(rows[0]?.COUNT ?? 0) > 0;
}

export async function runIngestion(): Promise<IngestionResult> {
  await ensureSnowflakeSchema();
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  await snowflakeQuery(
    `INSERT INTO INGESTION_RUNS (
      RUN_ID, STARTED_AT, STATUS, SOURCE_COUNT, QUALIFYING_COUNT,
      CHANGED_COUNT, ANALYZED_COUNT
    ) SELECT ?, TO_TIMESTAMP_TZ(?), 'RUNNING', 0, 0, 0, 0`,
    [runId, startedAt],
  );

  try {
    const fetched = await fetchChallengeEntriesWithStats();
    const entries = fetched.entries.map((entry) =>
      toChallengeEntry(entry, fetched.fetchedAt),
    );
    const [existingEntryRows, existingAnalysisRows] = await Promise.all([
      snowflakeQuery<ExistingEntryRow>(
        "SELECT ARTICLE_ID, CONTENT_HASH FROM CHALLENGE_ENTRIES",
      ),
      snowflakeQuery<ExistingAnalysisRow>(
        "SELECT ARTICLE_ID, CONTENT_HASH FROM ENTRY_ANALYSIS",
      ),
    ]);
    const existingEntries = new Map(
      existingEntryRows.map((row) => [Number(row.ARTICLE_ID), row.CONTENT_HASH]),
    );
    const existingAnalyses = new Map(
      existingAnalysisRows.map((row) => [Number(row.ARTICLE_ID), row.CONTENT_HASH]),
    );
    const changedEntries = entries.filter(
      (entry) =>
        existingEntries.get(entry.articleId) !== entry.contentHash ||
        existingAnalyses.get(entry.articleId) !== entry.contentHash,
    );

    for (const entry of entries) await upsertEntry(entry);

    const batchOutcomes = await mapWithConcurrency(
      chunk(changedEntries, ANALYSIS_BATCH_SIZE),
      ANALYSIS_CONCURRENCY,
      async (batch) => {
        try {
          const analyses = await analyzeChallengeEntries(batch);
          const byArticleId = new Map(
            analyses.map((result) => [result.articleId, result.analysis]),
          );
          return batch.map((entry) => ({
            entry,
            analysis: byArticleId.get(entry.articleId) ?? null,
            error: byArticleId.has(entry.articleId)
              ? null
              : "Gemini omitted this entry from batch analysis",
          }));
        } catch (error) {
          const batchError = sanitizeError(error);
          const fallbacks = [];
          for (const entry of batch) {
            try {
              fallbacks.push({
                entry,
                analysis: await analyzeChallengeEntry(entry),
                error: null,
              });
            } catch (fallbackError) {
              fallbacks.push({
                entry,
                analysis: null,
                error: `${batchError}; fallback: ${sanitizeError(fallbackError)}`,
              });
            }
          }
          return fallbacks;
        }
      },
    );
    const outcomes = batchOutcomes.flat();
    const successfulAnalyses = outcomes.filter(
      (outcome): outcome is typeof outcome & { analysis: EntryAnalysis } =>
        outcome.analysis !== null,
    );
    const analysisErrors = outcomes
      .map((outcome) => outcome.error)
      .filter((error): error is string => Boolean(error));
    for (const outcome of successfulAnalyses) {
      await upsertAnalysis(outcome.entry, outcome.analysis);
    }

    let snapshot = await getDashboardSnapshot();
    const snapshotId = await saveMetricSnapshot(snapshot);
    let broadcastGenerated = false;
    let broadcastError: string | null = null;
    if (changedEntries.length > 0 || !(await hasBroadcast())) {
      try {
        const broadcast = await generateBroadcastScript(snapshot);
        let audio: Uint8Array | null = null;
        try {
          audio = await synthesizeBroadcast(broadcast.script);
        } catch (error) {
          broadcastError = `Audio: ${sanitizeError(error)}`;
        }
        await saveBroadcast(
          snapshotId,
          broadcast.script,
          broadcast.durationSeconds,
          audio,
        );
        broadcastGenerated = true;
        snapshot = await getDashboardSnapshot();
      } catch (error) {
        broadcastError = `Broadcast: ${sanitizeError(error)}`;
      }
    }

    const partialErrors = [...analysisErrors.slice(0, 3), broadcastError]
      .filter((error): error is string => Boolean(error));
    const status = partialErrors.length > 0 ? "PARTIAL" : "SUCCESS";
    await snowflakeQuery(
      `UPDATE INGESTION_RUNS SET
        COMPLETED_AT = CURRENT_TIMESTAMP(),
        SOURCE_COUNT = ?,
        QUALIFYING_COUNT = ?,
        CHANGED_COUNT = ?,
        ANALYZED_COUNT = ?,
        STATUS = ?,
        ERROR_MESSAGE = ?
      WHERE RUN_ID = ?`,
      [
        fetched.summariesSeen,
        entries.length,
        changedEntries.length,
        successfulAnalyses.length,
        status,
        partialErrors.length > 0 ? partialErrors.join(" | ").slice(0, 800) : null,
        runId,
      ],
    );

    return {
      runId,
      status,
      sourceCount: fetched.summariesSeen,
      qualifyingCount: entries.length,
      changedCount: changedEntries.length,
      analyzedCount: successfulAnalyses.length,
      failedAnalysisCount: analysisErrors.length,
      broadcastGenerated,
      snapshot,
    };
  } catch (error) {
    await snowflakeQuery(
      `UPDATE INGESTION_RUNS SET
        COMPLETED_AT = CURRENT_TIMESTAMP(), STATUS = 'FAILED', ERROR_MESSAGE = ?
      WHERE RUN_ID = ?`,
      [sanitizeError(error), runId],
    ).catch(() => undefined);
    throw error;
  }
}

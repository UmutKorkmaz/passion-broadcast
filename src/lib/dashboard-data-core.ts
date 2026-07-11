import {
  PASSION_ARCHETYPES,
  SPONSOR_TECHNOLOGIES,
} from "@/lib/gemini-core";
import { snowflakeQuery } from "@/lib/snowflake-core";
import type {
  BreakdownDatum,
  DashboardEntry,
  DashboardSnapshot,
  LatestBroadcast,
  TimelineDatum,
} from "@/lib/types";

type EnrichedEntryRow = {
  ARTICLE_ID: number;
  TITLE: string;
  DESCRIPTION: string | null;
  BODY_EXCERPT: string | null;
  URL: string;
  AUTHOR_NAME: string | null;
  AUTHOR_USERNAME: string | null;
  TAGS: unknown;
  PUBLISHED_AT: unknown;
  POSITIVE_REACTIONS: number | null;
  COMMENTS_COUNT: number | null;
  READING_TIME_MINUTES: number | null;
  COVER_IMAGE: string | null;
  CONTENT_HASH: string;
  SOURCE_FETCHED_AT: unknown;
  ARCHETYPE: string | null;
  DOMAIN: string | null;
  MOTIVATION: string | null;
  EMOTIONAL_TONE: string | null;
  TECHNOLOGIES: unknown;
  SPONSOR_TECHNOLOGIES: unknown;
  GROUNDED_SUMMARY: string | null;
  CONFIDENCE: number | null;
};

type BroadcastRow = {
  SCRIPT: string;
  DURATION_SECONDS: number | null;
  GENERATED_AT: unknown;
  HAS_AUDIO: boolean;
};

type AudioRow = {
  AUDIO_BASE64: string | null;
  AUDIO_MIME: string | null;
  GENERATED_AT: unknown;
};

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
}

function toStringArray(value: unknown): string[] {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(candidate)) return [];
  return candidate
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

function buildBreakdown(
  values: readonly string[],
  total: number,
  preferredOrder?: readonly string[],
): BreakdownDatum[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left, leftCount], [right, rightCount]) => {
      if (preferredOrder) {
        const leftIndex = preferredOrder.indexOf(left);
        const rightIndex = preferredOrder.indexOf(right);
        const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
        const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
        if (normalizedLeft !== normalizedRight) return normalizedLeft - normalizedRight;
      }
      return rightCount - leftCount || left.localeCompare(right);
    })
    .map(([label, count]) => ({ label, count, percentage: percentage(count, total) }));
}

function buildTechnologyBreakdown(entries: readonly DashboardEntry[]): BreakdownDatum[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const technology of new Set(entry.technologies)) {
      counts.set(technology, (counts.get(technology) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort(([left, leftCount], [right, rightCount]) =>
      rightCount - leftCount || left.localeCompare(right),
    )
    .map(([label, count]) => ({
      label,
      count,
      percentage: percentage(count, entries.length),
    }));
}

function buildTimeline(entries: readonly DashboardEntry[]): TimelineDatum[] {
  const daily = new Map<string, number>();
  for (const entry of entries) {
    const day = entry.publishedAt.slice(0, 10);
    daily.set(day, (daily.get(day) ?? 0) + 1);
  }

  let cumulative = 0;
  return [...daily.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, count]) => {
      cumulative += count;
      return {
        label: new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${day}T00:00:00.000Z`)),
        count: cumulative,
      };
    });
}

async function getLatestBroadcast(): Promise<LatestBroadcast | undefined> {
  const rows = await snowflakeQuery<BroadcastRow>(`SELECT
      SCRIPT,
      DURATION_SECONDS,
      GENERATED_AT,
      AUDIO_BASE64 IS NOT NULL AS HAS_AUDIO
    FROM BROADCASTS
    ORDER BY GENERATED_AT DESC
    LIMIT 1`);
  const row = rows[0];
  if (!row) return undefined;

  return {
    title: "State of Passion",
    transcript: row.SCRIPT,
    durationSeconds: Number(row.DURATION_SECONDS ?? 0),
    audioUrl: row.HAS_AUDIO ? "/api/audio/latest" : undefined,
    generatedAt: toIsoString(row.GENERATED_AT),
  };
}

export async function getLatestBroadcastAudio(): Promise<{
  bytes: Uint8Array;
  mime: string;
  generatedAt: string;
} | null> {
  const rows = await snowflakeQuery<AudioRow>(`SELECT
      AUDIO_BASE64,
      AUDIO_MIME,
      GENERATED_AT
    FROM BROADCASTS
    WHERE AUDIO_BASE64 IS NOT NULL
    ORDER BY GENERATED_AT DESC
    LIMIT 1`);
  const row = rows[0];
  if (!row?.AUDIO_BASE64) return null;

  return {
    bytes: new Uint8Array(Buffer.from(row.AUDIO_BASE64, "base64")),
    mime: row.AUDIO_MIME ?? "audio/mpeg",
    generatedAt: toIsoString(row.GENERATED_AT),
  };
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const rows = await snowflakeQuery<EnrichedEntryRow>(`SELECT *
    FROM V_ENRICHED_ENTRIES
    ORDER BY PUBLISHED_AT DESC, ARTICLE_ID DESC`);

  const entries: DashboardEntry[] = rows.map((row) => ({
    articleId: Number(row.ARTICLE_ID),
    title: row.TITLE,
    description: row.DESCRIPTION ?? "",
    bodyExcerpt: row.BODY_EXCERPT ?? "",
    url: row.URL,
    authorName: row.AUTHOR_NAME ?? row.AUTHOR_USERNAME ?? "DEV builder",
    authorUsername: row.AUTHOR_USERNAME ?? "unknown",
    tags: toStringArray(row.TAGS),
    publishedAt: toIsoString(row.PUBLISHED_AT),
    positiveReactions: Number(row.POSITIVE_REACTIONS ?? 0),
    commentsCount: Number(row.COMMENTS_COUNT ?? 0),
    readingTimeMinutes: Number(row.READING_TIME_MINUTES ?? 0),
    coverImage: row.COVER_IMAGE,
    contentHash: row.CONTENT_HASH,
    sourceFetchedAt: toIsoString(row.SOURCE_FETCHED_AT),
    archetype: row.ARCHETYPE ?? "Awaiting analysis",
    domain: row.DOMAIN ?? "Unclassified",
    motivation: row.MOTIVATION ?? "Analysis pending.",
    emotionalTone: row.EMOTIONAL_TONE ?? "Analysis pending",
    technologies: toStringArray(row.TECHNOLOGIES),
    sponsorTechnologies: toStringArray(row.SPONSOR_TECHNOLOGIES),
    groundedSummary: row.GROUNDED_SUMMARY ?? row.DESCRIPTION ?? "Analysis pending.",
    confidence: Number(row.CONFIDENCE ?? 0),
  }));

  const analyzedEntries = entries.filter((entry) => entry.confidence > 0);
  const latestSourceUpdate = entries.reduce(
    (latest, entry) =>
      entry.sourceFetchedAt > latest ? entry.sourceFetchedAt : latest,
    new Date(0).toISOString(),
  );
  const archetypes = buildBreakdown(
    analyzedEntries.map((entry) => entry.archetype),
    analyzedEntries.length,
    PASSION_ARCHETYPES,
  );

  return {
    metrics: {
      entries: entries.length,
      builders: new Set(entries.map((entry) => entry.authorUsername)).size,
      archetypes: archetypes.length,
      reactions: entries.reduce((sum, entry) => sum + entry.positiveReactions, 0),
      analyzedEntries: analyzedEntries.length,
      technologies: new Set(analyzedEntries.flatMap((entry) => entry.technologies)).size,
    },
    entries,
    archetypes,
    technologies: buildTechnologyBreakdown(analyzedEntries),
    sponsorTechnologies: buildBreakdown(
      analyzedEntries.flatMap((entry) => entry.sponsorTechnologies),
      analyzedEntries.length,
      SPONSOR_TECHNOLOGIES,
    ),
    timeline: buildTimeline(entries),
    analysisCoverage: {
      analyzed: analyzedEntries.length,
      total: entries.length,
      percentage: percentage(analyzedEntries.length, entries.length),
    },
    generatedAt: new Date().toISOString(),
    sourceUpdatedAt: latestSourceUpdate,
    latestBroadcast: await getLatestBroadcast(),
  };
}

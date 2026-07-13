import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { getProviderEnv } from "@/lib/env-core";
import type { ChallengeEntry, DashboardSnapshot } from "@/lib/types";

export const PASSION_ARCHETYPES = [
  "Building & Coding",
  "Competition",
  "Creative Craft",
  "Community",
  "Family & Legacy",
  "Fandom",
  "Self-Improvement",
  "Exploration",
] as const;

export const SPONSOR_TECHNOLOGIES = [
  "Snowflake",
  "Solana",
  "ElevenLabs",
  "Google AI",
] as const;

export const entryAnalysisSchema = z.object({
  archetype: z.enum(PASSION_ARCHETYPES),
  domain: z.string().min(2).max(80),
  motivation: z.string().min(10).max(220),
  emotionalTone: z.string().min(2).max(160),
  technologies: z.array(z.string().min(1).max(50)).max(12),
  sponsorTechnologies: z.array(z.enum(SPONSOR_TECHNOLOGIES)).max(4),
  groundedSummary: z.string().min(20).max(320),
  confidence: z.number().min(0).max(1),
});

export type EntryAnalysis = z.infer<typeof entryAnalysisSchema>;

function getClient() {
  return new GoogleGenAI({ apiKey: getProviderEnv().GOOGLE_AI_API_KEY });
}

function compactArticle(entry: ChallengeEntry) {
  return {
    articleId: entry.articleId,
    title: entry.title,
    description: entry.description,
    body: entry.bodyExcerpt,
    tags: entry.tags,
    author: entry.authorUsername,
  };
}

export async function analyzeChallengeEntry(
  entry: ChallengeEntry,
): Promise<EntryAnalysis> {
  const env = getProviderEnv();
  const response = await getClient().models.generateContent({
    model: env.GEMINI_MODEL,
    contents: `You are the evidence-bound curator for Passion Broadcast, an observatory of DEV Weekend Challenge: Passion Edition submissions.

Classify only what the supplied public article supports. Do not judge quality, predict winners, invent project capabilities, or infer sensitive traits. If the evidence is weak, choose the closest broad archetype and lower confidence. Technologies must be explicitly named or unmistakably described. Sponsor technologies are limited to Snowflake, Solana, ElevenLabs, and Google AI.

Article:
${JSON.stringify(compactArticle(entry), null, 2)}`,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(entryAnalysisSchema, {
        target: "openapi-3.0",
      }),
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned an empty entry analysis");
  }

  return entryAnalysisSchema.parse(JSON.parse(response.text));
}

const batchAnalysisItemSchema = entryAnalysisSchema.extend({
  articleId: z.number().int().min(1),
});

export type BatchEntryAnalysis = {
  articleId: number;
  analysis: EntryAnalysis;
};

export async function analyzeChallengeEntries(
  entries: readonly ChallengeEntry[],
): Promise<BatchEntryAnalysis[]> {
  if (entries.length === 0) return [];
  if (entries.length > 10) {
    throw new RangeError("Gemini analysis batches are limited to 10 entries");
  }

  const responseSchema = z.object({
    analyses: z.array(batchAnalysisItemSchema).length(entries.length),
  });
  const env = getProviderEnv();
  const response = await getClient().models.generateContent({
    model: env.GEMINI_MODEL,
    contents: `You are the evidence-bound curator for Passion Broadcast, an observatory of DEV Weekend Challenge: Passion Edition submissions.

Analyze every supplied public article exactly once and preserve its articleId. Classify only what the article supports. Do not judge quality, predict winners, invent project capabilities, or infer sensitive traits. If evidence is weak, choose the closest broad archetype and lower confidence. Technologies must be explicitly named or unmistakably described. Sponsor technologies are limited to Snowflake, Solana, ElevenLabs, and Google AI.

Articles:
${JSON.stringify(entries.map(compactArticle), null, 2)}`,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(responseSchema, {
        target: "openapi-3.0",
      }),
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned an empty batch analysis");
  }

  const parsed = responseSchema.parse(JSON.parse(response.text));
  const expectedIds = new Set(entries.map((entry) => entry.articleId));
  const seenIds = new Set<number>();
  const results = parsed.analyses.map(({ articleId, ...analysis }) => {
    if (!expectedIds.has(articleId) || seenIds.has(articleId)) {
      throw new Error("Gemini returned an unexpected or duplicate articleId");
    }
    seenIds.add(articleId);
    return { articleId, analysis };
  });
  if (seenIds.size !== expectedIds.size) {
    throw new Error("Gemini omitted one or more entries from batch analysis");
  }
  return results;
}

const broadcastSchema = z.object({
  title: z.literal("State of Passion"),
  script: z.string().min(180).max(900),
  durationSeconds: z.number().int().min(30).max(75),
});

export type BroadcastScript = z.infer<typeof broadcastSchema>;

export async function generateBroadcastScript(
  snapshot: DashboardSnapshot,
): Promise<BroadcastScript> {
  const env = getProviderEnv();
  const facts = {
    generatedAt: snapshot.generatedAt,
    entryCount: snapshot.metrics.entries,
    builderCount: snapshot.metrics.builders,
    reactionCount: snapshot.metrics.reactions,
    archetypes: snapshot.archetypes.slice(0, 8),
    technologies: snapshot.technologies.slice(0, 8),
    representativeEntries: snapshot.entries.slice(0, 5).map((entry) => ({
      title: entry.title,
      author: entry.authorUsername,
      archetype: entry.archetype,
      summary: entry.groundedSummary,
    })),
  };

  const response = await getClient().models.generateContent({
    model: env.GEMINI_MODEL,
    contents: `Write a concise public-radio bulletin about the current DEV Weekend Challenge: Passion Edition field. Use only the JSON facts below. Be warm, observant, and specific without ranking projects or claiming exhaustive coverage. Mention the source as public DEV submissions. Pronounce DEV as "dev". Write one continuous narration suitable for ElevenLabs, around 45–60 seconds. Do not use markdown, bullets, stage directions, URLs, or invented statistics.

Facts:
${JSON.stringify(facts, null, 2)}`,
    config: {
      temperature: 0.45,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(broadcastSchema, {
        target: "openapi-3.0",
      }),
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned an empty broadcast script");
  }

  return broadcastSchema.parse(JSON.parse(response.text));
}

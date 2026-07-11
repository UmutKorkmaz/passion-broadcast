import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [{ analyzeChallengeEntry }, { synthesizeBroadcast }] =
    await Promise.all([
      import("../src/lib/gemini-core"),
      import("../src/lib/elevenlabs-core"),
    ]);

  const analysis = await analyzeChallengeEntry({
    articleId: 1,
    title: "A tiny coding project built for my community",
    description: "A developer built a weekend tool to help neighbors share skills.",
    bodyExcerpt:
      "I care about open source and local community projects, so I built this TypeScript app during the weekend.",
    url: "https://dev.to/example/test",
    authorName: "Example Builder",
    authorUsername: "example",
    tags: ["weekendchallenge", "typescript"],
    publishedAt: "2026-07-11T05:00:00.000Z",
    positiveReactions: 0,
    commentsCount: 0,
    readingTimeMinutes: 2,
    coverImage: null,
    contentHash: "provider-smoke",
    sourceFetchedAt: new Date().toISOString(),
  });

  const audio = await synthesizeBroadcast(
    "Passion Broadcast provider check complete.",
  );

  if (audio.byteLength < 1_000) {
    throw new Error("ElevenLabs returned unexpectedly small audio");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        geminiArchetype: analysis.archetype,
        elevenLabsBytes: audio.byteLength,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

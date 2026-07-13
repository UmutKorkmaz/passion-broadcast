import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { runIngestion } = await import("../src/lib/ingest-core");
  const result = await runIngestion();
  console.log(
    JSON.stringify(
      {
        ok: result.status !== "PARTIAL" || result.analyzedCount > 0,
        runId: result.runId,
        status: result.status,
        sourceCount: result.sourceCount,
        qualifyingCount: result.qualifyingCount,
        changedCount: result.changedCount,
        analyzedCount: result.analyzedCount,
        failedAnalysisCount: result.failedAnalysisCount,
        broadcastGenerated: result.broadcastGenerated,
        audioGenerated: result.audioGenerated,
        metrics: result.snapshot.metrics,
      },
      null,
      2,
    ),
  );

  if (
    result.changedCount > 0 &&
    (!result.broadcastGenerated || !result.audioGenerated)
  ) {
    throw new Error(
      "New content was found, but its narrated broadcast was not completed.",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

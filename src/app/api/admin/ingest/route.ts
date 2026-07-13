import { timingSafeEqual } from "node:crypto";

import { getIngestSecrets } from "@/lib/env";
import { runIngestion } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function matchesSecret(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isAuthorized(request: Request): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  const candidate = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!candidate) return false;
  const secrets = getIngestSecrets();
  return (
    matchesSecret(candidate, secrets.INGEST_SECRET) ||
    matchesSecret(candidate, secrets.CRON_SECRET)
  );
}

async function handle(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await runIngestion();
    return Response.json({
      runId: result.runId,
      status: result.status,
      sourceCount: result.sourceCount,
      qualifyingCount: result.qualifyingCount,
      changedCount: result.changedCount,
      analyzedCount: result.analyzedCount,
      failedAnalysisCount: result.failedAnalysisCount,
      broadcastGenerated: result.broadcastGenerated,
      audioGenerated: result.audioGenerated,
    });
  } catch {
    return Response.json(
      { error: "Ingestion failed. Check the protected server logs." },
      { status: 500 },
    );
  }
}

export const POST = handle;
export const GET = handle;

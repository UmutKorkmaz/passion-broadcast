import { snowflakeQuery } from "@/lib/snowflake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await snowflakeQuery<{ ENTRY_COUNT: number }>(
      "SELECT COUNT(*) AS ENTRY_COUNT FROM CHALLENGE_ENTRIES",
    );
    return Response.json({
      ok: true,
      snowflake: "connected",
      entries: Number(rows[0]?.ENTRY_COUNT ?? 0),
      checkedAt: new Date().toISOString(),
    });
  } catch {
    return Response.json(
      { ok: false, snowflake: "unavailable", checkedAt: new Date().toISOString() },
      { status: 503 },
    );
  }
}

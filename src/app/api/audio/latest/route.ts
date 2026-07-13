import type { NextRequest } from "next/server";

import { getLatestBroadcastAudio } from "@/lib/dashboard-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BROADCAST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const requestedId = request.nextUrl.searchParams.get("id");
    if (requestedId && !BROADCAST_ID_PATTERN.test(requestedId)) {
      return Response.json(
        { error: "Invalid broadcast ID." },
        { status: 400 },
      );
    }

    const audio = requestedId
      ? await getLatestBroadcastAudio(requestedId)
      : await getLatestBroadcastAudio();
    if (!audio) {
      return Response.json(
        { error: "No generated broadcast is available yet." },
        { status: 404 },
      );
    }

    const body = new ArrayBuffer(audio.bytes.byteLength);
    new Uint8Array(body).set(audio.bytes);

    return new Response(body, {
      headers: {
        "Content-Type": audio.mime,
        "Content-Length": String(audio.bytes.byteLength),
        "Cache-Control": requestedId
          ? "public, max-age=31536000, s-maxage=31536000, immutable"
          : "private, no-store, max-age=0, must-revalidate",
        "Last-Modified": new Date(audio.generatedAt).toUTCString(),
      },
    });
  } catch {
    return Response.json(
      { error: "Broadcast audio is temporarily unavailable." },
      { status: 503 },
    );
  }
}

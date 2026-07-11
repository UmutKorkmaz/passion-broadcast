import { getLatestBroadcastAudio } from "@/lib/dashboard-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const audio = await getLatestBroadcastAudio();
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
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
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

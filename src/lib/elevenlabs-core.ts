import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import { getProviderEnv } from "@/lib/env-core";

export async function synthesizeBroadcast(
  text: string,
): Promise<Uint8Array> {
  const env = getProviderEnv();
  const client = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
  const stream = await client.textToSpeech.convert(env.ELEVENLABS_VOICE_ID, {
    text,
    modelId: env.ELEVENLABS_MODEL_ID,
    outputFormat: "mp3_44100_128",
  });

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VOICE_RACHEL = "21m00Tcm4TlvDq8ikWAM";
const MODEL = "eleven_turbo_v2_5";

type Body = { text: string; voiceId?: string };

export async function POST(req: Request): Promise<Response> {
  const { text, voiceId = VOICE_RACHEL } = (await req.json()) as Body;
  const key = process.env.ELEVENLABS_API_KEY;

  if (!key || !text) {
    // Signal "no engine" — client falls back to Web Speech.
    return new Response(null, { status: 204, headers: { "x-tts-engine": "none" } });
  }

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=3&output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!upstream.ok || !upstream.body) {
    return new Response(null, { status: 204, headers: { "x-tts-engine": "error" } });
  }

  return new Response(upstream.body, {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
      "x-tts-engine": "elevenlabs",
    },
  });
}

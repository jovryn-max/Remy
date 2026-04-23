/**
 * Returns Deepgram connection config for the browser.
 *
 * Day One: returns the raw API key because we're on localhost only. Before
 * we deploy (Move 2) this route must be replaced with a short-lived
 * project-scoped token via Deepgram's Key Management API.
 *
 * Privacy posture:
 *   - mip_opt_out=true  → opt out of Deepgram's Model Improvement Program.
 *                         User audio is not used for training.
 *   - no_delay=false    → default; real-time streaming audio is not retained
 *                         by Deepgram beyond the live session.
 *   - We pass NO tags, NO extra metadata, NO custom labels that could
 *     identify a session upstream.
 *
 * Language:
 *   - detect_language=true lets Deepgram choose from the supported set
 *     (en, es, fr, de, it, pt, nl, ja, ko, zh, hi, ru). The coach's persona
 *     instructs it to respond in whatever language it just heard.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    return Response.json({ available: false });
  }
  return Response.json({
    available: true,
    token: key,
    model: "nova-2-general",
    config: {
      detect_language: true,
      interim_results: true,
      smart_format: true,
      punctuate: true,
      vad_events: true,
      endpointing: 300,
      utterance_end_ms: 1000,
      mip_opt_out: true,
    },
  });
}

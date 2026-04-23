/**
 * Returns Deepgram connection config for the browser.
 *
 * Day One: returns the raw API key because we're on localhost only. Before
 * we deploy (Move 2) this route must be replaced with a short-lived
 * project-scoped token via Deepgram's Key Management API.
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
    model: "nova-2",
    config: {
      interim_results: true,
      smart_format: true,
      punctuate: true,
      vad_events: true,
      endpointing: 300,
      utterance_end_ms: 1000,
      language: "en-US",
    },
  });
}

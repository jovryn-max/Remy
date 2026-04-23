import Anthropic from "@anthropic-ai/sdk";
import { OBSERVER_MODEL } from "@/lib/coach/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OBSERVER_SYSTEM = `You are a quiet observer for a health coach. A camera just captured one frame of a person sitting in a chair in a small private suite. You see them. The user never sees this note — it's written privately to the coach so the coach can be more attentive.

Rules:
- One or two short sentences. Max 25 words.
- Plain, human words. No clinical jargon. No adjectives like "patient" or "subject" — say "they" or "this person".
- Describe what you notice about their presence right now: breathing, shoulders, whether they look tired, worn, relaxed, tight. Posture. Affect.
- Never describe appearance in ways that could shame (weight, race, clothing quality, dental, skin conditions).
- Never guess identity, age, gender beyond what they'd clearly describe themselves as.
- Never invent things you can't actually see (pulse rate, BP, temperature).
- If the image is unclear, empty, or the person isn't visible, return: "Can't tell yet."

Respond ONLY with the note itself. No labels, no preamble.`;

type Body = {
  /** Data URL (image/jpeg;base64,...) from the canvas capture. */
  image: string;
};

const FALLBACK = "Can't tell yet.";

export async function POST(req: Request): Promise<Response> {
  const { image } = (await req.json()) as Body;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !image) {
    return Response.json({ note: FALLBACK, engine: "fallback" });
  }
  const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) {
    return Response.json({ note: FALLBACK, engine: "fallback" });
  }
  const [, mediaType, data] = match;

  const anthropic = new Anthropic({ apiKey: key });
  try {
    const resp = await anthropic.messages.create({
      model: OBSERVER_MODEL,
      max_tokens: 80,
      system: OBSERVER_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/webp",
                data,
              },
            },
            { type: "text", text: "Write the note." },
          ],
        },
      ],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return Response.json({ note: text || FALLBACK, engine: "claude" });
  } catch (err) {
    console.error("[observe] error:", err);
    return Response.json({ note: FALLBACK, engine: "fallback" });
  }
}

import Anthropic from "@anthropic-ai/sdk";
import { COACH_MODEL } from "@/lib/coach/models";
import { anthropicPrivacyHeaders, logSafe } from "@/lib/privacy/policy";
import type { UrgencyLevel } from "@/lib/coach/urgency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Generates a one-paragraph handoff letter in the user's own voice — the
 * thing they hand across the reception counter at a clinic, so they don't
 * have to start from zero. 5th-grade reading level. First person. Plain.
 *
 * The letter is derived from the current session's transcript + vitals;
 * nothing persists. We pass only what's needed to write the paragraph.
 */

const LETTER_SYSTEM = `You are ghost-writing a one-paragraph letter for the person who just sat in the Concierge30 chair. They will take this piece of paper to a clinic. They may have never seen a doctor before. The letter is in THEIR first-person voice — not the coach's.

Rules:
- First person. "I," "my." Never "the patient," never "they."
- 5th-grade reading level. Plain words. No medical jargon.
- 3 to 5 short sentences. One paragraph.
- Include: the one or two vital readings that matter, one sentence about how they said they were feeling, and one sentence saying what they'd like help with.
- No diagnosis. No medication names. No treatment recommendations. Those are the clinician's job, not the letter's.
- If the urgency flag is urgent_911, say clearly: "I came from the Concierge30 chair. They said my pressure is high enough to be seen today."
- Match the language they spoke in. If they spoke Spanish, the letter is in Spanish.
- No signature line. No "Dear Doctor." Just the paragraph itself.

Respond with ONLY the paragraph. No quotation marks, no labels.`;

type Body = {
  urgency: UrgencyLevel;
  vitalsSummary?: string;
  feelingSummary?: string;
  turns: { role: "user" | "assistant"; content: string }[];
};

function scripted(body: Body): string {
  const bp = /BP\s+(\d{2,3}\/\d{2,3})/.exec(body.vitalsSummary || "")?.[1];
  const feeling = body.feelingSummary?.trim() || "tired";
  if (body.urgency === "urgent_911") {
    return `I came from the Concierge30 chair at the Walmart. They said my blood pressure is ${bp || "very high"} and I need to be seen today. I've been feeling ${feeling}. I'd like help figuring out what to do next.`;
  }
  if (body.urgency === "advise_same_day_care" || body.urgency === "advise_followup") {
    return `I came from the Concierge30 chair. They said my blood pressure was ${bp || "a little high"}. I've been feeling ${feeling}. I haven't seen a doctor in a while and I'd like to know what to do.`;
  }
  return `I just came from the Concierge30 chair. Most things looked steady. I've been feeling ${feeling}. I'm here because I'd like to start checking in with someone regularly.`;
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as Body;
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return Response.json({ letter: scripted(body), engine: "scripted" });
  }

  const anthropic = new Anthropic({ apiKey: key, defaultHeaders: anthropicPrivacyHeaders() });

  try {
    const userMsg = [
      body.feelingSummary ? `They said they felt: ${body.feelingSummary}` : "",
      body.vitalsSummary ? `Vitals from the chair: ${body.vitalsSummary}` : "",
      `Urgency flag: ${body.urgency}`,
      body.turns.length > 0
        ? `They said, in their own words during the visit: ${body.turns
            .filter((t) => t.role === "user")
            .map((t) => t.content)
            .join(" | ")}`
        : "",
      "Write the letter.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const resp = await anthropic.messages.create({
      model: COACH_MODEL,
      max_tokens: 300,
      system: LETTER_SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    });

    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    return Response.json({ letter: text || scripted(body), engine: "claude" });
  } catch (err) {
    logSafe("[handoff] fell back", err);
    return Response.json({ letter: scripted(body), engine: "scripted" });
  }
}

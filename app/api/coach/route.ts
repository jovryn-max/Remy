import Anthropic from "@anthropic-ai/sdk";
import { COACH_SYSTEM, cameraContext } from "@/lib/coach/persona";
import { COACH_MODEL } from "@/lib/coach/models";
import { scriptedLine, type VisitPhase } from "@/lib/coach/fallbackScripts";
import type { UrgencyLevel } from "@/lib/coach/urgency";
import type { Scenario } from "@/lib/hardware/interfaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Message = { role: "user" | "assistant"; content: string };

type Body = {
  phase: VisitPhase;
  scenario: Scenario;
  urgency: UrgencyLevel;
  messages: Message[];
  cameraNotes?: string[];
  vitalsSummary?: string;
  feelingSummary?: string;
};

function buildSystem(body: Body): string {
  const bits: string[] = [COACH_SYSTEM];
  if (body.feelingSummary) {
    bits.push(`\nTHE PERSON JUST TOLD YOU HOW THEY'RE FEELING: ${body.feelingSummary}`);
  }
  if (body.vitalsSummary) {
    bits.push(`\nVITALS FROM THE CHAIR: ${body.vitalsSummary}`);
  }
  if (body.urgency !== "none") {
    bits.push(`\nURGENCY FLAG: ${body.urgency}. The deterministic module has already assessed this — honor it.`);
  }
  bits.push(cameraContext(body.cameraNotes));
  bits.push(`\nCURRENT PHASE: ${body.phase}`);
  return bits.join("");
}

function encodeChunk(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as Body;
  const key = process.env.ANTHROPIC_API_KEY;

  // Fallback: no key → scripted response.
  if (!key) {
    const line = scriptedLine(body.phase, body.scenario, body.urgency);
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // Token-sized slices with small delays so the client experience
        // (streaming caption + sentence-boundary TTS) still works.
        const words = line.split(/(\s+)/);
        for (const w of words) {
          controller.enqueue(encodeChunk(w));
          await new Promise((r) => setTimeout(r, 28));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "content-type": "text/plain; charset=utf-8", "x-coach-engine": "scripted" },
    });
  }

  const anthropic = new Anthropic({ apiKey: key });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const response = await anthropic.messages.stream({
          model: COACH_MODEL,
          max_tokens: 400,
          system: buildSystem(body),
          messages:
            body.messages.length > 0
              ? body.messages
              : [{ role: "user", content: phasePrompt(body) }],
        });

        for await (const event of response) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encodeChunk(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        // Graceful fallback mid-stream: emit the scripted line and close.
        const line = scriptedLine(body.phase, body.scenario, body.urgency);
        controller.enqueue(encodeChunk(line));
        controller.close();
        console.error("[coach] stream error, served scripted fallback:", err);
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "x-coach-engine": "claude" },
  });
}

/**
 * Used when the caller doesn't supply a messages history — each phase needs
 * a nudge to get the coach speaking in-character.
 */
function phasePrompt(body: Body): string {
  switch (body.phase) {
    case "welcome":
      return "The person just sat down. Greet them warmly. Let them know the chair will take a few readings and they don't need to do anything. 2–3 sentences.";
    case "feeling":
      return "Ask how they're feeling today — before any numbers. One or two sentences.";
    case "acknowledge":
      return "Acknowledge what they said in one warm sentence, then let them know the chair is going to take a few readings now.";
    case "interpret":
      if (body.urgency === "urgent_911") {
        return "Their BP is in hypertensive crisis. Tell them directly but calmly: their pressure is high enough that they need help right now. Offer to help them get to the clinic across from the suite.";
      }
      return "Give the first honest interpretation of their vitals, connecting it to how they said they were feeling. No list. No clinical categories. 3 short sentences.";
    case "explore-1":
      return "Ask one layer-deeper question that follows naturally from what they said. Not a list of questions — just one real one.";
    case "explore-2":
      return "Respond to what they just said with genuine warmth. Then ask one more layer-deeper question.";
    case "explore-3":
      return "Based on what they've shared, propose ONE specific small next step — dignified, achievable, theirs. Not a list. Not homework.";
    case "confirm":
      return "If they agreed, confirm warmly. If they pushed back, take it and adjust. If they declined, don't push.";
    case "takeaway":
      return "Tell them you'll print a card for them to take home. Mention it's optional and has no name on it. 2 short sentences.";
    case "goodbye":
      return "Say goodbye warmly. 1–2 sentences. End with 'come back anytime.'";
    default:
      return "Say something warm and brief.";
  }
}

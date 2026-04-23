import type { Scenario } from "@/lib/hardware/interfaces";
import type { UrgencyLevel } from "./urgency";

/**
 * Scripted responses used when ANTHROPIC_API_KEY is missing. Keeps the
 * end-to-end flow demonstrable without a paid key. These are intentionally
 * short and persona-consistent, not a replacement for the real model.
 */

export type VisitPhase =
  | "welcome"
  | "feeling"
  | "acknowledge"
  | "interpret"
  | "explore-1"
  | "explore-2"
  | "explore-3"
  | "confirm"
  | "takeaway"
  | "goodbye";

export function scriptedLine(
  phase: VisitPhase,
  scenario: Scenario,
  urgency: UrgencyLevel,
): string {
  if (phase === "welcome") {
    return "Welcome. Take a moment to settle in. There's nothing you need to do yet. In a minute the chair will take a few readings on its own — you don't need to lift a finger.";
  }
  if (phase === "feeling") {
    return "Before we look at any numbers, I want to ask you something. How are you feeling today?";
  }
  if (phase === "acknowledge") {
    if (scenario === "urgent") return "Okay. Thanks for telling me. Let's see what the chair picks up.";
    return "Alright. Let me see what the chair picks up.";
  }
  if (phase === "interpret") {
    if (urgency === "urgent_911") {
      return "Okay — I want to be straight with you. Your pressure is high enough right now that I'd like us to get you help today. Not scary, just today. There's a clinic right across from us. I can show you the way in a second.";
    }
    if (urgency === "advise_same_day_care") {
      return "So here's what I'm seeing. Your pressure is running high today. Not an emergency, but high enough that I'd feel better if someone looked at you soon — today if you can.";
    }
    if (urgency === "advise_followup") {
      return "Okay. Your numbers are a little high today. Nothing scary, but worth checking in with someone this month. Your pulse is fine. You feel about like the numbers look.";
    }
    return "Alright. Your numbers look steady today. Pressure's in a good range. Pulse easy. The chair didn't find anything to worry about.";
  }
  if (phase === "explore-1") {
    return "Can I ask — when was the last time someone sat down with you like this?";
  }
  if (phase === "explore-2") {
    return "Yeah. That makes sense. What's been hardest lately?";
  }
  if (phase === "explore-3") {
    if (urgency === "urgent_911" || urgency === "advise_same_day_care") {
      return "Here's what I'd do right now: walk across to the clinic. Tell them the chair said 180 and they'll take you back. That's it. That's the whole next step.";
    }
    if (urgency === "advise_followup") {
      return "One small thing, if you want. Tomorrow morning, before coffee, just sit still for a minute and notice your breath. Not fix it, just notice. That's enough.";
    }
    return "One small thing, if you want. Tomorrow, before anything else, take one real breath. The kind where you feel your shoulders drop. That's it.";
  }
  if (phase === "confirm") {
    return "Yeah. That's plenty.";
  }
  if (phase === "takeaway") {
    return "I'll print a little card for you to take along. Has your numbers and that one small thing. No name on it, nothing to sign.";
  }
  if (phase === "goodbye") {
    return "Take care of yourself. Come back anytime.";
  }
  return "";
}

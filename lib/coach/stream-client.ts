"use client";

import type { UrgencyLevel } from "./urgency";
import type { Scenario } from "@/lib/hardware/interfaces";

export type CoachRequest = {
  phase: string;
  scenario: Scenario;
  urgency: UrgencyLevel;
  messages: { role: "user" | "assistant"; content: string }[];
  cameraNotes?: string[];
  vitalsSummary?: string;
  feelingSummary?: string;
  isolationSignal?: { score: number; signals: string[] };
  priorVisit?: {
    bp?: { systolic: number; diastolic: number; pulse?: number };
    weight?: number;
    waist?: number;
    feeling?: string;
    nextStep?: string;
    urgency?: string;
    mentions?: string[];
    lang?: string;
  };
  wearableNote?: string;
  crisisLevel?: "none" | "standby" | "acute" | "imminent";
  crisisCategories?: string[];
};

/**
 * Posts to /api/coach and returns an async getNext() that yields text chunks.
 * When the stream is exhausted, getNext() resolves to null.
 */
export async function streamCoach(body: CoachRequest): Promise<{
  getNext: () => Promise<string | null>;
  engine: string;
}> {
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const engine = res.headers.get("x-coach-engine") || "unknown";

  if (!res.ok || !res.body) {
    return {
      engine,
      getNext: async () => null,
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  return {
    engine,
    getNext: async () => {
      const { value, done } = await reader.read();
      if (done) return null;
      return decoder.decode(value, { stream: true });
    },
  };
}

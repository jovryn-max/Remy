/**
 * Crisis resources — public hotlines.
 *
 * These are public services that the user calls themselves. We do not loop
 * anyone in on our side. The user's call is between the user and that
 * service. We never observe, log, or persist the call.
 *
 * If you fork this for a country other than the US, replace the numbers but
 * keep the structure: short list, named clearly, with text-message options
 * because some users can't or won't speak.
 */

import type { CrisisCategory } from "./crisis";

export type Resource = {
  id: string;
  name: string;
  /** What the coach calls it in conversation (warm, plain). */
  shortName: string;
  call?: string;
  text?: string;
  hours: "24/7" | string;
  languages: string[];
  /** When this resource is most relevant. */
  forCategories: CrisisCategory[];
  /** One-sentence description, fifth-grade reading level. */
  blurb: string;
};

export const RESOURCES: Resource[] = [
  {
    id: "988",
    name: "988 Suicide & Crisis Lifeline",
    shortName: "988",
    call: "988",
    text: "988",
    hours: "24/7",
    languages: ["English", "Spanish"],
    forCategories: ["suicidality", "self_harm", "imminent_danger"],
    blurb: "Real people, day or night. You can call or text 988.",
  },
  {
    id: "veterans",
    name: "Veterans Crisis Line",
    shortName: "Veterans Crisis Line",
    call: "988", // press 1
    text: "838255",
    hours: "24/7",
    languages: ["English"],
    forCategories: ["suicidality", "self_harm"],
    blurb: "If you served. Call 988 and press 1, or text 838255.",
  },
  {
    id: "ndvh",
    name: "National Domestic Violence Hotline",
    shortName: "Domestic Violence Hotline",
    call: "1-800-799-7233",
    text: "88788", // text START
    hours: "24/7",
    languages: ["English", "Spanish", "200+ via interpreters"],
    forCategories: ["ipv"],
    blurb: "Day or night. They listen. You don't have to leave to call. Text START to 88788 if calling isn't safe.",
  },
  {
    id: "rainn",
    name: "RAINN — sexual assault hotline",
    shortName: "RAINN",
    call: "1-800-656-4673",
    hours: "24/7",
    languages: ["English", "Spanish"],
    forCategories: ["ipv"],
    blurb: "If anyone has hurt you in that way — they listen, they don't push.",
  },
  {
    id: "samhsa",
    name: "SAMHSA — substance use & mental health",
    shortName: "SAMHSA helpline",
    call: "1-800-662-4357",
    hours: "24/7",
    languages: ["English", "Spanish"],
    forCategories: ["substance"],
    blurb: "Free. Day or night. They help find treatment near you, no insurance needed.",
  },
  {
    id: "trevor",
    name: "Trevor Project",
    shortName: "Trevor Project",
    call: "1-866-488-7386",
    text: "678678", // text START
    hours: "24/7",
    languages: ["English"],
    forCategories: ["suicidality"],
    blurb: "If you're young and LGBTQ. They listen. Text START to 678678.",
  },
  {
    id: "childhelp",
    name: "Childhelp National Child Abuse Hotline",
    shortName: "Childhelp",
    call: "1-800-422-4453",
    text: "1-800-422-4453", // also text-able
    hours: "24/7",
    languages: ["English", "Spanish"],
    forCategories: ["child_safety"],
    blurb: "About a child you're worried about — yours or anyone's.",
  },
  {
    id: "poison",
    name: "Poison Control",
    shortName: "Poison Control",
    call: "1-800-222-1222",
    hours: "24/7",
    languages: ["English", "Spanish"],
    forCategories: ["substance"],
    blurb: "If you took too much of anything — fast, free, no name needed.",
  },
  {
    id: "911",
    name: "911",
    shortName: "911",
    call: "911",
    hours: "24/7",
    languages: ["English", "Spanish"],
    forCategories: ["imminent_danger"],
    blurb: "If you're in danger right now.",
  },
];

/**
 * Pick the best three (or fewer) resources for the categories detected.
 * The coach is told elsewhere never to dump more than three things; this
 * enforces it here as well.
 */
export function pickResources(categories: CrisisCategory[], imminent: boolean): Resource[] {
  if (categories.length === 0) return [];
  const ranked: { r: Resource; score: number }[] = [];
  for (const r of RESOURCES) {
    let score = 0;
    for (const c of categories) {
      if (r.forCategories.includes(c)) score += 2;
    }
    if (imminent && r.forCategories.includes("imminent_danger")) score += 5;
    if (score > 0) ranked.push({ r, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  // Always include 988 if any suicidality / self-harm category was present.
  const out: Resource[] = [];
  const seen = new Set<string>();
  for (const { r } of ranked) {
    if (out.length >= 3) break;
    if (!seen.has(r.id)) {
      out.push(r);
      seen.add(r.id);
    }
  }
  return out;
}

/** A short, plain resource summary inlined into the coach's system prompt. */
export function resourceContext(resources: Resource[], imminent: boolean): string {
  if (resources.length === 0) return "";
  const lines = resources.map((r) => `- ${r.shortName}${r.call ? ` (${r.call})` : ""}${r.text ? ` text ${r.text}` : ""}: ${r.blurb}`).join("\n");
  return `\n\nCRISIS RESOURCES (these are on screen for the user — you can refer to them naturally; never read all three out loud, pick the one that fits, mention it in one short sentence; the user calls themselves, you do not "alert" anyone):\n${lines}${
    imminent
      ? `\n\nIMMINENT POSTURE: the person may be in physical danger right now. Stay with them. Speak slowly. Ask once, calmly: "Is it okay if we call 911 from the chair right now?" Wait for their yes. Do not pretend the call is happening; do not announce a call without their explicit yes. If they say no, stay with them and trust them; offer 988 instead.`
      : ""
  }`;
}

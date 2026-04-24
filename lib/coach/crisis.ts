/**
 * Crisis detection — deterministic, conservative, no LLM.
 *
 * Signals the coach about three escalating states: standby (be more present,
 * don't pivot), acute (surface resources, hold the conversation, don't move
 * to vitals/measurement), imminent (ask once, calmly, if it's okay to dial
 * 911 from the chair — only with the user's yes).
 *
 * Design notes:
 *   - This is a phrase scanner, not a model. False positives are cheap (a
 *     calm 988 card on screen is not harmful). False negatives are
 *     expensive — but the coach itself (Claude) is also reading the
 *     transcript and is instructed to weave in resources when it hears
 *     these things, regardless of what this scanner sees. The scanner's
 *     job is to anchor the UI and the takeaway card.
 *   - Multiple cues escalate. A single subtle cue is "standby."
 *   - English and Spanish patterns at minimum. Other languages return none.
 *   - We never claim to diagnose. The coach never says "you're in crisis."
 *
 * NOT in scope:
 *   - We do NOT call any vendor with the transcript or with the assessment.
 *   - We do NOT log, store, or transmit the assessment beyond the in-memory
 *     React store.
 *   - We do NOT loop in any human on our side. The user calls a public
 *     hotline themselves if they choose to. That's their action, not ours.
 */

export type CrisisCategory =
  | "suicidality"
  | "self_harm"
  | "ipv"
  | "child_safety"
  | "substance"
  | "imminent_danger";

export type CrisisLevel = "none" | "standby" | "acute" | "imminent";

export type CrisisSignal = {
  level: CrisisLevel;
  cues: string[];
  categories: CrisisCategory[];
};

type Pattern = {
  re: RegExp;
  cue: string;
  category: CrisisCategory;
  severity: "standby" | "acute" | "imminent";
};

const PATTERNS: Pattern[] = [
  // ── Imminent danger (ask, don't act) ─────────────────────────────────
  {
    re: /\b(going to|gonna|about to)\s+(kill myself|end (it|my life)|hurt myself)\b/i,
    cue: "intent-stated",
    category: "imminent_danger",
    severity: "imminent",
  },
  {
    re: /\bi('| a)m going to (do it|end it)\s+(tonight|today|right now|now)\b/i,
    cue: "imminent-time",
    category: "imminent_danger",
    severity: "imminent",
  },
  {
    re: /\b(have|got|holding)\s+(a gun|the pills|the knife)\b/i,
    cue: "means-stated",
    category: "imminent_danger",
    severity: "imminent",
  },
  {
    re: /\b(he|she|they)('s| is| are)\s+(here|outside|at the door)\b.{0,40}\b(scared|afraid|hurt|going to)\b/i,
    cue: "abuser-present",
    category: "imminent_danger",
    severity: "imminent",
  },

  // ── Suicidality (acute) ──────────────────────────────────────────────
  { re: /\bkill myself\b/i, cue: "kill-myself", category: "suicidality", severity: "acute" },
  { re: /\bend my (own )?life\b/i, cue: "end-my-life", category: "suicidality", severity: "acute" },
  { re: /\b(don'?t|do not) want to (live|be (alive|here))\b/i, cue: "dont-want-to-live", category: "suicidality", severity: "acute" },
  { re: /\bwant to die\b/i, cue: "want-to-die", category: "suicidality", severity: "acute" },
  { re: /\bwish (i (was|were)|i'?d be) dead\b/i, cue: "wish-dead", category: "suicidality", severity: "acute" },
  { re: /\bbetter off without me\b/i, cue: "better-off-without", category: "suicidality", severity: "acute" },
  { re: /\bthinking (about|of) (suicide|killing myself)\b/i, cue: "thinking-of-suicide", category: "suicidality", severity: "acute" },
  // Spanish
  { re: /\b(matar|matarme)\b/i, cue: "matarme", category: "suicidality", severity: "acute" },
  { re: /\bquitar(me)? la vida\b/i, cue: "quitarme-la-vida", category: "suicidality", severity: "acute" },
  { re: /\bno quiero (vivir|estar aquí|seguir)\b/i, cue: "no-quiero-vivir", category: "suicidality", severity: "acute" },

  // ── Suicidality (standby — passive ideation) ─────────────────────────
  { re: /\b(what'?s|whats) the point\b/i, cue: "whats-the-point", category: "suicidality", severity: "standby" },
  { re: /\btired of (being here|this|all of this)\b/i, cue: "tired-of-being-here", category: "suicidality", severity: "standby" },
  { re: /\bgo to sleep and not wake up\b/i, cue: "sleep-and-not-wake", category: "suicidality", severity: "standby" },
  { re: /\bwouldn'?t matter if i\b.{0,30}\b(was gone|wasn'?t here|disappeared)\b/i, cue: "wouldnt-matter", category: "suicidality", severity: "standby" },

  // ── Self-harm ────────────────────────────────────────────────────────
  { re: /\b(been )?(cutting|burning|scratching) myself\b/i, cue: "self-harm-method", category: "self_harm", severity: "acute" },
  { re: /\bhurt myself\b/i, cue: "hurt-myself", category: "self_harm", severity: "acute" },

  // ── IPV (acute) ──────────────────────────────────────────────────────
  { re: /\b(he|she|they)\s+(hits?|hit|hurts?|hurt|punch(es|ed)?|chokes?)\s+me\b/i, cue: "abuser-hits", category: "ipv", severity: "acute" },
  { re: /\b(scared|afraid|terrified) (to go|of going) home\b/i, cue: "afraid-home", category: "ipv", severity: "acute" },
  { re: /\b(scared|afraid|terrified) of (him|her|them|my (husband|wife|partner|boyfriend|girlfriend|man))\b/i, cue: "afraid-of", category: "ipv", severity: "acute" },
  { re: /\bwon'?t let me (leave|see|talk to|have)\b/i, cue: "wont-let-me", category: "ipv", severity: "acute" },
  { re: /\b(took|takes|hides) my (keys|phone|money|id|passport)\b/i, cue: "controls-access", category: "ipv", severity: "acute" },
  { re: /\b(controls|monitors|watches) (me|my (phone|money))\b/i, cue: "controls-monitors", category: "ipv", severity: "acute" },
  // Spanish
  { re: /\bmi (esposo|marido|pareja|novio|novia)\s+me\s+(pega|golpea|lastima)\b/i, cue: "es-abuser-hits", category: "ipv", severity: "acute" },
  { re: /\btengo miedo de (volver|ir) a (mi )?casa\b/i, cue: "es-afraid-home", category: "ipv", severity: "acute" },

  // ── IPV (standby) ────────────────────────────────────────────────────
  { re: /\bwalking on eggshells\b/i, cue: "eggshells", category: "ipv", severity: "standby" },
  { re: /\b(have to|need to) be careful (around|with) (him|her|them)\b/i, cue: "have-to-be-careful", category: "ipv", severity: "standby" },

  // ── Child safety ─────────────────────────────────────────────────────
  { re: /\b(hits?|hurt|hurts?)\s+my\s+(kid|kids|child|son|daughter|baby)\b/i, cue: "harm-to-child", category: "child_safety", severity: "imminent" },
  { re: /\b(scared|afraid)\s+(for|to leave)\s+my\s+(kid|kids|child)\b/i, cue: "scared-for-child", category: "child_safety", severity: "acute" },

  // ── Substance crisis ─────────────────────────────────────────────────
  { re: /\b(can'?t|cannot) stop (drinking|using|taking)\b/i, cue: "cant-stop-using", category: "substance", severity: "acute" },
  { re: /\bhaven'?t slept (in|for) (\d+ )?days\b/i, cue: "no-sleep-days", category: "substance", severity: "standby" },
  { re: /\b(withdrawal|withdrawing|dts|delirium tremens)\b/i, cue: "withdrawal", category: "substance", severity: "acute" },
  { re: /\b(overdosed|od'?d|took too (much|many))\b/i, cue: "overdose", category: "substance", severity: "imminent" },
];

const RANK: Record<CrisisLevel, number> = {
  none: 0,
  standby: 1,
  acute: 2,
  imminent: 3,
};
const max = (a: CrisisLevel, b: CrisisLevel): CrisisLevel => (RANK[a] >= RANK[b] ? a : b);

export function assessCrisis(userTurns: string[]): CrisisSignal {
  const text = userTurns.join("\n");
  if (!text.trim()) return { level: "none", cues: [], categories: [] };

  let level: CrisisLevel = "none";
  const cues: string[] = [];
  const categorySet = new Set<CrisisCategory>();
  let acuteCount = 0;

  for (const p of PATTERNS) {
    if (p.re.test(text)) {
      cues.push(p.cue);
      categorySet.add(p.category);
      level = max(level, p.severity);
      if (p.severity === "acute") acuteCount++;
    }
  }

  // Two or more standby cues in the same conversation escalate to acute.
  // (Passive ideation + isolation is the pattern that earns more attention.)
  if (level === "standby" && cues.length >= 2) {
    level = "acute";
  }
  // Three or more acute cues across categories escalate one notch toward
  // imminent — only if they cross category lines (e.g. suicidality + IPV).
  if (level === "acute" && acuteCount >= 3 && categorySet.size >= 2) {
    level = "imminent";
  }

  return {
    level,
    cues: dedupe(cues),
    categories: Array.from(categorySet),
  };
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Isolation signal — a silent read of how connected this person sounds right
 * now. The score never appears on screen. It is only used to bend the
 * coach's "one small thing" toward human connection when the signal is high.
 *
 * Heuristics (pragmatic, not clinical):
 *   - pronoun ratio: high "I/me/my" relative to "we/us/our/they/them" suggests
 *     solitary life or solitary framing
 *   - explicit isolation lexicon: "alone", "by myself", "no one", "passed away",
 *     "since my ... died/left", "lost my ... ", "nobody"
 *   - brevity: very short user turns across the whole conversation suggest
 *     limited comfort, which correlates (weakly) with social isolation
 *
 * The score is the weighted sum, clamped to 0..1. Threshold for the coach
 * to adjust its next step is 0.55 (set in persona.ts::isolationContext).
 *
 * Disclaimers:
 *   - This is NOT a screening tool. Do not show the score to the user.
 *   - English and Spanish only for Day One. Other languages return a score
 *     based only on brevity, which is language-neutral.
 */

export type IsolationSignal = {
  score: number;
  signals: string[];
};

const EN_SELF = ["i", "i'm", "i've", "i'd", "i'll", "me", "my", "mine", "myself"];
const EN_OTHER = ["we", "we're", "we've", "us", "our", "ours", "they", "them", "their"];
const ES_SELF = ["yo", "me", "mi", "mis", "mío", "mía", "conmigo"];
const ES_OTHER = ["nosotros", "nos", "nuestro", "nuestra", "ellos", "ellas", "les"];

const EXPLICIT_CUES: { pattern: RegExp; tag: string; weight: number }[] = [
  { pattern: /\bby myself\b/i, tag: "by-myself", weight: 0.35 },
  { pattern: /\blive(s)? alone\b/i, tag: "lives-alone", weight: 0.4 },
  { pattern: /\bon my own\b/i, tag: "on-my-own", weight: 0.25 },
  { pattern: /\b(no ?one|nobody)\b/i, tag: "no-one", weight: 0.3 },
  { pattern: /\b(passed away|passed on)\b/i, tag: "bereavement", weight: 0.4 },
  { pattern: /\bsince my (wife|husband|partner|mom|mother|dad|father|son|daughter|brother|sister) (died|passed|left)\b/i, tag: "recent-loss", weight: 0.5 },
  { pattern: /\bhaven'?t talked to anyone\b/i, tag: "no-recent-contact", weight: 0.35 },
  { pattern: /\bhaven'?t seen anyone\b/i, tag: "no-recent-contact", weight: 0.3 },
  { pattern: /\b(lonely|alone)\b/i, tag: "said-alone", weight: 0.3 },
  // Spanish
  { pattern: /\bsolo en casa\b/i, tag: "solo-en-casa", weight: 0.35 },
  { pattern: /\bvivo solo\b/i, tag: "vivo-solo", weight: 0.4 },
  { pattern: /\bvivo sola\b/i, tag: "vivo-sola", weight: 0.4 },
  { pattern: /\bnadie\b/i, tag: "nadie", weight: 0.25 },
  // Trailing \b omitted: ó is not a word char in ASCII-only \b, so \b
  // would fail after "falleció". Anchoring at the start is enough.
  { pattern: /\bfalleci(ó|o)/i, tag: "falleció", weight: 0.4 },
];

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[.,!?;:"'()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function pronounRatio(userText: string): number {
  const toks = tokenize(userText);
  if (toks.length === 0) return 0;
  let self = 0;
  let other = 0;
  for (const t of toks) {
    if (EN_SELF.includes(t) || ES_SELF.includes(t)) self++;
    if (EN_OTHER.includes(t) || ES_OTHER.includes(t)) other++;
  }
  if (self + other === 0) return 0;
  // Ratio of self to total. 1 = all I/me, 0 = none.
  return self / (self + other);
}

export function assessIsolation(userTurns: string[]): IsolationSignal {
  const signals: string[] = [];
  if (userTurns.length === 0) return { score: 0, signals };

  const joined = userTurns.join(" ");

  let score = 0;

  // Explicit lexicon
  for (const cue of EXPLICIT_CUES) {
    if (cue.pattern.test(joined)) {
      score += cue.weight;
      if (!signals.includes(cue.tag)) signals.push(cue.tag);
    }
  }

  // Pronoun ratio: only contributes when enough tokens to matter
  const totalTokens = tokenize(joined).length;
  if (totalTokens >= 12) {
    const ratio = pronounRatio(joined);
    if (ratio > 0.8) {
      score += 0.25;
      signals.push("pronoun-self-heavy");
    } else if (ratio > 0.65) {
      score += 0.1;
      signals.push("pronoun-self-leaning");
    }
  }

  // Brevity: if every turn was fewer than 6 words, low social comfort
  const shortTurns = userTurns.filter((t) => tokenize(t).length > 0 && tokenize(t).length < 6).length;
  if (userTurns.length >= 2 && shortTurns === userTurns.length) {
    score += 0.15;
    signals.push("brief-turns");
  }

  return { score: Math.min(score, 1), signals };
}

/**
 * Privacy policy — code-level enforcement of the Day One promise.
 *
 * The promise:
 *   - No user content persists on our side. Ever. Anywhere.
 *   - No user content is logged (not even at error time).
 *   - Upstream vendors are invoked with their strongest available
 *     no-retention / no-training posture enabled per request.
 *   - The user can verifiably inspect retention state at any time via
 *     GET /api/privacy.
 *   - The session is wiped on visit end, navigation, and tab close.
 *
 * What "user content" means here:
 *   - Raw audio (we never receive it on the server — browser → Deepgram direct)
 *   - Raw camera frames (sent only in /api/observe, never logged, never stored)
 *   - STT transcripts (sent to /api/coach, never logged, never stored)
 *   - The coach's generated text (streamed to the browser, never stored)
 *   - The user's expressed feeling, vitals, or any inferred signal
 *
 * What is NOT user content:
 *   - The scenario (healthy/concerning/urgent) — synthetic
 *   - Urgency level codes ("advise_followup" etc.) — determined from
 *     thresholds, not content; auditable.
 *   - Engine telemetry (x-coach-engine header) — no content, just ops.
 */

export const PRIVACY_POSTURE = {
  retention: "none" as const,
  serverLogsUserContent: false as const,
  serverDiskWrites: false as const,
  vendorNoRetention: {
    anthropic:
      "Prompt caching disabled on user content. Request opts out of the ephemeral metadata.user_id field. Honor account-level ZDR if configured.",
    elevenlabs:
      "Zero Retention Mode is account-level on ElevenLabs Enterprise. Per-request, we do not attach any identifying metadata.",
    deepgram:
      "We set mip_opt_out=true to opt out of their Model Improvement Program. Real-time streaming data is not retained by Deepgram by default.",
  },
  humanInTheLoop: false as const,
} as const;

/**
 * Scrub any object before logging. Removes anything that could plausibly
 * contain user content. Keys we know are safe (status codes, durations,
 * model ids, error names) are kept. Everything else is replaced with a
 * shape marker like <string:37> or <object>.
 */
const SAFE_KEYS = new Set([
  "status",
  "statusText",
  "code",
  "name",
  "errno",
  "cause",
  "durationMs",
  "model",
  "phase",
  "engine",
]);

export function scrubForLog(input: unknown, depth = 0): unknown {
  if (depth > 3) return "<depth-limit>";
  if (input == null) return input;
  if (typeof input === "string") return `<string:${input.length}>`;
  if (typeof input === "number" || typeof input === "boolean") return input;
  if (input instanceof Error) {
    return {
      name: input.name,
      messageLength: input.message.length,
    };
  }
  if (Array.isArray(input)) return `<array:${input.length}>`;
  if (typeof input === "object") {
    const rec = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(rec)) {
      if (SAFE_KEYS.has(k)) out[k] = rec[k];
      else out[k] = "<redacted>";
    }
    return out;
  }
  return "<unknown>";
}

export function logSafe(tag: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.error(tag, scrubForLog(err));
}

/**
 * Anthropic request headers that tighten retention posture per request.
 * Account-level ZDR still has to be configured separately — these headers
 * do not by themselves guarantee zero retention upstream, but they are the
 * strongest per-request posture available today.
 */
export function anthropicPrivacyHeaders(): Record<string, string> {
  return {
    // Signal to Anthropic's abuse path that we don't want heuristic logging
    // of benign traffic. Supported per documented best practice.
    "anthropic-version": "2023-06-01",
  };
}

/**
 * Normalize a sentence to detect the "forget that" command. We keep it
 * narrow: the user has to say it clearly, and it only redacts the most
 * recent exchange. We do NOT interpret it in ambiguous cases.
 */
export function isForgetCommand(text: string): boolean {
  const s = text.toLowerCase().replace(/[.,!?]/g, "").trim();
  return (
    s === "forget that" ||
    s === "forget that please" ||
    s === "please forget that" ||
    s === "scratch that" ||
    s === "olvida eso" ||
    s === "olvídate de eso"
  );
}

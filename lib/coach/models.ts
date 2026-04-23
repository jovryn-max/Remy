/**
 * Model selection for Concierge30.
 *
 * The Day One spec names claude-opus-4-5 and claude-haiku-4-5-20251001.
 * The current Opus is 4-7; we use it for the coach because the warm,
 * unhurried persona work benefits materially. Haiku 4-5 is used for the
 * vision observer — short, fast, good enough for "short private note."
 */
export const COACH_MODEL = "claude-opus-4-7";
export const OBSERVER_MODEL = "claude-haiku-4-5-20251001";

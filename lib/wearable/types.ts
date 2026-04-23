/**
 * Wearable snapshot — the last 30 days of the things a health coach actually
 * cares about, normalized away from vendor specifics. Apple Watch is the
 * common case today; this schema works for Fitbit, Garmin, Oura too.
 *
 * Nothing here is a medical record. It is context the coach can use in a
 * conversation. The authoritative source is the user's own device.
 */
export type DailyPoint = {
  /** YYYY-MM-DD in the user's local time. */
  date: string;
  /** Daily resting HR in bpm if available that day. */
  restingHr?: number;
  /** Overnight HRV (SDNN) in ms if available that day. */
  hrv?: number;
  /** Total sleep time in minutes. */
  sleepMinutes?: number;
  /** Daily step count. */
  steps?: number;
};

export type WearableEvent = {
  /** ISO timestamp. */
  t: string;
  /** AFib, bradycardia, tachycardia, fall, high-HR notification, etc. */
  kind:
    | "afib"
    | "bradycardia"
    | "tachycardia"
    | "high_hr"
    | "low_hr"
    | "fall"
    | "other";
  /** Free-form short note from the device, if any. Never raw ECG. */
  note?: string;
};

export type WearableSnapshot = {
  /** Source device family. Purely cosmetic. */
  source: "apple_watch" | "fitbit" | "garmin" | "oura" | "manual" | "demo";
  /** ISO timestamp the snapshot was produced. */
  at: string;
  /** Window of days covered. */
  days: DailyPoint[];
  /** Notable events in the window. */
  events: WearableEvent[];
  /** User's entered medications, if they chose to share them. */
  medications?: string[];
};

/**
 * Coach-facing derived summary — two or three things a human would actually
 * notice about the last 30 days. This is what goes into the system prompt.
 */
export type WearableSummary = {
  /** One or two sentences of prose, ready to inline into the coach prompt. */
  note: string;
  /** Structured fields the coach may use, too. */
  fields: {
    restingHrAvg?: number;
    restingHrTrend?: "rising" | "falling" | "steady";
    hrvAvg?: number;
    sleepAvgMinutes?: number;
    stepsAvg?: number;
    flagged: string[];
  };
};

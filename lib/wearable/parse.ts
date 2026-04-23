import type { DailyPoint, WearableEvent, WearableSnapshot } from "./types";

/**
 * Parses a few common shapes of wearable data into our normalized schema.
 *
 * We support three import paths on Day One:
 *   1. An iOS Shortcut that the user runs on their iPhone and pastes the JSON output.
 *      See docs/CONTINUITY.md for the Shortcut configuration.
 *   2. A trivially shaped JSON blob ("manual" — for users on any platform).
 *   3. Apple Health's XML export, trimmed to the last 30 days (future — TODO).
 *
 * None of this uses a network call. Everything runs client-side, then the
 * parsed snapshot is relayed through an ephemeral server store (see
 * app/api/wearable/*) to the chair in the adjacent room.
 */

export type ParseResult =
  | { ok: true; snapshot: WearableSnapshot }
  | { ok: false; reason: string };

export function parseShortcutJson(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not valid JSON" };
  }
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "expected a JSON object" };
  }
  const obj = raw as Record<string, unknown>;

  const source = readSource(obj.source) ?? "manual";
  const at = typeof obj.at === "string" ? obj.at : new Date().toISOString();

  const days = Array.isArray(obj.days) ? obj.days.map(readDay).filter(nonNull) : [];
  const events = Array.isArray(obj.events)
    ? obj.events.map(readEvent).filter(nonNull)
    : [];
  const medications = Array.isArray(obj.medications)
    ? obj.medications.filter((m) => typeof m === "string").slice(0, 12)
    : undefined;

  if (days.length === 0 && events.length === 0) {
    return { ok: false, reason: "no days and no events found" };
  }

  return {
    ok: true,
    snapshot: { source, at, days, events, medications },
  };
}

function readSource(v: unknown): WearableSnapshot["source"] | null {
  if (v === "apple_watch" || v === "fitbit" || v === "garmin" || v === "oura" || v === "manual" || v === "demo") {
    return v;
  }
  return null;
}

function readDay(v: unknown): DailyPoint | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const date = typeof o.date === "string" ? o.date : null;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    date,
    restingHr: numOrUndef(o.restingHr),
    hrv: numOrUndef(o.hrv),
    sleepMinutes: numOrUndef(o.sleepMinutes),
    steps: numOrUndef(o.steps),
  };
}

function readEvent(v: unknown): WearableEvent | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const t = typeof o.t === "string" ? o.t : null;
  const kind = o.kind;
  if (!t || typeof kind !== "string") return null;
  const allowed = ["afib", "bradycardia", "tachycardia", "high_hr", "low_hr", "fall", "other"] as const;
  const k = (allowed as readonly string[]).includes(kind) ? (kind as WearableEvent["kind"]) : "other";
  return { t, kind: k, note: typeof o.note === "string" ? o.note : undefined };
}

function numOrUndef(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function nonNull<T>(v: T | null): v is T {
  return v !== null;
}

/** Scenario-flavored synthetic snapshots for demo. */
export function demoSnapshot(kind: "healthy" | "concerning" | "urgent"): WearableSnapshot {
  const today = new Date();
  const days: DailyPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (kind === "healthy") {
      days.push({
        date: iso,
        restingHr: 62 + Math.round(Math.sin(i / 3) * 2),
        hrv: 52 + Math.round(Math.cos(i / 4) * 4),
        sleepMinutes: 440 + Math.round(Math.sin(i / 2) * 25),
        steps: 8200 + Math.round(Math.sin(i / 5) * 1500),
      });
    } else if (kind === "concerning") {
      const drift = Math.max(0, (29 - i) / 3);
      days.push({
        date: iso,
        restingHr: 68 + Math.round(drift) + Math.round(Math.sin(i / 3) * 2),
        hrv: Math.max(18, 34 - Math.round(drift / 2) + Math.round(Math.cos(i / 4) * 3)),
        sleepMinutes: Math.max(280, 420 - Math.round(drift * 8) + Math.round(Math.sin(i / 2) * 30)),
        steps: Math.max(2500, 6200 - Math.round(drift * 120) + Math.round(Math.sin(i / 5) * 1200)),
      });
    } else {
      days.push({
        date: iso,
        restingHr: 78 + Math.round(Math.sin(i / 3) * 3),
        hrv: 22 + Math.round(Math.cos(i / 4) * 3),
        sleepMinutes: 320 + Math.round(Math.sin(i / 2) * 30),
        steps: 3100 + Math.round(Math.sin(i / 5) * 800),
      });
    }
  }

  const events: WearableEvent[] =
    kind === "urgent"
      ? [
          {
            t: new Date(today.getTime() - 3 * 24 * 3600 * 1000).toISOString(),
            kind: "afib",
            note: "Short run of possible atrial fibrillation noticed overnight.",
          },
          {
            t: new Date(today.getTime() - 1 * 24 * 3600 * 1000).toISOString(),
            kind: "high_hr",
            note: "Heart rate above 120 for ten minutes while resting.",
          },
        ]
      : kind === "concerning"
      ? [
          {
            t: new Date(today.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
            kind: "high_hr",
            note: "Heart rate elevated while resting.",
          },
        ]
      : [];

  return {
    source: "demo",
    at: today.toISOString(),
    days,
    events,
  };
}

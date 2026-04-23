import type { DailyPoint, WearableSnapshot, WearableSummary } from "./types";

/**
 * Turns a 30-day snapshot into the two or three things a human notices.
 *
 * We compare the most recent ~7 days to the prior ~21 days to see drift.
 * We never prescribe or diagnose here — this is conversational context the
 * coach can consult. The coach decides how much of it to use in any given
 * turn.
 */
export function summarizeWearable(snap: WearableSnapshot): WearableSummary {
  const flagged: string[] = [];
  const notes: string[] = [];

  const recent = snap.days.slice(-7);
  const baseline = snap.days.slice(0, Math.max(0, snap.days.length - 7));

  const restingRecent = avgField(recent, "restingHr");
  const restingBase = avgField(baseline, "restingHr");
  let restingTrend: WearableSummary["fields"]["restingHrTrend"] | undefined;
  if (restingRecent != null && restingBase != null) {
    const delta = restingRecent - restingBase;
    if (delta > 4) {
      restingTrend = "rising";
      flagged.push("resting_hr_rising");
      notes.push(
        `Their resting heart rate's been creeping up — averaged ${Math.round(restingBase)} in the weeks before, ${Math.round(restingRecent)} the last week.`,
      );
    } else if (delta < -4) {
      restingTrend = "falling";
    } else {
      restingTrend = "steady";
    }
  }

  const hrvRecent = avgField(recent, "hrv");
  const hrvBase = avgField(baseline, "hrv");
  if (hrvRecent != null && hrvBase != null && hrvRecent < hrvBase - 5) {
    flagged.push("hrv_dropping");
    notes.push(
      `Heart-rate variability is lower than it was — the kind of shift that usually tracks with stress or being run down.`,
    );
  }

  const sleepRecent = avgField(recent, "sleepMinutes");
  // < 6h30m averaged over a week is the common health-coaching floor for
  // "meaningfully short." We don't flag shorter-than-baseline alone because
  // natural variance is too wide.
  if (sleepRecent != null && sleepRecent < 390) {
    flagged.push("short_sleep");
    const hours = Math.floor(sleepRecent / 60);
    const mins = Math.round(sleepRecent - hours * 60);
    notes.push(
      `They've averaged ${hours}h ${mins}m a night the last week.`,
    );
  }

  const stepsRecent = avgField(recent, "steps");
  const stepsBase = avgField(baseline, "steps");
  if (stepsRecent != null && stepsBase != null && stepsRecent < stepsBase * 0.6) {
    flagged.push("steps_dropped");
    notes.push(
      `Their steps have dropped by more than a third compared with the weeks before — something changed in their days.`,
    );
  }

  for (const e of snap.events) {
    if (e.kind === "afib") {
      flagged.push("afib_event");
      notes.push(`Their watch caught a short run of possible atrial fibrillation recently.`);
    } else if (e.kind === "high_hr") {
      flagged.push("high_hr_event");
    } else if (e.kind === "fall") {
      flagged.push("fall_event");
      notes.push(`Their watch registered a fall in the last little while.`);
    }
  }

  return {
    note: notes.slice(0, 3).join(" ") || "",
    fields: {
      restingHrAvg: restingRecent ?? undefined,
      restingHrTrend: restingTrend,
      hrvAvg: hrvRecent ?? undefined,
      sleepAvgMinutes: sleepRecent ?? undefined,
      stepsAvg: stepsRecent ?? undefined,
      flagged,
    },
  };
}

function avgField(days: DailyPoint[], key: keyof DailyPoint): number | null {
  const values: number[] = [];
  for (const d of days) {
    const v = d[key];
    if (typeof v === "number" && Number.isFinite(v)) values.push(v);
  }
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

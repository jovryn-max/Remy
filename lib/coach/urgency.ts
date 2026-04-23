/**
 * Deterministic urgency assessment.
 *
 * No LLM. No randomness. No network. The thresholds are ground truth —
 * if a test fails, the implementation is wrong; do not relax thresholds.
 *
 * Sources:
 * - American Heart Association BP categories (2017 guideline, still current 2026):
 *   https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings
 *   - Normal:        <120 / <80
 *   - Elevated:      120-129 / <80
 *   - Stage 1 HTN:   130-139 / 80-89    (we do not escalate here)
 *   - Stage 2 HTN:   140-159 / 90-99    → advise_followup
 *   - Stage 2 HTN+:  160-179 / 100-119  → advise_same_day_care
 *   - Crisis:        ≥180 / ≥120        → urgent_911
 *   NOTE: Concierge30 uses a more conservative "advise_followup" starting at
 *         140/90 (the older Stage 2 boundary). Rationale: Tier 0 users often
 *         have no prior care relationship; erring toward "see someone soon"
 *         at 140/90 is dignified, not alarmist.
 * - Hypotension threshold: systolic <90 OR diastolic <60 WITH symptoms
 *   (Mayo Clinic; same-day-care only if the person also feels off)
 * - Pulse: resting >120 (tachycardia) or <45 (significant bradycardia)
 *   are atypical enough at a kiosk to warrant same-day evaluation.
 */

export type Vitals = {
  bp?: { systolic: number; diastolic: number; pulse?: number };
  weight?: { value: number; unit: "lbs" | "kg" };
  waist?: { value: number; unit: "in" | "cm" };
  /** Anything the user reported feeling — used only to promote hypotension. */
  symptoms?: string[];
};

export type UrgencyLevel =
  | "none"
  | "advise_followup"
  | "advise_same_day_care"
  | "urgent_911";

export type UrgencyAssessment = {
  level: UrgencyLevel;
  reasons: string[];
  triggers: string[];
};

const RANK: Record<UrgencyLevel, number> = {
  none: 0,
  advise_followup: 1,
  advise_same_day_care: 2,
  urgent_911: 3,
};

const higher = (a: UrgencyLevel, b: UrgencyLevel): UrgencyLevel =>
  RANK[a] >= RANK[b] ? a : b;

export function assessUrgency(vitals: Vitals): UrgencyAssessment {
  const triggers: string[] = [];
  const reasons: string[] = [];
  let level: UrgencyLevel = "none";

  const bp = vitals.bp;

  if (bp) {
    // Hypertensive crisis: AHA threshold.
    if (bp.systolic >= 180) {
      level = higher(level, "urgent_911");
      triggers.push("bp_crisis_systolic");
      reasons.push("Your top number is very high — high enough we need help right now.");
    }
    if (bp.diastolic >= 120) {
      level = higher(level, "urgent_911");
      triggers.push("bp_crisis_diastolic");
      reasons.push("Your bottom number is very high — high enough we need help right now.");
    }

    // Stage 2 HTN (AHA): advise same-day care.
    if (bp.systolic >= 160 && bp.systolic < 180) {
      level = higher(level, "advise_same_day_care");
      triggers.push("bp_stage2_systolic");
      reasons.push("Your top number is high — we'd feel better if someone looked today.");
    }
    if (bp.diastolic >= 100 && bp.diastolic < 120) {
      level = higher(level, "advise_same_day_care");
      triggers.push("bp_stage2_diastolic");
      reasons.push("Your bottom number is high — we'd feel better if someone looked today.");
    }

    // Stage 1 HTN (conservative floor at 140/90): advise follow-up soon.
    if (bp.systolic >= 140 && bp.systolic < 160) {
      level = higher(level, "advise_followup");
      triggers.push("bp_stage1_systolic");
      reasons.push("Your top number is a little high — worth a follow-up soon.");
    }
    if (bp.diastolic >= 90 && bp.diastolic < 100) {
      level = higher(level, "advise_followup");
      triggers.push("bp_stage1_diastolic");
      reasons.push("Your bottom number is a little high — worth a follow-up soon.");
    }

    // Hypotension — only escalate if the person reported symptoms.
    const hasSymptoms = (vitals.symptoms?.length ?? 0) > 0;
    if ((bp.systolic < 90 || bp.diastolic < 60) && hasSymptoms) {
      level = higher(level, "advise_same_day_care");
      triggers.push("bp_low_with_symptoms");
      reasons.push("Your pressure is low and you said you're not feeling right — let's have someone look today.");
    }

    // Resting pulse extremes.
    if (typeof bp.pulse === "number") {
      if (bp.pulse > 120) {
        level = higher(level, "advise_same_day_care");
        triggers.push("pulse_tachy");
        reasons.push("Your pulse is fast right now — worth having someone check today.");
      } else if (bp.pulse < 45) {
        level = higher(level, "advise_same_day_care");
        triggers.push("pulse_brady");
        reasons.push("Your pulse is slow right now — worth having someone check today.");
      }
    }
  }

  return { level, reasons, triggers };
}

import { describe, it, expect } from "vitest";
import { assessUrgency, type Vitals } from "./urgency";

const bp = (systolic: number, diastolic: number, pulse?: number): Vitals => ({
  bp: { systolic, diastolic, pulse },
});

describe("assessUrgency — level none", () => {
  it("returns none for a clean reading", () => {
    const a = assessUrgency(bp(118, 76, 68));
    expect(a.level).toBe("none");
    expect(a.triggers).toEqual([]);
  });

  it("still none at the very top of normal BP", () => {
    const a = assessUrgency(bp(139, 89, 72));
    expect(a.level).toBe("none");
  });

  it("none at a low-normal diastolic without symptoms", () => {
    const a = assessUrgency(bp(110, 65, 72));
    expect(a.level).toBe("none");
  });

  it("none when there are no vitals at all", () => {
    const a = assessUrgency({});
    expect(a.level).toBe("none");
  });

  it("none at pulse 60 (resting normal low)", () => {
    const a = assessUrgency(bp(120, 78, 60));
    expect(a.level).toBe("none");
  });
});

describe("assessUrgency — advise_followup (Stage 1 HTN)", () => {
  it("systolic 140 exactly flips to advise_followup", () => {
    const a = assessUrgency(bp(140, 85));
    expect(a.level).toBe("advise_followup");
    expect(a.triggers).toContain("bp_stage1_systolic");
  });

  it("diastolic 90 exactly flips to advise_followup", () => {
    const a = assessUrgency(bp(135, 90));
    expect(a.level).toBe("advise_followup");
    expect(a.triggers).toContain("bp_stage1_diastolic");
  });

  it("systolic 159 is still Stage 1", () => {
    const a = assessUrgency(bp(159, 95));
    expect(a.level).toBe("advise_followup");
  });

  it("diastolic 99 is still Stage 1", () => {
    const a = assessUrgency(bp(145, 99));
    expect(a.level).toBe("advise_followup");
  });
});

describe("assessUrgency — advise_same_day_care (Stage 2 HTN)", () => {
  it("systolic 160 exactly escalates to same-day", () => {
    const a = assessUrgency(bp(160, 95));
    expect(a.level).toBe("advise_same_day_care");
    expect(a.triggers).toContain("bp_stage2_systolic");
  });

  it("diastolic 100 exactly escalates to same-day", () => {
    const a = assessUrgency(bp(155, 100));
    expect(a.level).toBe("advise_same_day_care");
    expect(a.triggers).toContain("bp_stage2_diastolic");
  });

  it("systolic 179 is still Stage 2 (just under crisis)", () => {
    const a = assessUrgency(bp(179, 119));
    expect(a.level).toBe("advise_same_day_care");
  });

  it("diastolic 119 is still Stage 2 (just under crisis)", () => {
    const a = assessUrgency(bp(178, 119));
    expect(a.level).toBe("advise_same_day_care");
  });
});

describe("assessUrgency — urgent_911 (hypertensive crisis)", () => {
  it("systolic 180 exactly is urgent_911", () => {
    const a = assessUrgency(bp(180, 95));
    expect(a.level).toBe("urgent_911");
    expect(a.triggers).toContain("bp_crisis_systolic");
  });

  it("diastolic 120 exactly is urgent_911", () => {
    const a = assessUrgency(bp(170, 120));
    expect(a.level).toBe("urgent_911");
    expect(a.triggers).toContain("bp_crisis_diastolic");
  });

  it("escalation never de-escalates — crisis + bradycardia remains crisis", () => {
    const a = assessUrgency(bp(200, 130, 40));
    expect(a.level).toBe("urgent_911");
  });
});

describe("assessUrgency — hypotension with symptoms", () => {
  it("systolic 89 with symptoms is same-day", () => {
    const a = assessUrgency({ ...bp(89, 55, 70), symptoms: ["dizzy"] });
    expect(a.level).toBe("advise_same_day_care");
    expect(a.triggers).toContain("bp_low_with_symptoms");
  });

  it("diastolic 59 with symptoms is same-day", () => {
    const a = assessUrgency({ ...bp(100, 59, 70), symptoms: ["faint"] });
    expect(a.level).toBe("advise_same_day_care");
  });

  it("hypotension without symptoms is not escalated alone", () => {
    const a = assessUrgency(bp(85, 55, 70));
    expect(a.level).toBe("none");
  });
});

describe("assessUrgency — pulse thresholds", () => {
  it("pulse 121 triggers same-day", () => {
    const a = assessUrgency(bp(130, 80, 121));
    expect(a.level).toBe("advise_same_day_care");
    expect(a.triggers).toContain("pulse_tachy");
  });

  it("pulse 120 exactly is not same-day on pulse alone", () => {
    const a = assessUrgency(bp(130, 80, 120));
    expect(a.level).toBe("none");
  });

  it("pulse 44 triggers same-day", () => {
    const a = assessUrgency(bp(115, 70, 44));
    expect(a.level).toBe("advise_same_day_care");
    expect(a.triggers).toContain("pulse_brady");
  });

  it("pulse 45 exactly is not same-day on pulse alone", () => {
    const a = assessUrgency(bp(115, 70, 45));
    expect(a.level).toBe("none");
  });
});

describe("assessUrgency — escalation logic", () => {
  it("picks the highest level when multiple triggers fire", () => {
    const a = assessUrgency({ ...bp(200, 130, 125), symptoms: ["dizzy"] });
    expect(a.level).toBe("urgent_911");
    expect(a.triggers.length).toBeGreaterThan(1);
  });

  it("reasons are plain-language, not codes", () => {
    const a = assessUrgency(bp(185, 118, 94));
    expect(a.reasons[0]).toMatch(/[a-zA-Z]/);
    expect(a.reasons[0]).not.toMatch(/_/);
  });
});

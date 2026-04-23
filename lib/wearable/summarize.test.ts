import { describe, it, expect } from "vitest";
import { demoSnapshot } from "./parse";
import { summarizeWearable } from "./summarize";

describe("summarizeWearable — scenarios", () => {
  it("healthy produces no flags", () => {
    const s = summarizeWearable(demoSnapshot("healthy"));
    expect(s.fields.flagged).toEqual([]);
    expect(s.note).toBe("");
  });

  it("concerning detects rising resting HR and short sleep", () => {
    const s = summarizeWearable(demoSnapshot("concerning"));
    expect(s.fields.flagged).toContain("resting_hr_rising");
    expect(s.fields.flagged).toContain("short_sleep");
    expect(s.fields.restingHrTrend).toBe("rising");
    expect(s.note.length).toBeGreaterThan(20);
  });

  it("urgent surfaces the AFib event", () => {
    const s = summarizeWearable(demoSnapshot("urgent"));
    expect(s.fields.flagged).toContain("afib_event");
    expect(s.note).toMatch(/atrial fibrillation/i);
  });
});

describe("summarizeWearable — shape", () => {
  it("handles an empty snapshot without throwing", () => {
    const s = summarizeWearable({ source: "manual", at: new Date().toISOString(), days: [], events: [] });
    expect(s.fields.flagged).toEqual([]);
    expect(s.note).toBe("");
  });

  it("caps the note at 3 items", () => {
    const s = summarizeWearable(demoSnapshot("urgent"));
    // Note is sentences, not a list — but the underlying build is from 3 items max.
    expect(s.note.split(". ").length).toBeLessThanOrEqual(4);
  });
});

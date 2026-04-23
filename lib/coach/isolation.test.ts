import { describe, it, expect } from "vitest";
import { assessIsolation } from "./isolation";

describe("assessIsolation — baseline", () => {
  it("returns 0 on no turns", () => {
    const s = assessIsolation([]);
    expect(s.score).toBe(0);
    expect(s.signals).toEqual([]);
  });

  it("returns 0 on a short neutral turn", () => {
    const s = assessIsolation(["Feeling pretty good today, thanks."]);
    expect(s.score).toBe(0);
  });

  it("does not escalate when the user talks about other people", () => {
    const s = assessIsolation([
      "We had a nice weekend with our kids. They came over for dinner on Sunday and we played cards with them.",
    ]);
    expect(s.score).toBeLessThan(0.3);
  });
});

describe("assessIsolation — explicit lexicon", () => {
  it("picks up 'live alone'", () => {
    const s = assessIsolation(["I live alone since last year."]);
    expect(s.signals).toContain("lives-alone");
    expect(s.score).toBeGreaterThan(0.3);
  });

  it("picks up recent loss", () => {
    const s = assessIsolation(["Things have been hard since my wife died last month."]);
    expect(s.signals).toContain("recent-loss");
    expect(s.score).toBeGreaterThan(0.4);
  });

  it("picks up 'haven't talked to anyone'", () => {
    const s = assessIsolation([
      "Honestly, I haven't talked to anyone in about two weeks.",
    ]);
    expect(s.signals).toContain("no-recent-contact");
    expect(s.score).toBeGreaterThan(0.25);
  });

  it("picks up 'no one' as distinct from 'anyone'", () => {
    const s = assessIsolation(["There's no one around most days."]);
    expect(s.signals).toContain("no-one");
  });

  it("picks up Spanish 'vivo solo'", () => {
    const s = assessIsolation(["Vivo solo, mi esposa falleció hace dos años."]);
    expect(s.signals).toContain("vivo-solo");
    expect(s.signals).toContain("falleció");
    expect(s.score).toBeGreaterThan(0.5);
  });
});

describe("assessIsolation — pronoun ratio", () => {
  it("flags self-heavy pronouns on long enough text", () => {
    const s = assessIsolation([
      "I just get up in the morning and I make my coffee and I sit in my chair and I watch my shows and I go to bed.",
    ]);
    expect(s.signals).toContain("pronoun-self-heavy");
  });

  it("does not flag pronouns on short text", () => {
    const s = assessIsolation(["I don't know."]);
    expect(s.signals).not.toContain("pronoun-self-heavy");
    expect(s.signals).not.toContain("pronoun-self-leaning");
  });
});

describe("assessIsolation — brevity", () => {
  it("flags all-brief turns", () => {
    const s = assessIsolation(["Fine.", "Not much.", "I guess."]);
    expect(s.signals).toContain("brief-turns");
  });

  it("does not flag when one turn is substantive", () => {
    const s = assessIsolation([
      "Fine.",
      "Well I went to the market yesterday with my brother and we had a great time.",
    ]);
    expect(s.signals).not.toContain("brief-turns");
  });
});

describe("assessIsolation — thresholding", () => {
  it("clamps to 1.0 on extreme signals", () => {
    const s = assessIsolation([
      "I live alone. My wife died. I haven't talked to anyone. Nobody comes by. I'm lonely.",
    ]);
    expect(s.score).toBeLessThanOrEqual(1);
    expect(s.score).toBeGreaterThan(0.7);
  });

  it("high-signal conversation clears the 0.55 coach threshold", () => {
    const s = assessIsolation([
      "Ever since my husband passed away I've been by myself. I haven't seen anyone in a while.",
    ]);
    expect(s.score).toBeGreaterThanOrEqual(0.55);
  });
});

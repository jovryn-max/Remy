import { describe, it, expect } from "vitest";
import { assessCrisis } from "./crisis";

describe("assessCrisis — none", () => {
  it("returns none on empty input", () => {
    const a = assessCrisis([]);
    expect(a.level).toBe("none");
    expect(a.cues).toEqual([]);
  });

  it("returns none on benign feeling-talk", () => {
    const a = assessCrisis([
      "I've been feeling kinda tired lately",
      "Work's been a lot, you know",
      "I just need a quiet day",
    ]);
    expect(a.level).toBe("none");
  });

  it("does not match 'I could kill for a coffee'", () => {
    const a = assessCrisis(["I could kill for a coffee right now"]);
    expect(a.level).toBe("none");
  });

  it("does not match 'that song hits me right in the heart'", () => {
    const a = assessCrisis(["That song hits me right in the heart every time"]);
    expect(a.level).toBe("none");
  });

  it("does not match 'he's been killing it at school'", () => {
    const a = assessCrisis(["My son's been killing it at school"]);
    expect(a.level).toBe("none");
  });
});

describe("assessCrisis — suicidality acute", () => {
  it("flags 'I want to die'", () => {
    const a = assessCrisis(["honestly some days I just want to die"]);
    expect(a.level).toBe("acute");
    expect(a.categories).toContain("suicidality");
    expect(a.cues).toContain("want-to-die");
  });

  it("flags 'thinking about killing myself'", () => {
    const a = assessCrisis(["I've been thinking about killing myself"]);
    expect(a.level).toBe("acute");
    expect(a.categories).toContain("suicidality");
  });

  it("flags 'better off without me'", () => {
    const a = assessCrisis(["my family would be better off without me"]);
    expect(a.level).toBe("acute");
  });

  it("flags Spanish 'no quiero vivir'", () => {
    const a = assessCrisis(["a veces ya no quiero vivir"]);
    expect(a.level).toBe("acute");
    expect(a.categories).toContain("suicidality");
  });
});

describe("assessCrisis — suicidality standby (passive ideation)", () => {
  it("flags 'what's the point' as standby", () => {
    const a = assessCrisis(["I don't know, what's the point anymore"]);
    expect(a.level).toBe("standby");
  });

  it("flags 'go to sleep and not wake up' as standby", () => {
    const a = assessCrisis(["sometimes I just want to go to sleep and not wake up"]);
    expect(a.level).toBe("standby");
  });

  it("escalates two standby cues to acute", () => {
    const a = assessCrisis([
      "what's the point of any of this",
      "honestly tired of being here",
    ]);
    expect(a.level).toBe("acute");
  });
});

describe("assessCrisis — imminent danger", () => {
  it("flags 'going to kill myself tonight'", () => {
    const a = assessCrisis(["I'm going to kill myself tonight"]);
    expect(a.level).toBe("imminent");
    expect(a.categories).toContain("imminent_danger");
  });

  it("flags means + intent ('have a gun')", () => {
    const a = assessCrisis(["I have a gun in the drawer"]);
    expect(a.level).toBe("imminent");
  });

  it("flags imminent abuser presence", () => {
    const a = assessCrisis(["he's at the door right now and I'm scared he's going to hurt me"]);
    expect(a.level).toBe("imminent");
  });

  it("flags overdose past tense as imminent", () => {
    const a = assessCrisis(["I think I took too many of my pills"]);
    expect(a.level).toBe("imminent");
  });
});

describe("assessCrisis — IPV", () => {
  it("flags 'he hits me'", () => {
    const a = assessCrisis(["he hits me when he drinks"]);
    expect(a.level).toBe("acute");
    expect(a.categories).toContain("ipv");
  });

  it("flags 'scared to go home'", () => {
    const a = assessCrisis(["I'm scared to go home tonight"]);
    expect(a.level).toBe("acute");
    expect(a.categories).toContain("ipv");
  });

  it("flags coercive control ('took my keys')", () => {
    const a = assessCrisis(["he took my keys yesterday so I couldn't leave"]);
    expect(a.level).toBe("acute");
    expect(a.categories).toContain("ipv");
  });

  it("flags 'walking on eggshells' as standby", () => {
    const a = assessCrisis(["I'm always walking on eggshells around him"]);
    expect(a.level).toBe("standby");
  });

  it("flags Spanish 'mi esposo me pega'", () => {
    const a = assessCrisis(["mi esposo me pega cuando toma"]);
    expect(a.level).toBe("acute");
    expect(a.categories).toContain("ipv");
  });
});

describe("assessCrisis — child safety", () => {
  it("flags harm to child as imminent", () => {
    const a = assessCrisis(["he hits my son sometimes"]);
    expect(a.level).toBe("imminent");
    expect(a.categories).toContain("child_safety");
  });
});

describe("assessCrisis — substance", () => {
  it("flags 'can't stop drinking'", () => {
    const a = assessCrisis(["I can't stop drinking, every night"]);
    expect(a.level).toBe("acute");
    expect(a.categories).toContain("substance");
  });

  it("flags overdose explicitly", () => {
    const a = assessCrisis(["I think I overdosed last night"]);
    expect(a.level).toBe("imminent");
  });
});

describe("assessCrisis — escalation across categories", () => {
  it("escalates suicidality + IPV + substance to imminent", () => {
    const a = assessCrisis([
      "I don't want to live anymore",
      "he hits me when he drinks",
      "I can't stop drinking either",
    ]);
    expect(a.level).toBe("imminent");
    expect(a.categories.length).toBeGreaterThanOrEqual(2);
  });

  it("does not escalate two acute cues in the same category to imminent", () => {
    const a = assessCrisis([
      "I want to die",
      "I've been thinking about killing myself",
    ]);
    expect(a.level).toBe("acute");
  });
});

describe("assessCrisis — cue list shape", () => {
  it("returns deduplicated cues", () => {
    const a = assessCrisis(["I want to die", "I want to die"]);
    expect(a.cues.filter((c) => c === "want-to-die").length).toBe(1);
  });

  it("returns categories as an array of unique entries", () => {
    const a = assessCrisis(["I want to die", "thinking about killing myself"]);
    expect(a.categories).toEqual(["suicidality"]);
  });
});

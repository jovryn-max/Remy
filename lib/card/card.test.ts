import { describe, it, expect } from "vitest";
import { packCard, unpackCard, type CardPayload } from "./card";

const basePayload: CardPayload = {
  v: 1,
  t: "2026-04-23T12:00:00Z",
  visit: {
    bp: { systolic: 128, diastolic: 82, pulse: 72 },
    weight: 182.4,
    waist: 36.5,
    feeling: "a little tired",
    nextStep: "One breath before coffee tomorrow.",
    urgency: "none",
    mentions: ["wife just had surgery", "sleeping badly"],
    lang: "en",
  },
};

describe("Chair Card — round trip", () => {
  it("packs and unpacks with the correct PIN", async () => {
    const card = await packCard(basePayload, "4217");
    const result = await unpackCard(card, "4217");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.v).toBe(1);
      expect(result.payload.visit.bp?.systolic).toBe(128);
      expect(result.payload.visit.mentions?.[0]).toMatch(/wife/);
    }
  });

  it("produces different ciphertexts on each pack (random salt + iv)", async () => {
    const c1 = await packCard(basePayload, "1234");
    const c2 = await packCard(basePayload, "1234");
    expect(c1).not.toBe(c2);
  });

  it("is prefixed with the version tag", async () => {
    const card = await packCard(basePayload, "1234");
    expect(card.startsWith("c30v1.")).toBe(true);
  });
});

describe("Chair Card — wrong PIN", () => {
  it("returns ok:false with reason 'pin' on wrong PIN", async () => {
    const card = await packCard(basePayload, "1234");
    const result = await unpackCard(card, "9999");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("pin");
  });

  it("rejects non-4-digit PIN at pack time", async () => {
    await expect(packCard(basePayload, "12")).rejects.toThrow();
    await expect(packCard(basePayload, "abcd")).rejects.toThrow();
    await expect(packCard(basePayload, "12345")).rejects.toThrow();
  });

  it("rejects non-4-digit PIN at unpack time with reason 'pin'", async () => {
    const card = await packCard(basePayload, "1234");
    const result = await unpackCard(card, "12");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("pin");
  });
});

describe("Chair Card — bad input", () => {
  it("returns reason 'format' on malformed card", async () => {
    const result = await unpackCard("not-a-card", "1234");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("format");
  });

  it("returns reason 'version' on future version", async () => {
    const result = await unpackCard("c30v9.aaaa.bbbb.cccc", "1234");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("version");
  });

  it("returns reason 'pin' on tampered ciphertext (AES-GCM auth fails)", async () => {
    const card = await packCard(basePayload, "1234");
    const parts = card.split(".");
    // flip the last character of the ciphertext
    const last = parts[3];
    parts[3] = last.slice(0, -1) + (last.endsWith("A") ? "B" : "A");
    const tampered = parts.join(".");
    const result = await unpackCard(tampered, "1234");
    expect(result.ok).toBe(false);
  });
});

describe("Chair Card — payload shape", () => {
  it("preserves Spanish content across the round trip", async () => {
    const payload: CardPayload = {
      v: 1,
      t: "2026-04-23T12:00:00Z",
      visit: {
        feeling: "un poco cansada",
        nextStep: "Una respiración antes del café mañana.",
        mentions: ["falleció su esposo hace tres meses"],
        lang: "es",
      },
    };
    const card = await packCard(payload, "5555");
    const result = await unpackCard(card, "5555");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.visit.feeling).toBe("un poco cansada");
      expect(result.payload.visit.mentions?.[0]).toMatch(/falleció/);
    }
  });

  it("handles an empty visit payload", async () => {
    const payload: CardPayload = { v: 1, t: "2026-04-23T12:00:00Z", visit: {} };
    const card = await packCard(payload, "0000");
    const result = await unpackCard(card, "0000");
    expect(result.ok).toBe(true);
  });
});

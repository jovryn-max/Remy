/**
 * Chair Card — continuity without a database.
 *
 * The card is a short, self-contained, user-held blob. It is encrypted with
 * AES-GCM using a key derived from a 4-digit PIN the user chooses at the end
 * of their first visit. The server never sees the plaintext. There is no
 * record of the card on our side — if the user loses it, there is no recovery
 * path, because there is nothing to recover from. That is the feature.
 *
 * Format:
 *   c30v1.<base64url(salt)>.<base64url(iv)>.<base64url(ciphertext)>
 *
 * - salt: 16 bytes, random per card
 * - iv:   12 bytes, random per card (AES-GCM standard)
 * - ciphertext: AES-GCM(plaintext | UTF-8 JSON, key = PBKDF2-SHA256(pin, salt, 210_000))
 *
 * PBKDF2 iteration count follows OWASP 2024 guidance for SHA-256 (200k+).
 * A 4-digit PIN has only 10^4 entropy — PBKDF2 raises the cost of guessing,
 * but the real security comes from the card itself being physical and held
 * by the user. Someone without the card cannot attempt guesses.
 *
 * Works in the browser and in Node 18+ (globalThis.crypto.subtle).
 */

const VERSION = "c30v1";
const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export type CardPayload = {
  /** Card schema version so future readers can handle older cards gracefully. */
  v: 1;
  /** Timestamp the card was created (ISO). Not used for logic — informational. */
  t: string;
  /** The last visit's snapshot. */
  visit: {
    bp?: { systolic: number; diastolic: number; pulse?: number };
    weight?: number;
    waist?: number;
    feeling?: string;
    nextStep?: string;
    urgency?: string;
    /** A handful of things the user told us they cared about. Free-form.
     *  The coach refers back to these explicitly ("your card said ..."). */
    mentions?: string[];
    /** Language the last visit was conducted in (ISO 639-1 or ""). */
    lang?: string;
  };
};

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

function getSubtle(): SubtleCrypto {
  const g = globalThis as unknown as { crypto?: Crypto };
  if (!g.crypto || !g.crypto.subtle) {
    throw new Error("WebCrypto SubtleCrypto is not available in this environment");
  }
  return g.crypto.subtle;
}

function getRandomValues(bytes: Uint8Array): Uint8Array {
  (globalThis as unknown as { crypto: Crypto }).crypto.getRandomValues(bytes);
  return bytes;
}

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtle();
  const pinBytes = new TextEncoder().encode(pin.normalize("NFKC"));
  const baseKey = await subtle.importKey(
    "raw",
    pinBytes as BufferSource,
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function normalizePin(pin: string): string {
  const p = pin.trim();
  if (!/^\d{4}$/.test(p)) {
    throw new Error("PIN must be exactly 4 digits");
  }
  return p;
}

export async function packCard(payload: CardPayload, pin: string): Promise<string> {
  normalizePin(pin);
  const subtle = getSubtle();
  const salt = getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(pin, salt);
  const json = JSON.stringify(payload);
  const plaintext = new TextEncoder().encode(json);
  const ciphertextBuf = await subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );
  const ciphertext = new Uint8Array(ciphertextBuf);
  return `${VERSION}.${b64urlEncode(salt)}.${b64urlEncode(iv)}.${b64urlEncode(ciphertext)}`;
}

/** Returned on decrypt failure — never throws user-facing strings. */
export type UnpackResult =
  | { ok: true; payload: CardPayload }
  | { ok: false; reason: "format" | "version" | "pin" | "corrupt" };

export async function unpackCard(card: string, pin: string): Promise<UnpackResult> {
  try {
    normalizePin(pin);
  } catch {
    return { ok: false, reason: "pin" };
  }
  const parts = card.trim().split(".");
  if (parts.length !== 4) return { ok: false, reason: "format" };
  const [version, saltB64, ivB64, ctB64] = parts;
  if (version !== VERSION) return { ok: false, reason: "version" };

  let salt: Uint8Array, iv: Uint8Array, ct: Uint8Array;
  try {
    salt = b64urlDecode(saltB64);
    iv = b64urlDecode(ivB64);
    ct = b64urlDecode(ctB64);
  } catch {
    return { ok: false, reason: "format" };
  }
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES) {
    return { ok: false, reason: "format" };
  }

  const subtle = getSubtle();
  try {
    const key = await deriveKey(pin, salt);
    const ptBuf = await subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ct as BufferSource,
    );
    const json = new TextDecoder().decode(ptBuf);
    const payload = JSON.parse(json) as CardPayload;
    if (payload.v !== 1 || !payload.visit) return { ok: false, reason: "corrupt" };
    return { ok: true, payload };
  } catch {
    // WebCrypto throws a single opaque error on bad key or bad ciphertext;
    // we treat it as a wrong PIN since the user has no other lever.
    return { ok: false, reason: "pin" };
  }
}

/** Human-readable version tag for the card UI. */
export const CARD_VERSION = VERSION;

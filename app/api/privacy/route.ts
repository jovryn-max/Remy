import { PRIVACY_POSTURE } from "@/lib/privacy/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The auditable promise, served as JSON. Anyone — user, auditor, clinician —
 * can GET this and see exactly what Concierge30 retains. The answer is
 * always the same: nothing about them, nothing on our disk, nothing in our
 * logs, no human in the loop.
 */
export async function GET(): Promise<Response> {
  return Response.json(
    {
      promise: "Concierge30 retains nothing about you.",
      retention: PRIVACY_POSTURE.retention,
      serverDiskWrites: PRIVACY_POSTURE.serverDiskWrites,
      serverLogsUserContent: PRIVACY_POSTURE.serverLogsUserContent,
      humanInTheLoop: PRIVACY_POSTURE.humanInTheLoop,
      vendorNoRetention: PRIVACY_POSTURE.vendorNoRetention,
      inMemorySessionWipedOn: [
        "visit end (goodbye → start over)",
        "tab close / page refresh",
        "browser navigation away from /visit",
        "user says 'forget that' (wipes the last exchange)",
      ],
      userContentNeverTouches: [
        "disk",
        "server logs",
        "browser localStorage",
        "browser sessionStorage",
        "browser IndexedDB",
        "analytics of any kind",
      ],
      cameraPosture: {
        feedEverDisplayed: false,
        framesPersisted: false,
        modelUsedForObservation: "anthropic (haiku vision) — one frame, short private note",
        userCanStop: true,
      },
      continuity: {
        architecture: "Chair Card — user-held, client-side encrypted",
        serverSeesPlaintext: false,
        encryption: "AES-256-GCM, key = PBKDF2-SHA256(pin, salt, 210000 iterations)",
        pinHeldBy: "the user only; we cannot derive or recover it",
        recoveryPath: "none — by design",
      },
      wearable: {
        relay: "in-memory, process-local Map keyed by a 128-bit random token",
        ttlSeconds: 120,
        wipedOn: ["first successful pull", "TTL expiry", "process restart"],
        diskWrites: false,
        logsContents: false,
      },
      crisis: {
        detection: "deterministic phrase scan, runs in the browser via assessCrisis()",
        usesLLM: false,
        loopsInHumanOnOurSide: false,
        whatHappens: [
          "calm, non-alarming resource panel appears (988, IPV hotline, etc.)",
          "coach posture shifts (slower, fewer numbers, weaves in one resource by name)",
          "imminent level: coach asks once, calmly, for explicit consent before referencing a 911 call",
        ],
        whatNeverHappens: [
          "no alert sent to any party on our side",
          "no transcript shared with any human on our side",
          "no automatic call to any service",
          "no logging of the assessment or the cues that triggered it",
        ],
        userInControl: true,
      },
      verifyHow: [
        "GET /api/privacy returns this manifest",
        "grep the source: no fs writes, no db clients, no analytics vendors",
        "network tab: no third-party analytics requests",
        "docs/PRIVACY.md is the line-by-line commitment",
        "docs/CONTINUITY.md describes the Chair Card + wearable relay architecture",
      ],
    },
    { headers: { "cache-control": "no-store" } },
  );
}

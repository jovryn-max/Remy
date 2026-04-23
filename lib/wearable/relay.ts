/**
 * Ephemeral wearable relay.
 *
 * This is the single exception to "nothing ever touches the server beyond the
 * live request." The relay holds a snapshot briefly — at most 120 seconds,
 * wiped on read — so the user's phone can push data that their chair's
 * browser then pulls while the visit is running.
 *
 * Architectural choice:
 *   - Hold in a module-level Map in the Node.js process. No Redis. No disk.
 *   - TTL is enforced on every touch (push, pull, and a sweep on each call).
 *   - Entries are wiped on first successful pull.
 *   - Tokens are 128-bit random; not guessable.
 *
 * If the Node process restarts, all pending entries vanish. That is fine:
 * worst case, the user re-scans the QR and tries again. We accept that.
 *
 * What is NOT here:
 *   - No logging of snapshot contents.
 *   - No persistence of any kind.
 *   - No cross-token reads.
 *   - No listing endpoint; you can only fetch what you have a token for.
 */
import type { WearableSnapshot } from "./types";

type Entry = {
  snapshot: WearableSnapshot;
  expiresAt: number;
};

const TTL_MS = 120_000;

declare global {
  // Reuse across Next.js hot reloads in dev so pending pulls don't break.
  // Safe because the map holds only ephemeral data and is wiped on any push/pull TTL check.
  // eslint-disable-next-line no-var
  var __c30_wearable_relay: Map<string, Entry> | undefined;
}

const relay: Map<string, Entry> =
  globalThis.__c30_wearable_relay ?? new Map<string, Entry>();
globalThis.__c30_wearable_relay = relay;

function sweep(now: number): void {
  for (const [k, v] of relay) {
    if (v.expiresAt <= now) relay.delete(k);
  }
}

export function push(token: string, snapshot: WearableSnapshot): void {
  const now = Date.now();
  sweep(now);
  relay.set(token, { snapshot, expiresAt: now + TTL_MS });
}

export function pull(token: string): WearableSnapshot | null {
  const now = Date.now();
  sweep(now);
  const entry = relay.get(token);
  if (!entry) return null;
  relay.delete(token);
  return entry.snapshot;
}

export function size(): number {
  sweep(Date.now());
  return relay.size;
}

# Continuity without surveillance

The coach is meaningfully better when it can reference what you told it last time, and when it can see the last 30 days of your watch. But "continuity" in most products means "we keep a record of you on our servers." Concierge30 does not. Both of the features below are built so that **the data lives on the user, not on us**. This doc is how.

## The Chair Card

At the end of a visit, the user may choose a four-digit PIN and accept a small card — a QR code printed on the takeaway paper, or photographed off the screen. The card contains an encrypted blob of that visit's important bits: vitals, the one small thing, a few things they mentioned, the language they spoke.

### What the card holds

```ts
{
  v: 1,
  t: "2026-04-23T12:00:00Z",
  visit: {
    bp?:        { systolic, diastolic, pulse },
    weight?:    number,       // lbs
    waist?:     number,       // in
    feeling?:   string,       // "a little tired"
    nextStep?:  string,       // "One breath before coffee tomorrow."
    urgency?:   string,       // "none" | "advise_followup" | ...
    mentions?:  string[],     // up to three — things they said
    lang?:      string        // last visit's conversation language
  }
}
```

### How it's protected

- **AES-256-GCM** with a key derived via **PBKDF2-SHA256** over the user's 4-digit PIN, 210,000 iterations, a fresh 16-byte random salt per card, and a 12-byte random IV.
- The PIN is **never sent anywhere**. Packing and unpacking both happen in the browser via WebCrypto. The server has no code path that can read the plaintext and no storage layer that holds the ciphertext or the PIN.
- A 4-digit PIN has only 10,000 possible values — PBKDF2's iteration count makes online guessing expensive, but the real security is physical: **someone who doesn't have your card cannot attempt to guess at all**.
- The card format is versioned (`c30v1.…`) so older cards stay readable when we add fields.

### What happens if you lose the card

Nothing. There is nothing to recover. That's the feature. Lose the card and the coach greets you fresh, no history, no upsell, no guilt. The promise of privacy perfection is undone the moment we hold a recovery path.

### Round-trip flow

1. **End of visit** → user picks a PIN on a large touch keypad → WebCrypto derives key → encrypts the JSON → the encrypted string is encoded into a QR. User photographs it or prints it.
2. **Next visit** → intro page offers *"I have a card."* → user pastes the code (or will scan it with a kiosk camera when v2 hardware lands) → enters PIN → WebCrypto decrypts → the payload flows into the coach's system prompt as `PRIOR VISIT` context.
3. **Persona rule**: the coach is explicitly told not to fake memory. It says *"your card told me"* or *"last time you said"* — never *"I remember you."*

### Tested

`lib/card/card.test.ts` covers pack/unpack round trip (English and Spanish), wrong-PIN rejection, malformed input, tampered ciphertext, version handling, and iteration cost. Run `pnpm test`.

## Wearable import (Apple Watch, Fitbit, Oura, etc.)

The chair doesn't connect to your watch. It doesn't need a Bluetooth pairing. Instead, for one single visit, your phone *lends* the chair the last 30 days, and then the chair forgets.

### The flow

1. During the **welcome** or **feeling** phase, the chair displays a small QR code in the corner: *"Optional — share your watch."*
2. The QR encodes `https://<chair-host>/health-import?s=<128-bit-token>`.
3. The user scans with their phone. The phone opens a page offering three choices:
   - **Demo** — three shapes (healthy / concerning / urgent), for trying the flow out.
   - **Paste** — the output JSON of the *Concierge30 Share 30 Days* iOS Shortcut (see below).
   - (Move 2) **iOS companion app** — native HealthKit tap-to-share.
4. The phone POSTs the snapshot to `/api/wearable/push` with the token.
5. The chair is already polling `/api/wearable/pull?s=<token>` on a 2-second interval. When it sees a match, the relay returns the snapshot **and wipes it**.
6. The chair computes a short prose summary (`lib/wearable/summarize.ts`) and inlines it into the coach's `RECENT DAYS` system prompt section. The coach uses it naturally in conversation — one sentence, never a list of metrics.

### The relay — what it is, what it is not

- A module-level `Map<token, {snapshot, expiresAt}>` living in the Node process memory.
- **TTL: 120 seconds**. Every `push` and `pull` sweeps expired entries.
- **Wiped on first successful pull.** The chair reads it, the relay deletes it. Second attempt returns empty.
- **No disk writes.** No database. No logging of contents.
- **No cross-token reads.** You can only fetch a token you hold.
- Tokens are **128-bit random**, generated client-side via `crypto.getRandomValues`.

If the Node process restarts, pending entries vanish. The user just re-scans the QR and tries again. That is an acceptable failure mode.

### The iOS Shortcut (for real users, not demos)

The user runs a Shortcut on their iPhone that reads the last 30 days from Apple Health, assembles a JSON object of this shape, and copies it to the clipboard:

```json
{
  "source": "apple_watch",
  "at": "2026-04-23T14:12:00Z",
  "days": [
    { "date": "2026-03-25", "restingHr": 62, "hrv": 48, "sleepMinutes": 412, "steps": 7821 },
    // ... 30 entries ...
  ],
  "events": [
    { "t": "2026-04-20T03:41:00Z", "kind": "afib", "note": "Short run of irregular rhythm" }
  ],
  "medications": ["metformin 500mg", "lisinopril 10mg"]
}
```

The Shortcut source is short and audit-friendly. It runs entirely on the user's phone. It never makes a network request to us.

### What the coach does with it

The coach gets a one-sentence prose summary — *"Their resting heart rate's been creeping up — averaged 66 in the weeks before, 74 the last week. Heart-rate variability is lower than it was."* — and weaves that naturally into the conversation. It doesn't recite numbers. It doesn't diagnose. It uses the data to ask better questions and to land on a better next step.

### What the coach never does

- Announce the metrics verbatim (*"Your HRV was 34ms"* — no).
- Draw charts. The screen never becomes a dashboard.
- Store the snapshot past the current visit. When the user leaves (`beforeunload`, navigation, tab close), `useSession.getState().reset()` wipes `wearableSnapshot` and `wearableSummary` along with everything else.

## What's ruled out

- No cloud sync. No account. No "log in with Apple." No health record on our servers.
- No cross-user aggregation. No anonymized dataset. No model fine-tuning on user data.
- No human review of any of this.
- No email, no SMS, no push notifications derived from this data.

## Auditing this yourself

```bash
# no database clients, no analytics
grep -rE "(prisma|mongoose|redis|segment|posthog|sentry|mixpanel|amplitude)" app lib components

# no disk writes, no browser storage
grep -rE "(localStorage|sessionStorage|IndexedDB|writeFile|fs\.)" app lib components

# the relay is in-memory only
grep -n "push(" lib/wearable/relay.ts

# the card crypto is WebCrypto only — no "secret" that could leak upstream
grep -rn "subtle" lib/card/
```

`GET /api/privacy` returns a manifest that always reflects the current posture. If any answer there ever changes without a corresponding change to this doc, the promise has been broken.

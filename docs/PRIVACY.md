# Privacy

Concierge30 retains nothing about you. This doc is the line-by-line commitment. `GET /api/privacy` serves a machine-readable version of the same promise.

## The short version

- No database. None. There is no Prisma client in the repo, no SQLite file, no connection string in `.env.example`.
- No disk writes server-side. No log files, no caches, no temp frames, no audio files.
- No analytics. No Segment, no PostHog, no Google Analytics, no Sentry. The only outbound requests go to Anthropic, ElevenLabs, and Deepgram — the three services that do the coach's actual work.
- No browser storage. No `localStorage`, no `sessionStorage`, no `IndexedDB`. The Zustand store lives only in the React tree and is wiped on unload.
- No human in the loop. No clinician reviews your session. No QA team sees your transcript. No sampling, ever. The coach is accountable to the deterministic urgency module and to the user, nothing else.

## What happens to each kind of data

### Your voice (microphone audio)

- Sent directly from your browser to **Deepgram's** real-time streaming endpoint over TLS. The server never sees your audio.
- We set `mip_opt_out=true`, which tells Deepgram their Model Improvement Program must not use your audio for training.
- Deepgram's default retention for real-time streaming audio is zero.
- When the visit ends (or the tab closes), the MediaStream is torn down, the Deepgram WebSocket closes, and there is nothing left.

### What you said (transcripts)

- Transcripts live briefly in the React store so the coach can respond in context.
- They are posted to `/api/coach` which forwards them to **Anthropic**. We do not log them, do not cache them, do not store them, do not write them to disk.
- If you say **"forget that"** (or the Spanish equivalent), we drop the most recent exchange from the in-memory history and from the next request to Anthropic. The coach never sees it again.
- On visit end or tab close, the store is wiped.

### Camera frames

- Frames are captured in-memory to an offscreen canvas and POSTed to `/api/observe`, which forwards one JPEG at a time to **Anthropic's** vision model.
- The camera feed is **never displayed** on screen. There is no `<video>` element in the DOM with an attached stream. (`grep -r "srcObject"` — the only hit is on a detached video used to source the canvas.)
- Frames are **never persisted**, **never logged**, and **never retained** beyond the single request.
- Only the resulting short note (a sentence about presence — breathing, tension, tiredness) is kept in memory, for at most the last six entries, and only within the current session.

### Vitals

- The scale, BP cuff, and waist band are mocked for Day One. When real drivers land, vitals will live in the same in-memory store. Same rules.
- The urgency assessment (`none` / `advise_followup` / `advise_same_day_care` / `urgent_911`) is computed by a pure, deterministic function — no LLM, no network, no randomness. It is **not** user content; it's a threshold decision.

### Logs

- All server routes use `logSafe()` from `lib/privacy/policy.ts`, which replaces any nested value that could contain user content with a shape marker like `<string:37>`. Only these keys survive redaction: `status`, `statusText`, `code`, `name`, `errno`, `cause`, `durationMs`, `model`, `phase`, `engine`.
- This means even when something breaks, the crash log tells us *that* something broke and roughly where — never what the user said.

### Chair Card (continuity)

- The card is a **user-held, client-side-encrypted blob**. The server has no code path that sees plaintext and no storage that holds ciphertext or PIN.
- Crypto: **AES-256-GCM** with a key derived via **PBKDF2-SHA256** (210k iterations) from a 4-digit PIN you choose. Per-card random salt and IV. WebCrypto only — never Node crypto running on a server.
- There is **no recovery path** if you lose the card. By design.
- Full detail: `docs/CONTINUITY.md`.

### Wearable import (Apple Watch, etc.)

- Your phone sends the snapshot to our server via an ephemeral 128-bit-token relay.
- The relay is an **in-memory Map** in the Node process, TTL **120 seconds**, **wiped on first successful pull**. No disk. No logging of contents. Restarting the process wipes all pending entries.
- The chair uses the data for the current visit only; `beforeunload` / navigation / tab close wipe `wearableSnapshot` from the React store.

## Vendor posture

We use three vendors. Each is invoked with the strongest available privacy posture per request. Account-level policy (ZDR tier on Anthropic, Enterprise ZRM on ElevenLabs, enterprise contract on Deepgram) is a separate lever that must be pulled by whoever operates the deployment.

| Vendor | Per-request posture |
|---|---|
| Anthropic | No `metadata.user_id` ever set. No prompt caching on user content. `anthropicPrivacyHeaders()` is attached to every call. Honors account-level ZDR if configured. |
| ElevenLabs | We send text only (not audio). No identifying headers or `user_id`. Honors account-level Zero Retention Mode if configured. |
| Deepgram | `mip_opt_out=true` on every connection. No tags, no labels. Real-time streaming audio is not retained by default. |

## How you verify this yourself

- `GET /api/privacy` — returns the machine-readable manifest
- `grep -rE "(localStorage|sessionStorage|IndexedDB|writeFile|fs\\.)" app lib components` — should return no hits
- Network tab in DevTools — only Anthropic/ElevenLabs/Deepgram (and your own host) should ever appear
- `lib/privacy/policy.ts` is 130 lines and enforces everything above at the code layer

## What would break the promise

- Adding any database client (Prisma, Mongoose, Redis, etc.)
- Adding any analytics SDK
- Logging a raw `err.message` without `logSafe`
- Rendering a `<video>` element with a camera stream attached
- Writing to `localStorage` / `sessionStorage`
- Any `fetch` to a vendor we haven't named here

Any PR that does any of those must be rejected.

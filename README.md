# Concierge30 — Day One

AI health coach for a private suite inside a retail location. Voice-first, camera-only-the-coach-sees, touch-second.

Day One is a complete Tier 0 single-visit experience running on localhost. See `AGENTS.md` for principles and scope.

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in keys (all three are optional — fallbacks work without them)
pnpm dev
```

Open http://localhost:3000 — pick a scenario on the intro page (healthy / concerning / urgent), click **Begin**, walk through a visit.

Keys:

- `ANTHROPIC_API_KEY` — the coach and the vision observer. Required for real LLM responses; otherwise a scripted fallback is used so the flow still demonstrates.
- `ELEVENLABS_API_KEY` — voice. Falls back to Web Speech Synthesis if missing.
- `DEEPGRAM_API_KEY` — speech-to-text. Falls back to Web Speech Recognition if missing.
- `NEXT_PUBLIC_USE_REAL_VOICE` — set to `false` to force fallbacks even if keys are present.

## Scripts

- `pnpm dev` — run the app at http://localhost:3000
- `pnpm test` — urgency tests (Vitest)
- `pnpm typecheck` — TypeScript strict check
- `pnpm build` — production build

## Layout

```
app/              Next.js app router
  (kiosk)/        Kiosk routes (intro, visit, test pages)
  api/            Coach + voice + observation routes
components/       Kiosk primitives, measurement viz, intro cards
lib/
  coach/          Persona + deterministic urgency module (+ tests)
  hardware/       Adapter interface + browser-runnable mock
  voice/          ElevenLabs, Deepgram, Web Speech fallbacks
  camera/         Frame capture + observation pipeline
  store/          Zustand session state
docs/             Principles, tiers, voice, camera
```

## Privacy

Concierge30 retains nothing about you. No database. No server logs of user content. No human-in-the-loop review. No browser storage. See `docs/PRIVACY.md` for the line-by-line commitment; `GET /api/privacy` returns the machine-readable promise.

## Bilingual

The moment the coach hears a language other than English, it switches and stays there. Deepgram STT runs with `detect_language=true`; ElevenLabs Turbo is multilingual; the persona has an explicit language-switch rule. Day One supports the languages Deepgram Nova-2 detects (en, es, fr, de, it, pt, nl, ja, ko, zh, hi, ru).

## The handoff letter

At the end of every visit, the coach writes a one-paragraph letter in your own voice — the thing you hand across a clinic's reception counter so you don't start from zero. Print button on the takeaway screen.

## What this is not

No database. No returning user recognition. No deployment config. Those are Move 2.

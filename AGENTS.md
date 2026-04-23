# Concierge30 — agent rules

## This is NOT the Next.js you know

Next.js 16 + React 19. APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Heed deprecation notices.

## The 7 principles (do not violate)

1. **Tier 0 must be a complete experience.** No teaser, no upsell path. A person with no phone, no account, no ID gets real value from one visit.
2. **The chair is the product, not the room.** Never ask the user to get up or navigate physical space.
3. **Radical simplicity beats clinical comprehensiveness.** When in doubt, remove.
4. **Dignity over data.** Never make the user feel measured, judged, scored, surveilled. No leaderboards, streaks, or pass/fail colors.
5. **The game is belonging, not points.** No gamification in V1. No streaks, badges, or progress bars, even as "easy wins."
6. **Trust before engagement.** No account prompts, no upsells, no "create a profile to unlock" before visit 3 minimum.
7. **Voice-first, touch-second; camera only the coach can see.** Camera is active for observation, but the feed is never shown on screen, never persisted, never sent anywhere except to the model that needs it for that moment.

## Scope — Day One (Move 1)

In scope: streaming coach, ElevenLabs TTS, Deepgram STT, barge-in, live vitals viz, camera observations the user doesn't see, mocked hardware, deterministic urgency module with tests.

Out of scope: persistence, Tier 1+ returning users, SMS, deployment, real drivers, gamification, i18n, print generation beyond visual preview.

## Build rules

- TypeScript strict. No `any` without a justifying comment.
- No component libraries. Primitives are built here.
- No comments describing what code does; only comments for non-obvious why.
- Do not add features, fallbacks, or validation for cases that can't happen. Trust internal callers.
- If a feature is not on the Day One list, stop and ask.

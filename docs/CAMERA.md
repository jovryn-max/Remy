# Camera

The camera is on during the visit. The user does not see it. Only the coach — the model — sees the frames, and only at the moment it needs them. This doc exists so the promise is auditable.

## What happens, step by step

1. When the visit starts, `createCamera()` calls `getUserMedia({ video: true, audio: false })`.
2. The returned `MediaStream` is attached to an in-memory `<video>` element that is **never appended to the DOM**. There is no preview surface, anywhere.
3. Every ~5.5 seconds while the visit is active, one frame is drawn to an offscreen canvas, converted to a JPEG data URL, and POSTed to `/api/observe`.
4. `/api/observe` forwards the JPEG to Claude Haiku (vision) with an observer system prompt that produces **one short private note** about presence — breathing, tension, tiredness, affect.
5. The note is stored in the session's in-memory `cameraNotes` array (last six).
6. The coach's `/api/coach` route appends the last three notes to its system prompt under a `PRIVATE OBSERVATIONS` header that tells the coach to *use the notes to inform tone, never to announce them*.

## What never happens

- The camera feed is **never displayed on screen**. There is no `<video>` DOM node with an attached stream.
- Frames are **never written to disk**.
- Frames are **never logged**.
- Nothing camera-derived is persisted beyond the current page session. Navigating to `/intro` resets the store.
- The notes themselves are short sentences — they never include the raw image, and they should never include identifying description (see the observer system prompt in `app/api/observe/route.ts`).

## The affordance the user sees

A small warm dot and a sentence: **"The coach can see you — only the coach."** It's present throughout the visit. If the user doesn't want to be observed, they can turn their head. If they want to stop entirely, tap the indicator (future work — currently requires reloading).

## Future hardening (Move 2+)

- On-device only for certain observations (breathing rate can be computed locally from optical flow — no need to send a frame).
- Explicit per-frame user dismissal ("Not this one") that drops the frame before upload.
- A privacy badge that turns gray when the camera is off, not just "off text."

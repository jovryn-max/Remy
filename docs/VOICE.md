# Voice

The coach's voice is the product. Everything else is instrumentation.

## Stack

| Layer | Primary | Fallback |
|---|---|---|
| **TTS** | ElevenLabs — voice `Rachel` (`21m00Tcm4TlvDq8ikWAM`), model `eleven_turbo_v2_5`, stability 0.5 / similarity 0.75 / style 0.3 | Web Speech Synthesis (`window.speechSynthesis`) |
| **STT** | Deepgram — model `nova-2`, interim results + VAD + smart format | Web Speech Recognition (`webkitSpeechRecognition`) |
| **Barge-in** | Custom: 85Hz–3kHz RMS with 130ms sustain threshold | — |

If `NEXT_PUBLIC_USE_REAL_VOICE=false` (or API keys are missing), the app silently uses the fallback path — the visit still works, it just sounds different. The active engine is logged in the browser console and shown on `/voice-test`.

## How the coach "speaks"

1. `/api/coach` returns a streaming text response from Claude (Opus).
2. A `SentenceSplitter` buffers incoming tokens and emits complete sentences (or long comma clauses) as soon as they're ready.
3. Each sentence is posted to `/api/voice/tts` which proxies a single ElevenLabs call and streams MP3 bytes back.
4. Sentences play sequentially with small gaps — 350ms after periods, 180ms after commas — so pacing feels human.

Perceived latency is dominated by the first sentence. Everything else is time-sliced in parallel with the listener's attention.

## How we hear the user

- Deepgram's streaming WebSocket speaks the user's words in near-real-time. Interim results are shown in the caption in italic grey so they feel like provisional thoughts, not final transcript.
- End-of-utterance is detected by Deepgram's VAD event plus a ~1.4s silence fallback. The coach never interrupts the user's end-of-thought.

## Barge-in

While the coach is speaking:

- The mic stays open in a separate AudioContext.
- Every animation frame we compute RMS over the 85Hz–3kHz band.
- If RMS > 0.08 for 130ms continuously, we cancel the current TTS playback, drop the sentence queue, abort the in-flight fetch, and open a Deepgram session.

Tap-to-interrupt: any pointer-down on the caption area calls `voice.interrupt()` with the same effect. This gives users who can't or won't speak — or whose speech isn't understood — a dignified manual override.

## Known limits (Day One)

- Deepgram token exchange: the `/api/voice/stt` route currently returns the API key directly. This is safe for localhost only. Before any deployment, swap this for a short-lived, project-scoped Deepgram key via their Key Management API.
- Web Audio barge-in uses `getByteFrequencyData`, which is 8-bit quantized. Good enough for voice detection, not good enough for SNR measurement. If false-triggers become an issue in a noisy room, move to `getFloatFrequencyData` with a higher threshold and a longer sustain.
- Web Speech fallback voices vary wildly by browser and OS. `Samantha` on macOS is passable; most desktop Chrome voices are not. The fallback is for "the demo still works," not "the demo sounds right."

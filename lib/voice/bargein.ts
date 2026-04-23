"use client";

/**
 * Barge-in detector.
 *
 * Monitors the mic level in the voice frequency band (85Hz–3kHz) while the
 * coach is speaking. If the user's voice sustains above threshold for
 * SUSTAIN_MS, we fire onBargeIn and the caller cancels TTS + starts STT.
 *
 * Why band-limited RMS and not raw level: HVAC hum and chair creaks sit mostly
 * below 85Hz; sibilance and room tone above 3kHz. The voice band is the part
 * that matters for "is a person starting to talk right now."
 */
export type BargeInController = {
  start(onBargeIn: () => void): Promise<void>;
  stop(): void;
  currentLevel(): number;
};

const BAND_MIN_HZ = 85;
const BAND_MAX_HZ = 3000;
const THRESHOLD = 0.08; // 0..1 RMS in voice band
const SUSTAIN_MS = 130;

export function createBargeIn(): BargeInController {
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let raf = 0;
  let sustainStart = 0;
  let lastLevel = 0;

  async function start(onBargeIn: () => void) {
    if (ctx) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return;
    }
    const AC =
      (window.AudioContext as typeof AudioContext) ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);

    const bins = analyser.frequencyBinCount;
    const data = new Uint8Array(bins);
    const nyquist = ctx.sampleRate / 2;
    const binHz = nyquist / bins;
    const minBin = Math.max(1, Math.floor(BAND_MIN_HZ / binHz));
    const maxBin = Math.min(bins - 1, Math.floor(BAND_MAX_HZ / binHz));

    const tick = () => {
      if (!analyser) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = minBin; i <= maxBin; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / (maxBin - minBin + 1)) / 255;
      lastLevel = rms;
      const now = performance.now();
      if (rms > THRESHOLD) {
        if (sustainStart === 0) sustainStart = now;
        if (now - sustainStart >= SUSTAIN_MS) {
          sustainStart = 0;
          onBargeIn();
          stop();
          return;
        }
      } else {
        sustainStart = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    try {
      source?.disconnect();
    } catch {}
    source = null;
    analyser = null;
    try {
      ctx?.close();
    } catch {}
    ctx = null;
    try {
      stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    stream = null;
    sustainStart = 0;
  }

  return {
    start,
    stop,
    currentLevel: () => lastLevel,
  };
}

"use client";

import { createSentenceSplitter } from "./sentences";

export type TtsEngine = "elevenlabs" | "webspeech" | "none";

export type TtsController = {
  speak(text: string): Promise<void>;
  cancel(): void;
  onEngine(cb: (engine: TtsEngine) => void): void;
};

/**
 * A sentence-queuing TTS controller.
 *
 * - Primary: POST /api/voice/tts per sentence, stream MP3 back, play sequentially.
 * - Fallback: SpeechSynthesisUtterance.
 *
 * Barge-in is handled by cancel() — it stops current playback, drops the queue,
 * and aborts any in-flight fetches.
 */
export function createTts(): {
  speakStream(getNext: () => Promise<string | null>, onBoundary?: (text: string) => void): Promise<void>;
  speakOne(text: string, onBoundary?: (text: string) => void): Promise<void>;
  cancel(): void;
  engine(): TtsEngine;
  probe(): Promise<TtsEngine>;
} {
  let currentAudio: HTMLAudioElement | null = null;
  let currentAbort: AbortController | null = null;
  let currentUtterance: SpeechSynthesisUtterance | null = null;
  let engineUsed: TtsEngine = "none";

  async function playElevenOnce(text: string): Promise<boolean> {
    if (typeof window === "undefined") return false;
    const abort = new AbortController();
    currentAbort = abort;
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
        signal: abort.signal,
      });
      if (!res.ok || res.status === 204 || !res.body) {
        return false;
      }
      engineUsed = "elevenlabs";
      const blob = await res.blob();
      if (abort.signal.aborted) return true;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        if (abort.signal.aborted) {
          audio.pause();
          URL.revokeObjectURL(url);
          resolve();
          return;
        }
        audio.play().catch(() => resolve());
      });
      return true;
    } catch {
      return false;
    } finally {
      currentAudio = null;
      currentAbort = null;
    }
  }

  function playWebSpeech(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        resolve();
        return;
      }
      engineUsed = "webspeech";
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.98;
      u.pitch = 1.0;
      u.volume = 1.0;
      const voices = window.speechSynthesis.getVoices();
      // Prefer a warm English voice if one is available.
      const pref =
        voices.find((v) => /Samantha|Jenny|Aria|Karen|female/i.test(v.name)) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0];
      if (pref) u.voice = pref;
      currentUtterance = u;
      u.onend = () => {
        currentUtterance = null;
        resolve();
      };
      u.onerror = () => {
        currentUtterance = null;
        resolve();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    });
  }

  async function speakOne(text: string, onBoundary?: (text: string) => void) {
    if (!text.trim()) return;
    onBoundary?.(text);
    const ok = await playElevenOnce(text);
    if (!ok) {
      await playWebSpeech(text);
    }
  }

  async function speakStream(
    getNext: () => Promise<string | null>,
    onBoundary?: (text: string) => void,
  ) {
    const splitter = createSentenceSplitter();
    let done = false;
    const queue: { text: string; pauseMs: number }[] = [];
    let producerErr: unknown = null;

    const producer = (async () => {
      try {
        while (true) {
          const next = await getNext();
          if (next === null) break;
          const chunks = splitter.push(next);
          for (const c of chunks) queue.push({ text: c.text, pauseMs: c.trailingPauseMs });
        }
        for (const c of splitter.flush()) queue.push({ text: c.text, pauseMs: c.trailingPauseMs });
      } catch (e) {
        producerErr = e;
      } finally {
        done = true;
      }
    })();

    while (!done || queue.length) {
      const item = queue.shift();
      if (!item) {
        await new Promise((r) => setTimeout(r, 40));
        continue;
      }
      if (currentAbort?.signal.aborted) break;
      await speakOne(item.text, onBoundary);
      if (currentAbort?.signal.aborted) break;
      if (item.pauseMs > 0) await new Promise((r) => setTimeout(r, item.pauseMs));
    }
    await producer;
    if (producerErr) throw producerErr;
  }

  function cancel() {
    if (currentAbort) {
      currentAbort.abort();
      currentAbort = null;
    }
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = "";
      currentAudio = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    currentUtterance = null;
  }

  async function probe(): Promise<TtsEngine> {
    if (typeof window === "undefined") return "none";
    const useReal = process.env.NEXT_PUBLIC_USE_REAL_VOICE !== "false";
    if (!useReal) {
      return "speechSynthesis" in window ? "webspeech" : "none";
    }
    try {
      const r = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "." }),
      });
      if (r.ok && r.status !== 204) {
        r.body?.cancel().catch(() => {});
        return "elevenlabs";
      }
    } catch {}
    return "speechSynthesis" in window ? "webspeech" : "none";
  }

  return {
    speakOne,
    speakStream,
    cancel,
    engine: () => engineUsed,
    probe,
  };
}

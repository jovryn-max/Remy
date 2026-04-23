"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createTts, type TtsEngine } from "./tts-client";
import { createStt, type SttEngine } from "./stt-client";
import { createBargeIn } from "./bargein";

export type VoiceMode = "idle" | "speaking" | "listening" | "thinking";

export type UseVoice = {
  mode: VoiceMode;
  captionText: string;
  interimText: string;
  ttsEngine: TtsEngine | "probing";
  sttEngine: SttEngine | "idle";
  speakStream: (getNext: () => Promise<string | null>) => Promise<string>;
  listen: () => Promise<string>;
  interrupt: () => void;
  setMode: (m: VoiceMode) => void;
  setCaption: (s: string) => void;
};

export function useVoice(): UseVoice {
  const [mode, setMode] = useState<VoiceMode>("idle");
  const [captionText, setCaption] = useState("");
  const [interimText, setInterim] = useState("");
  const [ttsEngine, setTtsEngine] = useState<TtsEngine | "probing">("probing");
  const [sttEngine, setSttEngine] = useState<SttEngine | "idle">("idle");

  const tts = useMemo(() => createTts(), []);
  const stt = useMemo(() => createStt(), []);
  const bargeIn = useMemo(() => createBargeIn(), []);
  const interruptedRef = useRef(false);
  const listenResolveRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    tts.probe().then((e) => setTtsEngine(e));
    return () => {
      tts.cancel();
      stt.stop();
      bargeIn.stop();
    };
  }, [tts, stt, bargeIn]);

  async function speakStream(getNext: () => Promise<string | null>): Promise<string> {
    interruptedRef.current = false;
    setMode("speaking");
    setCaption("");
    let accumulated = "";

    await bargeIn.start(() => {
      interruptedRef.current = true;
      tts.cancel();
    });

    const wrapped = async () => {
      const next = await getNext();
      if (next === null) return null;
      accumulated += next;
      setCaption(accumulated);
      return next;
    };

    try {
      await tts.speakStream(wrapped);
    } finally {
      bargeIn.stop();
    }

    setTtsEngine(tts.engine());

    if (interruptedRef.current) {
      const heard = await listen();
      return `__INTERRUPT__:${heard}`;
    }
    setMode("idle");
    return accumulated;
  }

  function listen(): Promise<string> {
    setMode("listening");
    setInterim("");
    return new Promise((resolve) => {
      listenResolveRef.current = resolve;
      let final = "";
      let stopTimer: ReturnType<typeof setTimeout> | null = null;
      const endOnSilence = () => {
        if (stopTimer) clearTimeout(stopTimer);
        stopTimer = setTimeout(() => {
          stt.stop();
        }, 1400);
      };
      stt.start({
        onInterim: (t) => {
          setInterim(t);
          endOnSilence();
        },
        onFinal: (t) => {
          final = t;
          setInterim(t);
          endOnSilence();
        },
        onEnd: () => {
          setSttEngine(stt.engine());
          setMode("idle");
          setInterim("");
          listenResolveRef.current = null;
          resolve((final || "").trim());
        },
        onError: () => {
          /* onEnd will still fire */
        },
      });
      // Safety net — don't listen forever.
      setTimeout(() => stt.stop(), 20000);
    });
  }

  function interrupt() {
    tts.cancel();
    interruptedRef.current = true;
  }

  return {
    mode,
    captionText,
    interimText,
    ttsEngine,
    sttEngine,
    speakStream,
    listen,
    interrupt,
    setMode,
    setCaption,
  };
}

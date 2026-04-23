"use client";

import { useMemo, useState } from "react";
import { Surface, ChoiceButton, CoachCaption, ListenIndicator } from "@/components/kiosk";
import { createTts } from "@/lib/voice/tts-client";
import { createStt } from "@/lib/voice/stt-client";
import { createBargeIn } from "@/lib/voice/bargein";

const SAMPLE =
  "Okay. The chair took a few quick readings. Your pressure's running a little high today. Not scary. Just a little high. How's sleep been?";

export default function VoiceTestPage() {
  const tts = useMemo(() => createTts(), []);
  const stt = useMemo(() => createStt(), []);
  const barge = useMemo(() => createBargeIn(), []);
  const [caption, setCaption] = useState("");
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [mode, setMode] = useState<"idle" | "speaking" | "listening">("idle");
  const [ttsEngine, setTtsEngine] = useState<string>("-");
  const [sttEngine, setSttEngine] = useState<string>("-");
  const [level, setLevel] = useState(0);

  async function speakSample() {
    setMode("speaking");
    setCaption("");
    let out = "";
    const chars = Array.from(SAMPLE);
    let i = 0;
    const getNext = async () => {
      if (i >= chars.length) return null;
      const slice = chars.slice(i, i + 8).join("");
      i += 8;
      out += slice;
      setCaption(out);
      return slice;
    };
    await barge.start(() => {
      tts.cancel();
    });
    await tts.speakStream(getNext);
    barge.stop();
    setTtsEngine(tts.engine());
    setMode("idle");
  }

  function listen() {
    setMode("listening");
    setInterim("");
    setFinalText("");
    stt.start({
      onInterim: (t) => setInterim(t),
      onFinal: (t) => setFinalText(t),
      onEnd: () => {
        setSttEngine(stt.engine());
        setMode("idle");
      },
    });
    setTimeout(() => stt.stop(), 8000);
  }

  async function bargeinTest() {
    setMode("speaking");
    setCaption("");
    let out = "";
    const chars = Array.from(SAMPLE);
    let i = 0;
    const getNext = async () => {
      if (i >= chars.length) return null;
      const slice = chars.slice(i, i + 8).join("");
      i += 8;
      out += slice;
      setCaption(out);
      return slice;
    };
    await barge.start(() => {
      tts.cancel();
      setMode("idle");
    });
    const interval = setInterval(() => setLevel(barge.currentLevel()), 100);
    await tts.speakStream(getNext);
    clearInterval(interval);
    barge.stop();
    setTtsEngine(tts.engine());
    setMode("idle");
  }

  return (
    <Surface>
      <div className="w-full flex flex-col gap-8">
        <div>
          <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)] mb-3">
            Voice test
          </div>
          <h1 className="coach-voice text-[40px] leading-tight text-[color:var(--c-ink)]">
            Exercise TTS, STT, and barge-in independently.
          </h1>
        </div>

        <div className="flex items-center gap-4 text-[13px] text-[color:var(--c-ink-soft)]">
          <ListenIndicator mode={mode === "idle" ? "idle" : mode} />
          <span>TTS engine: <b>{ttsEngine}</b></span>
          <span>STT engine: <b>{sttEngine}</b></span>
          <span>Mic level: {level.toFixed(2)}</span>
        </div>

        <div className="c-paper p-8">
          <CoachCaption text={caption || SAMPLE} mode={mode === "speaking" ? "speaking" : "idle"} />
        </div>

        <div className="flex gap-3 flex-wrap">
          <ChoiceButton onClick={speakSample}>Speak sample</ChoiceButton>
          <ChoiceButton variant="quiet" onClick={listen}>
            Listen 8s
          </ChoiceButton>
          <ChoiceButton variant="quiet" onClick={bargeinTest}>
            Barge-in test
          </ChoiceButton>
          <ChoiceButton variant="quiet" onClick={() => tts.cancel()}>
            Cancel speech
          </ChoiceButton>
        </div>

        <div className="text-[18px] text-[color:var(--c-ink)]">
          <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)] mb-2">
            You said
          </div>
          {interim && <div className="italic text-[color:var(--c-ink-soft)]">&ldquo;{interim}&rdquo;</div>}
          {finalText && <div className="mt-1 coach-voice text-[24px]">{finalText}</div>}
        </div>
      </div>
    </Surface>
  );
}

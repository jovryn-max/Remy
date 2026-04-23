"use client";

export type SttEngine = "deepgram" | "webspeech" | "none";

export type SttEvents = {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
};

type DeepgramTokenResponse = {
  available: boolean;
  token?: string;
  model?: string;
  config?: Record<string, unknown>;
};

/**
 * Creates a one-shot listen session. Call start() when you want to listen for
 * a user turn, then stop() to finalize. The controller picks Deepgram if the
 * token endpoint returns one; otherwise Web Speech Recognition; otherwise none.
 */
export function createStt() {
  let ws: WebSocket | null = null;
  let mediaStream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let recognition: SpeechRecognition | null = null;
  let engine: SttEngine = "none";
  let finalText = "";
  let interimText = "";

  async function startDeepgram(ev: SttEvents, token: string, config: Record<string, unknown>): Promise<boolean> {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(config)) {
        qs.set(k, String(v));
      }
      qs.set("encoding", "linear16");
      // MediaRecorder most reliable mime is audio/webm;opus — Deepgram accepts it
      // via the `encoding` query param. Use containerized webm to skip setting encoding.
      const url = `wss://api.deepgram.com/v1/listen?model=nova-2&${qs.toString()}`;
      ws = new WebSocket(url, ["token", token]);

      ws.onopen = () => {
        if (!mediaStream) return;
        recorder = new MediaRecorder(mediaStream, { mimeType: "audio/webm;codecs=opus" });
        recorder.ondataavailable = (e) => {
          if (ws?.readyState === WebSocket.OPEN && e.data.size > 0) {
            e.data.arrayBuffer().then((buf) => ws?.send(buf));
          }
        };
        recorder.start(120);
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === "Results") {
            const alt = data.channel?.alternatives?.[0];
            if (!alt) return;
            if (data.is_final) {
              finalText = (finalText + " " + alt.transcript).trim();
              interimText = "";
              ev.onFinal?.(finalText);
            } else {
              interimText = alt.transcript;
              ev.onInterim?.((finalText + " " + interimText).trim());
            }
          } else if (data.type === "UtteranceEnd") {
            if (finalText) ev.onFinal?.(finalText);
          }
        } catch {}
      };

      ws.onerror = (e) => ev.onError?.(e);
      ws.onclose = () => ev.onEnd?.();

      engine = "deepgram";
      return true;
    } catch (err) {
      ev.onError?.(err);
      return false;
    }
  }

  function startWebSpeech(ev: SttEvents): boolean {
    if (typeof window === "undefined") return false;
    const SR =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) return false;
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      let interim = "";
      let final = finalText;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final = (final + " " + t).trim();
        else interim += t;
      }
      if (final !== finalText) {
        finalText = final;
        ev.onFinal?.(finalText);
      } else if (interim) {
        interimText = interim;
        ev.onInterim?.((finalText + " " + interim).trim());
      }
    };
    recognition.onerror = (e) => ev.onError?.(e);
    recognition.onend = () => ev.onEnd?.();
    try {
      recognition.start();
      engine = "webspeech";
      return true;
    } catch (err) {
      ev.onError?.(err);
      return false;
    }
  }

  async function start(ev: SttEvents) {
    finalText = "";
    interimText = "";
    const useReal = process.env.NEXT_PUBLIC_USE_REAL_VOICE !== "false";
    if (useReal) {
      try {
        const resp = await fetch("/api/voice/stt");
        if (resp.ok) {
          const token = (await resp.json()) as DeepgramTokenResponse;
          if (token.available && token.token) {
            const ok = await startDeepgram(ev, token.token, token.config || {});
            if (ok) return;
          }
        }
      } catch {}
    }
    const ok = startWebSpeech(ev);
    if (!ok) {
      engine = "none";
      ev.onError?.(new Error("no stt engine available"));
      ev.onEnd?.();
    }
  }

  function stop() {
    try {
      recorder?.stop();
    } catch {}
    recorder = null;
    try {
      mediaStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    mediaStream = null;
    try {
      ws?.close();
    } catch {}
    ws = null;
    try {
      recognition?.stop();
    } catch {}
    recognition = null;
  }

  return {
    start,
    stop,
    engine: () => engine,
    transcript: () => (finalText + " " + interimText).trim(),
  };
}

// Minimal ambient typings for Web Speech Recognition (not in lib.dom in all envs).
declare global {
  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
  }
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((ev: SpeechRecognitionEvent) => void) | null;
    onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  }
  // eslint-disable-next-line @typescript-eslint/no-misused-new
  interface SpeechRecognitionConstructor {
    new (): SpeechRecognition;
  }
  var SpeechRecognition: SpeechRecognitionConstructor;
  // Result list shapes are already in lib.dom; no need to redefine.
}

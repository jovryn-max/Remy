"use client";

/**
 * Coach-only camera. The user never sees this feed.
 *
 * - Acquires a MediaStream via getUserMedia.
 * - Captures a single still frame at request time onto an offscreen canvas.
 * - Sends the data URL to /api/observe for a short private note.
 * - Never displays the stream, never persists frames.
 */

export type CameraController = {
  start(): Promise<{ ok: boolean; reason?: string }>;
  stop(): void;
  observeNow(): Promise<string>;
  active(): boolean;
};

export function createCamera(): CameraController {
  let stream: MediaStream | null = null;
  let video: HTMLVideoElement | null = null;
  let canvas: HTMLCanvasElement | null = null;

  async function start() {
    if (stream) return { ok: true };
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      canvas = document.createElement("canvas");
      return { ok: true };
    } catch (err) {
      stream = null;
      return { ok: false, reason: (err as Error).message };
    }
  }

  function stop() {
    try {
      stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    stream = null;
    video = null;
    canvas = null;
  }

  async function observeNow(): Promise<string> {
    if (!stream || !video || !canvas) return "";
    try {
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
      const res = await fetch("/api/observe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!res.ok) return "";
      const body = (await res.json()) as { note: string };
      return body.note || "";
    } catch {
      return "";
    }
  }

  return {
    start,
    stop,
    observeNow,
    active: () => stream != null,
  };
}

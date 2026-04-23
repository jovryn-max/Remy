"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChoiceButton } from "@/components/kiosk";
import { demoSnapshot, parseShortcutJson } from "@/lib/wearable/parse";
import type { WearableSnapshot } from "@/lib/wearable/types";

type Status = "ready" | "sending" | "sent" | "error";

function HealthImportInner() {
  const sp = useSearchParams();
  const token = sp.get("s") ?? "";
  const [status, setStatus] = useState<Status>("ready");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [text, setText] = useState<string>("");

  useEffect(() => {
    if (!token) setStatus("error");
  }, [token]);

  async function send(snapshot: WearableSnapshot) {
    setStatus("sending");
    try {
      const res = await fetch("/api/wearable/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, snapshot }),
      });
      if (!res.ok) throw new Error("push failed");
      setStatus("sent");
    } catch {
      setErrorMsg("couldn't send — try again");
      setStatus("error");
    }
  }

  async function sendPasted() {
    const parsed = parseShortcutJson(text);
    if (!parsed.ok) {
      setErrorMsg(parsed.reason);
      setStatus("error");
      return;
    }
    await send(parsed.snapshot);
  }

  return (
    <main className="min-h-screen px-6 py-12 flex flex-col items-center">
      <div className="w-full max-w-[520px] flex flex-col gap-6">
        <div>
          <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)]">
            Concierge30
          </div>
          <h1 className="coach-voice text-[36px] leading-tight text-[color:var(--c-ink)] mt-2">
            Share the last 30 days with the chair you're sitting in.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--c-ink-soft)]">
            Your phone sends this directly to your chair's session. Nothing is saved on our side — the page that picks it up wipes it within seconds.
          </p>
        </div>

        {status === "sent" && (
          <div className="c-paper p-6">
            <div className="coach-voice text-[24px] text-[color:var(--c-ink)]">Sent. You can put your phone down.</div>
            <div className="mt-2 text-[13px] text-[color:var(--c-ink-faint)]">
              The chair should pick this up within a couple seconds.
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="c-paper p-6">
            <div className="coach-voice text-[22px] text-[color:var(--c-ink)]">
              {errorMsg || (token ? "Something didn't work." : "Missing session token — try scanning the QR again.")}
            </div>
            <div className="mt-3">
              <ChoiceButton variant="quiet" onClick={() => setStatus("ready")}>
                Try again
              </ChoiceButton>
            </div>
          </div>
        )}

        {status === "ready" && token && (
          <>
            <div className="c-paper p-6 flex flex-col gap-3">
              <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)]">
                Fastest — demo data
              </div>
              <div className="text-[15px] text-[color:var(--c-ink-soft)]">
                For trying it out. Picks one of three shapes of recent data.
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <ChoiceButton onClick={() => send(demoSnapshot("healthy"))}>Healthy shape</ChoiceButton>
                <ChoiceButton variant="quiet" onClick={() => send(demoSnapshot("concerning"))}>
                  Concerning shape
                </ChoiceButton>
                <ChoiceButton variant="quiet" onClick={() => send(demoSnapshot("urgent"))}>
                  Urgent shape
                </ChoiceButton>
              </div>
            </div>

            <div className="c-paper p-6 flex flex-col gap-3">
              <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)]">
                Real — paste the iOS Shortcut output
              </div>
              <div className="text-[13px] text-[color:var(--c-ink-soft)] leading-relaxed">
                Install the &ldquo;Concierge30 Share 30 Days&rdquo; iOS Shortcut (see docs/CONTINUITY.md). Run it, copy the JSON, paste below.
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`{"source": "apple_watch", "days": [...], "events": [...]}`}
                className="w-full min-h-[140px] p-3 rounded-[12px] bg-[color:var(--c-paper)] border border-[color:var(--c-muted)] text-[13px] font-mono text-[color:var(--c-ink)] outline-none focus:border-[color:var(--c-accent)]"
              />
              <div>
                <ChoiceButton onClick={sendPasted} disabled={!text.trim()}>
                  Send to the chair
                </ChoiceButton>
              </div>
            </div>
          </>
        )}

        <div className="text-[12px] text-[color:var(--c-ink-faint)] leading-relaxed mt-6">
          The chair session token in this URL is good once, for up to 2 minutes. After the chair picks up your data, it's wiped from the relay immediately.
        </div>
      </div>
    </main>
  );
}

export default function HealthImportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <HealthImportInner />
    </Suspense>
  );
}

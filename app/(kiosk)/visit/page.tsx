"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Surface, CoachCaption, ListenIndicator, ChoiceButton } from "@/components/kiosk";
import { BPCuffViz } from "@/components/measurement/BPCuffViz";
import { ScaleViz } from "@/components/measurement/ScaleViz";
import { WaistViz } from "@/components/measurement/WaistViz";
import { CameraIndicator } from "@/components/measurement/CameraIndicator";
import { useSession, type VisitPhase } from "@/lib/store/session";
import { createMockHardware } from "@/lib/hardware/mock";
import { createCamera } from "@/lib/camera/camera-client";
import { useVoice } from "@/lib/voice/useVoice";
import { streamCoach } from "@/lib/coach/stream-client";
import { assessUrgency } from "@/lib/coach/urgency";
import { assessIsolation } from "@/lib/coach/isolation";
import { assessCrisis } from "@/lib/coach/crisis";
import { summarizeWearable } from "@/lib/wearable/summarize";
import { ImportQr } from "@/components/wearable/ImportQr";
import { ChairCard } from "@/components/card/ChairCard";
import { PinPad } from "@/components/card/PinPad";
import { CrisisPanel } from "@/components/crisis/CrisisPanel";
import type { CardPayload } from "@/lib/card/card";

function vitalsSummary(
  bp?: { systolic: number; diastolic: number; pulse: number },
  weight?: number,
  waist?: number,
) {
  const parts: string[] = [];
  if (bp) parts.push(`BP ${bp.systolic}/${bp.diastolic}, pulse ${bp.pulse}`);
  if (typeof weight === "number") parts.push(`weight ${weight.toFixed(1)} lbs`);
  if (typeof waist === "number") parts.push(`waist ${waist.toFixed(1)} in`);
  return parts.join(", ");
}

export default function VisitPage() {
  const router = useRouter();
  const session = useSession();
  const voice = useVoice();
  const [vizVisible, setVizVisible] = useState(false);
  const [takeawayVisible, setTakeawayVisible] = useState(false);
  const [cameraReason, setCameraReason] = useState<string | null>(null);

  const hardware = useMemo(() => createMockHardware({ scenario: session.scenario }), [session.scenario]);
  const camera = useMemo(() => createCamera(), []);
  const startedRef = useRef(false);
  const [cardPayloadForPrint, setCardPayloadForPrint] = useState<CardPayload | null>(null);
  const [pinEntry, setPinEntry] = useState<string>("");
  const [writingCard, setWritingCard] = useState<boolean>(false);

  useEffect(() => {
    // Import token — 128 bits, browser-generated, never logged.
    if (!useSession.getState().importToken) {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      const token = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
      useSession.getState().setImportToken(token);
    }
  }, []);

  const importUrl = useMemo(() => {
    if (typeof window === "undefined" || !session.importToken) return "";
    return `${window.location.origin}/health-import?s=${session.importToken}`;
  }, [session.importToken]);

  function onWearableArrived(snapshot: import("@/lib/wearable/types").WearableSnapshot) {
    const summary = summarizeWearable(snapshot);
    useSession.getState().setWearable(snapshot, summary);
  }

  // Observation loop — fire-and-forget, kept alive while the visit is running.
  useEffect(() => {
    if (!session.cameraActive) return;
    let cancelled = false;
    const loop = async () => {
      while (!cancelled) {
        await new Promise((r) => setTimeout(r, 5500));
        if (cancelled || !session.cameraActive) return;
        const note = await camera.observeNow();
        if (note && !cancelled) useSession.getState().addCameraNote(note);
      }
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, [session.cameraActive, camera]);

  // Master flow controller — runs once.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      // Kick off the camera in the background; don't block on it.
      camera
        .start()
        .then((r) => {
          if (r.ok) {
            useSession.getState().setCameraActive(true);
          } else {
            setCameraReason(r.reason || "unavailable");
          }
        });

      await speakPhase("welcome");

      useSession.getState().setPhase("feeling");
      await speakPhase("feeling");
      const feeling = await voice.listen();
      if (feeling) {
        useSession.getState().setFeeling(feeling);
        useSession.getState().addTurn({ role: "user", content: feeling });
      }

      useSession.getState().setPhase("measuring");
      setVizVisible(true);
      // Coach briefly acknowledges while measurement starts.
      const ackPromise = speakPhase("acknowledge");

      const [scaleRes, bpRes, waistRes] = await Promise.all([
        hardware.scale.read(),
        hardware.bloodPressure.read((phase, pressure) => {
          useSession.getState().setBPPhase(phase, pressure);
        }),
        hardware.waist.read(),
      ]);

      if ("value" in scaleRes) useSession.getState().setWeight(scaleRes.value);
      if ("value" in bpRes) useSession.getState().setBP(bpRes.value);
      if ("value" in waistRes) useSession.getState().setWaist(waistRes.value);

      const bp = "value" in bpRes ? bpRes.value : undefined;
      const weight = "value" in scaleRes ? scaleRes.value : undefined;
      const waist = "value" in waistRes ? waistRes.value : undefined;
      const urgency = assessUrgency({
        bp,
        weight: typeof weight === "number" ? { value: weight, unit: "lbs" } : undefined,
        waist: typeof waist === "number" ? { value: waist, unit: "in" } : undefined,
        symptoms: feeling ? [feeling] : [],
      });
      useSession.getState().setUrgency(urgency);

      await ackPromise;

      useSession.getState().setPhase("interpret");
      await speakPhase("interpret", { vitalsSummary: vitalsSummary(bp, weight, waist) });

      // Conversational loop: 3 turns.
      useSession.getState().setPhase("explore-1");
      await speakPhase("explore-1");
      const r1 = await voice.listen();
      if (r1) useSession.getState().addTurn({ role: "user", content: r1 });

      useSession.getState().setPhase("explore-2");
      await speakPhase("explore-2");
      const r2 = await voice.listen();
      if (r2) useSession.getState().addTurn({ role: "user", content: r2 });

      useSession.getState().setPhase("explore-3");
      const step = await speakPhase("explore-3");
      useSession.getState().setNextStep(step.trim());

      useSession.getState().setPhase("confirm");
      const r3 = await voice.listen();
      if (r3) useSession.getState().addTurn({ role: "user", content: r3 });
      await speakPhase("confirm");

      useSession.getState().setPhase("takeaway");
      setTakeawayVisible(true);
      // Generate the handoff letter in parallel with the takeaway speech so it's
      // ready on screen by the time the coach finishes speaking.
      const stNow = useSession.getState();
      void fetch("/api/handoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          urgency: stNow.urgency?.level ?? "none",
          vitalsSummary: vitalsSummary(stNow.bp, stNow.weight, stNow.waist),
          feelingSummary: stNow.feeling || undefined,
          turns: stNow.turns,
        }),
      })
        .then(async (r) => {
          if (!r.ok) return;
          const data = (await r.json()) as { letter: string };
          if (data.letter) useSession.getState().setHandoffLetter(data.letter);
        })
        .catch(() => {});
      await speakPhase("takeaway");

      useSession.getState().setPhase("goodbye");
      await speakPhase("goodbye");
    };

    run().catch(() => {
      // Never log the error — it could contain user content in the rejection shape.
    });

    // Privacy: wipe the store when the tab closes or the user navigates away.
    const wipe = () => {
      try {
        useSession.getState().reset();
      } catch {}
    };
    window.addEventListener("beforeunload", wipe);
    window.addEventListener("pagehide", wipe);

    return () => {
      camera.stop();
      window.removeEventListener("beforeunload", wipe);
      window.removeEventListener("pagehide", wipe);
      useSession.getState().reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // speakPhase: push one turn through the coach, stream it to TTS, return full text.
  async function speakPhase(
    phase: string,
    extras: { vitalsSummary?: string } = {},
  ): Promise<string> {
    const st = useSession.getState();
    const userTurns = st.turns.filter((t) => t.role === "user").map((t) => t.content);
    const isolation = assessIsolation(userTurns);
    const crisis = assessCrisis(userTurns);
    if (crisis.level !== st.crisis.level || crisis.cues.length !== st.crisis.cues.length) {
      useSession.getState().setCrisis(crisis);
    }
    const { getNext } = await streamCoach({
      phase: phase as never,
      scenario: st.scenario,
      urgency: st.urgency?.level ?? "none",
      messages: st.turns.map((t) => ({ role: t.role, content: t.content })),
      cameraNotes: st.cameraNotes,
      feelingSummary: st.feeling || undefined,
      vitalsSummary: extras.vitalsSummary,
      isolationSignal: isolation.score >= 0.3 ? isolation : undefined,
      priorVisit: st.priorVisit,
      wearableNote: st.wearableSummary?.note,
      crisisLevel: crisis.level,
      crisisCategories: crisis.categories,
    });
    const full = await voice.speakStream(getNext);
    const text = full.startsWith("__INTERRUPT__:") ? "" : full;
    if (text.trim()) useSession.getState().addTurn({ role: "assistant", content: text });
    return text;
  }

  const phase = session.phase;
  const phaseIsMeasuring = phase === "measuring";

  const startOver = () => router.push("/intro");

  return (
    <Surface onInterrupt={voice.mode === "speaking" ? voice.interrupt : undefined}>
      <div className="w-full flex flex-col gap-12">
        <header className="flex items-center justify-between">
          <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)]">
            Concierge30 · {phaseLabel(phase)}
          </div>
          <div className="flex items-center gap-4">
            <ListenIndicator mode={voice.mode} />
            <CameraIndicator active={session.cameraActive} />
          </div>
        </header>

        {cameraReason && (
          <div className="text-[13px] text-[color:var(--c-ink-faint)]">
            Camera: {cameraReason}. The visit continues — the coach just won't have that channel.
          </div>
        )}

        {(phase === "welcome" || phase === "feeling") &&
          importUrl &&
          session.importToken &&
          !session.wearableSummary && (
            <div className="flex justify-end">
              <ImportQr
                url={importUrl}
                pollToken={session.importToken}
                onArrived={onWearableArrived}
              />
            </div>
          )}

        {session.wearableSummary?.note && (phase === "interpret" || phase === "explore-1" || phase === "explore-2" || phase === "explore-3") && (
          <div className="text-[12px] text-[color:var(--c-ink-faint)] italic max-w-[720px]">
            The coach is weighing the last 30 days from your watch alongside the chair's reading.
          </div>
        )}

        {(session.crisis.level === "acute" || session.crisis.level === "imminent") &&
          phase !== "takeaway" && (
            <div className="max-w-[720px] mx-auto w-full c-fade-up">
              <CrisisPanel signal={session.crisis} variant="compact" />
            </div>
          )}

        <section className="min-h-[220px]">
          <CoachCaption
            text={voice.captionText}
            mode={voice.mode}
            onTap={voice.mode === "speaking" ? voice.interrupt : undefined}
          />
          {voice.mode === "listening" && voice.interimText && (
            <div className="mt-4 text-[20px] text-[color:var(--c-ink-soft)] italic">
              "{voice.interimText}"
            </div>
          )}
        </section>

        {phaseIsMeasuring && vizVisible && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start c-fade-up">
            <div className="flex items-center justify-center">
              <BPCuffViz
                phase={session.bpPhase}
                pressure={session.bpPressure}
                systolic={session.bp?.systolic}
                diastolic={session.bp?.diastolic}
              />
            </div>
            <div className="flex items-center justify-center">
              <ScaleViz active={true} finalValue={session.weight} />
            </div>
            <div className="flex items-center justify-center">
              <WaistViz active={true} finalValue={session.waist} />
            </div>
          </section>
        )}

        {phase === "takeaway" && takeawayVisible && writingCard && !cardPayloadForPrint && (
          <section className="c-paper p-10 max-w-[520px] mx-auto c-fade-up flex flex-col gap-5 items-center">
            <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)]">
              Optional — make a card
            </div>
            <div className="coach-voice text-[24px] leading-tight text-[color:var(--c-ink)] text-center max-w-[420px]">
              Choose a four-digit PIN. Next time, this card + your PIN is how the chair knows you — not a database.
            </div>
            <PinPad pin={pinEntry} onChange={setPinEntry} />
            <div className="flex gap-3">
              <ChoiceButton
                variant="quiet"
                onClick={() => {
                  setWritingCard(false);
                  setPinEntry("");
                }}
              >
                No card
              </ChoiceButton>
              <ChoiceButton
                onClick={() => {
                  if (pinEntry.length !== 4) return;
                  const st = useSession.getState();
                  const payload: CardPayload = {
                    v: 1,
                    t: new Date().toISOString(),
                    visit: {
                      bp: st.bp
                        ? { systolic: st.bp.systolic, diastolic: st.bp.diastolic, pulse: st.bp.pulse }
                        : undefined,
                      weight: st.weight,
                      waist: st.waist,
                      feeling: st.feeling || undefined,
                      nextStep: st.nextStep,
                      urgency: st.urgency?.level,
                      mentions: st.turns
                        .filter((t) => t.role === "user")
                        .map((t) => t.content)
                        .slice(-3),
                    },
                  };
                  setCardPayloadForPrint(payload);
                  useSession.getState().setCardPin(pinEntry);
                }}
                disabled={pinEntry.length !== 4}
              >
                Write the card
              </ChoiceButton>
            </div>
            <div className="text-[12px] text-[color:var(--c-ink-faint)] max-w-[380px] text-center">
              The PIN stays in your head and on the card only — we can't send it anywhere, we don't keep it.
            </div>
          </section>
        )}

        {phase === "takeaway" && takeawayVisible && !writingCard && !cardPayloadForPrint && (
          <div className="flex justify-center">
            <ChoiceButton variant="quiet" onClick={() => setWritingCard(true)}>
              Make a card for next time
            </ChoiceButton>
          </div>
        )}

        {phase === "takeaway" && takeawayVisible && (
          <section id="print-root" className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-[1200px] mx-auto c-fade-up">
            <div className="c-paper p-10">
              <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)] mb-4">
                What you're taking home
              </div>
              <div className="flex flex-col gap-3 text-[18px] text-[color:var(--c-ink)]">
                {session.bp && (
                  <div>
                    Blood pressure · <span className="coach-voice text-[24px]">{session.bp.systolic}/{session.bp.diastolic}</span>
                  </div>
                )}
                {typeof session.weight === "number" && (
                  <div>
                    Weight · <span className="coach-voice text-[24px]">{session.weight.toFixed(1)} lbs</span>
                  </div>
                )}
                {typeof session.waist === "number" && (
                  <div>
                    Waist · <span className="coach-voice text-[24px]">{session.waist.toFixed(1)} in</span>
                  </div>
                )}
                {session.nextStep && (
                  <div className="mt-4 pt-4 border-t border-[color:var(--c-muted)]">
                    <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)] mb-2">
                      One small thing
                    </div>
                    <div className="coach-voice text-[22px] leading-relaxed text-[color:var(--c-ink)]">
                      {session.nextStep}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="c-paper p-10">
              <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)] mb-4">
                If you take this to a clinic
              </div>
              {session.handoffLetter ? (
                <div className="coach-voice text-[21px] leading-[1.55] text-[color:var(--c-ink)] whitespace-pre-wrap">
                  {session.handoffLetter}
                </div>
              ) : (
                <div className="text-[15px] text-[color:var(--c-ink-faint)] italic">
                  writing a short letter in your words…
                </div>
              )}
              {session.handoffLetter && (
                <div className="mt-6">
                  <ChoiceButton variant="quiet" onClick={() => window.print()}>
                    Print
                  </ChoiceButton>
                </div>
              )}
            </div>

            {cardPayloadForPrint && session.cardPin && (
              <div className="c-paper p-10 lg:col-span-2 flex flex-col items-center gap-4">
                <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)]">
                  Your card
                </div>
                <ChairCard payload={cardPayloadForPrint} pin={session.cardPin} />
              </div>
            )}

            {(session.crisis.level === "acute" || session.crisis.level === "imminent") && (
              <div className="lg:col-span-2">
                <CrisisPanel signal={session.crisis} variant="card" />
              </div>
            )}
          </section>
        )}

        {phase === "goodbye" && (
          <div className="flex justify-center mt-6">
            <ChoiceButton variant="quiet" onClick={startOver}>
              Start over
            </ChoiceButton>
          </div>
        )}
      </div>
    </Surface>
  );
}

function phaseLabel(phase: VisitPhase): string {
  switch (phase) {
    case "welcome":
      return "settling in";
    case "feeling":
      return "how are you";
    case "measuring":
      return "the chair is reading";
    case "interpret":
      return "what I'm seeing";
    case "explore-1":
    case "explore-2":
    case "explore-3":
      return "a little conversation";
    case "confirm":
      return "one small thing";
    case "takeaway":
      return "a card to take home";
    case "goodbye":
      return "see you";
    default:
      return "";
  }
}

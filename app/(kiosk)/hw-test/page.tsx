"use client";

import { useMemo, useState } from "react";
import { Surface, ChoiceButton } from "@/components/kiosk";
import { BPCuffViz } from "@/components/measurement/BPCuffViz";
import { ScaleViz } from "@/components/measurement/ScaleViz";
import { WaistViz } from "@/components/measurement/WaistViz";
import { CameraIndicator } from "@/components/measurement/CameraIndicator";
import { createMockHardware } from "@/lib/hardware/mock";
import { createCamera } from "@/lib/camera/camera-client";
import type { Scenario, BPValue, BPPhase } from "@/lib/hardware/interfaces";

export default function HwTestPage() {
  const [scenario, setScenario] = useState<Scenario>("healthy");
  const [bp, setBp] = useState<BPValue | undefined>();
  const [bpPhase, setBpPhase] = useState<BPPhase | "idle">("idle");
  const [bpPressure, setBpPressure] = useState(0);
  const [weight, setWeight] = useState<number | undefined>();
  const [waist, setWaist] = useState<number | undefined>();
  const [camActive, setCamActive] = useState(false);
  const [observation, setObservation] = useState<string>("");
  const [log, setLog] = useState<string[]>([]);

  const hw = useMemo(() => createMockHardware({ scenario }), [scenario]);
  const cam = useMemo(() => createCamera(), []);

  const append = (line: string) => setLog((l) => [...l, line]);

  async function runBp() {
    append("BP: start");
    setBp(undefined);
    const r = await hw.bloodPressure.read((phase, p) => {
      setBpPhase(phase);
      setBpPressure(p);
    });
    if ("value" in r) {
      setBp(r.value);
      append(`BP: ${r.value.systolic}/${r.value.diastolic}, pulse ${r.value.pulse}`);
    }
  }

  async function runScale() {
    append("Scale: start");
    const r = await hw.scale.read();
    if ("value" in r) {
      setWeight(r.value);
      append(`Scale: ${r.value} lbs`);
    }
  }

  async function runWaist() {
    append("Waist: start");
    const r = await hw.waist.read();
    if ("value" in r) {
      setWaist(r.value);
      append(`Waist: ${r.value} in`);
    }
  }

  async function runCamera() {
    const r = await cam.start();
    if (r.ok) {
      setCamActive(true);
      append("Camera: started");
    } else {
      append(`Camera: ${r.reason || "failed"}`);
    }
  }

  async function observe() {
    if (!camActive) {
      append("Camera: not active — observing from mock");
      const obs = await hw.camera.observe();
      setObservation(obs.note);
      return;
    }
    const note = await cam.observeNow();
    setObservation(note);
    append(`Observation: ${note.slice(0, 80)}`);
  }

  return (
    <Surface>
      <div className="w-full flex flex-col gap-10">
        <div>
          <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)] mb-3">
            Hardware test
          </div>
          <h1 className="coach-voice text-[40px] leading-tight text-[color:var(--c-ink)]">
            Tap through each mock channel.
          </h1>
        </div>

        <div className="flex gap-3 flex-wrap">
          {(["healthy", "concerning", "urgent"] as const).map((s) => (
            <ChoiceButton
              key={s}
              variant={scenario === s ? "primary" : "quiet"}
              onClick={() => setScenario(s)}
            >
              {s}
            </ChoiceButton>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="c-paper p-6 flex flex-col items-center gap-4">
            <BPCuffViz phase={bpPhase} pressure={bpPressure} systolic={bp?.systolic} diastolic={bp?.diastolic} />
            <ChoiceButton onClick={runBp}>Read BP</ChoiceButton>
          </div>
          <div className="c-paper p-6 flex flex-col items-center gap-4">
            <ScaleViz active={weight != null || scenario !== undefined} finalValue={weight} />
            <ChoiceButton onClick={runScale}>Read scale</ChoiceButton>
          </div>
          <div className="c-paper p-6 flex flex-col items-center gap-4">
            <WaistViz active={waist != null} finalValue={waist} />
            <ChoiceButton onClick={runWaist}>Read waist</ChoiceButton>
          </div>
        </div>

        <div className="c-paper p-6 flex flex-col gap-4">
          <CameraIndicator active={camActive} />
          <div className="flex gap-3">
            <ChoiceButton onClick={runCamera}>Start camera</ChoiceButton>
            <ChoiceButton variant="quiet" onClick={observe}>
              Ask coach to observe
            </ChoiceButton>
          </div>
          {observation && (
            <div className="mt-2 text-[18px] italic text-[color:var(--c-ink-soft)]">
              &ldquo;{observation}&rdquo;
            </div>
          )}
        </div>

        <pre className="text-[13px] text-[color:var(--c-ink-faint)] whitespace-pre-wrap">
          {log.join("\n")}
        </pre>
      </div>
    </Surface>
  );
}

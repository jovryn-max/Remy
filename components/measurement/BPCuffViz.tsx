"use client";

import type { BPPhase } from "@/lib/hardware/interfaces";

type Props = {
  phase: BPPhase | "idle";
  pressure: number; // mmHg currently in the cuff
  systolic?: number;
  diastolic?: number;
};

/**
 * An arc that fills as the cuff inflates, pauses, then empties.
 * The number at the center is the current cuff pressure — honest, visible,
 * no fake "measuring..." spinner. Once complete, it shows the final reading.
 */
export function BPCuffViz({ phase, pressure, systolic, diastolic }: Props) {
  const max = 200;
  const pct = Math.min(pressure / max, 1);
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  const label =
    phase === "inflating"
      ? "Pressure rising"
      : phase === "holding"
      ? "Holding"
      : phase === "deflating"
      ? "Releasing"
      : phase === "done"
      ? "Done"
      : " ";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: 220, height: 220 }}>
        <svg width="220" height="220" viewBox="0 0 220 220">
          <circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke="var(--c-muted)"
            strokeWidth="3"
          />
          <circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke="var(--c-accent)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 110 110)"
            style={{ transition: "stroke-dashoffset 80ms linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {phase === "done" && systolic != null && diastolic != null ? (
            <>
              <div className="coach-voice text-[56px] leading-none text-[color:var(--c-ink)]">
                {systolic}
                <span className="text-[color:var(--c-ink-faint)] px-2">/</span>
                {diastolic}
              </div>
              <div className="text-[12px] tracking-wider uppercase text-[color:var(--c-ink-faint)] mt-1">
                Blood pressure
              </div>
            </>
          ) : (
            <>
              <div className="coach-voice text-[48px] leading-none text-[color:var(--c-ink)]">
                {Math.round(pressure)}
              </div>
              <div className="text-[12px] tracking-wider uppercase text-[color:var(--c-ink-faint)] mt-1">
                mmHg
              </div>
            </>
          )}
        </div>
      </div>
      <div className="text-[13px] tracking-wide text-[color:var(--c-ink-faint)]">{label}</div>
    </div>
  );
}

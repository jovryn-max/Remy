"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  active: boolean;
  finalValue?: number;
  unit?: string;
};

/**
 * A thin band that gently contracts from the sides and settles. Shows the
 * number when the band is engaged. No cartoon waistline — just a horizontal
 * rule that animates.
 */
export function WaistViz({ active, finalValue, unit = "in" }: Props) {
  const [display, setDisplay] = useState(0);
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    if (!active) {
      setDisplay(0);
      setProgress(0);
      return;
    }
    let t = 0;
    const tick = () => {
      t += 16;
      const p = Math.min(1, t / 1200);
      setProgress(p);
      if (typeof finalValue === "number") {
        setDisplay(finalValue * p);
      }
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [active, finalValue]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: 220, height: 220 }}>
        <svg width="220" height="220" viewBox="0 0 220 220">
          <line
            x1={20}
            y1={110}
            x2={200}
            y2={110}
            stroke="var(--c-muted)"
            strokeWidth="2"
            strokeDasharray="4 6"
          />
          <line
            x1={110 - 80 * progress}
            y1={110}
            x2={110 + 80 * progress}
            y2={110}
            stroke="var(--c-accent)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="coach-voice text-[56px] leading-none text-[color:var(--c-ink)]">
            {display > 0 ? display.toFixed(1) : "—"}
          </div>
          <div className="text-[12px] tracking-wider uppercase text-[color:var(--c-ink-faint)] mt-1">
            waist · {unit}
          </div>
        </div>
      </div>
      <div className="text-[13px] tracking-wide text-[color:var(--c-ink-faint)]">
        {active ? "Engaging" : " "}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  active: boolean;
  finalValue?: number;
  unit?: string;
};

/**
 * A number that oscillates and settles. No "weighing..." spinner.
 * Each render nudges toward finalValue with damping, so you can watch it
 * come to rest. The moment the real value locks in, we lock the display too.
 */
export function ScaleViz({ active, finalValue, unit = "lbs" }: Props) {
  const [display, setDisplay] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    if (!active) {
      setDisplay(0);
      return;
    }
    if (typeof finalValue === "number") {
      let value = display;
      let velocity = 0;
      const stiffness = 0.12;
      const damping = 0.75;
      const tick = () => {
        const delta = finalValue - value;
        velocity = (velocity + delta * stiffness) * damping;
        value = value + velocity;
        setDisplay(value);
        if (Math.abs(delta) > 0.05 || Math.abs(velocity) > 0.02) {
          frame.current = requestAnimationFrame(tick);
        } else {
          setDisplay(finalValue);
        }
      };
      frame.current = requestAnimationFrame(tick);
    } else {
      // settling animation without a target — wobble a bit
      let t = 0;
      const tick = () => {
        t += 1;
        setDisplay(160 + Math.sin(t * 0.18) * 3);
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(frame.current);
  }, [active, finalValue]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: 220, height: 220 }}>
        <svg width="220" height="220" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r="95" fill="none" stroke="var(--c-muted)" strokeWidth="2" />
          <line x1="110" y1="18" x2="110" y2="30" stroke="var(--c-accent)" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="coach-voice text-[56px] leading-none text-[color:var(--c-ink)]">
            {display.toFixed(1)}
          </div>
          <div className="text-[12px] tracking-wider uppercase text-[color:var(--c-ink-faint)] mt-1">
            {unit}
          </div>
        </div>
      </div>
      <div className="text-[13px] tracking-wide text-[color:var(--c-ink-faint)]">
        {active ? "Settling" : " "}
      </div>
    </div>
  );
}

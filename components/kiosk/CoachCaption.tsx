"use client";

import { useEffect, useRef } from "react";

type Mode = "speaking" | "listening" | "thinking" | "idle";

type Props = {
  text: string;
  mode: Mode;
  onTap?: () => void;
};

/**
 * Large, calm caption. The coach's words render here as they stream.
 * Tapping the caption area is a deliberate interrupt affordance —
 * someone who can't or won't speak can still stop the coach mid-word.
 */
export function CoachCaption({ text, mode, onTap }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [text]);

  return (
    <button
      type="button"
      onClick={onTap}
      aria-live="polite"
      aria-label="Coach is speaking. Tap to interrupt."
      className="w-full text-left bg-transparent border-0 p-0 cursor-pointer"
    >
      <div
        ref={ref}
        className="coach-voice text-[44px] leading-[1.28] text-[color:var(--c-ink)] min-h-[180px] max-h-[300px] overflow-hidden"
      >
        {text}
        {mode === "speaking" && <span className="c-caret" aria-hidden />}
        {mode === "thinking" && !text && (
          <span className="text-[color:var(--c-ink-faint)] italic">…</span>
        )}
      </div>
    </button>
  );
}

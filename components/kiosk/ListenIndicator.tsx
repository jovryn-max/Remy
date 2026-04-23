"use client";

type Props = {
  mode: "speaking" | "listening" | "thinking" | "idle";
  level?: number; // 0..1 voice-band energy while listening
};

/**
 * One small dot. Breathes when listening, steady while speaking, quiet when idle.
 * No words, no microphone icon. Presence, not instruction.
 */
export function ListenIndicator({ mode, level = 0 }: Props) {
  const color =
    mode === "listening"
      ? "var(--c-accent-light)"
      : mode === "speaking"
      ? "var(--c-accent)"
      : mode === "thinking"
      ? "var(--c-ink-faint)"
      : "var(--c-muted)";

  const scale = mode === "listening" ? 1 + Math.min(level, 1) * 0.8 : 1;
  const pulse = mode === "speaking" ? "c-pulse-soft 1.6s ease-in-out infinite" : "none";

  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span
        className="inline-block rounded-full transition-transform duration-150"
        style={{
          width: 14,
          height: 14,
          background: color,
          transform: `scale(${scale})`,
          animation: pulse,
          boxShadow: mode === "listening" ? `0 0 0 6px ${color}22` : "none",
        }}
      />
      <span className="text-[13px] tracking-wide uppercase text-[color:var(--c-ink-faint)]">
        {mode === "listening" && "Listening"}
        {mode === "speaking" && "Speaking"}
        {mode === "thinking" && "Thinking"}
        {mode === "idle" && ""}
      </span>
    </div>
  );
}

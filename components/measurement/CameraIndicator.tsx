"use client";

type Props = {
  active: boolean;
};

/**
 * Dignified camera-active affordance. The user does NOT see themselves.
 *
 * A small warm dot + plain words: "The coach can see you." We explain it
 * once at the start of the visit; this indicator persists so it's never
 * hidden, never ambiguous. Users who want it off can turn away or cover it.
 */
export function CameraIndicator({ active }: Props) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2 rounded-full"
      style={{
        background: active ? "rgba(139, 111, 71, 0.08)" : "transparent",
        border: "1px solid var(--c-muted)",
      }}
      aria-live="polite"
    >
      <span
        className="inline-block rounded-full"
        style={{
          width: 10,
          height: 10,
          background: active ? "var(--c-accent)" : "var(--c-muted)",
          animation: active ? "c-breath 2.4s ease-in-out infinite" : "none",
        }}
      />
      <span className="text-[13px] tracking-wide text-[color:var(--c-ink-soft)]">
        {active ? "The coach can see you — only the coach." : "Camera off"}
      </span>
    </div>
  );
}

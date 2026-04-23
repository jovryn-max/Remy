"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "quiet";
  disabled?: boolean;
};

export function ChoiceButton({ children, onClick, variant = "primary", disabled }: Props) {
  const base =
    "min-h-[88px] px-10 py-5 rounded-full text-[22px] font-[450] tracking-tight transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none";
  const styles =
    variant === "primary"
      ? "bg-[color:var(--c-ink)] text-[color:var(--c-paper)] hover:bg-[color:var(--c-ink-soft)] active:scale-[0.98]"
      : "bg-transparent text-[color:var(--c-ink-soft)] border border-[color:var(--c-muted)] hover:border-[color:var(--c-ink-soft)] active:scale-[0.98]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles}`}
    >
      {children}
    </button>
  );
}

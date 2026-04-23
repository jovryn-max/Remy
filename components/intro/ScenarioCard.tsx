"use client";

import type { Scenario } from "@/lib/hardware/interfaces";

type Props = {
  scenario: Scenario;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
};

export function ScenarioCard({ title, description, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`c-paper w-full text-left p-8 transition-all duration-200 ${
        selected ? "ring-2 ring-[color:var(--c-accent)]" : ""
      }`}
      aria-pressed={selected}
    >
      <div className="coach-voice text-[28px] leading-tight text-[color:var(--c-ink)]">
        {title}
      </div>
      <div className="mt-3 text-[15px] leading-relaxed text-[color:var(--c-ink-soft)]">
        {description}
      </div>
    </button>
  );
}

"use client";

import { pickResources, type Resource } from "@/lib/coach/resources";
import type { CrisisSignal } from "@/lib/coach/crisis";

type Props = {
  signal: CrisisSignal;
  /** "compact" for the in-visit sidebar; "card" for the takeaway. */
  variant?: "compact" | "card";
};

/**
 * Calm, non-alarming presence card. No red. No siren. No "EMERGENCY" badge.
 * Just the resources, named plainly, with the option to call directly from
 * the chair via the device's tel: handler. The user's hand stays on the
 * wheel; we do not loop in any human on our side.
 */
export function CrisisPanel({ signal, variant = "compact" }: Props) {
  if (signal.level === "none" || signal.level === "standby") return null;
  const imminent = signal.level === "imminent";
  const resources = pickResources(signal.categories, imminent);
  if (resources.length === 0) return null;

  const accent = imminent ? "var(--c-accent-warm)" : "var(--c-accent)";

  return (
    <aside
      className={`c-paper p-${variant === "card" ? "8" : "6"} flex flex-col gap-4`}
      style={{ borderLeft: `4px solid ${accent}` }}
      aria-label="Quiet support"
    >
      <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)]">
        If anything you said hits hard
      </div>
      <div className="coach-voice text-[19px] leading-relaxed text-[color:var(--c-ink)] max-w-[520px]">
        {imminent
          ? "You don't have to be alone with this. Real people are on the other end of these lines, day or night."
          : "Real people are on the other end of these, day or night. You don't have to call. They don't push."}
      </div>
      <ul className="flex flex-col gap-3">
        {resources.map((r) => (
          <ResourceRow key={r.id} r={r} />
        ))}
      </ul>
      <div className="text-[11px] text-[color:var(--c-ink-faint)] leading-relaxed">
        We don't see your call. We don't know if you called. The chair doesn't tell anyone.
      </div>
    </aside>
  );
}

function ResourceRow({ r }: { r: Resource }) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="coach-voice text-[20px] text-[color:var(--c-ink)]">{r.shortName}</span>
        {r.call && (
          <a
            href={`tel:${r.call.replace(/[^0-9+]/g, "")}`}
            className="text-[16px] text-[color:var(--c-accent)] underline"
          >
            {r.call}
          </a>
        )}
        {r.text && r.text !== r.call && (
          <a
            href={`sms:${r.text}`}
            className="text-[14px] text-[color:var(--c-ink-soft)] underline"
          >
            text {r.text}
          </a>
        )}
      </div>
      <div className="text-[14px] text-[color:var(--c-ink-soft)] leading-relaxed">{r.blurb}</div>
    </li>
  );
}

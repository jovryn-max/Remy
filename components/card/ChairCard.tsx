"use client";

import { useEffect, useState } from "react";
import { packCard, type CardPayload } from "@/lib/card/card";
import { renderQrSvg } from "@/lib/card/qr";

type Props = {
  payload: CardPayload | null;
  pin: string | null;
};

/**
 * Renders the Chair Card itself — QR + printed fallback string + a short
 * explanation. The card is generated client-side; the server never sees the
 * plaintext or the PIN.
 */
export function ChairCard({ payload, pin }: Props) {
  const [card, setCard] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!payload || !pin) {
      setCard(null);
      setSvg(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const packed = await packCard(payload, pin);
        if (cancelled) return;
        setCard(packed);
        const rendered = await renderQrSvg(packed, { size: 260 });
        if (cancelled) return;
        setSvg(rendered);
      } catch {
        if (!cancelled) setError("couldn't write the card — that's okay, you can still print the letter");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payload, pin]);

  if (error) {
    return (
      <div className="text-[14px] text-[color:var(--c-ink-faint)] italic">{error}</div>
    );
  }
  if (!card || !svg) {
    return (
      <div className="text-[14px] text-[color:var(--c-ink-faint)] italic">
        writing your card…
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="bg-[color:var(--c-paper)] rounded-[16px] p-4"
        aria-label="Chair Card QR code"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="text-[13px] tracking-wide text-[color:var(--c-ink-soft)] text-center max-w-[320px] leading-relaxed">
        Photograph this, or print it. Your PIN unlocks it next time. We don't keep a copy — if you lose the card, there's nothing to recover, and that's the point.
      </div>
      <details className="text-[11px] text-[color:var(--c-ink-faint)] max-w-[320px]">
        <summary className="cursor-pointer">Show the printed code</summary>
        <code className="block mt-2 break-all font-mono text-[10px] leading-[1.4]">{card}</code>
      </details>
    </div>
  );
}

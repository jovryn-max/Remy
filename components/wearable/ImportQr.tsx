"use client";

import { useEffect, useState } from "react";
import { renderQrSvg } from "@/lib/card/qr";
import type { WearableSnapshot } from "@/lib/wearable/types";

type Props = {
  url: string;
  onArrived: (snapshot: WearableSnapshot) => void;
  pollToken: string;
};

/**
 * Shows a QR code for "/health-import?s=<token>" and quietly polls the
 * wearable relay for an arrival. When a snapshot arrives, fires onArrived
 * and stops polling. The component itself never handles the snapshot —
 * the parent page does (and wipes its memory afterward).
 */
export function ImportQr({ url, onArrived, pollToken }: Props) {
  const [svg, setSvg] = useState<string>("");
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    let cancelled = false;
    renderQrSvg(url, { size: 220 }).then((s) => {
      if (!cancelled) setSvg(s);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (arrived) return;
    let cancelled = false;
    const tick = async () => {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/wearable/pull?s=${encodeURIComponent(pollToken)}`, {
            cache: "no-store",
          });
          if (res.ok) {
            const data = (await res.json()) as { ok: boolean; snapshot?: WearableSnapshot };
            if (data.ok && data.snapshot) {
              setArrived(true);
              onArrived(data.snapshot);
              return;
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 2000));
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [arrived, onArrived, pollToken]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)]">
        Optional — share your watch
      </div>
      <div
        className="bg-[color:var(--c-paper)] rounded-[16px] p-3"
        aria-label="QR code to share wearable data"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="text-[13px] text-[color:var(--c-ink-soft)] max-w-[260px] text-center leading-relaxed">
        Scan with your phone to share the last 30 days. The chair uses it for this visit and wipes it.
      </div>
      {arrived && (
        <div className="text-[13px] text-[color:var(--c-accent)] font-medium">
          Thanks — got it.
        </div>
      )}
    </div>
  );
}

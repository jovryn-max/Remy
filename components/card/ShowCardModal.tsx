"use client";

import { useState } from "react";
import { unpackCard, type CardPayload } from "@/lib/card/card";
import { ChoiceButton } from "@/components/kiosk";
import { PinPad } from "./PinPad";

type Props = {
  onResolved: (payload: CardPayload) => void;
  onCancel: () => void;
};

type Stage = "paste" | "pin" | "fail";

export function ShowCardModal({ onResolved, onCancel }: Props) {
  const [stage, setStage] = useState<Stage>("paste");
  const [card, setCard] = useState("");
  const [pin, setPin] = useState("");
  const [failReason, setFailReason] = useState<string>("");

  async function attempt() {
    const result = await unpackCard(card.trim(), pin);
    if (result.ok) {
      onResolved(result.payload);
      return;
    }
    const reason =
      result.reason === "pin"
        ? "That PIN didn't open it. Try again."
        : result.reason === "format"
        ? "That doesn't look like a card code."
        : result.reason === "version"
        ? "This card was made with a newer version we don't know yet."
        : "Something in the card looks corrupted.";
    setFailReason(reason);
    setStage("fail");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(224, 214, 194, 0.92)" }}
      role="dialog"
      aria-modal="true"
    >
      <div className="c-paper w-full max-w-[640px] p-10 flex flex-col gap-6 c-fade-up">
        <div className="flex items-center justify-between">
          <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)]">
            Show your card
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-[13px] text-[color:var(--c-ink-faint)] underline"
          >
            never mind
          </button>
        </div>

        {stage === "paste" && (
          <>
            <div className="coach-voice text-[28px] leading-tight text-[color:var(--c-ink)]">
              Paste or type the code from your card.
            </div>
            <textarea
              value={card}
              onChange={(e) => setCard(e.target.value)}
              placeholder="c30v1.…"
              autoFocus
              className="w-full min-h-[120px] p-4 rounded-[12px] bg-[color:var(--c-paper)] border border-[color:var(--c-muted)] text-[14px] font-mono text-[color:var(--c-ink)] focus:border-[color:var(--c-accent)] outline-none"
            />
            <div className="flex justify-end gap-3">
              <ChoiceButton
                variant="quiet"
                onClick={() => setStage("pin")}
                disabled={!card.trim().startsWith("c30v1.")}
              >
                Next
              </ChoiceButton>
            </div>
          </>
        )}

        {stage === "pin" && (
          <>
            <div className="coach-voice text-[28px] leading-tight text-[color:var(--c-ink)] text-center">
              Your four-digit PIN.
            </div>
            <PinPad pin={pin} onChange={setPin} autoFocus />
            <div className="flex justify-end gap-3">
              <ChoiceButton variant="quiet" onClick={() => setStage("paste")}>
                Back
              </ChoiceButton>
              <ChoiceButton onClick={attempt} disabled={pin.length !== 4}>
                Unlock
              </ChoiceButton>
            </div>
          </>
        )}

        {stage === "fail" && (
          <>
            <div className="coach-voice text-[26px] leading-tight text-[color:var(--c-ink)]">
              {failReason}
            </div>
            <div className="flex justify-end gap-3">
              <ChoiceButton variant="quiet" onClick={onCancel}>
                Skip
              </ChoiceButton>
              <ChoiceButton
                onClick={() => {
                  setPin("");
                  setStage("pin");
                }}
              >
                Try again
              </ChoiceButton>
            </div>
          </>
        )}

        <div className="text-[12px] text-[color:var(--c-ink-faint)] leading-relaxed">
          The code and your PIN stay here. We don't send either one anywhere. If you've forgotten the PIN, skip this — you can still have a good visit.
        </div>
      </div>
    </div>
  );
}

"use client";

type Props = {
  pin: string;
  onChange: (pin: string) => void;
  autoFocus?: boolean;
};

/**
 * Big 4-digit PIN pad. Touch-first, no tiny inputs. Digits only; no masking
 * while entering because the user is alone in a private suite and masking
 * makes kiosk entry harder without adding security here.
 */
export function PinPad({ pin, onChange, autoFocus }: Props) {
  const press = (d: string) => {
    if (pin.length >= 4) return;
    onChange((pin + d).slice(0, 4));
  };
  const back = () => onChange(pin.slice(0, -1));
  const clear = () => onChange("");

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="coach-voice text-[56px] tracking-[0.3em] text-[color:var(--c-ink)] min-h-[72px]"
        aria-live="polite"
        tabIndex={autoFocus ? 0 : -1}
      >
        {pin.padEnd(4, "•")}
      </div>
      <div className="grid grid-cols-3 gap-3 w-[320px]">
        {keys.map((k, i) => {
          if (k === "") return <div key={i} />;
          if (k === "⌫") {
            return (
              <button
                key={i}
                type="button"
                onClick={back}
                className="h-[88px] rounded-[20px] text-[28px] text-[color:var(--c-ink-soft)] bg-transparent border border-[color:var(--c-muted)] hover:border-[color:var(--c-ink-soft)] active:scale-[0.98] transition"
              >
                ⌫
              </button>
            );
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => press(k)}
              className="h-[88px] rounded-[20px] text-[32px] coach-voice text-[color:var(--c-ink)] bg-[color:var(--c-paper)] hover:bg-[color:var(--c-muted)] active:scale-[0.98] transition"
            >
              {k}
            </button>
          );
        })}
      </div>
      {pin.length > 0 && (
        <button
          type="button"
          onClick={clear}
          className="text-[13px] text-[color:var(--c-ink-faint)] underline"
        >
          clear
        </button>
      )}
    </div>
  );
}

import type { ReactNode } from "react";

type SurfaceProps = {
  children: ReactNode;
  className?: string;
  onInterrupt?: () => void;
};

/**
 * Full-viewport paper surface. Tapping anywhere on the surface can signal
 * "interrupt" when the coach is speaking; callers opt in via onInterrupt.
 */
export function Surface({ children, className = "", onInterrupt }: SurfaceProps) {
  return (
    <main
      onPointerDown={onInterrupt}
      className={`min-h-screen w-full flex items-center justify-center px-12 py-16 ${className}`}
    >
      <div className="w-full max-w-[1400px] flex flex-col items-center">{children}</div>
    </main>
  );
}

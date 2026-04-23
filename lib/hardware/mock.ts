import type {
  BPPhase,
  BPValue,
  CameraObservation,
  HardwareAdapter,
  MockAdapterOptions,
  PrintPayload,
  Scenario,
  VitalReading,
} from "./interfaces";

const VITALS: Record<Scenario, { bp: BPValue; weight: number; waist: number }> = {
  healthy: { bp: { systolic: 118, diastolic: 76, pulse: 68 }, weight: 165, waist: 33 },
  concerning: { bp: { systolic: 158, diastolic: 95, pulse: 78 }, weight: 204.2, waist: 41.5 },
  urgent: { bp: { systolic: 185, diastolic: 118, pulse: 94 }, weight: 215, waist: 43 },
};

const OBSERVATIONS: Record<Scenario, CameraObservation[]> = {
  healthy: [
    {
      note: "Shoulders dropped as they sat down. Breathing looks easy.",
      signals: { breathingRate: "steady", tension: "relaxed", tiredness: "ok" },
    },
    {
      note: "They're smiling a little, taking their time settling in.",
      signals: { breathingRate: "steady", tension: "relaxed", tiredness: "rested" },
    },
  ],
  concerning: [
    {
      note: "Breathing a touch shallow. Shoulders riding high.",
      signals: { breathingRate: "quick", tension: "tight", tiredness: "tired" },
    },
    {
      note: "They look tired. Eyes a little heavy. Not unwell, just worn.",
      signals: { breathingRate: "steady", tension: "neutral", tiredness: "tired" },
    },
  ],
  urgent: [
    {
      note: "Breathing's fast. They're sweating a little. Looks anxious.",
      signals: { breathingRate: "quick", tension: "tight", tiredness: "tired" },
    },
    {
      note: "Color's a bit flushed. Pulse is visible at the temple.",
      signals: { breathingRate: "quick", tension: "tight", tiredness: "tired" },
    },
  ],
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createMockHardware(opts: MockAdapterOptions): HardwareAdapter {
  const { scenario } = opts;
  const v = VITALS[scenario];
  let observationIndex = 0;
  let cameraActive = false;

  return {
    scale: {
      async read(): Promise<VitalReading<number>> {
        await sleep(2800);
        return {
          value: v.weight,
          unit: "lbs",
          timestamp: new Date(),
          confidence: "high",
        };
      },
    },
    bloodPressure: {
      async read(onPhaseChange?: (phase: BPPhase, pressure: number) => void) {
        const target = 180;
        const hold = v.bp.systolic + 20;

        onPhaseChange?.("inflating", 0);
        const inflateMs = 2500;
        const tickMs = 50;
        const ticks = inflateMs / tickMs;
        for (let i = 1; i <= ticks; i++) {
          await sleep(tickMs);
          const p = Math.round((target * i) / ticks);
          onPhaseChange?.("inflating", p);
        }

        onPhaseChange?.("holding", target);
        await sleep(1200);

        onPhaseChange?.("deflating", target);
        const deflateMs = 5500;
        const dTicks = deflateMs / tickMs;
        for (let i = 1; i <= dTicks; i++) {
          await sleep(tickMs);
          const p = Math.round(target - ((target - 40) * i) / dTicks);
          onPhaseChange?.("deflating", Math.max(p, v.bp.diastolic - 10));
          if (Math.abs(p - hold) < 3 && i % 4 === 0) {
            // tiny wiggle to suggest pulse detection
          }
        }
        onPhaseChange?.("done", 0);
        return {
          value: v.bp,
          unit: "mmHg",
          timestamp: new Date(),
          confidence: "high",
        };
      },
    },
    waist: {
      async read(): Promise<VitalReading<number>> {
        await sleep(1600);
        return {
          value: v.waist,
          unit: "in",
          timestamp: new Date(),
          confidence: "medium",
        };
      },
    },
    camera: {
      async start() {
        await sleep(120);
        cameraActive = true;
        return { active: true };
      },
      stop() {
        cameraActive = false;
      },
      async observe(): Promise<CameraObservation> {
        if (!cameraActive) return { note: "", signals: {} };
        const list = OBSERVATIONS[scenario];
        const obs = list[observationIndex % list.length];
        observationIndex++;
        await sleep(300);
        return obs;
      },
    },
    printer: {
      async print(_payload: PrintPayload) {
        await sleep(400);
        return { success: true };
      },
    },
  };
}

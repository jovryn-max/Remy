export type Scenario = "healthy" | "concerning" | "urgent";

export type BPPhase = "inflating" | "holding" | "deflating" | "done";

export interface VitalReading<T> {
  value: T;
  unit: string;
  timestamp: Date;
  confidence: "high" | "medium" | "low";
}

export type BPValue = { systolic: number; diastolic: number; pulse: number };

export type ReadError<Codes extends string> = { error: Codes };

export interface HardwareAdapter {
  scale: {
    read(): Promise<VitalReading<number> | ReadError<"no_reading" | "unstable">>;
  };
  bloodPressure: {
    read(
      onPhaseChange?: (phase: BPPhase, pressure: number) => void,
    ): Promise<VitalReading<BPValue> | ReadError<"cuff_not_seated" | "motion">>;
  };
  waist: {
    read(): Promise<VitalReading<number> | ReadError<"band_not_engaged">>;
  };
  /**
   * The camera is for the coach only. The user never sees the feed.
   * `start()` returns a stream reference for frame capture; `observe()`
   * returns a short, scenario-consistent description of what the coach sees
   * right now (from the model, or canned from the mock).
   */
  camera: {
    start(): Promise<{ active: boolean; reason?: string }>;
    stop(): void;
    observe(): Promise<CameraObservation>;
  };
  printer: {
    print(payload: PrintPayload): Promise<{ success: boolean }>;
  };
}

export type CameraObservation = {
  /** Short sentence the coach can weave into conversation. Never clinical, never creepy. */
  note: string;
  /** Low-level flags that the coach *may* consult. Not shown to the user. */
  signals: {
    breathingRate?: "slow" | "steady" | "quick";
    tension?: "relaxed" | "neutral" | "tight";
    tiredness?: "rested" | "ok" | "tired";
  };
};

export type PrintPayload = {
  vitals: {
    bp?: BPValue;
    weight?: number;
    waist?: number;
  };
  nextStep: string;
  phone?: string;
};

export interface MockAdapterOptions {
  scenario: Scenario;
}

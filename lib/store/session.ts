import { create } from "zustand";
import type { BPPhase, BPValue, Scenario } from "@/lib/hardware/interfaces";
import type { UrgencyAssessment } from "@/lib/coach/urgency";

export type VisitPhase =
  | "intro"
  | "welcome"
  | "feeling"
  | "measuring"
  | "interpret"
  | "explore-1"
  | "explore-2"
  | "explore-3"
  | "confirm"
  | "takeaway"
  | "goodbye";

type Turn = { role: "user" | "assistant"; content: string };

type SessionState = {
  scenario: Scenario;
  phase: VisitPhase;
  feeling: string;
  bpPhase: BPPhase | "idle";
  bpPressure: number;
  bp?: BPValue;
  weight?: number;
  waist?: number;
  urgency?: UrgencyAssessment;
  cameraActive: boolean;
  cameraNotes: string[];
  turns: Turn[];
  nextStep?: string;

  setScenario: (s: Scenario) => void;
  setPhase: (p: VisitPhase) => void;
  setFeeling: (f: string) => void;
  setBPPhase: (p: BPPhase | "idle", pressure?: number) => void;
  setBP: (v: BPValue) => void;
  setWeight: (w: number) => void;
  setWaist: (w: number) => void;
  setUrgency: (u: UrgencyAssessment) => void;
  setCameraActive: (a: boolean) => void;
  addCameraNote: (n: string) => void;
  addTurn: (t: Turn) => void;
  setNextStep: (s: string) => void;
  reset: () => void;
};

const initial: Omit<
  SessionState,
  | "setScenario"
  | "setPhase"
  | "setFeeling"
  | "setBPPhase"
  | "setBP"
  | "setWeight"
  | "setWaist"
  | "setUrgency"
  | "setCameraActive"
  | "addCameraNote"
  | "addTurn"
  | "setNextStep"
  | "reset"
> = {
  scenario: "healthy",
  phase: "intro",
  feeling: "",
  bpPhase: "idle",
  bpPressure: 0,
  cameraActive: false,
  cameraNotes: [],
  turns: [],
};

export const useSession = create<SessionState>((set) => ({
  ...initial,
  setScenario: (s) => set({ scenario: s }),
  setPhase: (p) => set({ phase: p }),
  setFeeling: (f) => set({ feeling: f }),
  setBPPhase: (p, pressure) =>
    set((st) => ({ bpPhase: p, bpPressure: pressure ?? st.bpPressure })),
  setBP: (v) => set({ bp: v }),
  setWeight: (w) => set({ weight: w }),
  setWaist: (w) => set({ waist: w }),
  setUrgency: (u) => set({ urgency: u }),
  setCameraActive: (a) => set({ cameraActive: a }),
  addCameraNote: (n) =>
    set((st) => ({ cameraNotes: n ? [...st.cameraNotes, n].slice(-6) : st.cameraNotes })),
  addTurn: (t) => set((st) => ({ turns: [...st.turns, t] })),
  setNextStep: (s) => set({ nextStep: s }),
  reset: () => set(initial),
}));

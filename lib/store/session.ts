import { create } from "zustand";
import type { BPPhase, BPValue, Scenario } from "@/lib/hardware/interfaces";
import type { UrgencyAssessment } from "@/lib/coach/urgency";
import { isForgetCommand } from "@/lib/privacy/policy";
import type { CardPayload } from "@/lib/card/card";
import type { WearableSnapshot, WearableSummary } from "@/lib/wearable/types";
import type { CrisisSignal } from "@/lib/coach/crisis";

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
  setHandoffLetter: (s: string) => void;
  forgetLast: () => void;
  reset: () => void;
  handoffLetter?: string;

  priorVisit?: CardPayload["visit"];
  setPriorVisit: (p: CardPayload["visit"] | undefined) => void;

  wearableSnapshot?: WearableSnapshot;
  wearableSummary?: WearableSummary;
  setWearable: (s: WearableSnapshot, summary: WearableSummary) => void;

  cardPin?: string;
  setCardPin: (pin: string | undefined) => void;

  importToken?: string;
  setImportToken: (t: string) => void;

  crisis: CrisisSignal;
  setCrisis: (s: CrisisSignal) => void;
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
  | "setHandoffLetter"
  | "forgetLast"
  | "setPriorVisit"
  | "setWearable"
  | "setCardPin"
  | "setImportToken"
  | "setCrisis"
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
  crisis: { level: "none", cues: [], categories: [] },
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
  addTurn: (t) => {
    if (t.role === "user" && isForgetCommand(t.content)) {
      set((st) => {
        const turns = [...st.turns];
        if (turns.length && turns[turns.length - 1]?.role === "assistant") turns.pop();
        if (turns.length && turns[turns.length - 1]?.role === "user") turns.pop();
        return { turns };
      });
      return;
    }
    set((st) => ({ turns: [...st.turns, t] }));
  },
  setNextStep: (s) => set({ nextStep: s }),
  setHandoffLetter: (s) => set({ handoffLetter: s }),
  forgetLast: () =>
    set((st) => {
      const turns = [...st.turns];
      if (turns.length && turns[turns.length - 1]?.role === "assistant") turns.pop();
      if (turns.length && turns[turns.length - 1]?.role === "user") turns.pop();
      return { turns };
    }),
  setPriorVisit: (p) => set({ priorVisit: p }),
  setWearable: (s, summary) => set({ wearableSnapshot: s, wearableSummary: summary }),
  setCardPin: (pin) => set({ cardPin: pin }),
  setImportToken: (t) => set({ importToken: t }),
  setCrisis: (s) => set({ crisis: s }),
  reset: () => set(initial),
}));

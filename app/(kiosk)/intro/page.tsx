"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Surface, ChoiceButton } from "@/components/kiosk";
import { ScenarioCard } from "@/components/intro/ScenarioCard";
import { ShowCardModal } from "@/components/card/ShowCardModal";
import type { Scenario } from "@/lib/hardware/interfaces";
import type { CardPayload } from "@/lib/card/card";
import { useSession } from "@/lib/store/session";

const SCENARIOS: { id: Scenario; title: string; description: string }[] = [
  {
    id: "healthy",
    title: "Healthy",
    description: "Nothing's wrong. Readings come back steady. Good bones for testing the warm, unhurried path.",
  },
  {
    id: "concerning",
    title: "Concerning",
    description: "Stage 1 hypertension, slightly elevated waist, a little tired. The coach adjusts without alarm.",
  },
  {
    id: "urgent",
    title: "Urgent",
    description: "Hypertensive crisis. The coach tells them directly and calmly and helps them get care now.",
  },
];

export default function IntroPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Scenario>("healthy");
  const [showCard, setShowCard] = useState(false);
  const setScenario = useSession((s) => s.setScenario);
  const setPriorVisit = useSession((s) => s.setPriorVisit);
  const reset = useSession((s) => s.reset);

  const begin = () => {
    reset();
    setScenario(selected);
    router.push("/visit");
  };

  const beginWithCard = (payload: CardPayload) => {
    reset();
    setScenario(selected);
    setPriorVisit(payload.visit);
    router.push("/visit");
  };

  return (
    <Surface>
      <div className="w-full flex flex-col gap-10 items-center">
        <div className="text-center c-fade-up">
          <div className="text-[14px] tracking-[0.2em] uppercase text-[color:var(--c-ink-faint)] mb-3">
            Concierge30
          </div>
          <h1 className="coach-voice text-[56px] leading-tight text-[color:var(--c-ink)] max-w-[900px]">
            A quiet place to check in on how you're doing.
          </h1>
          <p className="mt-6 text-[18px] text-[color:var(--c-ink-soft)] max-w-[640px] mx-auto">
            Pick a scenario. In a real visit, you'd just sit down — the chair handles the rest.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-[1100px]">
          {SCENARIOS.map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s.id}
              title={s.title}
              description={s.description}
              selected={selected === s.id}
              onSelect={() => setSelected(s.id)}
            />
          ))}
        </div>

        <div className="flex gap-4 mt-6">
          <ChoiceButton onClick={begin}>Begin</ChoiceButton>
          <ChoiceButton variant="quiet" onClick={() => setShowCard(true)}>
            I have a card
          </ChoiceButton>
        </div>

        <div className="text-center text-[13px] text-[color:var(--c-ink-faint)] max-w-[620px] mt-8 leading-relaxed">
          The camera turns on during the visit so the coach can notice how you're doing. It's for the coach only — the picture isn't shown on screen, isn't saved, and isn't sent anywhere else.
        </div>
      </div>

      {showCard && (
        <ShowCardModal
          onCancel={() => setShowCard(false)}
          onResolved={(payload) => {
            setShowCard(false);
            beginWithCard(payload);
          }}
        />
      )}
    </Surface>
  );
}

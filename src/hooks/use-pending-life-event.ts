import { useState, useTransition } from "react";
import { loadPendingEventForSession } from "@/app/actions/game";

interface PendingLifeEvent {
  readonly templateKey: string;
  readonly description: string;
  readonly choices: {
    readonly key: string;
    readonly text: string;
  }[];
}

export default function usePendingLifeEvent() {
  const [event, setEvent] = useState<PendingLifeEvent | null>(null);
  const [, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const data = await loadPendingEventForSession();
      if (data && "pendingLifeEvent" in data) {
        const le = data.pendingLifeEvent as PendingLifeEvent | undefined;
        if (le) {
          setEvent({ templateKey: le.templateKey, description: le.description, choices: le.choices.map((c) => ({ ...c })) });
        } else {
          setEvent(null);
        }
      } else {
        setEvent(null);
      }
    });
  };

  return { event, load };
}

/**
 * Tournoi du cockpit rattaché à une étape : lecture de son journal (celui du cockpit s'il est le
 * tournoi courant de ce navigateur, sinon celui enregistré) et écriture d'événements par le
 * responsable (répercussion des inscrits).
 */
import type { Stage, TournamentEvent, TournamentState } from "@pilot5q/domain";
import { useCallback, useEffect, useMemo, useState } from "react";

import { replay } from "@/lib/engine";
import { addNotification } from "@/lib/notifications";
import { loadEvents, saveEvents } from "@/store/persistence";
import { useTournament, type EventInput } from "@/store/tournament";

import type { RosterIO } from "./roster";

export interface StageTournament {
  /** Le journal est connu (tournoi ouvert dans ce navigateur). */
  known: boolean;
  /** Le tournoi est celui affiché par le cockpit de ce navigateur. */
  current: boolean;
  state: TournamentState | null;
  io: RosterIO | null;
  reload: () => void;
}

export function useStageTournament(stage: Stage): StageTournament {
  const cockpit = useTournament();
  const id = stage.tournamentId;
  const current = Boolean(id) && cockpit.id === id;
  const [stored, setStored] = useState<TournamentEvent[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (current || !id) return;
    let cancelled = false;
    void loadEvents(id).then((evs) => {
      if (!cancelled) setStored(evs.length > 0 ? evs : null);
    });
    return () => {
      cancelled = true;
    };
  }, [current, id, tick]);

  const events = current ? cockpit.events : stored;
  const state = useMemo(() => (events ? replay(events) : null), [events]);
  const { dispatch } = cockpit;

  const io = useMemo<RosterIO | null>(() => {
    if (!id) return null;
    return {
      load: async () => (current ? cockpit.events : await loadEvents(id)),
      append: async (e) => {
        if (current) {
          dispatch(e as EventInput);
          return;
        }
        const evs = await loadEvents(id);
        await saveEvents(id, [...evs, { ...e, at: new Date().toISOString() } as TournamentEvent]);
      },
      notify: (n) => addNotification(n),
    };
  }, [id, current, cockpit.events, dispatch]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { known: Boolean(events), current, state, io, reload };
}

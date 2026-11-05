/**
 * Store du tournoi : journal d'événements + état dérivé par rejeu.
 *
 * - `events` est la source de vérité, persistée dans IndexedDB à chaque changement ;
 * - `state` est recalculé par `replay` (moteur du domaine ou secours) ;
 * - `undo` retire le dernier événement et rejoue le journal.
 */
import type { Billard, TournamentEvent, TournamentState } from "@pilot5q/domain";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { replay } from "@/lib/engine";

import {
  loadCurrentId,
  loadEvents,
  removeTournament,
  saveCurrentId,
  saveEvents,
  upsertIndex,
} from "./persistence";

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
/** Événement sans horodatage : le store ajoute `at`. */
export type EventInput = DistributiveOmit<TournamentEvent, "at">;

export interface TournamentStore {
  /** Identifiant du tournoi ouvert (null : aucun). */
  id: string | null;
  /** Chargement initial depuis IndexedDB terminé. */
  ready: boolean;
  events: TournamentEvent[];
  state: TournamentState;
  savedAt: Date | null;
  saving: boolean;
  dispatch: (event: EventInput) => void;
  dispatchMany: (events: EventInput[]) => void;
  undo: () => void;
  canUndo: boolean;
  /** Ouvre (ou crée) un tournoi avec un journal initial. */
  open: (id: string, events: EventInput[]) => void;
  /** Ferme le tournoi courant (il reste en base). */
  close: () => void;
  /** Supprime définitivement le tournoi courant. */
  destroy: () => void;
  /** Corrige la structure des billards du tournoi (avant tout tirage). */
  amendBillards: (billards: Billard[]) => void;
}

const Ctx = createContext<TournamentStore | null>(null);

const stamp = (e: EventInput): TournamentEvent =>
  ({ ...e, at: new Date().toISOString() }) as TournamentEvent;

const PROTECTED: TournamentEvent["type"][] = ["tournament.created", "players.imported"];

export function TournamentProvider({
  children,
  initialId = null,
  initialEvents = [],
  persist = true,
}: {
  children: ReactNode;
  initialId?: string | null;
  initialEvents?: TournamentEvent[];
  persist?: boolean;
}) {
  const [id, setId] = useState<string | null>(initialId);
  const [events, setEvents] = useState<TournamentEvent[]>(initialEvents);
  const [ready, setReady] = useState(!persist);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);

  // Chargement initial
  useEffect(() => {
    if (!persist) return;
    let cancelled = false;
    (async () => {
      const current = await loadCurrentId();
      if (cancelled) return;
      if (current) {
        const evs = await loadEvents(current);
        if (cancelled) return;
        if (evs.length > 0) {
          setId(current);
          setEvents(evs);
        }
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [persist]);

  // Autosave à chaque changement du journal
  useEffect(() => {
    if (!persist || !ready || !id || !dirty.current) return;
    let cancelled = false;
    setSaving(true);
    saveEvents(id, events)
      .then(() => {
        if (cancelled) return;
        setSavedAt(new Date());
        const created = events.find((e) => e.type === "tournament.created");
        if (created?.type === "tournament.created") {
          void upsertIndex({
            id,
            name: created.payload.name,
            city: created.payload.city,
            updatedAt: new Date().toISOString(),
          });
        }
      })
      .catch(() => {
        /* stockage indisponible : l'état reste en mémoire */
      })
      .finally(() => {
        if (!cancelled) setSaving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [events, id, ready, persist]);

  const state = useMemo(() => replay(events), [events]);

  const dispatchMany = useCallback((inputs: EventInput[]) => {
    dirty.current = true;
    setEvents((prev) => [...prev, ...inputs.map(stamp)]);
  }, []);
  const dispatch = useCallback((e: EventInput) => dispatchMany([e]), [dispatchMany]);

  const canUndo = events.length > 0 && !PROTECTED.includes(events[events.length - 1]!.type);
  const undo = useCallback(() => {
    dirty.current = true;
    setEvents((prev) => {
      const last = prev[prev.length - 1];
      if (!last || PROTECTED.includes(last.type)) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  const open = useCallback(
    (newId: string, inputs: EventInput[]) => {
      dirty.current = true;
      setId(newId);
      setEvents(inputs.map(stamp));
      if (persist) void saveCurrentId(newId);
    },
    [persist],
  );

  const close = useCallback(() => {
    dirty.current = false;
    setId(null);
    setEvents([]);
    setSavedAt(null);
    if (persist) void saveCurrentId(null);
  }, [persist]);

  const destroy = useCallback(() => {
    const current = id;
    close();
    if (persist && current) void removeTournament(current);
  }, [close, id, persist]);

  const amendBillards = useCallback((billards: Billard[]) => {
    dirty.current = true;
    setEvents((prev) =>
      prev.map((e) =>
        e.type === "tournament.created" ? { ...e, payload: { ...e.payload, billards } } : e,
      ),
    );
  }, []);

  const value = useMemo<TournamentStore>(
    () => ({
      id,
      ready,
      events,
      state,
      savedAt,
      saving,
      dispatch,
      dispatchMany,
      undo,
      canUndo,
      open,
      close,
      destroy,
      amendBillards,
    }),
    [
      id,
      ready,
      events,
      state,
      savedAt,
      saving,
      dispatch,
      dispatchMany,
      undo,
      canUndo,
      open,
      close,
      destroy,
      amendBillards,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTournament(): TournamentStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTournament doit être utilisé sous <TournamentProvider>");
  return ctx;
}

/**
 * Store du tournoi : journal d'événements + état dérivé par rejeu.
 *
 * - `events` est la source de vérité, persistée dans IndexedDB à chaque changement ;
 * - `state` est recalculé par `replay` (moteur du domaine ou secours) ;
 * - `undo` retire le dernier événement et rejoue le journal ;
 * - clôture du tournoi par le directeur de jeu (`closeTournament`) : tant que le journal se
 *   termine par une clôture, plus rien ne passe (ni score, ni annulation, ni réouverture de
 *   phase), quel que soit le rôle ; seule `reopenTournament` rouvre, et uniquement si le cockpit
 *   l'a autorisée pour la session en cours (`setCanReopen` : responsable connecté).
 */
import type { Billard, TournamentEvent, TournamentState } from "@pilot5q/domain";
import { journalClosed } from "@pilot5q/domain";
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

import { closureEvents } from "@/lib/closure";
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
  /** Annule toutes les actions à partir de l'index `index` du journal (inclus). */
  undoTo: (index: number) => void;
  canUndo: boolean;
  /** Ouvre (ou crée) un tournoi avec un journal initial. */
  open: (id: string, events: EventInput[]) => void;
  /** Ferme le tournoi courant (il reste en base). */
  close: () => void;
  /** Supprime définitivement le tournoi courant. */
  destroy: () => void;
  /** Corrige la structure des billards du tournoi (avant tout tirage). */
  amendBillards: (billards: Billard[]) => void;
  /** Consultation seule (DJ après la clôture) : toute modification est ignorée. */
  readOnly: boolean;
  setReadOnly: (v: boolean) => void;
  /** Tournoi clôturé par le directeur de jeu (date, auteur), null tant qu'il est ouvert. */
  closure: { at: string; by: string } | null;
  /**
   * Clôture le tournoi : classe les tableaux joués pas encore classés puis verrouille tout.
   * Sans effet si la clôture n'est pas possible (finales non jouées, consolante en cours).
   */
  closeTournament: (by?: string) => void;
  /** La session en cours peut rouvrir un tournoi clôturé (responsable connecté). */
  canReopen: boolean;
  setCanReopen: (v: boolean) => void;
  /** Rouvre un tournoi clôturé ; ignoré si la session n'y est pas autorisée. */
  reopenTournament: (by?: string) => void;
}

const Ctx = createContext<TournamentStore | null>(null);

const stamp = (e: EventInput): TournamentEvent =>
  ({ ...e, at: new Date().toISOString() }) as TournamentEvent;

export const PROTECTED: TournamentEvent["type"][] = ["tournament.created", "players.imported"];

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
  const [readOnly, setReadOnlyState] = useState(false);
  const locked = useRef(false);
  const setReadOnly = useCallback((v: boolean) => {
    locked.current = v;
    setReadOnlyState(v);
  }, []);
  const [canReopen, setCanReopenState] = useState(false);
  const reopenAllowed = useRef(false);
  const setCanReopen = useCallback((v: boolean) => {
    reopenAllowed.current = v;
    setCanReopenState(v);
  }, []);

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

  const closure = state.closure ?? null;

  // Tournoi clôturé : le journal est figé (vérifié sur le journal à jour, pas sur un rendu).
  const dispatchMany = useCallback((inputs: EventInput[]) => {
    if (locked.current) return;
    dirty.current = true;
    setEvents((prev) => (journalClosed(prev) ? prev : [...prev, ...inputs.map(stamp)]));
  }, []);
  const dispatch = useCallback((e: EventInput) => dispatchMany([e]), [dispatchMany]);

  const canUndo =
    !readOnly &&
    !closure &&
    events.length > 0 &&
    !PROTECTED.includes(events[events.length - 1]!.type);
  const undo = useCallback(() => {
    if (locked.current) return;
    dirty.current = true;
    setEvents((prev) => {
      const last = prev[prev.length - 1];
      if (!last || PROTECTED.includes(last.type) || journalClosed(prev)) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  const undoTo = useCallback((index: number) => {
    if (locked.current) return;
    dirty.current = true;
    setEvents((prev) => {
      if (index < 0 || index >= prev.length || journalClosed(prev)) return prev;
      if (prev.slice(index).some((e) => PROTECTED.includes(e.type))) return prev;
      return prev.slice(0, index);
    });
  }, []);

  const closeTournament = useCallback((by?: string) => {
    if (locked.current) return;
    dirty.current = true;
    setEvents((prev) => {
      if (journalClosed(prev)) return prev;
      const more = closureEvents(replay(prev), by);
      return more.length > 0 ? [...prev, ...more.map(stamp)] : prev;
    });
  }, []);

  const reopenTournament = useCallback((by?: string) => {
    if (locked.current || !reopenAllowed.current) return;
    dirty.current = true;
    setEvents((prev) =>
      journalClosed(prev)
        ? [...prev, stamp({ type: "tournament.reopened", payload: by ? { by } : {} })]
        : prev,
    );
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
    if (locked.current) return;
    dirty.current = true;
    setEvents((prev) =>
      journalClosed(prev)
        ? prev
        : prev.map((e) =>
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
      undoTo,
      canUndo,
      open,
      close,
      destroy,
      amendBillards,
      readOnly,
      setReadOnly,
      closure,
      closeTournament,
      canReopen,
      setCanReopen,
      reopenTournament,
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
      undoTo,
      canUndo,
      open,
      close,
      destroy,
      amendBillards,
      readOnly,
      setReadOnly,
      closure,
      closeTournament,
      canReopen,
      setCanReopen,
      reopenTournament,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Commandes de saisie désactivées : session en consultation seule, ou tournoi clôturé par le
 * directeur de jeu (pour tout le monde, jusqu'à la réouverture par le responsable).
 */
export function useEditLock(): boolean {
  const ctx = useContext(Ctx);
  return Boolean(ctx && (ctx.readOnly || ctx.closure));
}

export function useTournament(): TournamentStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTournament doit être utilisé sous <TournamentProvider>");
  return ctx;
}

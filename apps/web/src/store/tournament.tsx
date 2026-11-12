/**
 * Store du tournoi : journal d'événements + état dérivé par rejeu.
 *
 * - `events` est la source de vérité, persistée dans IndexedDB à chaque changement ;
 * - `state` est recalculé par `replay` (moteur du domaine ou secours) ;
 * - `undo` / `undoTo` retirent des événements du journal et rejouent, mais rien n'est perdu :
 *   les événements retirés vont dans la pile `redo` (un groupe par annulation, persistée) et
 *   `redo()` les remet tels quels. Toute nouvelle action vide cette pile ;
 * - clôture du tournoi par le directeur de jeu (`closeTournament`), d'après `closureStatus` du
 *   domaine (réponse du responsable national, 11 novembre : « après la clôture du DJ seul le
 *   responsable peut modifier ») :
 *   · tournoi clôturé : plus rien ne passe (ni score, ni annulation, ni réouverture de phase),
 *     quel que soit le rôle ; seule `reopenTournament` rouvre, et uniquement pour la session du
 *     responsable connecté (`setCanReopen`, posé par le cockpit) ;
 *   · tournoi rouvert : seul le responsable modifie (scores, classements, annulation) puis
 *     clôture de nouveau ; le directeur de jeu et la démonstration restent en lecture seule ;
 *   · une clôture ne s'annule pas : le directeur de jeu ne retrouve jamais la saisie.
 */
import type { Billard, TournamentEvent, TournamentState } from "@pilot5q/domain";
import { closureStatus, journalClosed } from "@pilot5q/domain";
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
  loadRedo,
  removeTournament,
  saveCurrentId,
  saveEvents,
  saveRedo,
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
  /**
   * Actions annulées qu'on peut rétablir : un groupe par annulation, le plus récent en dernier.
   * Vidé dès qu'une nouvelle action est saisie.
   */
  redoStack: TournamentEvent[][];
  /** Rétablit la dernière annulation (`all` : toutes les annulations en attente). */
  redo: (all?: boolean) => void;
  canRedo: boolean;
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
  /**
   * Réouverture en cours par le responsable (date, auteur), après une clôture : lui seul peut
   * corriger, jusqu'à la nouvelle clôture.
   */
  reopening: { at: string; by: string } | null;
  /**
   * Session du responsable connecté : elle seule peut rouvrir un tournoi clôturé, le corriger
   * pendant la réouverture et le clôturer de nouveau.
   */
  canReopen: boolean;
  setCanReopen: (v: boolean) => void;
  /** Rouvre un tournoi clôturé ; ignoré si la session n'y est pas autorisée. */
  reopenTournament: (by?: string) => void;
}

/** Journal du tournoi et actions annulées, tenus ensemble. */
interface Journal {
  events: TournamentEvent[];
  redo: TournamentEvent[][];
}

const Ctx = createContext<TournamentStore | null>(null);

const stamp = (e: EventInput): TournamentEvent =>
  ({ ...e, at: new Date().toISOString() }) as TournamentEvent;

/** Événements que « Annuler » ne retire jamais : création, import, et clôture du tournoi. */
export const PROTECTED: TournamentEvent["type"][] = [
  "tournament.created",
  "players.imported",
  "tournament.closed",
];

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
  // Journal et pile « Rétablir » changent ensemble : un seul état, pour rester cohérents.
  const [journal, setJournal] = useState<Journal>({ events: initialEvents, redo: [] });
  const events = journal.events;
  const redoStack = journal.redo;
  /** Modifie le journal ; une nouvelle action vide la pile « Rétablir ». */
  const setEvents = useCallback(
    (next: TournamentEvent[] | ((prev: TournamentEvent[]) => TournamentEvent[])) =>
      setJournal((prev) => {
        const events = typeof next === "function" ? next(prev.events) : next;
        return events === prev.events ? prev : { events, redo: [] };
      }),
    [],
  );
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
          const redo = await loadRedo(current);
          if (cancelled) return;
          setId(current);
          setJournal({ events: evs, redo });
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
      .then(() => saveRedo(id, redoStack))
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
  }, [events, redoStack, id, ready, persist]);

  const state = useMemo(() => replay(events), [events]);

  const closure = state.closure ?? null;
  const reopening = state.reopening ?? null;

  /**
   * Le journal refuse-t-il toute modification à la session en cours ? Clôturé : oui, pour tous.
   * Rouvert pour correction : oui, sauf pour le responsable. Vérifié sur le journal à jour, pas
   * sur un rendu.
   */
  const frozen = useCallback((events: TournamentEvent[]) => {
    const status = closureStatus(events);
    return status === "closed" || (status === "reopened" && !reopenAllowed.current);
  }, []);

  const dispatchMany = useCallback(
    (inputs: EventInput[]) => {
      if (locked.current) return;
      dirty.current = true;
      setEvents((prev) => (frozen(prev) ? prev : [...prev, ...inputs.map(stamp)]));
    },
    [frozen, setEvents],
  );
  const dispatch = useCallback((e: EventInput) => dispatchMany([e]), [dispatchMany]);

  const canUndo =
    !readOnly &&
    !closure &&
    !(reopening && !canReopen) &&
    events.length > 0 &&
    !PROTECTED.includes(events[events.length - 1]!.type);
  const undo = useCallback(() => {
    if (locked.current) return;
    dirty.current = true;
    setJournal((prev) => {
      const last = prev.events[prev.events.length - 1];
      if (!last || PROTECTED.includes(last.type) || frozen(prev.events)) return prev;
      return { events: prev.events.slice(0, -1), redo: [...prev.redo, [last]] };
    });
  }, [frozen]);

  const undoTo = useCallback(
    (index: number) => {
      if (locked.current) return;
      dirty.current = true;
      setJournal((prev) => {
        if (index < 0 || index >= prev.events.length || frozen(prev.events)) return prev;
        const removed = prev.events.slice(index);
        if (removed.some((e) => PROTECTED.includes(e.type))) return prev;
        return { events: prev.events.slice(0, index), redo: [...prev.redo, removed] };
      });
    },
    [frozen],
  );

  const canRedo =
    !readOnly && !closure && !(reopening && !canReopen) && redoStack.length > 0;
  const redo = useCallback(
    (all = false) => {
      if (locked.current) return;
      dirty.current = true;
      setJournal((prev) => {
        if (prev.redo.length === 0 || frozen(prev.events)) return prev;
        // Les groupes se rétablissent du plus récent au plus ancien : l'ordre du journal revient.
        const groups = all ? [...prev.redo].reverse() : [prev.redo[prev.redo.length - 1]!];
        return {
          events: [...prev.events, ...groups.flat()],
          redo: all ? [] : prev.redo.slice(0, -1),
        };
      });
    },
    [frozen],
  );

  const closeTournament = useCallback(
    (by?: string) => {
      if (locked.current) return;
      dirty.current = true;
      setEvents((prev) => {
        if (frozen(prev)) return prev;
        const more = closureEvents(replay(prev), by);
        return more.length > 0 ? [...prev, ...more.map(stamp)] : prev;
      });
    },
    [frozen, setEvents],
  );

  const reopenTournament = useCallback((by?: string) => {
    if (locked.current || !reopenAllowed.current) return;
    dirty.current = true;
    setEvents((prev) =>
      journalClosed(prev)
        ? [...prev, stamp({ type: "tournament.reopened", payload: by ? { by } : {} })]
        : prev,
    );
  }, [setEvents]);

  const open = useCallback(
    (newId: string, inputs: EventInput[]) => {
      dirty.current = true;
      setId(newId);
      setJournal({ events: inputs.map(stamp), redo: [] });
      if (persist) void saveCurrentId(newId);
    },
    [persist],
  );

  const close = useCallback(() => {
    dirty.current = false;
    setId(null);
    setJournal({ events: [], redo: [] });
    setSavedAt(null);
    if (persist) void saveCurrentId(null);
  }, [persist]);

  const destroy = useCallback(() => {
    const current = id;
    close();
    if (persist && current) void removeTournament(current);
  }, [close, id, persist]);

  const amendBillards = useCallback(
    (billards: Billard[]) => {
      if (locked.current) return;
      dirty.current = true;
      setEvents((prev) =>
        frozen(prev)
          ? prev
          : prev.map((e) =>
              e.type === "tournament.created" ? { ...e, payload: { ...e.payload, billards } } : e,
            ),
      );
    },
    [frozen, setEvents],
  );

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
      redoStack,
      redo,
      canRedo,
      open,
      close,
      destroy,
      amendBillards,
      readOnly,
      setReadOnly,
      closure,
      reopening,
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
      redoStack,
      redo,
      canRedo,
      open,
      close,
      destroy,
      amendBillards,
      readOnly,
      setReadOnly,
      closure,
      reopening,
      closeTournament,
      canReopen,
      setCanReopen,
      reopenTournament,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Commandes de saisie désactivées : session en consultation seule, tournoi clôturé (pour tout le
 * monde, jusqu'à la réouverture par le responsable), ou tournoi rouvert pour correction (pour
 * tous sauf le responsable).
 */
export function useEditLock(): boolean {
  const ctx = useContext(Ctx);
  if (!ctx) return false;
  return Boolean(ctx.readOnly || ctx.closure || (ctx.reopening && !ctx.canReopen));
}

export function useTournament(): TournamentStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTournament doit être utilisé sous <TournamentProvider>");
  return ctx;
}

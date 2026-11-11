import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { realWeekendEvents } from "@/admin/realWeekend";
import { demoEvents } from "@/lib/demo";

import { TournamentProvider, useEditLock, useTournament, type EventInput } from "./tournament";

const wrapper = ({ children }: { children: ReactNode }) => (
  <TournamentProvider persist={false}>{children}</TournamentProvider>
);

const at = "2026-11-01T17:00:00.000Z";
/** Week-end réel du tournoi d'exemple, joué jusqu'aux finales. */
function playedWeekend(): EventInput[] {
  const base = demoEvents();
  return [...base, ...realWeekendEvents(base.map((e) => ({ ...e, at }) as never))];
}
/** Même week-end, sans le classement final des tableaux (finales jouées, pas encore classées). */
function playedNotRanked(): EventInput[] {
  return playedWeekend().filter(
    (e) => !(e.type === "phase.closed" && ["M", "N", "CLS"].includes(e.payload.phase)),
  );
}

const useStore = () => ({ store: useTournament(), lock: useEditLock() });

const score: EventInput = {
  type: "score.entered",
  payload: { phase: "M", matchId: "M-F", sa: 0, sb: 3, setsA: [1, 2, 3], setsB: [60, 60, 60] },
};

describe("clôture du tournoi par le directeur de jeu", () => {
  it("n'est possible qu'une fois les finales jouées", () => {
    const { result } = renderHook(useStore, { wrapper });
    act(() => result.current.store.open("t-early", demoEvents()));
    const n = result.current.store.events.length;
    act(() => result.current.store.closeTournament("DJ"));
    expect(result.current.store.events).toHaveLength(n);
    expect(result.current.store.closure).toBeNull();
    expect(result.current.lock).toBe(false);
  });

  it("classe les tableaux joués puis fige le journal", () => {
    const { result } = renderHook(useStore, { wrapper });
    act(() => result.current.store.open("t-close", playedNotRanked()));
    expect(result.current.store.state.closed.M).toBeUndefined();
    act(() => result.current.store.closeTournament("DUPONT Jean"));
    const { state, closure } = result.current.store;
    expect(state.closed).toMatchObject({ M: true, N: true, CLS: true });
    expect(closure?.by).toBe("DUPONT Jean");
    expect(result.current.lock).toBe(true);
    expect(result.current.store.canUndo).toBe(false);
  });

  it("après la clôture, le directeur de jeu ne peut plus rien modifier, annuler ni rouvrir", () => {
    const { result } = renderHook(useStore, { wrapper });
    act(() => result.current.store.open("t-dj", playedWeekend()));
    act(() => result.current.store.closeTournament("DJ"));
    const n = result.current.store.events.length;
    const final = result.current.store.state.brackets.M.find((m) => m.id === "M-F");

    act(() => result.current.store.dispatch(score));
    act(() =>
      result.current.store.dispatchMany([
        { type: "phase.reopened", payload: { phase: "M" } },
        { type: "tournament.reopened", payload: {} },
      ]),
    );
    act(() => result.current.store.undo());
    act(() => result.current.store.undoTo(n - 3));
    act(() => result.current.store.amendBillards([]));
    // Réouverture : refusée, la session n'est pas celle du responsable
    act(() => result.current.store.reopenTournament("DJ"));

    expect(result.current.store.events).toHaveLength(n);
    expect(result.current.store.closure).not.toBeNull();
    expect(result.current.store.state.closed.M).toBe(true);
    expect(result.current.store.state.brackets.M.find((m) => m.id === "M-F")).toEqual(final);
    expect(result.current.store.state.billards.length).toBeGreaterThan(0);
  });

  it("le responsable connecté rouvre, corrige, puis le tournoi peut être clôturé de nouveau", () => {
    const { result } = renderHook(useStore, { wrapper });
    act(() => result.current.store.open("t-resp", playedWeekend()));
    act(() => result.current.store.closeTournament("DJ"));
    // Même le responsable ne modifie rien sans rouvrir d'abord
    act(() => result.current.store.setCanReopen(true));
    const n = result.current.store.events.length;
    act(() => result.current.store.dispatch(score));
    expect(result.current.store.events).toHaveLength(n);

    act(() => result.current.store.reopenTournament("Responsable"));
    expect(result.current.store.closure).toBeNull();
    expect(result.current.lock).toBe(false);
    expect(result.current.store.events.at(-1)).toMatchObject({
      type: "tournament.reopened",
      payload: { by: "Responsable" },
    });

    // Correction du score de la finale Masters après réouverture du tableau
    act(() => result.current.store.dispatch({ type: "phase.reopened", payload: { phase: "M" } }));
    act(() => result.current.store.dispatch(score));
    expect(result.current.store.state.brackets.M.find((m) => m.id === "M-F")?.sb).toBe(3);

    act(() => result.current.store.closeTournament("Responsable"));
    expect(result.current.store.closure?.by).toBe("Responsable");
    expect(result.current.store.state.closed.M).toBe(true);
  });

  it("pendant une réouverture, seul le responsable modifie : le directeur de jeu reste verrouillé", () => {
    const { result } = renderHook(useStore, { wrapper });
    act(() => result.current.store.open("t-reopened", playedWeekend()));
    act(() => result.current.store.closeTournament("DJ"));
    act(() => result.current.store.setCanReopen(true));
    act(() => result.current.store.reopenTournament("Responsable"));
    expect(result.current.store.reopening?.by).toBe("Responsable");

    // Session du directeur de jeu (ou démonstration) : le tournoi est rouvert, pas pour lui
    act(() => result.current.store.setCanReopen(false));
    expect(result.current.lock).toBe(true);
    expect(result.current.store.canUndo).toBe(false);
    const n = result.current.store.events.length;
    act(() => result.current.store.dispatch(score));
    act(() => result.current.store.dispatch({ type: "phase.reopened", payload: { phase: "M" } }));
    act(() => result.current.store.undo());
    act(() => result.current.store.undoTo(n - 2));
    act(() => result.current.store.amendBillards([]));
    // Il ne peut pas non plus clôturer de nouveau à la place du responsable
    act(() => result.current.store.closeTournament("DJ"));
    act(() => result.current.store.reopenTournament("DJ"));
    expect(result.current.store.events).toHaveLength(n);
    expect(result.current.store.closure).toBeNull();
    expect(result.current.store.reopening?.by).toBe("Responsable");

    // Session du responsable : il corrige, annule sa correction, puis clôture de nouveau
    act(() => result.current.store.setCanReopen(true));
    expect(result.current.lock).toBe(false);
    act(() => result.current.store.dispatch({ type: "phase.reopened", payload: { phase: "M" } }));
    act(() => result.current.store.dispatch(score));
    expect(result.current.store.state.brackets.M.find((m) => m.id === "M-F")?.sb).toBe(3);
    act(() => result.current.store.undo());
    expect(result.current.store.state.brackets.M.find((m) => m.id === "M-F")?.sb).not.toBe(3);
    act(() => result.current.store.closeTournament("Responsable"));
    expect(result.current.store.closure?.by).toBe("Responsable");
    expect(result.current.store.reopening).toBeNull();
    // Reclôturé : de nouveau figé pour tout le monde
    expect(result.current.lock).toBe(true);
  });

  it("une clôture ne s'annule pas : impossible de revenir avant elle, même pour le responsable", () => {
    const { result } = renderHook(useStore, { wrapper });
    act(() => result.current.store.open("t-barrier", playedWeekend()));
    const before = result.current.store.events.length;
    act(() => result.current.store.closeTournament("DJ"));
    act(() => result.current.store.setCanReopen(true));
    act(() => result.current.store.reopenTournament("Responsable"));
    const n = result.current.store.events.length;
    // Revenir à un point antérieur à la clôture rendrait la saisie au directeur de jeu : refusé
    act(() => result.current.store.undoTo(before - 1));
    act(() => result.current.store.undoTo(before));
    expect(result.current.store.events).toHaveLength(n);
    // Annuler la réouverture elle-même : le tournoi redevient clôturé
    act(() => result.current.store.undo());
    expect(result.current.store.events).toHaveLength(n - 1);
    expect(result.current.store.closure?.by).toBe("DJ");
    act(() => result.current.store.undo());
    expect(result.current.store.events).toHaveLength(n - 1);
  });

  it("une session en lecture seule ne peut ni clôturer ni rouvrir", () => {
    const { result } = renderHook(useStore, { wrapper });
    act(() => result.current.store.open("t-ro", playedWeekend()));
    act(() => result.current.store.setReadOnly(true));
    act(() => result.current.store.closeTournament("DJ"));
    expect(result.current.store.closure).toBeNull();
    act(() => result.current.store.setReadOnly(false));
    act(() => result.current.store.closeTournament("DJ"));
    act(() => {
      result.current.store.setReadOnly(true);
      result.current.store.setCanReopen(true);
    });
    act(() => result.current.store.reopenTournament("X"));
    expect(result.current.store.closure).not.toBeNull();
  });
});

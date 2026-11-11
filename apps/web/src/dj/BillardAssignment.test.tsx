import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ToastProvider } from "@/components/Toast";
import { assignmentsKey, planToAssignments } from "@/lib/assign";
import { optimizeBillards } from "@/lib/billardsOptimizer";
import { demoEvents } from "@/lib/demo";
import { TournamentProvider, useTournament, type TournamentStore } from "@/store/tournament";

import { BillardAssignment } from "./BillardAssignment";

/** Tournoi d'exemple : 17 poules de 4, 11 billards (1 à 4 en 3m10, 5 à 11 en 2m80). */
function renderAssignment() {
  const events = demoEvents().map((e) => ({ ...e, at: "2026-10-29T10:00:00Z" }));
  const store: { current: TournamentStore | null } = { current: null };
  function Probe() {
    store.current = useTournament();
    return null;
  }
  render(
    <TournamentProvider persist={false} initialId="demo" initialEvents={events as never}>
      <ToastProvider>
        <Probe />
        <BillardAssignment pouleCount={17} locked={false} />
      </ToastProvider>
    </TournamentProvider>,
  );
  return {
    state: () => store.current!.state,
    store: () => store.current!,
    preq: () => store.current!.state.billardAssignments.PREQ ?? {},
  };
}

const tile = (name: string) => screen.getByRole("group", { name });

describe("affectation des billards du vendredi", () => {
  it("écrit chaque modification dans le journal, sans brouillon à enregistrer", () => {
    const t = renderAssignment();
    expect(t.preq()["1"]).toEqual([11]);
    fireEvent.change(screen.getByLabelText("Ajouter une poule au billard 2"), {
      target: { value: "1" },
    });
    expect(t.preq()["1"]).toEqual([2]);
    expect(within(tile("Billard 2")).getByTitle(/^Poule 1 ·/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
    // Retirer une poule : le journal dit explicitement qu'elle n'a plus de billard
    fireEvent.click(screen.getByRole("button", { name: "Retirer la poule 1" }));
    expect(t.preq()["1"]).toEqual([]);
    expect(screen.getByText(/1 non placée/)).toBeInTheDocument();
  });

  it("« Proposer » applique toute la proposition de l'optimiseur, billards liés compris", () => {
    const t = renderAssignment();
    fireEvent.click(screen.getByRole("button", { name: "Proposer" }));
    const sizes = Array.from({ length: 17 }, (_, i) => ({ num: i + 1, size: 4 }));
    const proposal = optimizeBillards(sizes, t.state().billards, 1);
    if (!proposal.ok) throw new Error(proposal.reason);
    expect(assignmentsKey(t.preq())).toBe(assignmentsKey(planToAssignments(proposal.plan)));
    // 17 poules sur 11 billards : 5 groupes de 3 poules sur 2 billards liés, 1 billard à 2 poules
    const linked = screen.getAllByRole("group", { name: /^Billards \d+ \+ \d+$/ });
    expect(linked).toHaveLength(5);
    for (const group of linked) expect(within(group).getAllByTitle(/^Poule \d+ ·/)).toHaveLength(3);
    // Aucun billard vide, dans le journal comme à l'écran
    const used = new Set(Object.values(t.preq()).flat());
    expect([...used].sort((a, b) => a - b)).toEqual(t.state().billards.map((b) => b.num));
    expect(screen.queryByText("Déposez une poule ici")).toBeNull();
    // Les poules du journal portent les deux billards de leur paire
    const pairs = Object.values(t.preq()).filter((bs) => bs.length === 2);
    expect(pairs).toHaveLength(15);
    // « Autre proposition » : une autre répartition, toujours complète
    fireEvent.click(screen.getByRole("button", { name: "Autre proposition" }));
    expect(new Set(Object.values(t.preq()).flat()).size).toBe(11);
  });

  it("« Vider » puis annulation : l'affichage suit le journal", () => {
    const t = renderAssignment();
    const before = assignmentsKey(t.preq());
    fireEvent.click(screen.getByRole("button", { name: "Vider" }));
    expect(assignmentsKey(t.preq())).toBe("");
    expect(screen.getByText(/À placer \(17\)/)).toBeInTheDocument();
    act(() => t.store().undo());
    expect(assignmentsKey(t.preq())).toBe(before);
    expect(screen.queryByText(/À placer/)).toBeNull();
    expect(within(tile("Billard 11")).getByTitle(/^Poule 1 ·/)).toBeInTheDocument();
  });

  it("deux billards liés encore vides restent liés quand le journal change ailleurs", () => {
    const t = renderAssignment();
    fireEvent.click(screen.getByRole("button", { name: "Vider" }));
    fireEvent.click(within(tile("Billard 5")).getByRole("button", { name: "Lier" }));
    fireEvent.click(within(tile("Billard 5")).getByRole("button", { name: "B6" }));
    expect(tile("Billards 5 + 6")).toBeInTheDocument();
    // Un événement sur une autre phase ne défait pas la liaison en cours
    act(() =>
      t.store().dispatch({
        type: "billards.assigned",
        payload: { phase: "B", assignments: { B1: [3] } },
      }),
    );
    expect(tile("Billards 5 + 6")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Ajouter une poule au billard 5 + 6"), {
      target: { value: "4" },
    });
    expect(t.preq()["4"]).toEqual([5, 6]);
  });
});

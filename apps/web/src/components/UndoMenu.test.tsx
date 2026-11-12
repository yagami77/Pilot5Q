import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { TournamentEvent } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import { demoEvents } from "@/lib/demo";
import { useTournament } from "@/store/tournament";
import { renderView } from "@/test/weekend";

import { UndoMenu } from "./UndoMenu";

const at = "2026-10-29T10:00:00.000Z";
const assign = (b: number): TournamentEvent => ({
  type: "billards.assigned",
  at,
  payload: { phase: "B", assignments: { B1: [b] } },
});
/** Tournoi d'exemple suivi de trois affectations de billards (les trois actions annulables). */
const journal = (): TournamentEvent[] => [
  ...demoEvents().map((e) => ({ ...e, at }) as TournamentEvent),
  assign(9),
  assign(10),
  assign(11),
];

function Probe() {
  const { events } = useTournament();
  return <output data-testid="count">{events.length}</output>;
}

const count = () => Number(screen.getByTestId("count").textContent);
const panel = () => screen.getByRole("dialog", { name: "Historique des actions" });

function setup() {
  const events = journal();
  renderView(
    <>
      <UndoMenu />
      <Probe />
    </>,
    events,
  );
  return events.length;
}

describe("annulation : historique, confirmation, rétablir", () => {
  it("« Annuler » n'efface rien d'un clic : il ouvre l'historique et demande confirmation", async () => {
    const n = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Annuler/ }));
    // Rien n'a bougé : la dernière action est seulement présélectionnée
    expect(count()).toBe(n);
    expect(within(panel()).getByText(/^Annuler « Billards · barrages » \?$/)).toBeInTheDocument();
    // Renoncer ne change rien
    fireEvent.click(within(panel()).getByRole("button", { name: "Ne rien annuler" }));
    expect(count()).toBe(n);
    // Confirmer annule la seule dernière action
    fireEvent.click(within(panel()).getAllByRole("button", { pressed: false })[0]!);
    fireEvent.click(within(panel()).getByRole("button", { name: "Confirmer l'annulation" }));
    expect(count()).toBe(n - 1);
    // Le panneau se referme (après son animation de sortie)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("revient où l'on veut : l'action choisie et les suivantes, avec le décompte", () => {
    const n = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Annuler/ }));
    const rows = within(panel()).getAllByRole("button", { name: /Billards · barrages/ });
    expect(rows.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(rows[2]!);
    expect(within(panel()).getByText("Annuler les 3 dernières actions ?")).toBeInTheDocument();
    expect(within(panel()).getByText("3 affectations de billards")).toBeInTheDocument();
    fireEvent.click(within(panel()).getByRole("button", { name: "Annuler ces 3 actions" }));
    expect(count()).toBe(n - 3);
  });

  it("« Rétablir » remet ce qui vient d'être annulé", () => {
    const n = setup();
    expect(screen.queryByRole("button", { name: /Rétablir/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Annuler/ }));
    fireEvent.click(within(panel()).getAllByRole("button", { name: /Billards · barrages/ })[1]!);
    fireEvent.click(within(panel()).getByRole("button", { name: "Annuler ces 2 actions" }));
    expect(count()).toBe(n - 2);
    fireEvent.click(screen.getByRole("button", { name: /Rétablir/ }));
    expect(count()).toBe(n);
    expect(screen.queryByRole("button", { name: /Rétablir/ })).toBeNull();
  });

  it("Échap ferme l'historique sans rien annuler", () => {
    const n = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Annuler/ }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(count()).toBe(n);
  });
});

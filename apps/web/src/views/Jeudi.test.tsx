import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { ToastProvider } from "@/components/Toast";
import { demoEvents } from "@/lib/demo";
import { TournamentProvider } from "@/store/tournament";

import { Jeudi } from "./Jeudi";

function renderJeudi() {
  const events = demoEvents().map((e) => ({ ...e, at: "2026-10-29T10:00:00Z" }));
  return render(
    <MemoryRouter>
      <TournamentProvider persist={false} initialId="demo" initialEvents={events as never}>
        <ToastProvider>
          <Jeudi />
        </ToastProvider>
      </TournamentProvider>
    </MemoryRouter>,
  );
}

describe("vue Jeudi", () => {
  it("affiche les tuiles, les têtes de série et lance le tirage des poules", () => {
    renderJeudi();
    expect(screen.getByRole("heading", { name: /Tirage des billards/ })).toBeInTheDocument();
    expect(
      screen.getByText("Inscrits").nextElementSibling?.querySelector("[aria-label]"),
    ).toHaveAttribute("aria-label", "76");
    expect(screen.getByText("Coupade Jules")).toBeInTheDocument();
    expect(screen.getByText("David Nicolas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lancer le tirage" }));
    expect(screen.getByRole("heading", { name: "Serpentin du tirage" })).toBeInTheDocument();
    // Liste statique des poules : une ligne par poule, sans numéros 1 à 4
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(18);
    expect(screen.getByRole("heading", { name: "Documents à imprimer" })).toBeInTheDocument();
    expect(screen.getByText(/17 poules créées/)).toBeInTheDocument();
    // Bouton du jour suivant dans la barre des tâches : désactivé tant que tout n'est pas fait
    const next = screen.getByRole("button", { name: /Passer au vendredi/ });
    expect(next).toBeDisabled();
    expect(next.parentElement?.parentElement).toHaveAttribute(
      "title",
      expect.stringMatching(/Reste à faire : .*Documents imprimés/),
    );
  });

  it("garde l'affectation modifiée des poules du vendredi quand on change un billard d'une phase suivante", () => {
    renderJeudi();
    const card = screen
      .getByRole("heading", { name: "Billards et poules affectées" })
      .closest("section")!;
    const tile = () => within(card).getByRole("group", { name: "Billard 2" });
    // Tournoi d'exemple : la poule 1 est sur le billard 11 ; le DJ la déplace sur le billard 2
    expect(within(tile()).queryByTitle(/^Poule 1 ·/)).toBeNull();
    fireEvent.change(within(card).getByLabelText("Ajouter une poule au billard 2"), {
      target: { value: "1" },
    });
    expect(within(tile()).getByTitle(/^Poule 1 ·/)).toBeInTheDocument();
    // … puis il modifie le billard d'un barrage (phases suivantes)
    const later = screen
      .getByRole("heading", { name: "Billards des phases suivantes" })
      .closest("section")!;
    fireEvent.click(within(later).getByRole("button", { name: "Modifier" }));
    const select = within(later).getByLabelText("Barrages · B1") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: select.value === "3" ? "4" : "3" } });
    // L'affectation des poules du vendredi n'est pas revenue à celle par défaut
    expect(within(tile()).getByTitle(/^Poule 1 ·/)).toBeInTheDocument();
  });
});

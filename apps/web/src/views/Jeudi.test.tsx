import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByText("Barre Patrick")).toBeInTheDocument();
    expect(screen.getByText("Hubert Michel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lancer le tirage" }));
    expect(screen.getAllByText("Poule 17").length).toBeGreaterThan(0);
    expect(screen.getByText(/17 poules créées/)).toBeInTheDocument();
    // Bouton du jour suivant dans la barre des tâches : désactivé tant que tout n'est pas fait
    const next = screen.getByRole("button", { name: /Passer au vendredi/ });
    expect(next).toBeDisabled();
    expect(next.parentElement?.parentElement).toHaveAttribute(
      "title",
      expect.stringMatching(/Reste à faire : .*Documents imprimés/),
    );
  });
});

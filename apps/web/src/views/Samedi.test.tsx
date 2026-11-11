import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  fewSmallTables,
  fridayDone,
  mastersRanked,
  renderView,
  saturdayWithConsolante,
} from "@/test/weekend";

import { Samedi } from "./Samedi";

describe("samedi : issue des poules Masters", () => {
  it("rien sous les poules tant que les Masters ne sont pas classés", () => {
    renderView(<Samedi />, fridayDone());
    expect(screen.queryByText(/qualifiés pour les quarts/)).not.toBeInTheDocument();
  });

  it("Masters classés : 8 qualifiés avec leur quart, 8 éliminés avec leur prime", () => {
    renderView(<Samedi />, mastersRanked());
    const qualified = screen.getByRole("region", { name: "Qualifiés pour les quarts de finale" });
    expect(within(qualified).getByText("8 qualifiés pour les quarts")).toBeInTheDocument();
    // SPEC §5 : Q1 = 1er P1 – 2e P4, Q2 = 1er P3 – 2e P2, Q3 = 1er P4 – 2e P1, Q4 = 1er P2 – 2e P3
    const quarts = within(qualified).getAllByRole("listitem");
    expect(quarts.map((q) => q.textContent?.replace(/\s+/g, " "))).toEqual([
      expect.stringMatching(/Q1.*Coupade Jules.*1er poule 1.*Mikdad Ali Mohammed.*2e poule 4/),
      expect.stringMatching(/Q2.*1er poule 3.*2e poule 2/),
      expect.stringMatching(/Q3.*1er poule 4.*2e poule 1/),
      expect.stringMatching(/Q4.*1er poule 2.*2e poule 3/),
    ]);

    const out = screen.getByRole("region", { name: "Éliminés des poules Masters et primes" });
    // 2 % de la cagnotte (2 870 €) pour chaque 3e et 4e de poule
    expect(within(out).getByText(/8 éliminés · prime de 57,40/)).toBeInTheDocument();
    const lines = within(out).getAllByRole("listitem");
    expect(lines).toHaveLength(8);
    expect(lines[0]).toHaveTextContent(/3e poule 1.*Bongiovanni Giovanni.*57,40/);
    expect(within(out).getAllByRole("checkbox")).toHaveLength(8);
  });

  it("le détail des primes s'ouvre dans un volet qui disparaît quand on le replie", async () => {
    renderView(<Samedi />, mastersRanked());
    expect(screen.queryByRole("region", { name: "Primes du tournoi" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voir les primes" }));
    const panel = screen.getByRole("region", { name: "Primes du tournoi" });
    expect(within(panel).getByText("Masters · 80 %")).toBeInTheDocument();
    expect(within(panel).getByText("National · 20 %")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Masquer les primes" }));
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Primes du tournoi" })).not.toBeInTheDocument(),
    );
  });

  it("la barre des tâches n'a plus de tâche « Primes des poules Masters »", () => {
    renderView(<Samedi />, mastersRanked());
    const bar = screen.getByRole("region", { name: "Tâches du samedi" });
    expect(within(bar).queryByText(/Primes/)).not.toBeInTheDocument();
  });
});

describe("samedi : consolante", () => {
  it("non créée : volontaires et création directement sur la page du samedi", () => {
    renderView(<Samedi />, fridayDone());
    expect(screen.getByText(/La consolante n'a pas été créée le vendredi soir/)).toBeVisible();
    const boxes = screen.getAllByRole("checkbox", { name: /souhaite jouer la consolante/ });
    expect(boxes).toHaveLength(28);
    // Trois volontaires seulement
    boxes.slice(3).forEach((b) => fireEvent.click(b));
    fireEvent.click(screen.getByRole("button", { name: "Créer la consolante" }));
    expect(screen.queryByRole("button", { name: "Créer la consolante" })).not.toBeInTheDocument();
    const bar = screen.getByRole("region", { name: "Tâches du samedi" });
    expect(within(bar).getByRole("button", { name: /^Consolante/ })).toHaveAttribute(
      "data-status",
      "todo",
    );
  });

  it("sans objet avec moins de 5 billards 2m80", () => {
    renderView(<Samedi />, fewSmallTables(fridayDone()));
    expect(screen.getByText(/Consolante sans objet : il faut au moins 5 billards/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Créer la consolante" })).not.toBeInTheDocument();
  });

  it("19 joueurs : chaque huitième montre ses deux lignes, joueur connu ou vainqueur attendu", () => {
    renderView(<Samedi />, saturdayWithConsolante());
    const card = (id: string) => {
      const el = document.querySelector<HTMLElement>(`#consolante [data-match="${id}"]`);
      if (!el) throw new Error(`carte ${id} absente`);
      return el;
    };
    // Les trois matchs avant les huitièmes sont des barrages : B1, B2, B3 dans l'ordre du tableau
    expect(screen.getByText(/^Barrages · 1 set à 100$/)).toBeInTheDocument();
    expect(screen.queryByText(/^Seizièmes/)).not.toBeInTheDocument();
    expect(card("CLS-R32-2")).toHaveTextContent(/^B1/);
    expect(card("CLS-R32-10")).toHaveTextContent(/^B2/);
    expect(card("CLS-R32-14")).toHaveTextContent(/^B3/);
    // H1 : tête de série 1 contre le vainqueur du barrage B1
    expect(card("CLS-R16-1")).toHaveTextContent(/^H1/);
    expect(card("CLS-R16-1")).toHaveTextContent("Desmettre Bruno");
    expect(card("CLS-R16-1")).toHaveTextContent("Vainqueur B1");
    expect(card("CLS-R16-5")).toHaveTextContent("Vainqueur B2");
    expect(card("CLS-R16-7")).toHaveTextContent("Vainqueur B3");
    expect(card("CLS-QF1")).toHaveTextContent("Vainqueur H1");
    // H2 : deux joueurs connus
    expect(card("CLS-R16-2")).toHaveTextContent("Goutaloy Sylvain");
    expect(card("CLS-R16-2")).toHaveTextContent("Fourneyron Richard");
    // Les cartes d'un même tour ne se chevauchent pas (116 px de haut)
    const tops = Array.from({ length: 8 }, (_, i) =>
      Number.parseFloat(card(`CLS-R16-${i + 1}`).style.top),
    );
    tops.slice(1).forEach((top, i) => expect(top - (tops[i] ?? 0)).toBeGreaterThanOrEqual(116));
  });
});

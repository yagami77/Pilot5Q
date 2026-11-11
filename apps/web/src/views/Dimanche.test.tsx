import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { allPlayed, allRanked, renderView, sundayStart } from "@/test/weekend";

import { Dimanche } from "./Dimanche";

beforeEach(() => window.localStorage.clear());

const rendered = (label: string) => screen.getByLabelText(new RegExp(`^${label} `));

describe("dimanche : barre des tâches", () => {
  it("plus de tâche « Arbitres renseignés » ni de téléchargement du JSON", () => {
    renderView(<Dimanche />, allRanked());
    expect(screen.queryByText(/Arbitres renseignés/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /JSON/ })).not.toBeInTheDocument();
  });
});

describe("dimanche : saisie d'un quart en 3 sets gagnants", () => {
  it("« Valider » n'est actif que pour un match complet ; les arbitres restent facultatifs", () => {
    renderView(<Dimanche />, sundayStart());
    fireEvent.click(screen.getAllByRole("button", { name: "Saisir Quarts 1" })[0]!);
    // Fenêtre flottante : jsdom ne calcule pas sa position, elle reste « cachée » pour les
    // requêtes par rôle ; on la prend par son attribut.
    const popover = () => document.querySelector<HTMLElement>('[aria-label="Saisie du match"]');
    const dialog = popover();
    if (!dialog) throw new Error("fenêtre de saisie absente");
    const validate = within(dialog).getByText("Valider").closest("button");
    if (!validate) throw new Error("bouton Valider absent");
    const cell = (set: number, who: string) =>
      within(dialog).getByLabelText(`Set ${set}, ${who}`) as HTMLInputElement;
    const enter = (set: number, a: string, b: string) => {
      fireEvent.change(cell(set, "Coupade Jules"), { target: { value: a } });
      fireEvent.change(cell(set, "Mikdad Ali Mohammed"), { target: { value: b } });
    };
    expect(validate).toBeDisabled();
    expect(within(dialog).getByText("Arbitres (facultatif)")).toBeInTheDocument();
    enter(1, "60", "52");
    // Match en cours : rien en erreur, mais pas encore validable
    expect(cell(1, "Coupade Jules")).toHaveClass("win");
    expect(cell(1, "Mikdad Ali Mohammed")).toHaveClass("lose");
    expect(cell(1, "Mikdad Ali Mohammed")).not.toHaveClass("err");
    expect(cell(2, "Coupade Jules").className).not.toMatch(/\b(win|lose|err)\b/);
    expect(validate).toBeDisabled();
    enter(2, "60", "12");
    enter(3, "60", "0");
    expect(within(dialog).getByText("Match complet")).toBeInTheDocument();
    // Aucun arbitre saisi : la validation reste possible
    expect(validate).toBeEnabled();
    fireEvent.click(validate);
    expect(popover()).toBeNull();
    expect(screen.getAllByRole("button", { name: "Saisir Quarts 1" })[0]).toHaveTextContent(
      "Modifier",
    );
  });
});

describe("dimanche : primes en volet repliable", () => {
  it("ouvert à la première consultation, replié ensuite, état mémorisé", () => {
    const first = renderView(<Dimanche />, sundayStart());
    const toggle = () =>
      within(screen.getByRole("region", { name: "Primes" })).getAllByRole("button")[0]!;
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Masters · 80 %")).toBeInTheDocument();
    first.unmount();
    // Déjà consulté : replié par défaut
    const second = renderView(<Dimanche />, sundayStart());
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Masters · 80 %")).not.toBeInTheDocument();
    // Rouvert à la main : il le reste
    fireEvent.click(toggle());
    expect(screen.getByText("Masters · 80 %")).toBeInTheDocument();
    second.unmount();
    renderView(<Dimanche />, sundayStart());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
  });
});

describe("dimanche : résumé de fin", () => {
  it("podiums avec 3e et 4e distincts, sans bloc de primes ni conditions annexes", () => {
    window.localStorage.setItem("pilot5q:panel:primes:test", "0");
    renderView(<Dimanche />, allRanked());
    expect(screen.getByRole("heading", { name: "Tournoi terminé" })).toBeInTheDocument();
    expect(rendered("1er Masters")).toHaveTextContent("Coupade Jules");
    expect(rendered("2e Masters")).toHaveTextContent("David Nicolas");
    expect(rendered("3e Masters")).toHaveTextContent("Guerin Xavier");
    expect(rendered("4e Masters")).toHaveTextContent("Duvernoy Christophe");
    expect(rendered("3e National")).toHaveTextContent("Hervelin Gabriel");
    expect(rendered("4e National")).toHaveTextContent("Wallart Jean Charles");
    expect(screen.queryByText("Demi-finaliste")).not.toBeInTheDocument();
    // Le tableau des primes n'est plus répété dans le résumé (volet replié en haut de page)
    expect(screen.queryByText("Masters · 80 %")).not.toBeInTheDocument();
    expect(screen.getByText(/Il reste à clôturer le tournoi/)).toBeInTheDocument();
  });

  it("clôture : un bouton, une confirmation, puis plus aucune saisie possible", async () => {
    renderView(<Dimanche />, allPlayed());
    // Finales jouées, tableaux pas encore classés : la clôture est déjà possible
    expect(
      screen.getAllByRole("button", { name: /^Saisir (Quarts|Demi-finales|Finale)/ }).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Clôturer le tournoi" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Clôturer le tournoi" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Tournoi clôturé" })).toBeInTheDocument();
    expect(screen.getByText(/Toute correction passe désormais par le responsable/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Revoir les tableaux" }));
    expect(screen.queryByRole("button", { name: /^Saisir / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rouvrir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mode test/ })).not.toBeInTheDocument();
  });
});

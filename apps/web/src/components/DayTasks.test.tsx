import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  allPlayed,
  allRanked,
  fewSmallTables,
  fridayDone,
  mastersRanked,
  renderView,
  sundayStart,
} from "@/test/weekend";

import { DayTasks } from "./DayTasks";

const bar = (day: string) => screen.getByRole("region", { name: `Tâches du ${day}` });
const task = (day: string, name: RegExp | string) => within(bar(day)).getByRole("button", { name });

describe("barre des tâches : passage au jour suivant", () => {
  it("vendredi : « Passer au samedi » actif dès les barrages classés, sans consolante", () => {
    renderView(<DayTasks day="vendredi" />, fridayDone());
    expect(task("vendredi", /Consolante créée/)).toHaveAttribute("data-status", "todo");
    expect(screen.getByRole("button", { name: /Passer au samedi/ })).toBeEnabled();
  });

  it("samedi : « Passer au dimanche » suit le déblocage du dimanche, pas les autres tâches", () => {
    const { unmount } = renderView(<DayTasks day="samedi" />, mastersRanked());
    // Masters classés mais huitièmes National pas joués : dimanche encore verrouillé
    const waiting = screen.getByRole("button", { name: /Passer au dimanche/ });
    expect(waiting).toBeDisabled();
    expect(waiting.parentElement?.parentElement).toHaveAttribute(
      "title",
      "Après les poules du samedi",
    );
    unmount();
    // Dimanche débloqué alors que la consolante n'est pas créée : le bouton est actif
    renderView(<DayTasks day="samedi" />, sundayStart(false));
    expect(task("samedi", /Consolante non créée/)).toHaveAttribute("data-status", "alert");
    expect(screen.getByText("1 à faire")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Passer au dimanche/ })).toBeEnabled();
  });
});

describe("barre des tâches : consolante du samedi", () => {
  it("non créée : tâche en alerte avec l'action « Créer »", () => {
    renderView(<DayTasks day="samedi" />, fridayDone());
    const chip = task("samedi", /Consolante non créée/);
    expect(chip).toHaveAttribute("data-status", "alert");
    expect(chip).toHaveClass("bg-alert-soft", "text-alert-ink");
    expect(within(chip).getByText("Créer")).toBeInTheDocument();
    // Elle ne compte pas comme faite : 0 tâche faite sur 4
    expect(within(bar("samedi")).getByText("4 à faire")).toBeInTheDocument();
  });

  it("sans objet (moins de 5 billards 2m80) : neutre, hors du compteur", () => {
    renderView(<DayTasks day="samedi" />, fewSmallTables(fridayDone()));
    const chip = task("samedi", /Consolante sans objet/);
    expect(chip).toHaveAttribute("data-status", "na");
    expect(chip).not.toHaveClass("bg-alert-soft");
    expect(within(bar("samedi")).getByText("3 à faire")).toBeInTheDocument();
  });
});

describe("barre des tâches : clôture du tournoi", () => {
  it("le bouton est inactif tant que les finales ne sont pas jouées", () => {
    renderView(<DayTasks day="dimanche" />, sundayStart());
    const close = screen.getByRole("button", { name: "Clôturer le tournoi" });
    expect(close).toBeDisabled();
    expect(close.parentElement?.parentElement).toHaveAttribute(
      "title",
      "Reste à jouer : le tableau Masters, le tableau National",
    );
    expect(within(bar("dimanche")).queryByText(/Arbitres/)).not.toBeInTheDocument();
  });

  it("tout est joué : un seul bouton, une confirmation, puis « Tournoi clôturé »", async () => {
    const gone = () =>
      waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    renderView(<DayTasks day="dimanche" />, allPlayed());
    fireEvent.click(screen.getByRole("button", { name: "Clôturer le tournoi" }));
    const dialog = screen.getByRole("alertdialog", { name: "Clôturer le tournoi ?" });
    expect(dialog).toHaveTextContent("Masters : Coupade Jules");
    expect(dialog).toHaveTextContent("seul le responsable national peut rouvrir");
    // Annuler : rien ne change
    fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));
    await gone();
    expect(screen.getByRole("button", { name: "Clôturer le tournoi" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Clôturer le tournoi" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Clôturer le tournoi" }),
    );
    await gone();
    expect(screen.getByText("Tournoi clôturé")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clôturer le tournoi" })).not.toBeInTheDocument();
    expect(screen.getByText("Tout est fait")).toBeInTheDocument();
  });

  it("consolante jamais créée : sans objet, elle ne bloque pas la clôture", () => {
    renderView(<DayTasks day="dimanche" />, allPlayed(false));
    expect(screen.getByRole("button", { name: "Clôturer le tournoi" })).toBeEnabled();
  });

  it("tableaux déjà classés : la clôture reste le dernier geste", () => {
    renderView(<DayTasks day="dimanche" />, allRanked());
    expect(task("dimanche", "Clôture")).toHaveAttribute("data-status", "todo");
    expect(screen.getByRole("button", { name: "Clôturer le tournoi" })).toBeEnabled();
  });
});

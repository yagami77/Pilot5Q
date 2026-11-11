import type { Distance, Match } from "@pilot5q/domain";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { isValidScore } from "@/lib/engine";

import {
  ScoreEditor,
  draftMatch,
  draftOf,
  scoreOf,
  scoreState,
  setState,
  setsProgress,
  type ScoreDraft,
} from "./ScoreEditor";

/** Phases finales du dimanche : 3 sets gagnants à 60 (SPEC §8). */
const FINAL: Distance = { pointsParSet: 60, setsGagnants: 3 };
const match: Match = { id: "M-QF1", a: "COUPADE JULES", b: "MIKDAD HAKIM", sa: null, sb: null };
const draft = (a: (number | null)[], b: (number | null)[]): ScoreDraft => ({
  sa: null,
  sb: null,
  setsA: [...a, ...Array.from({ length: 5 - a.length }, () => null)],
  setsB: [...b, ...Array.from({ length: 5 - b.length }, () => null)],
});

describe("état d'un set", () => {
  it("un set valide a exactement un joueur à la distance et l'autre en dessous", () => {
    expect(setState(60, 52, 60)).toBe("a");
    expect(setState(0, 60, 60)).toBe("b");
    expect(setState(60, 60, 60)).toBe("invalid");
    expect(setState(61, 10, 60)).toBe("invalid");
    expect(setState(-1, 60, 60)).toBe("invalid");
    expect(setState(59.5, 60, 60)).toBe("invalid");
  });

  it("un set pas encore saisi ou en cours n'est pas une erreur", () => {
    expect(setState(null, null, 60)).toBe("empty");
    expect(setState(60, null, 60)).toBe("partial");
    expect(setState(null, 12, 60)).toBe("partial");
    expect(setState(45, 52, 60)).toBe("open");
  });
});

describe("avancement d'un match en plusieurs sets", () => {
  it("set 1 saisi 60–52 : match en cours, set 2 ouvert, sets 3 à 5 fermés", () => {
    const p = setsProgress(draft([60], [52]), FINAL);
    expect(p).toMatchObject({ played: 1, wa: 1, wb: 0, decided: false, open: 2 });
    expect(p.states).toEqual(["a", "empty", "empty", "empty", "empty"]);
    const s = scoreOf(draft([60], [52]), FINAL);
    expect(s).toEqual({ sa: 1, sb: 0, setsA: [60], setsB: [52] });
    // Enregistré tel quel, le match est « en cours » : ni valide ni incohérent
    const stored = draftMatch(match, draft([60], [52]), FINAL);
    expect(isValidScore(stored, FINAL)).toBe(false);
    expect(scoreState(stored, FINAL)).toBe("partial");
  });

  it("le match s'arrête au troisième set gagné", () => {
    const p = setsProgress(draft([60, 12, 60, 60], [52, 60, 0, 59]), FINAL);
    expect(p).toMatchObject({ played: 4, wa: 3, wb: 1, decided: true, open: 4 });
    const stored = draftMatch(match, draft([60, 12, 60, 60], [52, 60, 0, 59]), FINAL);
    expect(stored).toMatchObject({ sa: 3, sb: 1, setsA: [60, 12, 60, 60], setsB: [52, 60, 0, 59] });
    expect(isValidScore(stored, FINAL)).toBe(true);
    expect(scoreState(stored, FINAL)).toBe("valid");
  });

  it("un set en erreur ou incomplet n'est pas enregistré, ni les suivants", () => {
    expect(scoreOf(draft([60, 60, 60], [52, 60, 10]), FINAL)).toEqual({
      sa: 1,
      sb: 0,
      setsA: [60],
      setsB: [52],
    });
    expect(scoreOf(draft([60, 45], [52, null]), FINAL).setsA).toEqual([60]);
    expect(scoreOf(draft([45], [52]), FINAL)).toEqual({ sa: null, sb: null });
    expect(scoreOf(draft([], []), FINAL)).toEqual({ sa: null, sb: null });
  });

  it("état d'un score enregistré : vide, en cours, valide ou incohérent", () => {
    expect(scoreState(match, FINAL)).toBe("empty");
    expect(scoreState({ ...match, sa: 1, sb: 1, setsA: [60, 60], setsB: [60, 0] }, FINAL)).toBe(
      "invalid",
    );
    const one: Distance = { pointsParSet: 100, setsGagnants: 1 };
    expect(scoreState({ ...match, sa: 100, sb: null }, one)).toBe("partial");
    expect(scoreState({ ...match, sa: 100, sb: 100 }, one)).toBe("invalid");
    expect(scoreState({ ...match, sa: 100, sb: 64 }, one)).toBe("valid");
  });
});

function Harness({
  initial = draftOf(match, FINAL),
  onCommit = () => undefined,
}: {
  initial?: ScoreDraft;
  onCommit?: (d: ScoreDraft) => void;
}) {
  const [d, setD] = useState(initial);
  return (
    <div data-score-root>
      <ScoreEditor
        match={match}
        distance={FINAL}
        draft={d}
        onDraft={setD}
        onCommit={onCommit}
        layout="inline"
        idBase="t"
        size="sm"
      />
      <button type="button" data-score-submit>
        Valider
      </button>
    </div>
  );
}

const cell = (set: number, who: "a" | "b") =>
  screen.getByLabelText(
    `Set ${set}, ${who === "a" ? "Coupade Jules" : "Mikdad Hakim"}`,
  ) as HTMLInputElement;
const type = (set: number, who: "a" | "b", value: string) => {
  fireEvent.focus(cell(set, who));
  fireEvent.change(cell(set, who), { target: { value } });
};

describe("saisie d'un match en 3 sets gagnants à 60", () => {
  it("set 1 saisi 60–52 : vainqueur vert, perdant rouge, aucune erreur, suite neutre", () => {
    render(<Harness />);
    type(1, "a", "60");
    type(1, "b", "52");
    expect(cell(1, "a")).toHaveClass("win");
    expect(cell(1, "b")).toHaveClass("lose");
    for (const who of ["a", "b"] as const) {
      expect(cell(1, who)).not.toHaveClass("err");
      expect(cell(1, who)).not.toHaveAttribute("aria-invalid");
      // Set 2 : pas encore saisi, neutre et saisissable
      expect(cell(2, who)).toBeEnabled();
      expect(cell(2, who).className).not.toMatch(/\b(win|lose|err)\b/);
      // Sets 3 à 5 : pas encore atteints
      for (const set of [3, 4, 5]) expect(cell(set, who)).toBeDisabled();
    }
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Sets gagnés par Coupade Jules")).toHaveTextContent("1");
    expect(screen.getByLabelText("Sets gagnés par Mikdad Hakim")).toHaveTextContent("0");
  });

  it("les cases se suivent dans l'ordre de saisie (Tab) : set 1 A, set 1 B, set 2 A…", () => {
    render(<Harness initial={draft([60, 12], [52, 60])} />);
    const order = [...document.querySelectorAll<HTMLInputElement>("input")].map((i) =>
      i.getAttribute("aria-label"),
    );
    expect(order.slice(0, 6)).toEqual([
      "Set 1, Coupade Jules",
      "Set 1, Mikdad Hakim",
      "Set 2, Coupade Jules",
      "Set 2, Mikdad Hakim",
      "Set 3, Coupade Jules",
      "Set 3, Mikdad Hakim",
    ]);
  });

  it("Entrée et Espace enchaînent les cases, puis mènent à « Valider »", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    type(1, "a", "60");
    fireEvent.keyDown(cell(1, "a"), { key: "Enter" });
    expect(cell(1, "b")).toHaveFocus();
    type(1, "b", "52");
    fireEvent.keyDown(cell(1, "b"), { key: "Enter" });
    expect(cell(2, "a")).toHaveFocus();
    // Espace : la distance pour ce joueur, puis l'autre joueur du même set
    fireEvent.keyDown(cell(2, "a"), { key: " " });
    expect(cell(2, "a")).toHaveValue(60);
    expect(cell(2, "b")).toHaveFocus();
    type(2, "b", "3");
    fireEvent.keyDown(cell(2, "b"), { key: "Enter" });
    expect(cell(3, "a")).toHaveFocus();
    type(3, "a", "10");
    fireEvent.keyDown(cell(3, "a"), { key: "Enter" });
    fireEvent.keyDown(cell(3, "b"), { key: " " });
    // 2–1 : le match continue au set 4
    expect(cell(4, "a")).toHaveFocus();
    fireEvent.keyDown(cell(4, "a"), { key: " " });
    type(4, "b", "59");
    fireEvent.keyDown(cell(4, "b"), { key: "Enter" });
    // 3–1 : match terminé, plus de case à saisir
    expect(screen.getByRole("button", { name: "Valider" })).toHaveFocus();
    expect(cell(5, "a")).toBeDisabled();
    expect(scoreOf(onCommit.mock.lastCall?.[0] as ScoreDraft, FINAL)).toMatchObject({
      sa: 3,
      sb: 1,
    });
  });

  it("les sets au-delà de la fin du match sont désactivés et vidés", () => {
    render(<Harness initial={draft([60, 12, 60, 60], [52, 60, 0, 59])} />);
    expect(cell(4, "a")).toBeEnabled();
    expect(cell(5, "a")).toBeDisabled();
    // Correction du set 2 : le match se termine désormais 3–0, le set 4 n'existe plus
    type(2, "a", "60");
    type(2, "b", "12");
    for (const who of ["a", "b"] as const) {
      expect(cell(4, who)).toBeDisabled();
      expect(cell(4, who)).toHaveValue(null);
    }
    expect(screen.getByLabelText("Sets gagnés par Coupade Jules")).toHaveTextContent("3");
    expect(screen.getByLabelText("Sets gagnés par Coupade Jules")).toHaveClass("text-ok-ink");
    expect(screen.getByLabelText("Sets gagnés par Mikdad Hakim")).toHaveClass("text-alert-ink");
  });

  it("deux joueurs à 60 : erreur signalée (bordure et message), distincte d'une défaite", () => {
    render(<Harness initial={draft([60], [52])} />);
    type(2, "a", "60");
    type(2, "b", "60");
    for (const who of ["a", "b"] as const) {
      expect(cell(2, who)).toHaveClass("err");
      expect(cell(2, who)).toHaveAttribute("aria-invalid", "true");
      expect(cell(2, who)).not.toHaveClass("lose");
      // Le set 1 garde ses couleurs de résultat ; le set 3 attend la correction
      expect(cell(1, who)).not.toHaveClass("err");
      expect(cell(3, who)).toBeDisabled();
    }
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Set 2 : un seul joueur à 60, l'autre entre 0 et 59.",
    );
  });

  it("un set sans vainqueur n'est signalé qu'une fois quitté", () => {
    render(<Harness />);
    type(1, "a", "45");
    type(1, "b", "52");
    // Pendant la saisie du set (« 6 » avant « 60 ») : pas d'alerte
    expect(cell(1, "b")).not.toHaveClass("err");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.blur(cell(1, "b"));
    expect(cell(1, "a")).toHaveClass("err");
    expect(screen.getByRole("alert")).toHaveTextContent("Set 1 : un joueur doit être à 60.");
  });
});

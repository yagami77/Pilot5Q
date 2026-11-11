import type { Player, TournamentEvent } from "@pilot5q/domain";
import { pouleMatches } from "@pilot5q/domain";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { demoEvents } from "@/lib/demo";
import { replay } from "@/lib/engine";

import { PoulesBoard, billardBandColumns, billardPlan, boardColumns } from "./boards";
import { DOCS, docById } from "./docs";

const at = "2026-10-29T18:00:00.000Z";

/**
 * État tiré avec `count` poules de 4 ; `linked` : groupes de poules sur deux billards liés
 * (« 3 poules sur 2 billards »).
 */
function drawnState(count = 17, linked: Record<number, number[]> = {}) {
  const base = demoEvents().map((e) => ({ ...e, at }) as TournamentEvent);
  const s0 = replay(base);
  const extra: Player[] = Array.from({
    length: Math.max(0, 8 + count * 4 - s0.players.length),
  }).map((_, i) => ({
    ...s0.players[0]!,
    licence: `T${i}`,
    name: `JOUEUR SUPPLEMENTAIRE ${i + 1}`,
  }));
  const players = [...s0.players, ...extra];
  const field = players.slice(8).map((p) => p.name);
  const poules = Array.from({ length: count }, (_, i) => {
    const names = field.slice(i * 4, i * 4 + 4);
    return {
      num: i + 1,
      players: names,
      billards: linked[i + 1] ?? [(i % 11) + 1],
      matches: pouleMatches(i + 1, names),
    };
  });
  const assignments: Record<string, number[]> = {};
  for (const p of poules) assignments[String(p.num)] = p.billards;
  return replay([
    ...base.map((e) => (e.type === "players.imported" ? { ...e, payload: { players } } : e)),
    { type: "billards.assigned", at, payload: { phase: "PREQ", assignments } },
    { type: "poules.drawn", at, payload: { phase: "PREQ", poules } },
  ]);
}

function board(state: ReturnType<typeof drawnState>) {
  return render(
    <PoulesBoard state={state} phase="PREQ" title="Poules du vendredi" day="vendredi" />,
  );
}

describe("tableau des poules (affichage)", () => {
  it("choisit le nombre de colonnes selon le nombre de poules", () => {
    expect(boardColumns(4)).toBe(2);
    expect(boardColumns(8)).toBe(2);
    expect(boardColumns(17)).toBe(3);
    expect(boardColumns(24)).toBe(4);
  });

  it("tient sur une seule page avec ses 17 poules et la bande des billards", () => {
    const state = drawnState();
    const doc = docById("tableau-poules")!;
    expect(doc.pages(state)).toBe(1);
    const { container } = board(state);
    expect(container.querySelectorAll(".board-card")).toHaveLength(17);
    expect(container.querySelectorAll(".board-player")).toHaveLength(68);
    expect(container.querySelectorAll(".print-page")).toHaveLength(1);
    expect(screen.getByText("Poules du vendredi")).toBeInTheDocument();
  });

  it("indique pour chaque billard la poule qui commence (numéro le plus élevé)", () => {
    const state = drawnState();
    const plan = billardPlan(state, "PREQ");
    expect(plan).toHaveLength(11);
    // Billard 1 : poules 1 et 12 → la 12 commence
    expect(plan[0]).toEqual({ num: 1, type: "3m10", poules: [12, 1] });
    expect(plan[10]?.poules).toEqual([11]);
  });

  it("3 poules sur 2 billards : pastille courte « B 5·6 », format en exposant", () => {
    const state = drawnState(17, { 1: [5, 6], 2: [5, 6], 3: [5, 6], 10: [10, 11] });
    const { container } = board(state);
    const pills = [...container.querySelectorAll(".board-pill")];
    expect(pills).toHaveLength(17);
    const first = pills[0]!;
    expect(first.querySelector(".board-pill-label")?.textContent).toBe("B");
    expect(first.querySelector("b")?.textContent).toBe("5·6");
    expect(first.querySelector(".board-pill-type")?.textContent).toBe("2m80");
    expect(first).toHaveAttribute("aria-label", "Billards 5 et 6, 2m80");
    // Deux billards à deux chiffres sur une poule à deux chiffres
    expect(pills[9]?.querySelector("b")?.textContent).toBe("10·11");
    // Un seul billard 3m10 : pastille pleine
    expect(pills[3]).toHaveClass("board-pill-full");
    expect(pills[3]).toHaveAttribute("aria-label", "Billard 4, 3m10");
    // Plus aucun libellé long qui débordait de la carte
    expect(container.textContent).not.toMatch(/Billards \d+ & \d+/);
  });

  it("23 poules : quatre colonnes, pastille courte, quatre lignes par carte", () => {
    const state = drawnState(23, { 21: [10, 11], 22: [10, 11], 23: [10, 11] });
    const { container } = board(state);
    const grid = container.querySelector(".board-grid")!;
    expect(grid).toHaveClass("board-grid-sm");
    expect((grid as HTMLElement).style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
    const cards = [...container.querySelectorAll(".board-card")];
    expect(cards).toHaveLength(23);
    for (const card of cards) {
      expect(card.querySelectorAll(".board-player")).toHaveLength(4);
      // Le nom est dans son propre élément, tronqué par la feuille de style (jamais replié)
      expect(card.querySelectorAll(".board-name")).toHaveLength(4);
      expect(card.querySelector(".board-pill-label")?.textContent).toBe("B");
    }
    expect(cards[22]?.querySelector(".board-pill b")?.textContent).toBe("10·11");
  });

  it("8 poules ou moins : grandes cartes, libellé « Billard(s) » en toutes lettres", () => {
    const state = drawnState(8, { 1: [5, 6] });
    const { container } = board(state);
    expect(container.querySelector(".board-grid")).toHaveClass("board-grid-md");
    const labels = [...container.querySelectorAll(".board-pill-label")].map((l) => l.textContent);
    expect(labels[0]).toBe("Billards");
    expect(labels[1]).toBe("Billard");
  });

  it("range la bande des billards sur deux rangées au plus jusqu'à 12 billards", () => {
    expect(billardBandColumns(3)).toBe(3);
    expect(billardBandColumns(8)).toBe(4);
    expect(billardBandColumns(11)).toBe(6);
    expect(billardBandColumns(12)).toBe(6);
  });

  it("n'a plus de variante A3 (aucun club n'a d'imprimante A3)", () => {
    expect(docById("tableau-poules-a3")).toBeUndefined();
    expect(DOCS.some((d) => /A3/.test(d.label))).toBe(false);
  });
});

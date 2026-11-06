import type { TournamentEvent } from "@pilot5q/domain";
import { pouleMatches } from "@pilot5q/domain";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { demoEvents } from "@/lib/demo";
import { replay } from "@/lib/engine";

import { PoulesBoard, billardPlan, boardColumns } from "./boards";
import { docById } from "./docs";

function drawnState() {
  const at = "2026-10-29T18:00:00.000Z";
  const base = demoEvents().map((e) => ({ ...e, at }) as TournamentEvent);
  const s0 = replay(base);
  const field = s0.players.slice(8).map((p) => p.name);
  const poules = Array.from({ length: 17 }, (_, i) => {
    const players = field.slice(i * 4, i * 4 + 4);
    return { num: i + 1, players, billards: [(i % 11) + 1], matches: pouleMatches(i + 1, players) };
  });
  const assignments: Record<string, number[]> = {};
  for (const p of poules) assignments[String(p.num)] = p.billards;
  return replay([
    ...base,
    { type: "billards.assigned", at, payload: { phase: "PREQ", assignments } },
    { type: "poules.drawn", at, payload: { phase: "PREQ", poules } },
  ]);
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
    const { container } = render(
      <PoulesBoard state={state} phase="PREQ" title="Poules du vendredi" day="vendredi" />,
    );
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

  it("propose la même page à l'échelle A3", () => {
    const state = drawnState();
    const doc = docById("tableau-poules-a3")!;
    expect(doc.available(state)).toBe(true);
    const { container } = render(<>{doc.render(state)}</>);
    expect(container.querySelector(".print-a3 .print-page")).not.toBeNull();
  });
});

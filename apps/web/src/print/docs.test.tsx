import type { BracketMatch, TournamentEvent } from "@pilot5q/domain";
import { pouleMatches } from "@pilot5q/domain";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { demoEvents } from "@/lib/demo";
import { replay } from "@/lib/engine";

import { ROWS, docById, docsFor } from "./docs";

describe("documents imprimés", () => {
  it("le tableau de la consolante imprime aussi le premier tour (seizièmes, barrages)", () => {
    const at = "2026-10-31T08:00:00.000Z";
    const base = replay(demoEvents().map((e) => ({ ...e, at }) as TournamentEvent));
    const names = base.players.map((p) => p.name);
    const m = (round: BracketMatch["round"], slot: number, a: string, b: string): BracketMatch => ({
      id: `CLS-${round}-${slot}`,
      round,
      slot,
      a,
      b,
      sa: null,
      sb: null,
    });
    const state = {
      ...base,
      brackets: {
        ...base.brackets,
        CLS: [
          m("R64", 1, names[60]!, names[61]!),
          m("R32", 1, names[40]!, names[41]!),
          m("R32", 2, names[42]!, names[43]!),
          { ...m("R16", 1, "", ""), labelA: "Vainqueur R32-1", labelB: "Vainqueur R32-2" },
        ],
      },
    };
    const doc = docById("tableau-consolante")!;
    expect(doc.available(state)).toBe(true);
    render(<>{doc.render(state)}</>);
    expect(screen.getByText(/Trente-deuxièmes/)).toBeInTheDocument();
    expect(screen.getByText(/Seizièmes/)).toBeInTheDocument();
    expect(screen.getByText(/Huitièmes/)).toBeInTheDocument();
    expect(screen.getByText("Vainqueur S1")).toBeInTheDocument();
  });

  it("pagine le pointage par lignes de 7,6 mm (cases à cocher) avec le numéro de page", () => {
    const at = "2026-10-29T08:00:00.000Z";
    const state = replay(demoEvents().map((e) => ({ ...e, at }) as TournamentEvent));
    const doc = docById("pointage")!;
    expect(doc.pages(state)).toBe(Math.ceil(state.players.length / ROWS.pointage));
    const { container } = render(<>{doc.render(state)}</>);
    expect(container.querySelectorAll(".print-page")).toHaveLength(doc.pages(state));
    expect(container.querySelectorAll(".p-box")).toHaveLength(state.players.length);
    expect(container.querySelectorAll("tr.hl")).toHaveLength(state.masters.length);
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("propose le tableau des poules en A4 le jeudi, sans variante A3", () => {
    const at = "2026-10-29T08:00:00.000Z";
    const base = replay(demoEvents().map((e) => ({ ...e, at }) as TournamentEvent));
    expect(docsFor("jeudi", base).map((d) => d.id)).toEqual(["pointage", "schema"]);
    const names = base.players.slice(8, 12).map((p) => p.name);
    const state = replay([
      ...demoEvents().map((e) => ({ ...e, at }) as TournamentEvent),
      {
        type: "poules.drawn",
        at,
        payload: {
          phase: "PREQ",
          poules: [{ num: 1, players: names, billards: [1], matches: [] }],
        },
      },
    ]);
    expect(docsFor("jeudi", state).map((d) => d.id)).toEqual([
      "pointage",
      "joueurs-poules",
      "tableau-poules",
      "premiers-matchs",
      "feuilles-preq",
      "schema",
    ]);
  });

  it("feuilles de match : plus de QR code ni de mention « poule en ligne »", () => {
    const at = "2026-10-29T08:00:00.000Z";
    const base = demoEvents().map((e) => ({ ...e, at }) as TournamentEvent);
    const names = replay(base)
      .players.slice(8, 16)
      .map((p) => p.name);
    const state = replay([
      ...base,
      {
        type: "poules.drawn",
        at,
        payload: {
          phase: "PREQ",
          poules: [
            { num: 1, players: names.slice(0, 4), billards: [1], matches: [] },
            { num: 2, players: names.slice(4, 8), billards: [1], matches: [] },
          ].map((p) => ({ ...p, matches: pouleMatches(p.num, p.players) })),
        },
      },
    ]);
    const { container } = render(<>{docById("feuilles-preq")!.render(state)}</>);
    expect(container.querySelectorAll(".sheet-half")).toHaveLength(2);
    expect(container.querySelectorAll(".sheet-block")).toHaveLength(12);
    expect(container.textContent).not.toMatch(/en ligne/i);
    expect(container.querySelector("[class*='qr']")).toBeNull();
    // Aucun dessin de QR code (les seuls SVG sont la marque, les ciseaux et les coches)
    expect(container.querySelector("svg[shape-rendering='crispEdges']")).toBeNull();
    // Pied de feuille : rappel des règles et marque
    for (const foot of container.querySelectorAll(".sheet-foot")) {
      expect(foot.querySelector(".sheet-rule")?.textContent).toMatch(/Match valide/);
      expect(foot.textContent).toMatch(/Pilot5Q/);
    }
  });
});

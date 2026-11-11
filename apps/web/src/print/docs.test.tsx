import type { BracketMatch, TournamentEvent } from "@pilot5q/domain";
import { consolanteBracket, pouleMatches } from "@pilot5q/domain";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { demoEvents } from "@/lib/demo";
import { replay } from "@/lib/engine";
import { nice } from "@/lib/format";

import { ROWS, docById, docsFor } from "./docs";

describe("documents imprimés", () => {
  it("le tableau de la consolante imprime tous les tours présents, premier tour compris", () => {
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

describe("tours de jeu de la consolante (document)", () => {
  const at = "2026-10-31T08:00:00.000Z";
  const base = () => replay(demoEvents().map((e) => ({ ...e, at }) as TournamentEvent));

  function withConsolante(count: number) {
    const s = base();
    const names = s.players.slice(8, 8 + count).map((p) => p.name);
    return {
      state: { ...s, brackets: { ...s.brackets, CLS: consolanteBracket(names, 40) } },
      names,
    };
  }

  it("n'est proposé qu'une fois la consolante créée, le vendredi soir et le samedi", () => {
    const s = base();
    const doc = docById("tours-consolante")!;
    expect(doc.available(s)).toBe(false);
    const closed = { ...s, closed: { PREQ: true, B: true } };
    expect(docsFor("vendredi", closed).map((d) => d.id)).not.toContain("tours-consolante");
    const { state } = withConsolante(19);
    expect(doc.available(state)).toBe(true);
    const friday = docsFor("vendredi", { ...state, closed: { PREQ: true, B: true } });
    expect(friday.map((d) => d.id)).toEqual(
      expect.arrayContaining(["pointage-consolante", "tableau-consolante", "tours-consolante"]),
    );
    expect(docsFor("samedi", state).map((d) => d.id)).toContain("tours-consolante");
    // Pas le jeudi ni le dimanche
    expect(docsFor("jeudi", state).map((d) => d.id)).not.toContain("tours-consolante");
    expect(docsFor("dimanche", state).map((d) => d.id)).not.toContain("tours-consolante");
  });

  it("19 joueurs : barrages, huitièmes, quarts, demies, finale sur une page", () => {
    const { state, names } = withConsolante(19);
    const doc = docById("tours-consolante")!;
    expect(doc.pages(state)).toBe(1);
    const { container } = render(<>{doc.render(state)}</>);
    expect(container.querySelectorAll(".print-page")).toHaveLength(1);
    expect(screen.getByText("Tours de jeu · Consolante")).toBeInTheDocument();
    const groups = [...container.querySelectorAll("tr.group th")].map((th) => th.textContent);
    expect(groups).toHaveLength(5);
    expect(groups[0]).toMatch(/^Barrages.*3 matchs$/);
    expect(groups[1]).toMatch(/^Huitièmes.*8 matchs$/);
    expect(groups[4]).toMatch(/^Finale.*1 match$/);
    // 3 + 8 + 4 + 2 + 1 matchs, une case « Joué » par match
    expect(container.querySelectorAll("tbody tr:not(.group)")).toHaveLength(18);
    expect(container.querySelectorAll(".p-box")).toHaveLength(18);
    // Tête de série 1 connue, son adversaire désigné par le barrage qui le qualifie
    expect(screen.getByText(nice(names[0]!))).toBeInTheDocument();
    expect(screen.getByText("Vainqueur B1")).toBeInTheDocument();
    expect(screen.getByText("Vainqueur H1")).toBeInTheDocument();
    // Codes des matchs : B1 à B3, H1 à H8, Q1 à Q4, D1, D2, F
    const codes = [...container.querySelectorAll("tbody tr:not(.group) td:nth-child(5)")].map(
      (td) => td.textContent,
    );
    expect(codes.slice(0, 4)).toEqual(["B1", "B2", "B3", "H1"]);
    expect(codes.slice(-3)).toEqual(["D1", "D2", "F"]);
    // Aucun billard proposé : colonne « Billard » vide, à remplir à la main ; plus de « Passage »
    const head = [...container.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(head).toEqual([
      "Heure",
      "#",
      "Joué",
      "Billard",
      "Match",
      "Joueur 1",
      "Joueur 2",
      "Score",
    ]);
    const billards = [...container.querySelectorAll("tbody tr:not(.group) td:nth-child(4)")];
    expect(billards.every((td) => td.textContent === "")).toBe(true);
    expect(container.textContent).not.toMatch(/passage|indicatif|billards? \d/i);
    expect(screen.getByText("Vainqueur D2")).toBeInTheDocument();
  });

  it("tableau imprimé de 19 joueurs : mêmes codes qu'à l'écran, sans billard", () => {
    const { state } = withConsolante(19);
    // Même si un billard a été tiré pour un match, il n'est pas imprimé pour la consolante
    const CLS = state.brackets.CLS.map((m) => (m.id === "CLS-R16-2" ? { ...m, billard: 7 } : m));
    const doc = docById("tableau-consolante")!;
    const { container } = render(
      <>{doc.render({ ...state, brackets: { ...state.brackets, CLS } })}</>,
    );
    const groups = [...container.querySelectorAll("tr.group th")].map((th) => th.textContent);
    expect(groups.map((g) => g?.replace(/1 set.*/, ""))).toEqual([
      "Barrages",
      "Huitièmes",
      "Quarts",
      "Demi-finales",
      "Finale",
    ]);
    const rows = [...container.querySelectorAll("tbody tr:not(.group)")];
    expect(rows.map((r) => r.querySelector("td")?.textContent)).toEqual([
      "B1",
      "B2",
      "B3",
      ...Array.from({ length: 8 }, (_, i) => `H${i + 1}`),
      "Q1",
      "Q2",
      "Q3",
      "Q4",
      "D1",
      "D2",
      "F",
    ]);
    expect(rows.every((r) => r.querySelectorAll("td")[1]?.textContent === "")).toBe(true);
    expect(screen.getByText("Vainqueur B1")).toBeInTheDocument();
    expect(screen.getByText("Vainqueur B3")).toBeInTheDocument();
    expect(screen.queryByText(/Vainqueur S\d/)).not.toBeInTheDocument();
  });

  it("40 joueurs : deux pages numérotées, aucun tour coupé", () => {
    const s = base();
    const names = Array.from({ length: 40 }, (_, i) => `JOUEUR ${i + 1}`);
    const state = { ...s, brackets: { ...s.brackets, CLS: consolanteBracket(names, 40) } };
    const doc = docById("tours-consolante")!;
    expect(doc.pages(state)).toBe(2);
    const { container } = render(<>{doc.render(state)}</>);
    const pages = [...container.querySelectorAll(".print-page")];
    expect(pages).toHaveLength(2);
    expect(container.querySelectorAll("tbody tr:not(.group)")).toHaveLength(39);
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });
});

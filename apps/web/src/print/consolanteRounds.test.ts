import type { TournamentEvent } from "@pilot5q/domain";
import { consolanteBracket } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import { demoEvents } from "@/lib/demo";
import { replay } from "@/lib/engine";

import { consolantePages, consolanteRounds } from "./consolanteRounds";

const at = "2026-10-31T08:00:00.000Z";

/** Tournoi d'exemple avec une consolante de `count` joueurs. */
function withConsolante(count: number) {
  const s = replay(demoEvents().map((e) => ({ ...e, at }) as TournamentEvent));
  const names = Array.from({ length: count }, (_, i) => `JOUEUR ${String(i + 1).padStart(2, "0")}`);
  const CLS = count >= 2 ? consolanteBracket(names, 40) : [];
  return { ...s, brackets: { ...s.brackets, CLS } };
}

describe("tours de jeu de la consolante", () => {
  it("19 joueurs : barrages B1 à B3, huitièmes, quarts, demies, finale, dans l'ordre du tableau", () => {
    const r = consolanteRounds(withConsolante(19));
    expect(r.tours.map((t) => t.label)).toEqual([
      "Barrages",
      "Huitièmes",
      "Quarts",
      "Demi-finales",
      "Finale",
    ]);
    expect(r.tours.map((t) => t.rows.length)).toEqual([3, 8, 4, 2, 1]);
    // Numérotation continue, dans l'ordre du tableau
    expect(r.tours.flatMap((t) => t.rows.map((x) => x.order))).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
    // Barrages : têtes de série 14–19, 15–18, 16–17 (règle de l'outil Excel)
    const [barrages, huitiemes, quarts, demies, finale] = r.tours;
    expect(barrages!.rows.map((x) => x.code)).toEqual(["B1", "B2", "B3"]);
    expect(barrages!.rows.map((x) => [x.a, x.b])).toEqual([
      ["JOUEUR 14", "JOUEUR 19"],
      ["JOUEUR 15", "JOUEUR 18"],
      ["JOUEUR 16", "JOUEUR 17"],
    ]);
    expect(huitiemes!.rows.map((x) => x.code)).toEqual([
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "H7",
      "H8",
    ]);
    // La tête de série 1 attend le vainqueur du premier barrage
    expect(huitiemes!.rows[0]).toMatchObject({
      a: "JOUEUR 01",
      aKnown: true,
      b: "Vainqueur B1",
      bKnown: false,
      played: false,
    });
    expect(huitiemes!.rows[1]).toMatchObject({ aKnown: true, bKnown: true });
    expect(huitiemes!.rows[4]).toMatchObject({ b: "Vainqueur B2" });
    expect(huitiemes!.rows[6]).toMatchObject({ b: "Vainqueur B3" });
    expect(quarts!.rows[0]).toMatchObject({ code: "Q1", a: "Vainqueur H1", b: "Vainqueur H2" });
    expect(demies!.rows.map((x) => x.code)).toEqual(["D1", "D2"]);
    expect(finale!.rows[0]).toMatchObject({ code: "F", a: "Vainqueur D1", b: "Vainqueur D2" });
  });

  it("ne propose aucun billard, même quand un match en porte un", () => {
    const s = withConsolante(8);
    const CLS = s.brackets.CLS.map((m) => (m.id === "CLS-QF2" ? { ...m, billard: 4 } : m));
    const r = consolanteRounds({ ...s, brackets: { ...s.brackets, CLS } });
    expect(r.tours[0]!.label).toBe("Quarts");
    expect(r.tours[0]!.rows.map((x) => x.code)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
    for (const row of r.tours.flatMap((t) => t.rows)) {
      expect(row).not.toHaveProperty("billard");
      expect(row).not.toHaveProperty("passage");
    }
  });

  it("marque les matchs joués et fait avancer les vainqueurs connus", () => {
    const s = withConsolante(4);
    const CLS = s.brackets.CLS.map((m) => (m.round === "SF" ? { ...m, sa: 100, sb: 60 } : m));
    const r = consolanteRounds({ ...s, brackets: { ...s.brackets, CLS } });
    expect(r.tours.map((t) => t.label)).toEqual(["Demi-finales", "Finale"]);
    expect(r.tours[0]!.rows.map((x) => x.played)).toEqual([true, true]);
    expect(r.tours[1]!.rows[0]!.played).toBe(false);
  });

  it("28 joueurs : vrais seizièmes avec exempts (codes S, pas des barrages)", () => {
    const r = consolanteRounds(withConsolante(28));
    expect(r.tours[0]!.label).toBe("Seizièmes");
    expect(r.tours[0]!.rows).toHaveLength(12);
    expect(r.tours[0]!.rows.every((x) => /^S\d+$/.test(x.code))).toBe(true);
  });

  it("pagine sans couper un tour : 40 joueurs sur deux pages, 19 sur une seule", () => {
    const big = consolanteRounds(withConsolante(40));
    expect(big.tours.map((t) => t.rows.length)).toEqual([8, 16, 8, 4, 2, 1]);
    // 8 barrages avant de vrais seizièmes
    expect(big.tours[0]!.label).toBe("Barrages");
    expect(big.tours[0]!.rows.map((x) => x.code)).toEqual(
      Array.from({ length: 8 }, (_, i) => `B${i + 1}`),
    );
    expect(big.tours[1]!.label).toBe("Seizièmes");
    expect(big.tours[1]!.rows.map((x) => x.code)).toEqual(
      Array.from({ length: 16 }, (_, i) => `S${i + 1}`),
    );
    const pages = consolantePages(big);
    expect(pages.map((p) => p.map((t) => t.round))).toEqual([
      ["R64", "R32"],
      ["R16", "QF", "SF", "F"],
    ]);
    expect(consolantePages(consolanteRounds(withConsolante(19)))).toHaveLength(1);
    expect(consolantePages(consolanteRounds(withConsolante(0)))).toEqual([]);
  });
});

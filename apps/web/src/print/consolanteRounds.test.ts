import type { TournamentEvent, TournamentState } from "@pilot5q/domain";
import { consolanteBracket } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import { demoEvents } from "@/lib/demo";
import { replay } from "@/lib/engine";

import {
  consolanteBillards,
  consolantePages,
  consolanteRounds,
  waitingLabel,
} from "./consolanteRounds";

const at = "2026-10-31T08:00:00.000Z";

/** Tournoi d'exemple (4 billards 3m10, 7 billards 2m80) avec une consolante de `count` joueurs. */
function withConsolante(count: number, patch?: (s: TournamentState) => TournamentState) {
  const s = replay(demoEvents().map((e) => ({ ...e, at }) as TournamentEvent));
  const names = Array.from({ length: count }, (_, i) => `JOUEUR ${String(i + 1).padStart(2, "0")}`);
  const CLS = count >= 2 ? consolanteBracket(names, 40) : [];
  const state = { ...s, brackets: { ...s.brackets, CLS } };
  return patch ? patch(state) : state;
}

/** Trois billards 2m80 pour la consolante, quel que soit le tirage du samedi. */
const threeTables = (s: TournamentState): TournamentState => ({
  ...s,
  billards: [
    { num: 1, type: "3m10" },
    { num: 2, type: "3m10" },
    { num: 3, type: "3m10" },
    { num: 4, type: "2m80" },
    { num: 5, type: "2m80" },
    { num: 6, type: "2m80" },
  ],
  billardAssignments: { ...s.billardAssignments, QN: {}, QM: {} },
});

describe("billards de la consolante", () => {
  it("prend les 2m80 laissés libres par les poules du samedi", () => {
    const s = withConsolante(19);
    const small = s.billards.filter((b) => b.type === "2m80").map((b) => b.num);
    const national = new Set(Object.values(s.billardAssignments.QN ?? {}).flat());
    expect(national.size).toBeGreaterThan(0);
    const tables = consolanteBillards(s);
    expect(tables).toEqual(small.filter((b) => !national.has(b)));
    expect(tables.length).toBeGreaterThan(0);
    expect(tables.every((b) => small.includes(b))).toBe(true);
  });

  it("à défaut de 2m80 libre, tous les 2m80 ; sans 2m80, tous les billards", () => {
    const s = withConsolante(19);
    const small = s.billards.filter((b) => b.type === "2m80").map((b) => b.num);
    const all: Record<string, number[]> = { "1": small };
    expect(
      consolanteBillards({ ...s, billardAssignments: { ...s.billardAssignments, QN: all } }),
    ).toEqual(small);
    const big = s.billards.map((b) => ({ ...b, type: "3m10" as const }));
    expect(consolanteBillards({ ...s, billards: big })).toEqual(big.map((b) => b.num));
  });
});

describe("tours de jeu de la consolante", () => {
  it("19 joueurs sur 3 billards : barrages, huitièmes en 3 passages, quarts, demies, finale", () => {
    const r = consolanteRounds(withConsolante(19, threeTables));
    expect(r.billards).toEqual([4, 5, 6]);
    expect(r.drawn).toBe(false);
    expect(r.tours.map((t) => t.label)).toEqual([
      "Seizièmes (barrages)",
      "Huitièmes",
      "Quarts",
      "Demi-finales",
      "Finale",
    ]);
    expect(r.tours.map((t) => t.rows.length)).toEqual([3, 8, 4, 2, 1]);
    expect(r.tours.map((t) => t.passages)).toEqual([1, 3, 2, 1, 1]);
    // Numérotation continue, dans l'ordre de lancement
    expect(r.tours.flatMap((t) => t.rows.map((x) => x.order))).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
    // Barrages : têtes de série 14–19, 15–18, 16–17 (règle de l'outil Excel), un par billard
    const [barrages, huitiemes, quarts, demies, finale] = r.tours;
    expect(barrages!.rows.map((x) => x.code)).toEqual(["S2", "S10", "S14"]);
    expect(barrages!.rows.map((x) => [x.a, x.b])).toEqual([
      ["JOUEUR 14", "JOUEUR 19"],
      ["JOUEUR 15", "JOUEUR 18"],
      ["JOUEUR 16", "JOUEUR 17"],
    ]);
    expect(barrages!.rows.map((x) => x.billard)).toEqual([4, 5, 6]);
    expect(barrages!.rows.every((x) => x.billardFirm && x.passage === 1)).toBe(true);
    // Huitièmes : H1 à H8 dans l'ordre, billards 4-5-6 puis de nouveau 4-5-6, puis 4-5
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
    expect(huitiemes!.rows.map((x) => x.billard)).toEqual([4, 5, 6, 4, 5, 6, 4, 5]);
    expect(huitiemes!.rows.map((x) => x.passage)).toEqual([1, 1, 1, 2, 2, 2, 3, 3]);
    // Au-delà du premier passage, le billard est indicatif (premier billard libéré)
    expect(huitiemes!.rows.map((x) => x.billardFirm)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
    // La tête de série 1 attend le vainqueur du premier barrage
    expect(huitiemes!.rows[0]).toMatchObject({
      a: "JOUEUR 01",
      aKnown: true,
      b: "Vainqueur S2",
      bKnown: false,
      played: false,
    });
    expect(huitiemes!.rows[1]).toMatchObject({ aKnown: true, bKnown: true });
    expect(quarts!.rows[0]).toMatchObject({ code: "Q1", a: "Vainqueur H1", b: "Vainqueur H2" });
    expect(quarts!.rows.map((x) => x.passage)).toEqual([1, 1, 1, 2]);
    expect(demies!.rows.map((x) => x.code)).toEqual(["D1", "D2"]);
    expect(finale!.rows[0]).toMatchObject({ code: "F", a: "Vainqueur D1", b: "Vainqueur D2" });
  });

  it("garde le billard tiré d'un match et répartit les autres autour", () => {
    const r = consolanteRounds(
      withConsolante(8, (s) => {
        const t = threeTables(s);
        return {
          ...t,
          brackets: {
            ...t.brackets,
            CLS: t.brackets.CLS.map((m) => (m.id === "CLS-QF2" ? { ...m, billard: 4 } : m)),
          },
        };
      }),
    );
    expect(r.drawn).toBe(true);
    const quarts = r.tours[0]!;
    expect(quarts.label).toBe("Quarts");
    const byCode = Object.fromEntries(quarts.rows.map((x) => [x.code, x]));
    // Le billard tiré est servi d'abord ; les autres matchs prennent les billards restants
    expect(byCode.Q2).toMatchObject({ billard: 4, billardFirm: true, passage: 1 });
    expect(byCode.Q1).toMatchObject({ billard: 5, billardFirm: true, passage: 1 });
    expect(byCode.Q3).toMatchObject({ billard: 6, billardFirm: true, passage: 1 });
    expect(byCode.Q4).toMatchObject({ billard: 4, billardFirm: false, passage: 2 });
    // Liste dans l'ordre de passage, puis du tableau
    expect(quarts.rows.map((x) => x.code)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
  });

  it("marque les matchs joués et fait avancer les vainqueurs connus", () => {
    const s = withConsolante(4, threeTables);
    const CLS = s.brackets.CLS.map((m) => (m.round === "SF" ? { ...m, sa: 100, sb: 60 } : m));
    const r = consolanteRounds({ ...s, brackets: { ...s.brackets, CLS } });
    expect(r.tours.map((t) => t.label)).toEqual(["Demi-finales", "Finale"]);
    expect(r.tours[0]!.rows.map((x) => x.played)).toEqual([true, true]);
    expect(r.tours[1]!.rows[0]!.played).toBe(false);
  });

  it("28 joueurs : seizièmes avec exempts (pas des barrages)", () => {
    const r = consolanteRounds(withConsolante(28, threeTables));
    expect(r.tours[0]).toMatchObject({ label: "Seizièmes", passages: 4 });
    expect(r.tours[0]!.rows).toHaveLength(12);
  });

  it("pagine sans couper un tour : 40 joueurs sur deux pages, 19 sur une seule", () => {
    const big = consolanteRounds(withConsolante(40, threeTables));
    expect(big.tours.map((t) => t.rows.length)).toEqual([8, 16, 8, 4, 2, 1]);
    expect(big.tours[0]!.label).toBe("Trente-deuxièmes (barrages)");
    const pages = consolantePages(big);
    expect(pages.map((p) => p.map((t) => t.round))).toEqual([
      ["R64", "R32"],
      ["R16", "QF", "SF", "F"],
    ]);
    expect(consolantePages(consolanteRounds(withConsolante(19, threeTables)))).toHaveLength(1);
    expect(consolantePages(consolanteRounds(withConsolante(0)))).toEqual([]);
  });

  it("rend lisibles les provenances du tableau", () => {
    expect(waitingLabel("Vainqueur R32-2")).toBe("Vainqueur S2");
    expect(waitingLabel("Vainqueur QF3")).toBe("Vainqueur Q3");
    expect(waitingLabel("Vainqueur SF1")).toBe("Vainqueur D1");
    expect(waitingLabel(undefined)).toBe("");
  });
});

import { describe, expect, it } from "vitest";

import { demoEvents } from "@/lib/demo";
import { replay } from "@/lib/engine";
import { pouleMatches } from "@/lib/engine";
import type { TournamentEvent } from "@pilot5q/domain";

import { chunk, groupByBillard, paginateHalves } from "./layout";
import { barrageSheets, finalSheets, pouleSheet, pouleSheetPages, singleHalves } from "./sheets";

const it2 = (item: string, billards: number[]) => ({ item, billards });

describe("mise en page des feuilles de match", () => {
  it("garde les deux poules d'un billard sur la même page", () => {
    const pages = paginateHalves([it2("P1", [2]), it2("P2", [1]), it2("P3", [1]), it2("P4", [2])]);
    expect(pages).toEqual([
      ["P2", "P3"],
      ["P1", "P4"],
    ]);
  });

  it("un groupe de 3 poules sur 2 billards liés occupe une page et demie", () => {
    const pages = paginateHalves([
      it2("P1", [5, 6]),
      it2("P2", [5, 6]),
      it2("P3", [6, 5]),
      it2("P4", [7]),
      it2("P5", [8]),
      it2("P6", [8]),
    ]);
    expect(groupByBillard([it2("a", [5, 6]), it2("b", [6, 5])])).toHaveLength(1);
    expect(pages).toEqual([
      ["P1", "P2"],
      ["P3", "P4"],
      ["P5", "P6"],
    ]);
  });
});

describe("pagination des listes", () => {
  it("découpe en pages de taille fixe, au moins une page", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 30)).toEqual([[]]);
  });
});

describe("feuille d'une poule", () => {
  it("pré-remplit 2 contre 3 et 1 contre 4, puis des lignes d'écriture libellées", () => {
    const at = "2026-10-30T10:00:00.000Z";
    const base = demoEvents().map((e) => ({ ...e, at }) as TournamentEvent);
    const s0 = replay(base);
    const names = s0.players.slice(8, 12).map((p) => p.name);
    const state = replay([
      ...base,
      {
        type: "poules.drawn",
        at,
        payload: {
          phase: "PREQ",
          poules: [{ num: 1, players: names, billards: [3], matches: pouleMatches(1, names) }],
        },
      },
    ]);
    const sheet = pouleSheet(state, "PREQ", state.poules.PREQ[0]!, "vendredi");
    expect(sheet.matches).toHaveLength(6);
    expect(sheet.matches[0]?.label).toBe("2 contre 3");
    expect([sheet.matches[0]?.a.num, sheet.matches[0]?.b.num]).toEqual([2, 3]);
    expect(sheet.matches[2]?.a).toEqual({ name: "", hint: "Perdant M1" });
    expect(sheet.matches[4]?.a.name).toBe(names[3]);
    expect(sheet.matches[4]?.b.hint).toBe("Son dernier adversaire");
    expect(sheet.cells[0]?.value).toBe("1");
    expect(sheet.cells[1]?.value).toBe(state.billardAssignments.PREQ?.["1"]?.join(" & "));
    // Plus de QR code sur les feuilles (non utilisé)
    expect(sheet).not.toHaveProperty("qr");
  });

  it("regroupe les feuilles de la phase par billard et indique qui commence", () => {
    const at = "2026-10-30T10:00:00.000Z";
    const base = demoEvents().map((e) => ({ ...e, at }) as TournamentEvent);
    const s0 = replay(base);
    const names = s0.players.slice(8, 20).map((p) => p.name);
    const poule = (num: number, players: string[], billards: number[]) => ({
      num,
      players,
      billards,
      matches: pouleMatches(num, players),
    });
    const state = replay([
      ...base,
      {
        type: "billards.assigned",
        at,
        payload: { phase: "PREQ", assignments: { "1": [2], "2": [2], "3": [5] } },
      },
      {
        type: "poules.drawn",
        at,
        payload: {
          phase: "PREQ",
          poules: [
            poule(1, names.slice(0, 4), [2]),
            poule(2, names.slice(4, 8), [2]),
            poule(3, names.slice(8, 12), [5]),
          ],
        },
      },
    ]);
    const pages = pouleSheetPages(state, "PREQ", "vendredi");
    expect(pages.map((p) => p.map((h) => h.key))).toEqual([["PREQ-1", "PREQ-2"], ["PREQ-3"]]);
    expect(pages[0]?.[0]?.turn).toBe("Joue après la poule 2");
    expect(pages[0]?.[1]?.turn).toBe("Commence");
    expect(pages[1]?.[0]?.turn).toBeUndefined();
  });
});

describe("matchs isolés : deux par demi-feuille", () => {
  it("groupe les barrages deux par deux avec leur billard dans le cartouche", () => {
    const at = "2026-10-30T18:00:00.000Z";
    const base = replay(demoEvents().map((e) => ({ ...e, at }) as TournamentEvent));
    const names = base.players.map((p) => p.name);
    const state = {
      ...base,
      barrages: Array.from({ length: 5 }, (_, i) => ({
        id: `B${i + 1}`,
        a: names[10 + i]!,
        b: names[30 + i]!,
        sa: null,
        sb: null,
        billard: i + 1,
      })),
    };
    const halves = singleHalves(state, barrageSheets(state));
    expect(halves).toHaveLength(3);
    expect(halves[0]?.matches.map((m) => m.title)).toEqual(["Barrage 1", "Barrage 2"]);
    expect(halves[0]?.cells.map((c) => c.sub)).toEqual(["Billard 1 · 3m10", "Billard 2 · 3m10"]);
    expect(halves[2]?.matches).toHaveLength(1);
  });

  it("ne mélange pas Masters et National sur une même demi-feuille", () => {
    const at = "2026-11-01T08:00:00.000Z";
    const base = replay(demoEvents().map((e) => ({ ...e, at }) as TournamentEvent));
    const bm = (round: "QF" | "SF" | "F", slot: number) => ({
      id: `${round}-${slot}`,
      round,
      slot,
      a: "",
      b: "",
      sa: null,
      sb: null,
      labelA: `Vainqueur QF${slot}`,
      labelB: `Vainqueur QF${slot + 1}`,
    });
    const state = {
      ...base,
      brackets: { ...base.brackets, M: [bm("SF", 1), bm("SF", 2), bm("F", 1)], N: [bm("F", 1)] },
    };
    const halves = singleHalves(state, finalSheets(state));
    expect(halves.map((h) => h.matches.map((m) => m.title))).toEqual([
      ["Demi-finale 1 Masters", "Demi-finale 2 Masters"],
      ["Finale Masters"],
      ["Finale National"],
    ]);
    expect(halves[0]?.matches[0]?.a.hint).toBe("Vainqueur quart 1");
    expect(halves[0]?.matches[0]?.fields).toEqual(["Arbitre 1", "Arbitre 2", "Heure"]);
  });
});

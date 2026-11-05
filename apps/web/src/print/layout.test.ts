import { describe, expect, it } from "vitest";

import { demoEvents } from "@/lib/demo";
import { replay } from "@/lib/engine";
import { pouleMatches } from "@/lib/engine";
import type { TournamentEvent } from "@pilot5q/domain";

import { groupByBillard, paginateHalves } from "./layout";
import { pouleSheet } from "./sheets";

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
    expect(sheet.billards).toEqual(state.billardAssignments.PREQ?.["1"]);
  });
});

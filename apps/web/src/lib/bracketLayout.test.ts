import type { BracketMatch, BracketRound } from "@pilot5q/domain";
import { BRACKET_ROUNDS, consolanteBracket } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import { bracketLayout, isPreliminaryRound, waitingLabel } from "./bracketLayout";

const BOX = { w: 300, h: 116, gap: 110, rowH: (rows: number) => (rows > 8 ? 124 : 132) };

function layoutOf(matches: BracketMatch[]) {
  const rounds = BRACKET_ROUNDS.filter((r) => matches.some((m) => m.round === r));
  const byRound = rounds.map((r) =>
    matches.filter((m) => m.round === r).sort((x, y) => x.slot - y.slot),
  );
  return { rounds, byRound, layout: bracketLayout(byRound, [...rounds], BOX) };
}

const players = (n: number) => Array.from({ length: n }, (_, i) => `JOUEUR ${i + 1}`);

/** Deux cartes d'un même tour ne se chevauchent jamais. */
function overlaps(matches: BracketMatch[]): string[] {
  const { byRound, layout } = layoutOf(matches);
  const out: string[] = [];
  for (const ms of byRound) {
    const ys = ms.map((m) => ({ id: m.id, y: layout.pos.get(m.id)?.y ?? Number.NaN }));
    ys.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ys.length; i++) {
      const prev = ys[i - 1];
      const cur = ys[i];
      if (prev && cur && !(cur.y - prev.y >= BOX.h)) out.push(`${prev.id}/${cur.id}`);
    }
  }
  return out;
}

describe("géométrie du tableau", () => {
  it("consolante de 19 joueurs : tableau de 16 et 3 préliminaires, huitièmes entiers", () => {
    const cls = consolanteBracket(players(19), 40);
    const { rounds, byRound, layout } = layoutOf(cls);
    expect(rounds).toEqual(["R32", "R16", "QF", "SF", "F"]);
    expect(byRound[0]).toHaveLength(3);
    expect(byRound[1]).toHaveLength(8);
    expect(isPreliminaryRound(byRound[0] ?? [], byRound[1])).toBe(true);
    // La hauteur est celle des 8 huitièmes, pas celle des 3 préliminaires
    expect(layout.base).toBe(1);
    expect(layout.height).toBe(8 * 132);
    expect(overlaps(cls)).toEqual([]);
    // Chaque préliminaire est en face du huitième qu'il alimente (côté joueur B)
    for (const pre of byRound[0] ?? []) {
      const target = (byRound[1] ?? []).find((m) => m.slot === Math.ceil(pre.slot / 2));
      expect(target?.b).toBe("");
      expect(target?.labelB).toBe(`Vainqueur R32-${pre.slot}`);
      expect(layout.pos.get(pre.id)?.y).toBe(layout.pos.get(target?.id ?? "")?.y);
    }
  });

  it("aucun chevauchement, quel que soit le nombre de joueurs de la consolante", () => {
    for (let n = 2; n <= 40; n++) {
      expect(overlaps(consolanteBracket(players(n), 40)), `${n} joueurs`).toEqual([]);
    }
  });

  it("un tour incomplet garde chaque match à sa place dans le tableau", () => {
    // 13 joueurs : tableau de 16 avec trois exemptions (huitièmes 1, 3 et 5 absents)
    const cls = consolanteBracket(players(13), 40);
    const { byRound, layout } = layoutOf(cls);
    expect(layout.base).toBe(0);
    expect(byRound[0]?.length).toBe(5);
    for (const m of byRound[0] ?? []) {
      expect(layout.pos.get(m.id)?.y).toBe((m.slot - 0.5) * 132 - BOX.h / 2);
    }
  });

  it("tableau complet : chaque match au milieu des deux matchs qui l'alimentent", () => {
    const cls = consolanteBracket(players(16), 40);
    const { byRound, layout } = layoutOf(cls);
    const y = (id: string) => layout.pos.get(id)?.y ?? Number.NaN;
    for (const qf of byRound[1] ?? []) {
      const feeders = (byRound[0] ?? []).filter((m) => Math.ceil(m.slot / 2) === qf.slot);
      expect(feeders).toHaveLength(2);
      expect(y(qf.id)).toBe((y(feeders[0]?.id ?? "") + y(feeders[1]?.id ?? "")) / 2);
    }
  });
});

describe("libellé d'un joueur attendu", () => {
  it("reprend le nom du match tel qu'il est affiché sur sa carte", () => {
    const cases: [string | undefined, string][] = [
      ["Vainqueur R32-2", "Vainqueur S2"],
      ["Vainqueur R16-8", "Vainqueur H8"],
      ["Vainqueur QF1", "Vainqueur Q1"],
      ["Vainqueur SF2", "Vainqueur D2"],
      ["TS 14", "TS 14"],
      ["1er P3", "1er P3"],
      [undefined, ""],
    ];
    for (const [input, expected] of cases) expect(waitingLabel(input)).toBe(expected);
    const round: BracketRound = "R64";
    expect(waitingLabel(`Vainqueur ${round}-12`)).toBe("Vainqueur T12");
  });
});

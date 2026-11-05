/**
 * Test d'or : la fixture tn-exemple.json (76 joueurs, 17 poules, scores réels) doit redonner
 * exactement le classement de phase, les barrages et des poules du samedi cohérentes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_RULES,
  barragePairs,
  composeMasters,
  composeNational,
  mastersClubConflicts,
  matchOutcome,
  rankBarrages,
  rankPhase,
  resolveClubConflicts,
  serpentin,
} from "../src/index.js";
import type { Billard, Match, Player, Poule } from "../src/index.js";

interface Fixture {
  tournament: { name: string; season: string; mastersPrequalified: number };
  billards: Billard[];
  players: Player[];
  poules: { num: number; billards: number[]; players: string[]; matches: Omit<Match, "id">[] }[];
  barrages: { m: string; a: string; b: string; sa: number; sb: number }[];
  expectedPhaseRanking: {
    rank: number;
    name: string;
    pouleRank: number;
    ptm: number;
    pts: number;
    faits: number;
    subis: number;
    moy: number;
  }[];
  expectedBarrageRanking: { rank: number; name: string }[];
}

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(here, "fixtures", "tn-exemple.json"), "utf8"),
) as Fixture;

const poules: Poule[] = fixture.poules.map((p) => ({
  num: p.num,
  players: p.players,
  billards: p.billards,
  matches: p.matches.map((m, i) => ({ ...m, id: `P${p.num}-M${i + 1}` })),
}));
const arrivee: Record<string, number> = Object.fromEntries(
  fixture.players.map((p) => [p.name, p.seed]),
);
const clubOf: Record<string, string> = Object.fromEntries(
  fixture.players.map((p) => [p.name, p.club]),
);
const abandon = fixture.expectedPhaseRanking[67]?.name ?? "";
const d = DEFAULT_RULES.distances.preq;
const ranking = rankPhase(poules, d, arrivee, [abandon]);

describe("fixture tn-exemple : tirage du vendredi", () => {
  it("retrouve les 17 poules par serpentin des joueurs 9 à 76", () => {
    const names = fixture.players.slice(8).map((p) => p.name);
    const drawn = serpentin(names, DEFAULT_RULES.maxPoulesOf3);
    expect(drawn).toEqual(fixture.poules.map((p) => p.players));
    const { poules: fixed, unresolved } = resolveClubConflicts(drawn, clubOf);
    expect(unresolved).toEqual([]);
    expect(fixed).toEqual(drawn);
  });
});

describe("fixture tn-exemple : classement de phase", () => {
  it("redonne exactement l'ordre des 68 joueurs", () => {
    expect(ranking.map((r) => r.name)).toEqual(fixture.expectedPhaseRanking.map((r) => r.name));
  });

  it("redonne rang de poule, Pm, Ps, faits, subis et moyenne des 60 premiers", () => {
    for (let i = 0; i < 60; i++) {
      const got = ranking[i];
      const exp = fixture.expectedPhaseRanking[i];
      expect(got, `ligne ${i + 1}`).toBeDefined();
      expect(exp).toBeDefined();
      if (!got || !exp) continue;
      expect(got.place).toBe(exp.rank);
      expect(got.rang, exp.name).toBe(exp.pouleRank);
      expect(got.ptm, exp.name).toBe(exp.ptm);
      expect(got.pts, exp.name).toBe(exp.pts);
      expect(got.faits, exp.name).toBe(exp.faits);
      expect(got.subis, exp.name).toBe(exp.subis);
      expect(Math.abs(got.moy - exp.moy), exp.name).toBeLessThan(1e-6);
    }
  });

  it("classe le joueur ayant abandonné dernier avec 0 partout", () => {
    const last = ranking[67];
    expect(last?.name).toBe(abandon);
    expect(last?.ptm).toBe(0);
    expect(last?.faits).toBe(0);
    expect(last?.rang).toBe(4);
  });
});

describe("fixture tn-exemple : barrages", () => {
  const pairs = barragePairs(ranking, DEFAULT_RULES.barrageSize);
  const expected = [...fixture.barrages].sort((x, y) => x.m.localeCompare(y.m));

  it("redonne exactement les 8 paires B1..B8", () => {
    expect(pairs.map((m) => [m.id, m.a, m.b])).toEqual(expected.map((b) => [b.m, b.a, b.b]));
    expect(pairs[0]?.labelA).toBe("1er du classement");
    expect(pairs[0]?.labelB).toBe("16e du classement");
  });

  const played: Match[] = expected.map((b) => ({ id: b.m, a: b.a, b: b.b, sa: b.sa, sb: b.sb }));
  const winners = played.map((m) => matchOutcome(m, DEFAULT_RULES.distances.barrage)?.winner ?? "");
  const cumul = rankBarrages(ranking, played, DEFAULT_RULES.distances.barrage);

  it("le classement cumulé des barrages correspond à expectedBarrageRanking", () => {
    expect(cumul.map((r) => r.name)).toEqual(fixture.expectedBarrageRanking.map((r) => r.name));
  });

  const masters = fixture.players.slice(0, 8).map((p) => p.name);
  const QM = composeMasters(masters, winners, arrivee, clubOf);
  const losers = cumul.map((r) => r.name).filter((n) => !winners.includes(n));
  const QN = composeNational(losers, ranking, 17, 40);

  it("compose 4 poules Masters de 4 sans 3 joueurs du même club", () => {
    expect(QM).toHaveLength(4);
    expect(QM.map((p) => p.players.length)).toEqual([4, 4, 4, 4]);
    expect(mastersClubConflicts(QM, clubOf)).toEqual([]);
    const all = QM.flatMap((p) => p.players).sort();
    expect(all).toEqual([...masters, ...winners].sort());
    // Le serpentin est fait dans l'ordre d'arrivée : la poule 1 commence par le 1er de la liste.
    expect(QM[0]?.players[0]).toBe(fixture.players[0]?.name);
    expect(QM[0]?.matches).toHaveLength(6);
  });

  it("compose 8 poules National de 4 : perdants des barrages puis places 17 à 40", () => {
    expect(QN).toHaveLength(8);
    expect(QN.map((p) => p.players.length)).toEqual([4, 4, 4, 4, 4, 4, 4, 4]);
    const all = QN.flatMap((p) => p.players);
    expect(new Set(all).size).toBe(32);
    expect(QN.map((p) => p.players[0])).toEqual(losers);
    expect(QN[0]?.players[1]).toBe(ranking[23]?.name); // place 24 ferme le second passage
    expect(QN[7]?.players[1]).toBe(ranking[16]?.name); // place 17 en poule 8
    for (const name of all) {
      const place = ranking.find((r) => r.name === name)?.place ?? 0;
      expect(losers.includes(name) || (place >= 17 && place <= 40)).toBe(true);
    }
  });
});

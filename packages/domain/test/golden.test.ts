/**
 * Test d'or : la fixture tn-exemple.json (76 joueurs, 17 poules, scores réels du week-end) doit
 * redonner exactement ce que l'outil Excel de référence a produit : classement du vendredi,
 * barrages, poules du samedi, classements QN/QM, tableaux N/M et consolante, classements des
 * phases finales, classement final du tournoi et primes. La dernière section rejoue toute la
 * séquence par le réducteur (journal d'événements) pour prouver l'automate de bout en bout.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_RULES,
  advanceBracket,
  barragePairs,
  bracketRanking,
  composeMasters,
  composeNational,
  consolanteBracket,
  entryArrivee,
  finalRanking,
  forfaitSubisOf,
  mastersClubConflicts,
  mastersQF,
  matchOutcome,
  nationalR16,
  phaseComplete,
  phaseRanking,
  primesOf,
  rankBarrages,
  rankPhase,
  rankPouleInPhase,
  rankTournamentPhase,
  replay,
  resolveClubConflicts,
  serpentin,
  serpentinOrder,
  walkoverPoints,
} from "../src/index.js";
import type {
  Billard,
  BracketMatch,
  BracketRound,
  Distance,
  Match,
  Player,
  Poule,
  TournamentEvent,
  TournamentPhaseRow,
  TournamentState,
} from "../src/index.js";

interface FixtureMatch {
  m?: string;
  a: string;
  b: string;
  sa: number;
  sb: number;
  setsA?: number[];
  setsB?: number[];
}
interface FixturePoule {
  num: number;
  billards: number[];
  players: string[];
  matches: FixtureMatch[];
  excelRanking?: {
    name: string;
    rang: number;
    ptm: number;
    pts: number;
    faits: number;
    subis: number;
    moy: number;
  }[];
}
interface ExpectedRow {
  rank: number;
  name: string;
  pouleRank?: number | null;
  ptm: number;
  pts: number;
  faits: number;
  subis: number;
  moy: number;
  arriveeQN?: number;
  phase?: string | null;
}
interface FixtureBracketMatch extends FixtureMatch {
  id: string;
  round: string;
  billard?: number;
}
interface Fixture {
  tournament: {
    name: string;
    season: string;
    city: string;
    club: string;
    dates: [string, string];
    mastersPrequalified: number;
  };
  billards: Billard[];
  players: Player[];
  poules: FixturePoule[];
  barrages: { m: string; a: string; b: string; sa: number; sb: number }[];
  expectedPhaseRanking: ExpectedRow[];
  expectedBarrageRanking: { rank: number; name: string }[];
  abandons: { player: string; phase: string }[];
  saturday: {
    QN: { distance: Distance; poules: FixturePoule[]; expectedRanking: ExpectedRow[] };
    QM: { distance: Distance; poules: FixturePoule[]; expectedRanking: ExpectedRow[] };
  };
  brackets: {
    N: {
      labels: Record<string, string>;
      matches: FixtureBracketMatch[];
      expectedRanking: ExpectedRow[];
    };
    M: {
      labels: Record<string, string>;
      matches: FixtureBracketMatch[];
      expectedRanking: ExpectedRow[];
    };
    CLS: {
      candidates: string[];
      players: string[];
      seeds: Record<string, number>;
      matches: FixtureBracketMatch[];
      expectedRanking: (ExpectedRow & { joues: number })[];
    };
  };
  expectedTournamentRanking: {
    rank: number;
    name: string;
    points: number;
    faits: number;
    subis: number;
    moy: number;
  }[];
  primes: {
    juniors: number;
    players: number;
    inscriptions: number;
    ffb: number;
    club: number;
    total: number;
    masters: { label: string | null; pct: number; amount: number; name: string }[];
    national: { label: string | null; pct: number; amount: number; name: string }[];
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(here, "fixtures", "tn-exemple.json"), "utf8"),
) as Fixture;

const toPoule = (p: FixturePoule): Poule => ({
  num: p.num,
  players: p.players,
  billards: p.billards,
  matches: p.matches.map((m, i) => ({
    id: `P${p.num}-M${i + 1}`,
    a: m.a,
    b: m.b,
    sa: m.sa,
    sb: m.sb,
    ...(m.setsA ? { setsA: m.setsA } : {}),
    ...(m.setsB ? { setsB: m.setsB } : {}),
  })),
});
const poules: Poule[] = fixture.poules.map(toPoule);
const arrivee: Record<string, number> = Object.fromEntries(
  fixture.players.map((p) => [p.name, p.seed]),
);
const clubOf: Record<string, string> = Object.fromEntries(
  fixture.players.map((p) => [p.name, p.club]),
);
const abandon = fixture.abandons.find((a) => a.phase === "PREQ")?.player ?? "";
const d = DEFAULT_RULES.distances.preq;
const ranking = rankPhase(poules, d, arrivee, [abandon]);
const masters = fixture.players.slice(0, 8).map((p) => p.name);

/** Compare une ligne de classement calculée à la ligne attendue de l'Excel. */
function expectRow(
  got: {
    ptm: number;
    pts: number;
    faits: number;
    subis: number;
    moy: number;
    rang?: number | null;
  },
  exp: ExpectedRow,
): void {
  expect(got.ptm, exp.name).toBe(exp.ptm);
  expect(got.pts, exp.name).toBe(exp.pts);
  expect(got.faits, exp.name).toBe(exp.faits);
  expect(got.subis, exp.name).toBe(exp.subis);
  expect(Math.abs(got.moy - exp.moy), exp.name).toBeLessThan(1e-9);
  if (exp.pouleRank !== undefined && exp.pouleRank !== null) {
    expect(got.rang, exp.name).toBe(exp.pouleRank);
  }
}

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
      expectRow(got, exp);
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

const pairs = barragePairs(ranking, DEFAULT_RULES.barrageSize);
const expectedBarrages = [...fixture.barrages].sort((x, y) => x.m.localeCompare(y.m));
const played: Match[] = expectedBarrages.map((b) => ({
  id: b.m,
  a: b.a,
  b: b.b,
  sa: b.sa,
  sb: b.sb,
}));
const winners = played.map((m) => matchOutcome(m, DEFAULT_RULES.distances.barrage)?.winner ?? "");
const cumul = rankBarrages(ranking, played, DEFAULT_RULES.distances.barrage);
const losers = cumul.map((r) => r.name).filter((n) => !winners.includes(n));
const QM = composeMasters(masters, winners, arrivee, clubOf);
const QN = composeNational(losers, ranking, 17, 40);

describe("fixture tn-exemple : barrages", () => {
  it("redonne exactement les 8 paires B1..B8", () => {
    expect(pairs.map((m) => [m.id, m.a, m.b])).toEqual(
      expectedBarrages.map((b) => [b.m, b.a, b.b]),
    );
    expect(pairs[0]?.labelA).toBe("1er du classement");
    expect(pairs[0]?.labelB).toBe("16e du classement");
  });

  it("le classement cumulé des barrages correspond à expectedBarrageRanking (vainqueurs d'abord)", () => {
    expect(cumul.map((r) => r.name)).toEqual(fixture.expectedBarrageRanking.map((r) => r.name));
    expect(cumul.slice(0, 8).every((r) => winners.includes(r.name))).toBe(true);
  });
});

describe("fixture tn-exemple : poules du samedi", () => {
  it("composeMasters redonne exactement les 4 poules Masters réelles", () => {
    expect(QM.map((p) => p.players)).toEqual(fixture.saturday.QM.poules.map((p) => p.players));
    expect(mastersClubConflicts(QM, clubOf)).toEqual([]);
    // Serpentin dans l'ordre d'arrivée : préqualifiés (1 à 8) puis vainqueurs de barrage.
    expect(serpentinOrder(QM.map((p) => p.players)).slice(0, 8)).toEqual(masters);
  });

  it("composeNational redonne exactement les 8 poules National réelles", () => {
    expect(QN.map((p) => p.players)).toEqual(fixture.saturday.QN.poules.map((p) => p.players));
    expect(QN.map((p) => p.players[0])).toEqual(losers);
  });
});

const QNreal = fixture.saturday.QN.poules.map(toPoule);
const QMreal = fixture.saturday.QM.poules.map(toPoule);
const dQN = DEFAULT_RULES.distances.qn;
const dQM = DEFAULT_RULES.distances.qm;
/** Ordre d'arrivée du National : ordre d'entrée dans la phase (serpentin reconstitué). */
const arriveeQN: Record<string, number> = { ...arrivee };
serpentinOrder(QNreal.map((p) => p.players)).forEach((n, i) => {
  arriveeQN[n] = i + 1;
});
const rankingQN = rankPhase(QNreal, dQN, arriveeQN);
const rankingQM = rankPhase(QMreal, dQM, arrivee);

describe("fixture tn-exemple : qualifications du samedi", () => {
  it("QN : chaque poule redonne le classement Excel (rang, Pm, Ps, faits, subis, moyenne)", () => {
    for (const p of fixture.saturday.QN.poules) {
      const { rows, complete } = rankPouleInPhase(toPoule(p), dQN);
      expect(complete).toBe(true);
      expect(rows.map((r) => r.name)).toEqual(p.excelRanking?.map((r) => r.name));
      rows.forEach((r, i) => {
        const exp = p.excelRanking?.[i];
        if (exp) expectRow(r, { ...exp, rank: i + 1, pouleRank: exp.rang });
      });
    }
  });

  it("QN : le classement de phase (32 joueurs) est identique à l'Excel, ordre d'arrivée = ordre d'entrée dans la phase", () => {
    const exp = fixture.saturday.QN.expectedRanking;
    expect(rankingQN.map((r) => r.name)).toEqual(exp.map((r) => r.name));
    rankingQN.forEach((r, i) => {
      const e = exp[i];
      if (!e) return;
      expect(r.place).toBe(e.rank);
      expectRow(r, e);
      expect(r.arrivee, e.name).toBe(e.arriveeQN);
    });
  });

  it("QM : poules en 2 sets gagnants à 60, points de set et moyennes identiques à l'Excel", () => {
    for (const p of fixture.saturday.QM.poules) {
      const { rows, complete } = rankPouleInPhase(toPoule(p), dQM);
      expect(complete).toBe(true);
      expect(rows.map((r) => r.name)).toEqual(p.excelRanking?.map((r) => r.name));
      rows.forEach((r, i) => {
        const exp = p.excelRanking?.[i];
        if (exp) expectRow(r, { ...exp, rank: i + 1, pouleRank: exp.rang });
      });
    }
    const exp = fixture.saturday.QM.expectedRanking;
    expect(rankingQM.map((r) => r.name)).toEqual(exp.map((r) => r.name));
    rankingQM.forEach((r, i) => {
      const e = exp[i];
      if (e) expectRow(r, e);
    });
  });
});

/** Trouve le match d'un tableau opposant deux joueurs (quel que soit le côté). */
function findMatch<M extends Match>(ms: M[], a: string, b: string): M | undefined {
  return ms.find((m) => (m.a === a && m.b === b) || (m.a === b && m.b === a));
}

/** Applique les scores réels d'un tableau aux matchs correspondants (par joueurs). */
function applyScores(ms: BracketMatch[], real: FixtureBracketMatch[]): BracketMatch[] {
  return ms.map((m) => {
    const r = real.find((x) => (x.a === m.a && x.b === m.b) || (x.a === m.b && x.b === m.a));
    if (!r || m.a === "" || m.b === "") return m;
    const swap = r.a !== m.a;
    const out: BracketMatch = { ...m, sa: swap ? r.sb : r.sa, sb: swap ? r.sa : r.sb };
    if (r.setsA && r.setsB) {
      out.setsA = swap ? r.setsB : r.setsA;
      out.setsB = swap ? r.setsA : r.setsB;
    }
    return out;
  });
}

/** Rejoue un tableau tour par tour jusqu'à la finale avec les scores réels. */
function replayBracket(
  start: BracketMatch[],
  real: FixtureBracketMatch[],
  dist: Distance,
  byRound: Partial<Record<BracketRound, Distance>>,
): BracketMatch[] {
  let ms = advanceBracket(start, dist, byRound);
  for (let i = 0; i < 6; i++) ms = advanceBracket(applyScores(ms, real), dist, byRound);
  return ms;
}

const dFinal = DEFAULT_RULES.distances.final;
const byRoundN: Partial<Record<BracketRound, Distance>> = {
  R16: DEFAULT_RULES.distances.huitiemes,
};
const realN = fixture.brackets.N.matches;
const realM = fixture.brackets.M.matches;
const bracketN = replayBracket(nationalR16(QNreal, dQN), realN, dFinal, byRoundN);
const bracketM = replayBracket(mastersQF(QMreal, dQM), realM, dFinal, {});
const distN = (r: BracketRound): Distance => byRoundN[r] ?? dFinal;
const distM = (): Distance => dFinal;

describe("fixture tn-exemple : tableau National", () => {
  it("nationalR16 redonne les huit huitièmes réels H1..H8 dans l'ordre du tableau", () => {
    const r16 = nationalR16(QNreal, dQN);
    const real = realN.filter((m) => m.round === "R16");
    expect(r16.map((m) => [m.a, m.b])).toEqual(real.map((m) => [m.a, m.b]));
    expect(r16.map((m) => `${m.labelA} vs ${m.labelB}`)).toEqual(
      real.map((m) => fixture.brackets.N.labels[m.id]?.replace("2eme", "2e")),
    );
  });

  it("rejoue quarts, demies et finale avec les croisements et vainqueurs réels", () => {
    for (const r of realN.filter((m) => m.round !== "R16")) {
      const m = findMatch(bracketN, r.a, r.b);
      expect(m, `${r.id} ${r.a}–${r.b}`).toBeDefined();
      if (!m) continue;
      const expectedRound = { QF: "QF", SF: "SF", F: "F" }[r.round];
      expect(m.round, r.id).toBe(expectedRound);
      expect(matchOutcome(m, distN(m.round))?.winner, r.id).toBe(r.sa > r.sb ? r.a : r.b);
    }
    const final = bracketN.find((m) => m.round === "F");
    const realFinal = realN.find((m) => m.id === "F");
    expect(final && matchOutcome(final, dFinal)?.winner).toBe(
      realFinal && (realFinal.sa > realFinal.sb ? realFinal.a : realFinal.b),
    );
    expect(bracketN.every((m) => matchOutcome(m, distN(m.round)) !== null)).toBe(true);
  });

  it("le classement de la phase finale National (32 joueurs) est identique à l'Excel", () => {
    const rows = rankTournamentPhase(rankingQN, bracketN, distN, arrivee);
    const exp = fixture.brackets.N.expectedRanking;
    expect(rows.map((r) => r.name)).toEqual(exp.map((r) => r.name));
    rows.forEach((r, i) => {
      const e = exp[i];
      if (!e) return;
      expectRow(r, e);
      expect(r.label, e.name).toBe(e.phase ?? "");
      if (e.pouleRank !== null && e.pouleRank !== undefined) expect(r.rang).toBe(e.pouleRank);
    });
  });
});

describe("fixture tn-exemple : tableau Masters", () => {
  it("mastersQF redonne les quatre quarts réels (Q3/Q4 numérotés selon SPEC, inversés dans l'Excel)", () => {
    const qf = mastersQF(QMreal, dQM);
    const real = realM.filter((m) => m.round === "QF");
    const key = (m: { a: string; b: string }): string => [m.a, m.b].sort().join("|");
    expect(qf.map(key).sort()).toEqual(real.map(key).sort());
    // Q1 et Q2 identiques ; SPEC numérote Q3 = 1er P4–2e P1 et Q4 = 1er P2–2e P3, l'Excel l'inverse.
    expect(qf[0] && key(qf[0])).toBe(real[0] && key(real[0]));
    expect(qf[1] && key(qf[1])).toBe(real[1] && key(real[1]));
    expect(qf[2] && key(qf[2])).toBe(real[3] && key(real[3]));
    expect(qf[3] && key(qf[3])).toBe(real[2] && key(real[2]));
  });

  it("rejoue demies et finale (3 sets gagnants à 60) avec les vainqueurs réels", () => {
    for (const r of realM.filter((m) => m.round !== "QF")) {
      const m = findMatch(bracketM, r.a, r.b);
      expect(m, `${r.id} ${r.a}–${r.b}`).toBeDefined();
      if (!m) continue;
      expect(matchOutcome(m, dFinal)?.winner, r.id).toBe(r.sa > r.sb ? r.a : r.b);
    }
    const final = bracketM.find((m) => m.round === "F");
    expect(final?.a === masters[0] || final?.b === masters[0]).toBe(true);
  });

  it("le classement de la phase finale Masters (16 joueurs) est identique à l'Excel", () => {
    const rows = rankTournamentPhase(rankingQM, bracketM, distM, arrivee);
    const exp = fixture.brackets.M.expectedRanking;
    expect(rows.map((r) => r.name)).toEqual(exp.map((r) => r.name));
    rows.forEach((r, i) => {
      const e = exp[i];
      if (!e) return;
      expectRow(r, e);
      expect(r.label, e.name).toBe(e.phase ?? "");
    });
  });
});

const dCLS = DEFAULT_RULES.distances.cls;
const realCLS = fixture.brackets.CLS.matches;
const clsPlayers = fixture.brackets.CLS.players;
const bracketCLS = replayBracket(consolanteBracket(clsPlayers, 40), realCLS, dCLS, {});

describe("fixture tn-exemple : consolante", () => {
  it("les volontaires sont les places 41 et suivantes, dans l'ordre du classement de sortie, hors abandons", () => {
    const excluded = new Set(fixture.abandons.map((a) => a.player));
    const expected = ranking
      .slice(40)
      .map((r) => r.name)
      .filter((n) => !excluded.has(n));
    expect(clsPlayers).toEqual(expected);
    expect(clsPlayers).toHaveLength(19);
  });

  it("19 joueurs : tableau de 16 et 3 barrages identiques au tableau réel (B1..B3, H1..H8)", () => {
    const start = consolanteBracket(clsPlayers, 40);
    const pre = start.filter((m) => m.round === "R32");
    const realB = realCLS.filter((m) => m.round === "B");
    expect(pre.map((m) => [m.a, m.b])).toEqual(realB.map((m) => [m.a, m.b]));
    for (const m of realB) {
      expect(fixture.brackets.CLS.seeds[m.a]).toBe(clsPlayers.indexOf(m.a) + 1);
      expect(fixture.brackets.CLS.seeds[m.b]).toBe(clsPlayers.indexOf(m.b) + 1);
    }
    const r16 = bracketCLS.filter((m) => m.round === "R16");
    const realH = realCLS.filter((m) => m.round === "R16");
    expect(r16.map((m) => [m.a, m.b])).toEqual(realH.map((m) => [m.a, m.b]));
  });

  it("rejoue le tableau jusqu'à la finale et redonne le vainqueur réel", () => {
    for (const r of realCLS) {
      const m = findMatch(bracketCLS, r.a, r.b);
      expect(m, `${r.id} ${r.a}–${r.b}`).toBeDefined();
      if (!m) continue;
      expect(matchOutcome(m, dCLS)?.winner, r.id).toBe(r.sa > r.sb ? r.a : r.b);
    }
    expect(bracketCLS).toHaveLength(realCLS.length);
    const final = bracketCLS.find((m) => m.round === "F");
    expect(final && matchOutcome(final, dCLS)?.winner).toBe(
      fixture.brackets.CLS.expectedRanking[0]?.name,
    );
  });

  it("le classement de la consolante (19 joueurs du tableau) est identique à l'Excel", () => {
    const rows = rankTournamentPhase([], bracketCLS, () => dCLS, arrivee);
    const exp = fixture.brackets.CLS.expectedRanking.filter((r) => r.joues > 0);
    expect(exp).toHaveLength(19);
    expect(rows.map((r) => r.name)).toEqual(exp.map((r) => r.name));
    rows.forEach((r, i) => {
      const e = exp[i];
      if (!e) return;
      expectRow(r, e);
      expect(r.joues, e.name).toBe(e.joues);
    });
  });
});

/* ------------------------------------------------------------------------------------------ */
/* Rejeu complet par le réducteur                                                              */
/* ------------------------------------------------------------------------------------------ */

const at = "2026-10-30T10:00:00Z";

/** Événements de score d'une phase de poules, à partir des matchs réels (appariés par joueurs). */
function pouleScores(
  state: TournamentState,
  phase: "PREQ" | "QN" | "QM",
  real: FixturePoule[],
): TournamentEvent[] {
  const events: TournamentEvent[] = [];
  for (const fp of real) {
    const poule = state.poules[phase].find((p) => p.num === fp.num);
    if (!poule) throw new Error(`poule ${phase} ${fp.num}`);
    for (const fm of fp.matches) {
      const m = findMatch(poule.matches, fm.a, fm.b);
      if (!m) throw new Error(`match ${fm.a}-${fm.b}`);
      const swap = m.a !== fm.a;
      events.push({
        type: "score.entered",
        at,
        payload: {
          phase,
          matchId: m.id,
          sa: swap ? fm.sb : fm.sa,
          sb: swap ? fm.sa : fm.sb,
          ...(fm.setsA && fm.setsB
            ? { setsA: swap ? fm.setsB : fm.setsA, setsB: swap ? fm.setsA : fm.setsB }
            : {}),
        },
      });
    }
  }
  return events;
}

/** Événements de score d'un tableau, tour par tour (les joueurs n'étant connus qu'au fur et à mesure). */
function bracketScores(
  state: TournamentState,
  phase: "N" | "M" | "CLS",
  real: FixtureBracketMatch[],
): TournamentState {
  let s = state;
  for (let i = 0; i < 6; i++) {
    for (const m of s.brackets[phase]) {
      if (m.a === "" || m.b === "" || m.sa !== null) continue;
      const r = real.find((x) => (x.a === m.a && x.b === m.b) || (x.a === m.b && x.b === m.a));
      if (!r) throw new Error(`match ${phase} ${m.id} ${m.a}–${m.b}`);
      const swap = r.a !== m.a;
      s = push({
        type: "score.entered",
        at,
        payload: {
          phase,
          matchId: m.id,
          sa: swap ? r.sb : r.sa,
          sb: swap ? r.sa : r.sb,
          ...(r.setsA && r.setsB
            ? { setsA: swap ? r.setsB : r.setsA, setsB: swap ? r.setsA : r.setsB }
            : {}),
        },
      });
    }
  }
  return s;
}

/** Journal courant (les tests ci-dessous l'allongent dans l'ordre du tournoi). */
const log: TournamentEvent[] = [];
function push(...events: TournamentEvent[]): TournamentState {
  log.push(...events);
  return replay(log);
}

describe("fixture tn-exemple : rejeu complet par le réducteur", () => {
  let state: TournamentState = push(
    {
      type: "tournament.created",
      at,
      payload: {
        name: fixture.tournament.name,
        season: fixture.tournament.season,
        city: fixture.tournament.city,
        club: fixture.tournament.club,
        dates: fixture.tournament.dates,
        billards: fixture.billards,
        rules: DEFAULT_RULES,
      },
    },
    { type: "players.imported", at, payload: { players: fixture.players } },
    { type: "poules.drawn", at, payload: { phase: "PREQ", poules: poules } },
  );

  it("vendredi : scores, abandon, clôture → barrages réels", () => {
    state = push(...pouleScores(state, "PREQ", fixture.poules));
    state = push({
      type: "forfait.declared",
      at,
      payload: { phase: "PREQ", player: abandon, kind: "abandon" },
    });
    expect(phaseComplete(state, "PREQ")).toBe(true);
    expect(phaseRanking(state, "PREQ").map((r) => r.name)).toEqual(
      fixture.expectedPhaseRanking.map((r) => r.name),
    );
    state = push({ type: "phase.closed", at, payload: { phase: "PREQ" } });
    expect(state.barrages.map((m) => [m.id, m.a, m.b])).toEqual(
      expectedBarrages.map((b) => [b.m, b.a, b.b]),
    );
    state = push(
      ...expectedBarrages.map((b): TournamentEvent => ({
        type: "score.entered",
        at,
        payload: { phase: "B", matchId: b.m, sa: b.sa, sb: b.sb },
      })),
    );
    expect(phaseComplete(state, "B")).toBe(true);
  });

  it("clôture des barrages → poules QN et QM réelles", () => {
    state = push({ type: "phase.closed", at, payload: { phase: "B" } });
    expect(state.poules.QM.map((p) => p.players)).toEqual(
      fixture.saturday.QM.poules.map((p) => p.players),
    );
    expect(state.poules.QN.map((p) => p.players)).toEqual(
      fixture.saturday.QN.poules.map((p) => p.players),
    );
    const order = entryArrivee(state, "QN");
    expect(serpentinOrder(state.poules.QN.map((p) => p.players)).map((n) => order[n])).toEqual(
      Array.from({ length: 32 }, (_, i) => i + 1),
    );
  });

  it("samedi : scores QN/QM → classements Excel, huitièmes réels sans clôture du National, clôture Masters → quarts réels", () => {
    state = push(
      ...pouleScores(state, "QN", fixture.saturday.QN.poules),
      ...pouleScores(state, "QM", fixture.saturday.QM.poules),
    );
    expect(phaseComplete(state, "QN")).toBe(true);
    expect(phaseComplete(state, "QM")).toBe(true);
    expect(phaseRanking(state, "QN").map((r) => r.name)).toEqual(
      fixture.saturday.QN.expectedRanking.map((r) => r.name),
    );
    expect(phaseRanking(state, "QM").map((r) => r.name)).toEqual(
      fixture.saturday.QM.expectedRanking.map((r) => r.name),
    );
    // Les huitièmes National se remplissent dès que les poules couplées sont complètes : pas de
    // clôture du National (retours du 6 novembre).
    expect(state.closed.QN).toBeUndefined();
    state = push({ type: "phase.closed", at, payload: { phase: "QM" } });
    expect(state.brackets.N.filter((m) => m.round === "R16").map((m) => [m.a, m.b])).toEqual(
      realN.filter((m) => m.round === "R16").map((m) => [m.a, m.b]),
    );
    expect(state.brackets.N).toHaveLength(15);
    expect(state.brackets.M).toHaveLength(7);
  });

  it("dimanche : tableaux N et M rejoués jusqu'aux finales, classements des phases finales", () => {
    state = bracketScores(state, "N", realN);
    state = bracketScores(state, "M", realM);
    expect(phaseComplete(state, "N")).toBe(true);
    expect(phaseComplete(state, "M")).toBe(true);
    const n = bracketRanking(state, "N");
    const m = bracketRanking(state, "M");
    expect(n.map((r) => r.name)).toEqual(fixture.brackets.N.expectedRanking.map((r) => r.name));
    expect(m.map((r) => r.name)).toEqual(fixture.brackets.M.expectedRanking.map((r) => r.name));
    expect(n[0]?.label).toBe("Gagnant");
    expect(m[0]?.label).toBe("Gagnant");
    expect(m[8]?.label).toBe("");
  });

  it("consolante : création, scores, classement", () => {
    state = push({ type: "consolante.created", at, payload: { players: clsPlayers } });
    state = bracketScores(state, "CLS", realCLS);
    expect(phaseComplete(state, "CLS")).toBe(true);
    expect(bracketRanking(state, "CLS").map((r) => r.name)).toEqual(
      fixture.brackets.CLS.expectedRanking.filter((r) => r.joues > 0).map((r) => r.name),
    );
  });

  it("classement final du tournoi : barème, décimale Ps/matchs/100 et moyenne (l'Excel compte faux les matchs QN)", () => {
    const rows = finalRanking(state);
    const exp = fixture.expectedTournamentRanking;
    // Points du barème (partie entière) identiques pour les 76 joueurs.
    const byName = new Map(exp.map((e) => [e.name, e]));
    for (const r of rows) {
      const e = byName.get(r.name);
      expect(e, r.name).toBeDefined();
      if (!e) continue;
      expect(r.points, r.name).toBe(Math.floor(e.points + 1e-9));
      if (!r.abandon) {
        expect(r.faits, r.name).toBe(e.faits);
        expect(r.subis, r.name).toBe(e.subis);
        expect(Math.abs(r.moy - e.moy), r.name).toBeLessThan(1e-9);
      }
    }
    // Nombre réel de matchs joués hors consolante, lu dans la fixture (3 par poule, 1 par
    // barrage, un par match de tableau). L'outil Excel compte 3, 4, 5, 6 matchs aux joueurs
    // classés 1er à 4e des poules National 2 à 8 (série recopiée dans la colonne « Matches
    // Joués » de l'onglet Q N) : sa décimale est donc fausse pour ces joueurs et son ordre n'est
    // reproduit qu'après correction du nombre de matchs.
    const matchesOf = (name: string): number => {
      let n = 0;
      const inPoule = (ps: FixturePoule[]): boolean => ps.some((p) => p.players.includes(name));
      if (inPoule(fixture.poules) && name !== abandon) n += 3;
      if (expectedBarrages.some((b) => b.a === name || b.b === name)) n += 1;
      if (inPoule(fixture.saturday.QN.poules) || inPoule(fixture.saturday.QM.poules)) n += 3;
      n += [...realN, ...realM].filter((m) => m.a === name || m.b === name).length;
      return n;
    };
    const corrected = exp
      .map((e) => {
        const points = Math.floor(e.points + 1e-9);
        const got = rows.find((r) => r.name === e.name);
        const abandonned = got?.abandon ?? false;
        const pts = got?.pts ?? 0;
        const joues = matchesOf(e.name);
        return {
          ...e,
          points,
          decimal: abandonned || joues === 0 ? 0 : pts / joues / 100,
          abandonned,
          arrivee: arrivee[e.name] ?? 0,
        };
      })
      .sort(
        (x, y) =>
          Number(x.abandonned) - Number(y.abandonned) ||
          y.points - x.points ||
          y.decimal - x.decimal ||
          y.moy - x.moy ||
          x.arrivee - y.arrivee,
      );
    expect(rows.map((r) => r.name)).toEqual(corrected.map((r) => r.name));
    rows.forEach((r) => {
      const joues = matchesOf(r.name);
      expect(r.joues, r.name).toBe(r.abandon ? 0 : joues);
      if (!r.abandon) expect(Math.abs(r.decimal - r.pts / joues / 100), r.name).toBeLessThan(1e-12);
    });
    // Les joueurs mal comptés par l'Excel sont les seuls à changer de place.
    const affected = new Set(
      fixture.saturday.QN.poules
        .filter((p) => p.num >= 2)
        .flatMap((p) => p.excelRanking?.slice(1).map((r) => r.name) ?? []),
    );
    const excelOrder = exp.map((e) => e.name);
    const moved = rows.filter((r, i) => excelOrder[i] !== r.name).map((r) => r.name);
    expect(moved.length).toBeGreaterThan(0);
    const sameGroup = (a: string, b: string): boolean =>
      Math.floor((byName.get(a)?.points ?? 0) + 1e-9) ===
      Math.floor((byName.get(b)?.points ?? 0) + 1e-9);
    for (const name of moved) {
      const i = rows.findIndex((r) => r.name === name);
      const neighbours = [excelOrder[i] ?? ""];
      expect(
        affected.has(name) || neighbours.some((n) => affected.has(n) && sameGroup(n, name)),
        name,
      ).toBe(true);
    }
    expect(rows[rows.length - 1]).toMatchObject({ name: abandon, points: 0, abandon: true });
    expect(rows[0]).toMatchObject({ name: masters[0], points: 80, origin: "M" });
    expect(rows[0] && rows[0].points + rows[0].decimal).toBeCloseTo(exp[0]?.points ?? 0, 9);
  });

  it("primes : cagnotte et bénéficiaires identiques à l'onglet PRIMES (2 juniors)", () => {
    const p = primesOf(state);
    expect(p.juniors).toBe(fixture.primes.juniors);
    expect(p.players).toBe(fixture.primes.players);
    expect(p.inscriptions).toBe(fixture.primes.inscriptions);
    expect(p.total).toBe(fixture.primes.total);
    const amounts = (rows: { amount: number }[]): number[] => rows.map((r) => r.amount);
    expect(amounts(p.masters)).toEqual(amounts(fixture.primes.masters));
    expect(amounts(p.national)).toEqual(amounts(fixture.primes.national));
    expect(Math.abs(p.masters.reduce((s, r) => s + r.amount, 0) - 0.8 * p.total)).toBeLessThan(
      0.01,
    );
    expect(Math.abs(p.national.reduce((s, r) => s + r.amount, 0) - 0.2 * p.total)).toBeLessThan(
      0.01,
    );
    // Mêmes bénéficiaires par groupe (l'Excel ordonne les perdants par numéro de match).
    const groups = (rows: { pct: number; name: string }[]): Record<string, string[]> => {
      const out: Record<string, string[]> = {};
      for (const r of rows) (out[String(r.pct)] ??= []).push(r.name);
      for (const k of Object.keys(out)) out[k]?.sort();
      return out;
    };
    expect(groups(p.masters)).toEqual(groups(fixture.primes.masters));
    expect(groups(p.national)).toEqual(groups(fixture.primes.national));
  });

  it("forfait avant une poule du samedi : poule de 3 compensée, points subis moyens crédités aux adversaires", () => {
    // Si le 4e de la poule National 1 avait déclaré forfait avant le début : la poule devient
    // une poule de 3 (+2 Pm, +1 Ps aux restants, SPEC §5), chacun gagne 100 points contre lui et
    // subit la moyenne (vendredi + barrage) de ses propres points subis par set (SPEC §5).
    const poule = fixture.saturday.QN.poules[0];
    expect(poule).toBeDefined();
    if (!poule) return;
    const forfait = poule.excelRanking?.[3]?.name ?? "";
    const before = log.slice(
      0,
      log.findIndex((e) => e.type === "score.entered" && e.payload.phase === "QN"),
    );
    const base = replay(before);
    const playedWithoutForfait = pouleScores(base, "QN", [poule]).filter((e) => {
      if (e.type !== "score.entered") return false;
      const id = e.payload.matchId;
      const m = base.poules.QN[0]?.matches.find((x) => x.id === id);
      return m !== undefined && m.a !== forfait && m.b !== forfait;
    });
    const s = replay([
      ...before,
      { type: "forfait.declared", at, payload: { phase: "QN", player: forfait, kind: "forfait" } },
      ...playedWithoutForfait,
    ]);
    const rows = rankPhase(
      [s.poules.QN[0] ?? { num: 1, players: [], billards: [], matches: [] }],
      dQN,
      entryArrivee(s, "QN"),
      [forfait],
      forfaitSubisOf(s, "QN"),
    );
    expect(rows[3]).toMatchObject({ name: forfait, ptm: 0, pts: 0, faits: 0 });
    const real = poule.excelRanking ?? [];
    for (const r of rows.slice(0, 3)) {
      const e = real.find((x) => x.name === r.name);
      expect(e).toBeDefined();
      if (!e) continue;
      // Points réels contre les deux autres + match contre le forfait + compensation poule de 3.
      const vsForfait = poule.matches.find(
        (m) => (m.a === r.name && m.b === forfait) || (m.b === r.name && m.a === forfait),
      );
      const faitsReal =
        e.faits - (vsForfait ? (vsForfait.a === r.name ? vsForfait.sa : vsForfait.sb) : 0);
      const subisReal =
        e.subis - (vsForfait ? (vsForfait.a === r.name ? vsForfait.sb : vsForfait.sa) : 0);
      const ps = walkoverPoints(s, "QN", r.name, dQN);
      expect(r.faits, r.name).toBe(faitsReal + 100);
      expect(r.subis, r.name).toBe(subisReal + ps);
      expect(ps).toBeGreaterThan(0);
      expect(ps).toBeLessThan(100);
      expect(r.joues, r.name).toBe(3);
    }
    expect(rows.slice(0, 3).reduce((acc, r) => acc + r.ptm, 0)).toBe(6 + 3 * 2 + 3 * 2);
    expect(rows.slice(0, 3).reduce((acc, r) => acc + r.pts, 0)).toBe(3 + 3 + 3);
  });

  it("forfait dans un tableau : points subis = moyenne des phases précédentes ramenée à la distance", () => {
    // Si le finaliste National avait déclaré forfait pour la finale : l'adversaire gagne 3 sets
    // à 60, le forfait marque par set la moyenne (PREQ+B, puis QN) des points subis par set
    // par l'adversaire, ramenée à 60.
    const final = state.brackets.N.find((m) => m.round === "F");
    expect(final).toBeDefined();
    if (!final) return;
    const loser = matchOutcome(final, dFinal)?.loser ?? "";
    const winner = matchOutcome(final, dFinal)?.winner ?? "";
    const before: TournamentEvent[] = log.filter(
      (e) => !(e.type === "score.entered" && e.payload.matchId === "N-F"),
    );
    const s = replay([
      ...before,
      { type: "forfait.declared", at, payload: { phase: "N", player: loser, kind: "forfait" } },
    ]);
    const m = s.brackets.N.find((x) => x.round === "F");
    const expected = walkoverPoints(s, "N", winner, dFinal);
    const friday = fixture.expectedPhaseRanking.find((r) => r.name === winner);
    const barrage = expectedBarrages.find((b) => b.a === winner || b.b === winner);
    const qn = fixture.saturday.QN.expectedRanking.find((r) => r.name === winner);
    expect(friday && qn).toBeTruthy();
    if (!friday || !qn) return;
    const subisB = barrage ? (barrage.a === winner ? barrage.sb : barrage.sa) : 0;
    const avg60 =
      (((friday.subis + subisB) / (3 + (barrage ? 1 : 0))) * 0.6 + (qn.subis / 3) * 0.6) / 2;
    expect(expected).toBe(Math.floor(avg60));
    expect(m).toMatchObject({ forfait: m?.a === loser ? "a" : "b" });
    const o = m && matchOutcome(m, dFinal);
    expect(o?.winner).toBe(winner);
    expect(o?.pointsWinner).toBe(180);
    expect(o?.pointsLoser).toBe(expected * 3);
    expect(bracketRanking(s, "N")[0]?.name).toBe(winner);
  });
});

/** Vérification de type : les lignes des classements de phase finale portent un libellé. */
const _check: TournamentPhaseRow[] = bracketRanking(replay([]), "N");
void _check;

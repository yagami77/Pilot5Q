/**
 * Huitièmes National progressifs (retours du 6 novembre) : un huitième reçoit ses joueurs dès
 * que ses deux poules couplées sont complètes, sans clôture du National ; correction d'un score
 * de poule après coup.
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_RULES, NATIONAL_R16_PAIRS, replay, reduce, toPoules } from "../src/index.js";
import type { BracketMatch, Player, TournamentEvent, TournamentState } from "../src/index.js";

const at = "2026-10-31T09:00:00Z";
const names = Array.from({ length: 32 }, (_, i) => `JOUEUR ${String(i + 1).padStart(2, "0")}`);
const players: Player[] = names.map((name, i) => ({
  licence: `L${i + 1}`,
  name,
  club: `Club ${i % 9}`,
  seed: i + 9,
  place: i + 9,
}));
/** Poule k : joueurs 4(k−1)+1 à 4k ; dans chaque poule, l'ordre des joueurs est l'ordre final. */
const groups = Array.from({ length: 8 }, (_, k) => names.slice(4 * k, 4 * k + 4));

function base(): TournamentState {
  return replay([
    {
      type: "tournament.created",
      at,
      payload: {
        name: "TN test",
        season: "2026-2027",
        city: "Ville",
        club: "Club",
        dates: ["2026-10-30", "2026-11-01"],
        billards: [],
        rules: DEFAULT_RULES,
      },
    },
    { type: "players.imported", at, payload: { players } },
    { type: "poules.drawn", at, payload: { phase: "QN", poules: toPoules(groups) } },
  ]);
}

function score(
  phase: "QN" | "N",
  matchId: string,
  sa: number | null,
  sb: number | null,
): TournamentEvent {
  return { type: "score.entered", at, payload: { phase, matchId, sa, sb } };
}

/** Joue toute la poule `num` : le joueur placé avant gagne 100 à `loser`. */
function playPoule(s: TournamentState, num: number, loser = 50): TournamentState {
  const p = s.poules.QN.find((x) => x.num === num);
  let out = s;
  for (const m of p?.matches ?? []) {
    const aFirst = p!.players.indexOf(m.a) < p!.players.indexOf(m.b);
    out = reduce(out, score("QN", m.id, aFirst ? 100 : loser, aFirst ? loser : 100));
  }
  return out;
}

/** Id du match entre deux joueurs d'une poule. */
function matchOf(s: TournamentState, num: number, x: string, y: string): string {
  const m = s.poules.QN.find((p) => p.num === num)?.matches.find(
    (mm) => (mm.a === x && mm.b === y) || (mm.a === y && mm.b === x),
  );
  if (!m) throw new Error(`match ${x}–${y}`);
  return m.id;
}

const r16 = (s: TournamentState, slot: number): BracketMatch | undefined =>
  s.brackets.N.find((m) => m.round === "R16" && m.slot === slot);

describe("huitièmes National progressifs", () => {
  it("couples de poules : 1–8, 7–2, 4–5, 6–3 puis symétriques", () => {
    expect(NATIONAL_R16_PAIRS).toEqual([
      [1, 8],
      [7, 2],
      [4, 5],
      [6, 3],
      [8, 1],
      [2, 7],
      [5, 4],
      [3, 6],
    ]);
  });

  it("une poule seule ne débloque rien ; les poules 1 et 8 débloquent H1 et H5", () => {
    let s = playPoule(base(), 1);
    expect(s.brackets.N).toEqual([]);
    s = playPoule(s, 8);
    expect(s.closed.QN).toBeUndefined();
    expect(s.brackets.N).toHaveLength(15);
    expect([r16(s, 1)?.a, r16(s, 1)?.b]).toEqual([groups[0]![0], groups[7]![1]]);
    expect([r16(s, 5)?.a, r16(s, 5)?.b]).toEqual([groups[7]![0], groups[0]![1]]);
    for (const slot of [2, 3, 4, 6, 7, 8]) {
      expect([r16(s, slot)?.a, r16(s, slot)?.b]).toEqual(["", ""]);
    }
    // Les libellés restent ceux du tableau réel
    expect(s.brackets.N.filter((m) => m.round === "R16").map((m) => m.labelA)).toEqual([
      "1er P1",
      "1er P7",
      "1er P4",
      "1er P6",
      "1er P8",
      "1er P2",
      "1er P5",
      "1er P3",
    ]);
  });

  it("un huitième débloqué se saisit et son vainqueur avance en quart", () => {
    let s = playPoule(playPoule(base(), 1), 8);
    s = reduce(s, score("N", "N-R16-1", 100, 70));
    expect(s.brackets.N.find((m) => m.id === "N-QF1")?.a).toBe(groups[0]![0]);
  });

  it("toutes les poules complètes : les huit huitièmes, comme à la clôture", () => {
    let s = base();
    for (let n = 1; n <= 8; n++) s = playPoule(s, n);
    const progressive = s.brackets.N;
    expect(progressive.filter((m) => m.round === "R16" && m.a && m.b)).toHaveLength(8);
    const closed = reduce(s, { type: "phase.closed", at, payload: { phase: "QN" } });
    expect(closed.brackets.N).toEqual(progressive);
    const reopened = reduce(closed, { type: "phase.reopened", at, payload: { phase: "QN" } });
    expect(reopened.closed.QN).toBeUndefined();
    expect(reopened.brackets.N).toEqual(progressive);
  });

  it("score de poule corrigé sans changer les qualifiés : huitième joué conservé", () => {
    let s = playPoule(playPoule(base(), 1), 8);
    s = reduce(s, score("N", "N-R16-1", 100, 70));
    const [a, b] = groups[0]!;
    s = reduce(s, score("QN", matchOf(s, 1, a!, b!), 100, 60));
    expect(r16(s, 1)).toMatchObject({ a: groups[0]![0], sa: 100, sb: 70 });
    expect(r16(s, 1)?.needsReview).toBeUndefined();
  });

  it("score de poule corrigé qui change les qualifiés : huitième recalculé et à vérifier", () => {
    let s = playPoule(playPoule(base(), 1), 8);
    s = reduce(s, score("N", "N-R16-5", 100, 70));
    expect(s.brackets.N.find((m) => m.id === "N-QF3")?.a).toBe(groups[7]![0]);
    // Poule 1 : le 3e bat finalement le 2e → nouveau 2e de poule 1 (adversaire de H5)
    const [, second, third] = groups[0]!;
    const id = matchOf(s, 1, second!, third!);
    const m = s.poules.QN[0]!.matches.find((x) => x.id === id)!;
    s = reduce(s, score("QN", id, m.a === second ? 50 : 100, m.a === second ? 100 : 50));
    expect(r16(s, 5)).toMatchObject({ a: groups[7]![0], b: third, sa: null, sb: null });
    expect(r16(s, 5)?.needsReview).toBe(true);
    // Le quart alimenté par H5 perd son joueur tant que H5 n'est pas rejoué
    expect(s.brackets.N.find((x) => x.id === "N-QF3")?.a).toBe("");
    // H1 (1er P1 inchangé, non joué) : pas de signalement
    expect(r16(s, 1)?.needsReview).toBeUndefined();
    s = reduce(s, score("N", "N-R16-5", 100, 80));
    expect(r16(s, 5)?.needsReview).toBeUndefined();
  });

  it("score de poule effacé : huitième joué gardé et à vérifier, huitième non joué vidé", () => {
    let s = playPoule(playPoule(base(), 1), 8);
    s = reduce(s, score("N", "N-R16-5", 100, 70));
    const [a, b] = groups[7]!;
    const id = matchOf(s, 8, a!, b!);
    const before = s.poules.QN[7]!.matches.find((x) => x.id === id)!;
    s = reduce(s, score("QN", id, null, null));
    expect(r16(s, 5)).toMatchObject({ a: groups[7]![0], sa: 100, needsReview: true });
    expect([r16(s, 1)?.a, r16(s, 1)?.b]).toEqual(["", ""]);
    // Même score ressaisi : tout revient, plus rien à vérifier
    s = reduce(s, score("QN", id, before.sa ?? 0, before.sb ?? 0));
    expect(r16(s, 5)).toMatchObject({ a: groups[7]![0], sa: 100, sb: 70 });
    expect(r16(s, 5)?.needsReview).toBeUndefined();
    expect(r16(s, 1)?.a).toBe(groups[0]![0]);
  });

  it("forfait avant le début d'une poule : la poule de 3 compte comme complète", () => {
    let s = playPoule(base(), 8);
    const ff = groups[0]![3]!;
    s = reduce(s, {
      type: "forfait.declared",
      at,
      payload: { phase: "QN", player: ff, kind: "forfait" },
    });
    const p1 = s.poules.QN[0]!;
    for (const m of p1.matches) {
      if (m.a === ff || m.b === ff) continue;
      const aFirst = p1.players.indexOf(m.a) < p1.players.indexOf(m.b);
      s = reduce(s, score("QN", m.id, aFirst ? 100 : 50, aFirst ? 50 : 100));
    }
    expect([r16(s, 1)?.a, r16(s, 5)?.b]).toEqual([groups[0]![0], groups[0]![1]]);
  });
});

import type { Billard, Player, TournamentEvent, TournamentState } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import { liveBillards, movePouleAssignments, pouleRemaining } from "./billardsLive";
import { DEFAULT_RULES, matchWinner, pouleMatches, reduce, replay } from "./engine";

const at = "2026-10-30T10:00:00.000Z";

/** 5 poules de 4 sur 4 billards : B1 (P1, P2), B2 (P3), B3 (P4), B4 3m10 (P5). */
function setup(): TournamentState {
  const billards: Billard[] = [
    { num: 1, type: "2m80" },
    { num: 2, type: "2m80" },
    { num: 3, type: "2m80" },
    { num: 4, type: "3m10" },
  ];
  const players: Player[] = Array.from({ length: 20 }, (_, i) => ({
    licence: `L${i + 1}`,
    name: `JOUEUR ${String.fromCharCode(65 + i)}`,
    club: `Club ${i % 7}`,
    seed: i + 1,
    place: i + 1,
  }));
  const poules = Array.from({ length: 5 }, (_, k) => {
    const names = players.slice(k * 4, k * 4 + 4).map((p) => p.name);
    return { num: k + 1, players: names, billards: [], matches: pouleMatches(k + 1, names) };
  });
  const events: TournamentEvent[] = [
    {
      type: "tournament.created",
      at,
      payload: {
        name: "TN test",
        season: "2026-2027",
        city: "Ville",
        club: "Club",
        dates: ["2026-10-30", "2026-11-01"],
        billards,
        rules: DEFAULT_RULES,
      },
    },
    { type: "players.imported", at, payload: { players } },
    { type: "poules.drawn", at, payload: { phase: "PREQ", poules } },
    {
      type: "billards.assigned",
      at,
      payload: { phase: "PREQ", assignments: { 1: [1], 2: [1], 3: [2], 4: [3], 5: [4] } },
    },
  ];
  return replay(events);
}

/** Saisit `n` matchs de la poule (le joueur A gagne 100 à 50). */
function play(state: TournamentState, poule: number, n: number): TournamentState {
  let s = state;
  const p = s.poules.PREQ.find((x) => x.num === poule);
  for (const m of (p?.matches ?? []).slice(0, n)) {
    s = reduce(s, {
      type: "score.entered",
      at,
      payload: { phase: "PREQ", matchId: m.id, sa: 100, sb: 50 },
    });
  }
  return s;
}

describe("vue billards en direct", () => {
  it("au départ : aucun billard libre, personne en retard", () => {
    const live = liveBillards(setup());
    expect(live.started).toBe(false);
    expect(live.billards.map((b) => [b.num, b.load, b.status])).toEqual([
      [1, 12, "occupe"],
      [2, 6, "occupe"],
      [3, 6, "occupe"],
      [4, 6, "occupe"],
    ]);
    expect(live.poules.some((p) => p.late)).toBe(false);
    expect(live.suggestions).toEqual([]);
  });

  it("billard bientôt libre (un match restant) puis libre", () => {
    let s = play(setup(), 3, 5);
    let b2 = liveBillards(s).billards.find((b) => b.num === 2);
    expect(b2?.status).toBe("bientot");
    expect(b2?.load).toBe(1);
    s = play(s, 3, 6);
    b2 = liveBillards(s).billards.find((b) => b.num === 2);
    expect(b2?.status).toBe("libre");
  });

  it("poules en retard : relatif à la moyenne des matchs restants", () => {
    let s = setup();
    for (const p of [3, 4, 5]) s = play(s, p, 6);
    const live = liveBillards(s);
    // Restants : P1 6, P2 6, P3 0, P4 0, P5 0 → moyenne 2,4
    expect(live.average).toBeCloseTo(2.4);
    expect(live.poules.filter((p) => p.late).map((p) => p.num)).toEqual([1, 2]);
  });

  it("propose de déplacer une poule d'un billard chargé vers un billard libre du même format", () => {
    let s = setup();
    for (const p of [3, 5]) s = play(s, p, 6);
    s = play(s, 1, 2);
    const live = liveBillards(s);
    // B2 libre (2m80) : une poule de B1 (2 poules, 10 matchs) ; B4 libre (3m10) : aucune poule
    // de même format à déplacer.
    expect(live.suggestions).toEqual([{ poule: 2, from: [1], to: 2, type: "2m80", late: true }]);
  });

  it("pas de déplacement si la poule est seule sur son billard", () => {
    let s = setup();
    s = play(s, 1, 6);
    s = play(s, 2, 6);
    const live = liveBillards(s);
    expect(live.billards.find((b) => b.num === 1)?.status).toBe("libre");
    expect(live.suggestions).toEqual([]);
  });

  it("déplacement : affectation complète, la poule change de billard", () => {
    let s = setup();
    for (const p of [3, 5]) s = play(s, p, 6);
    const assignments = movePouleAssignments(s, "PREQ", 2, 2);
    expect(assignments).toEqual({ 1: [1], 2: [2], 3: [2], 4: [3], 5: [4] });
    s = reduce(s, { type: "billards.assigned", at, payload: { phase: "PREQ", assignments } });
    const live = liveBillards(s);
    expect(live.billards.find((b) => b.num === 1)?.poules.map((p) => p.num)).toEqual([1]);
    expect(live.billards.find((b) => b.num === 2)?.poules.map((p) => p.num)).toEqual([2, 3]);
    expect(live.suggestions).toEqual([]);
  });

  it("matchs restants : les matchs d'un joueur forfait ne comptent pas", () => {
    let s = setup();
    const p1 = s.poules.PREQ[0];
    s = reduce(s, {
      type: "forfait.declared",
      at,
      payload: { phase: "PREQ", player: p1?.players[3] ?? "", kind: "forfait" },
    });
    expect(pouleRemaining(s, "PREQ", s.poules.PREQ[0]!)).toEqual({ total: 3, remaining: 3 });
    const m = s.poules.PREQ[0]?.matches[0];
    expect(m && matchWinner(m, DEFAULT_RULES.distances.preq)).toBeNull();
  });
});

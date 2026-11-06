/**
 * Réducteur : rejeu d'une séquence created → imported → drawn → scores → closed PREQ, puis
 * enchaînement jusqu'aux tableaux du dimanche.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_RULES,
  initialState,
  phaseComplete,
  phaseRanking,
  reduce,
  replay,
  serpentin,
  toLiveJson,
  toPoules,
} from "../src/index.js";
import type {
  Billard,
  Match,
  Player,
  Poule,
  TournamentEvent,
  TournamentState,
} from "../src/index.js";

interface Fixture {
  tournament: { name: string; season: string; city: string; club: string; dates: [string, string] };
  billards: Billard[];
  players: Player[];
  poules: { num: number; billards: number[]; players: string[]; matches: Omit<Match, "id">[] }[];
  barrages: { m: string; a: string; b: string; sa: number; sb: number }[];
}

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(here, "fixtures", "tn-exemple.json"), "utf8"),
) as Fixture;
const at = "2026-10-30T10:00:00Z";

/** Poules PREQ tirées à partir des joueurs 9 à 76 (sans scores). */
const drawn: Poule[] = toPoules(
  serpentin(
    fixture.players.slice(8).map((p) => p.name),
    DEFAULT_RULES.maxPoulesOf3,
  ),
);

/** Événements de score reproduisant les résultats de la fixture sur les matchs générés. */
function preqScores(state: TournamentState): TournamentEvent[] {
  const events: TournamentEvent[] = [];
  for (const fp of fixture.poules) {
    const poule = state.poules.PREQ.find((p) => p.num === fp.num);
    if (!poule) throw new Error(`poule ${fp.num}`);
    for (const fm of fp.matches) {
      const m = poule.matches.find(
        (x) => (x.a === fm.a && x.b === fm.b) || (x.a === fm.b && x.b === fm.a),
      );
      if (!m) throw new Error(`match ${fm.a}-${fm.b}`);
      const swap = m.a !== fm.a;
      events.push({
        type: "score.entered",
        at,
        payload: {
          phase: "PREQ",
          matchId: m.id,
          sa: swap ? fm.sb : fm.sa,
          sb: swap ? fm.sa : fm.sb,
        },
      });
    }
  }
  return events;
}

const setup: TournamentEvent[] = [
  {
    type: "tournament.created",
    at,
    payload: { ...fixture.tournament, billards: fixture.billards, rules: DEFAULT_RULES },
  },
  { type: "players.imported", at, payload: { players: fixture.players } },
  { type: "poules.drawn", at, payload: { phase: "PREQ", poules: drawn } },
];

describe("réducteur : vendredi", () => {
  const afterDraw = replay(setup);

  it("initialise info, billards, joueurs et préqualifiés Masters", () => {
    expect(afterDraw.info?.name).toBe("TN 2");
    expect(afterDraw.billards).toHaveLength(11);
    expect(afterDraw.players).toHaveLength(76);
    expect(afterDraw.masters).toEqual(fixture.players.slice(0, 8).map((p) => p.name));
    expect(afterDraw.poules.PREQ).toHaveLength(17);
    expect(afterDraw.poules.PREQ[0]?.matches).toHaveLength(6);
  });

  it("ne mute jamais l'état reçu", () => {
    const before = JSON.stringify(afterDraw);
    const ev = preqScores(afterDraw)[0];
    if (!ev) throw new Error("event");
    const after = reduce(afterDraw, ev);
    expect(JSON.stringify(afterDraw)).toBe(before);
    expect(after).not.toBe(afterDraw);
    expect(after.poules.PREQ[0]?.matches[0]?.sa).not.toBeNull();
  });

  it("ignore les événements sur une phase ou un match inconnus", () => {
    const s1 = reduce(afterDraw, {
      type: "score.entered",
      at,
      payload: { phase: "QN", matchId: "P1-M1", sa: 100, sb: 1 },
    });
    expect(s1).toBe(afterDraw);
    const s2 = reduce(afterDraw, {
      type: "arbitre.set",
      at,
      payload: { phase: "PREQ", matchId: "P99-M1", licence: "X" },
    });
    expect(s2).toBe(afterDraw);
  });

  const scored = preqScores(afterDraw).reduce(reduce, afterDraw);
  const abandon = "CLEMENT GILLES";
  const withForfait = reduce(scored, {
    type: "forfait.declared",
    at,
    payload: { phase: "PREQ", player: abandon, kind: "abandon" },
  });

  it("fermer PREQ dérive les 8 barrages (1–16, 2–15…) avec les billards tirés", () => {
    expect(phaseComplete(withForfait, "PREQ")).toBe(true);
    const assigned = reduce(withForfait, {
      type: "billards.assigned",
      at,
      payload: { phase: "B", assignments: { B1: [4], B2: [3] } },
    });
    const closed = reduce(assigned, { type: "phase.closed", at, payload: { phase: "PREQ" } });
    expect(closed.closed.PREQ).toBe(true);
    expect(closed.barrages).toHaveLength(8);
    const expected = [...fixture.barrages].sort((x, y) => x.m.localeCompare(y.m));
    expect(closed.barrages.map((m) => [m.id, m.a, m.b])).toEqual(
      expected.map((b) => [b.m, b.a, b.b]),
    );
    expect(closed.barrages[0]?.billard).toBe(4);
    expect(closed.barrages[2]?.billard).toBeUndefined();
    // Fermer deux fois ne change rien.
    expect(reduce(closed, { type: "phase.closed", at, payload: { phase: "PREQ" } })).toBe(closed);
    // Rouvrir efface les barrages.
    const reopened = reduce(closed, { type: "phase.reopened", at, payload: { phase: "PREQ" } });
    expect(reopened.closed.PREQ).toBeUndefined();
    expect(reopened.barrages).toEqual([]);
    expect(reopened.billardAssignments.B).toEqual({ B1: [4], B2: [3] });
  });

  it("enchaîne barrages → poules du samedi → tableaux → finales", () => {
    let s = reduce(withForfait, { type: "phase.closed", at, payload: { phase: "PREQ" } });
    expect(phaseComplete(s, "B")).toBe(false);
    for (const b of fixture.barrages) {
      s = reduce(s, {
        type: "score.entered",
        at,
        payload: { phase: "B", matchId: b.m, sa: b.sa, sb: b.sb },
      });
    }
    expect(phaseComplete(s, "B")).toBe(true);
    s = reduce(s, { type: "phase.closed", at, payload: { phase: "B" } });
    expect(s.poules.QM).toHaveLength(4);
    expect(s.poules.QN).toHaveLength(8);
    expect(s.poules.QM.flatMap((p) => p.players)).toContain("CHAUVIN THIERRY");
    expect(s.poules.QN.flatMap((p) => p.players)).toContain("ROUSSEL JULIE");
    expect(s.poules.QM[0]?.matches[0]?.id).toBe("P1-M1");

    // Samedi : le joueur en tête de poule gagne tout (QN en 1 set, QM en 2 sets gagnants).
    const playAll = (state: TournamentState, phase: "QN" | "QM"): TournamentState => {
      let out = state;
      for (const p of state.poules[phase]) {
        for (const m of p.matches) {
          const aWins = p.players.indexOf(m.a) < p.players.indexOf(m.b);
          const payload =
            phase === "QN"
              ? { phase, matchId: m.id, sa: aWins ? 100 : 40, sb: aWins ? 40 : 100 }
              : {
                  phase,
                  matchId: m.id,
                  sa: aWins ? 2 : 0,
                  sb: aWins ? 0 : 2,
                  setsA: aWins ? [60, 60] : [10, 10],
                  setsB: aWins ? [10, 10] : [60, 60],
                };
          out = reduce(out, { type: "score.entered", at, payload });
        }
      }
      return out;
    };
    s = playAll(s, "QN");
    s = playAll(s, "QM");
    expect(phaseComplete(s, "QN")).toBe(true);
    expect(phaseComplete(s, "QM")).toBe(true);
    expect(phaseRanking(s, "QM")[0]?.ptm).toBe(6);
    s = reduce(s, { type: "phase.closed", at, payload: { phase: "QN" } });
    s = reduce(s, { type: "phase.closed", at, payload: { phase: "QM" } });
    expect(s.brackets.N).toHaveLength(15);
    expect(s.brackets.M).toHaveLength(7);
    const r16 = s.brackets.N.find((m) => m.id === "N-R16-1");
    expect(r16).toMatchObject({
      a: s.poules.QN[0]?.players[0],
      b: s.poules.QN[7]?.players[1],
      labelA: "1er P1",
    });
    expect(s.brackets.M.find((m) => m.id === "M-QF1")?.a).toBe(s.poules.QM[0]?.players[0]);

    // Dimanche : huitièmes en 1 set, puis 3 sets gagnants ; le joueur A gagne toujours.
    const playBracket = (state: TournamentState, phase: "N" | "M"): TournamentState => {
      let out = state;
      for (let i = 0; i < 6; i++) {
        for (const m of out.brackets[phase]) {
          if (m.sa !== null || m.a === "" || m.b === "") continue;
          const d = phase === "N" && m.round === "R16" ? { sa: 100, sb: 30 } : { sa: 3, sb: 1 };
          out = reduce(out, { type: "score.entered", at, payload: { phase, matchId: m.id, ...d } });
        }
      }
      return out;
    };
    s = playBracket(s, "N");
    s = playBracket(s, "M");
    expect(phaseComplete(s, "N")).toBe(true);
    expect(phaseComplete(s, "M")).toBe(true);
    const finalN = s.brackets.N.find((m) => m.id === "N-F");
    expect(finalN?.a).toBe(s.poules.QN[0]?.players[0]);
    expect(s.brackets.M.find((m) => m.id === "M-F")?.a).toBe(s.poules.QM[0]?.players[0]);

    // Arbitre et forfait sur un tableau.
    s = reduce(s, {
      type: "arbitre.set",
      at,
      payload: { phase: "N", matchId: "N-F", licence: "123456A" },
    });
    expect(s.brackets.N.find((m) => m.id === "N-F")?.arbitre).toBe("123456A");
    // Deux arbitres par match (slot 2), licence vide = effacement ; sans slot = arbitre 1.
    s = reduce(s, {
      type: "arbitre.set",
      at,
      payload: { phase: "N", matchId: "N-F", licence: " 654321B ", slot: 2 },
    });
    expect(s.brackets.N.find((m) => m.id === "N-F")).toMatchObject({
      arbitre: "123456A",
      arbitre2: "654321B",
    });
    const cleared = reduce(s, {
      type: "arbitre.set",
      at,
      payload: { phase: "N", matchId: "N-F", licence: "", slot: 1 },
    });
    expect(cleared.brackets.N.find((m) => m.id === "N-F")).toMatchObject({
      arbitre: null,
      arbitre2: "654321B",
    });

    // Consolante : places ≥ 41 volontaires.
    const volunteers = phaseRanking(s, "PREQ")
      .filter((r) => r.place >= 41)
      .map((r) => r.name)
      .slice(0, 12);
    s = reduce(s, { type: "consolante.created", at, payload: { players: volunteers } });
    expect(s.brackets.CLS.filter((m) => m.round === "R16")).toHaveLength(4);
    expect(s.brackets.CLS.find((m) => m.id === "CLS-F")).toBeDefined();
    const pending = s.brackets.CLS.find((m) => m.round === "R16");
    if (!pending) throw new Error("pending");
    s = reduce(s, {
      type: "forfait.declared",
      at,
      payload: { phase: "CLS", player: pending.a, kind: "forfait" },
    });
    expect(s.brackets.CLS.find((m) => m.id === pending.id)?.forfait).toBe("a");
    const qf = s.brackets.CLS.find(
      (m) => m.round === "QF" && m.slot === Math.ceil(pending.slot / 2),
    );
    expect(qf?.[pending.slot % 2 === 1 ? "a" : "b"]).toBe(pending.b);

    // Rouvrir B efface le samedi et le dimanche.
    const reopened = reduce(s, { type: "phase.reopened", at, payload: { phase: "B" } });
    expect(reopened.poules.QN).toEqual([]);
    expect(reopened.brackets.N).toEqual([]);
    expect(reopened.closed.QN).toBeUndefined();
    expect(reopened.brackets.CLS).toHaveLength(s.brackets.CLS.length);

    // Export JSON public.
    const live = toLiveJson(s);
    expect(live.tournoi).toBe("TN 2");
    expect(live.infos.joueurs).toHaveLength(68);
    expect(live.competitions.map((c) => c.nom)).toEqual(["PRE Q", "N1 Q", "M Q", "N1 KO", "M KO"]);
    expect(live.competitions[0]?.classement[0]?.[1]).toBe("KLEIN ÉMILIE");
    expect(live.competitions[3]?.poules.map((p) => p.nom)).toEqual(["R16", "QF", "SF", "F"]);
  });
});

describe("réducteur : état initial", () => {
  it("rejoue un journal vide", () => {
    const s = replay([]);
    expect(s).toEqual(initialState());
    expect(s.rules).toEqual(DEFAULT_RULES);
    expect(s.rules).not.toBe(DEFAULT_RULES);
  });
});

import type { Poule, TournamentEvent } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import { DEMO, demoAbandon, demoEvents, demoPreqScore } from "./demo";
import { clubOf, pouleMatches, replay, resolveClubConflicts, serpentin } from "./engine";
import { preqRanking } from "./tournament";

const stamp = (e: ReturnType<typeof demoEvents>[number]): TournamentEvent =>
  ({ ...e, at: "2026-10-29T10:00:00Z" }) as TournamentEvent;

describe("tournoi d'exemple", () => {
  it("reproduit les poules, le classement et les barrages de l'outil de référence", () => {
    let state = replay(demoEvents().map(stamp));
    expect(state.players).toHaveLength(76);
    expect(state.masters).toHaveLength(8);
    const field = state.players.slice(8).map((p) => p.name);
    const { poules: groups, unresolved } = resolveClubConflicts(serpentin(field, 3), clubOf(state));
    expect(unresolved).toEqual([]);
    const poules: Poule[] = groups.map((players, i) => ({
      num: i + 1,
      players,
      billards: [],
      matches: pouleMatches(i + 1, players),
    }));
    poules.forEach((p, i) => expect(p.players).toEqual(DEMO.poules[i]?.players));
    const events: TournamentEvent[] = [
      ...demoEvents().map(stamp),
      stamp({ type: "poules.drawn", payload: { phase: "PREQ", poules } }),
    ];
    for (const p of poules)
      for (const m of p.matches) {
        const s = demoPreqScore(m);
        expect(s).not.toBeNull();
        if (s)
          events.push(
            stamp({ type: "score.entered", payload: { phase: "PREQ", matchId: m.id, ...s } }),
          );
      }
    const abandon = demoAbandon();
    expect(abandon).toBeTruthy();
    if (abandon)
      events.push(
        stamp({
          type: "forfait.declared",
          payload: { phase: "PREQ", player: abandon, kind: "abandon" },
        }),
      );
    events.push(stamp({ type: "phase.closed", payload: { phase: "PREQ" } }));
    state = replay(events);
    const ranking = preqRanking(state);
    expect(ranking.map((r) => r.name)).toEqual(DEMO.expectedPhaseRanking.map((r) => r.name));
    expect(state.barrages).toHaveLength(8);
    for (const b of state.barrages) {
      const real = DEMO.barrages.find((x) => x.m === b.id);
      expect([real?.a, real?.b].sort()).toEqual([b.a, b.b].sort());
    }
    expect(state.barrages.every((b) => b.billard)).toBe(true);
  });
});

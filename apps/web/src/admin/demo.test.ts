import type { TournamentEvent } from "@pilot5q/domain";
import { rankingRows, replay } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import inscriptions from "@/data/tn-exemple-inscriptions.json";
import { DEMO } from "@/lib/demo";

import { SEASON_FIXTURE, demoSeason, type DemoInscription } from "./demo";
import { compareWithReference, isAfterReference } from "./Ranking";
import { realWeekendEvents } from "./realWeekend";
import {
  closeStage,
  openingEvents,
  reopenStage,
  stageAcceptance,
  tournamentAwards,
  tournamentFinished,
} from "./stage";

const order = (inscriptions as { registrations: DemoInscription[] }).registrations;

describe("saison de démonstration", () => {
  it("la liste ordonnée du TN 2 (classement avant TN 2 + base joueurs) est celle du tournoi d'exemple", () => {
    const doc = demoSeason(order);
    const stage = doc.stages.find((s) => s.number === 2);
    expect(stage).toBeDefined();
    if (!stage) return;
    const a = stageAcceptance(doc, stage);
    expect(a.capacity).toBe(96);
    expect(a.waiting).toHaveLength(0);
    expect(a.accepted.map((p) => p.name)).toEqual(DEMO.players.map((p) => p.name));
  });
});

describe("preuve de bout en bout : TN 2 joué dans le cockpit puis clôturé", () => {
  it("le classement glissant devient celui « après TN 2 » du classeur de référence", () => {
    const doc = demoSeason(order);
    const stage = doc.stages.find((s) => s.number === 2);
    if (!stage) throw new Error("TN 2 absent");
    const accepted = stageAcceptance(doc, stage).accepted;
    const at = "2026-10-29T10:00:00Z";
    const opening = openingEvents(doc, stage, accepted).map(
      (e) => ({ ...e, at }) as TournamentEvent,
    );
    const rest = realWeekendEvents(opening).map((e) => ({ ...e, at }) as TournamentEvent);
    const state = replay([...opening, ...rest]);
    expect(tournamentFinished(state)).toBe(true);
    const awards = tournamentAwards(state);
    expect(awards).toHaveLength(76);
    const closed = closeStage(doc, stage, awards, doc.juniors, at);
    const rows = rankingRows(closed.ranking);
    // Mêmes 129 joueurs, mêmes points du barème ; seules les décimales des joueurs du National
    // mal comptés par l'outil Excel (matchs des poules National 2 à 8) diffèrent.
    expect(isAfterReference(rows)).toBe(true);
    const c = compareWithReference(rows);
    expect(c.received).toBe(SEASON_FIXTURE.expectedAfter.length);
    expect(c.identical + c.decimalOnly.length).toBe(c.expected);
    for (const d of c.decimalOnly) expect(Math.abs(d.got - d.expected)).toBeLessThan(0.01);
    // Joueurs classés 1er à 4e des poules National 2 à 8 : au plus 28.
    expect(c.decimalOnly.length).toBeLessThanOrEqual(28);
    expect(c.samePosition).toBeGreaterThanOrEqual(c.expected - 6);
    // Avec les cumuls de l'outil Excel (test du domaine season.test.ts), l'égalité est exacte.
    // La base joueurs suit : classement en cours = place après TN 2.
    const first = closed.players.find((p) => p.name === rows[0]?.name);
    expect(first?.currentPlace).toBe(1);
    expect(first?.lastSeason).toBe("2026-2027");
    // Annuler la clôture rend la fenêtre et la base d'avant.
    const reopened = reopenStage(closed, stage);
    expect(reopened.ranking).toBe(doc.ranking);
    expect(reopened.players).toBe(doc.players);
  });
});

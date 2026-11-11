import type { TournamentEvent } from "@pilot5q/domain";
import { rankingRows, replay } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import inscriptions from "@/data/tn-exemple-inscriptions.json";
import { DEMO } from "@/lib/demo";

import { DEMO_LEFT_STAGE, SEASON_FIXTURE, demoSeason, type DemoInscription } from "./demo";
import { compareWithReference, isAfterReference } from "./reference";
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

  it("le classement « avant TN 2 » rend à chaque inscrit sa place connue à l'inscription", () => {
    const doc = demoSeason(order);
    const rows = rankingRows(doc.ranking);
    const position = new Map(rows.map((r) => [r.name, r.position]));
    expect(order).toHaveLength(76);
    expect(order.filter((i) => i.currentPlace !== null)).toHaveLength(68);
    for (const i of order) {
      // Un inscrit sans classement à l'inscription n'est pas classé.
      expect(position.get(i.name) ?? null, i.name).toBe(i.currentPlace);
    }
    // La base joueurs porte les mêmes places que le classement affiché.
    for (const p of doc.players) {
      expect(p.currentPlace, p.name).toBe(position.get(p.name) ?? null);
    }
    // Un classement identique à chaque chargement (rien d'aléatoire, rien de résiduel).
    expect(rankingRows(demoSeason(order).ranking).map((r) => [r.name, r.pts])).toEqual(
      rows.map((r) => [r.name, r.pts]),
    );
  });

  it("le TN simulé (TN 2 2025-2026) ressemble à un tournoi : barème respecté, 100 joueurs au plus", () => {
    const doc = demoSeason(order);
    const simulated = doc.ranking.flatMap((e) =>
      e.results.filter((r) => r.season === DEMO_LEFT_STAGE.season && r.tn === DEMO_LEFT_STAGE.tn),
    );
    expect(simulated.length).toBeGreaterThan(60);
    expect(simulated.length).toBeLessThanOrEqual(100);
    const count = (base: number) => simulated.filter((r) => Math.floor(r.pts) === base).length;
    // Un vainqueur et un finaliste Masters, deux demi-finalistes, quatre quarts au plus.
    expect(count(80)).toBe(1);
    expect(count(54)).toBe(1);
    expect(count(38)).toBe(2);
    expect(count(26)).toBeLessThanOrEqual(4);
    expect(count(25)).toBeLessThanOrEqual(1);
    // Le classeur ne contient que 4 TN par joueur : seuls ces points-là sont simulés.
    const windowTotal = SEASON_FIXTURE.windowBefore.reduce((a, e) => a + e.results.length, 0);
    expect(doc.ranking.reduce((a, e) => a + e.results.length, 0)).toBe(
      windowTotal + simulated.length,
    );
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

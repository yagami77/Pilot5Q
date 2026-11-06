/**
 * Logique d'une étape (fonctions pures) : liste ordonnée et liste d'attente à partir des
 * inscrits, journal d'ouverture du tournoi pour le club hôte, clôture et points.
 */
import type {
  Player,
  RankingEntry,
  Registration,
  Rules,
  Stage,
  TournamentAward,
  TournamentState,
} from "@pilot5q/domain";
import {
  DEFAULT_RULES,
  acceptRegistrations,
  applyTournament,
  awardsFromRanking,
  capacityFor,
  currentPlaces,
  finalRanking,
  lastKnownPlaces,
  markLegacyIntegrations,
  rankingRows,
  updatePlayerBase,
  type Acceptance,
} from "@pilot5q/domain";

import { drawPreqBillards } from "@/lib/draw";
import { pouleSizes } from "@/lib/engine";
import { drawLaterPhaseEvents, makeBillards } from "@/lib/setup";
import type { EventInput } from "@/store/tournament";

import type { SeasonDocument, StageClosure } from "./persistence";

/** Inscrits d'une étape, drapeau U21 de la saison appliqué. */
export function stageRegistrations(doc: SeasonDocument, stage: Stage): Registration[] {
  const juniors = new Set(doc.juniors);
  return (doc.registrations[stage.id]?.registrations ?? []).map((r) => ({
    ...r,
    junior: r.junior || juniors.has(r.licence),
  }));
}

/** Capacité de l'étape (billards × 8 + 8, plafonnée). */
export function stageCapacity(doc: SeasonDocument, stage: Stage): number {
  return capacityFor(stage.big + stage.small, doc.settings);
}

/** Acceptés (liste ordonnée), liste d'attente et forfaits d'une étape. */
export function stageAcceptance(doc: SeasonDocument, stage: Stage): Acceptance {
  return acceptRegistrations(
    stageRegistrations(doc, stage),
    stageCapacity(doc, stage),
    currentPlaces(doc.players),
    lastKnownPlaces(doc.players),
    doc.settings.waitlistPriority,
  );
}

/**
 * Données enregistrées avant la liste d'attente manuelle (un forfait y intégrait automatiquement
 * le premier en attente) : ces intégrations sont marquées pour que les acceptés ne changent pas.
 */
export function migrateSeason(doc: SeasonDocument): SeasonDocument {
  let changed = false;
  const registrations = { ...doc.registrations };
  for (const [id, regs] of Object.entries(doc.registrations)) {
    if (regs.manualWaitlist) continue;
    changed = true;
    const stage = doc.stages.find((s) => s.id === id);
    registrations[id] = {
      ...regs,
      manualWaitlist: true,
      registrations: stage
        ? markLegacyIntegrations(
            stageRegistrations(doc, stage),
            stageCapacity(doc, stage),
            currentPlaces(doc.players),
            lastKnownPlaces(doc.players),
            doc.settings.waitlistPriority,
          ).map((r, i) => ({ ...r, junior: regs.registrations[i]?.junior ?? r.junior }))
        : regs.registrations,
    };
  }
  return changed ? { ...doc, registrations } : doc;
}

/**
 * Valeurs dérivées enregistrées avec l'étape après une modification des inscrits : nombre d'U21
 * parmi les acceptés (stocké avec le TN pour les primes et la feuille de pointage).
 */
export function withStageDerived(doc: SeasonDocument, stageId: string): SeasonDocument {
  const stage = doc.stages.find((s) => s.id === stageId);
  if (!stage) return doc;
  const juniorCount = stageAcceptance(doc, stage).accepted.filter((p) => p.junior).length;
  if (stage.juniorCount === juniorCount) return doc;
  return {
    ...doc,
    stages: doc.stages.map((s) => (s.id === stageId ? { ...s, juniorCount } : s)),
  };
}

/** Paramètres du tournoi déduits de ceux de la saison. */
export function stageRules(doc: SeasonDocument): Rules {
  return {
    ...DEFAULT_RULES,
    distances: doc.settings.distances,
    consolanteMinSmallTables: doc.settings.consolanteMinSmallTables,
    inscriptionFee: doc.settings.inscriptionFee,
  };
}

/** Journal initial du tournoi ouvert pour le club hôte (SPEC §2, §3). */
export function openingEvents(
  doc: SeasonDocument,
  stage: Stage,
  players: Player[],
  random?: () => number,
): EventInput[] {
  const billards = makeBillards(stage.big, stage.small);
  const rules = stageRules(doc);
  const club = doc.clubs.find((c) => c.id === stage.clubId);
  const count = pouleSizes(
    Math.max(0, players.length - rules.mastersPrequalified),
    rules.maxPoulesOf3,
  ).length;
  return [
    {
      type: "tournament.created",
      payload: {
        name: stage.name,
        season: stage.season,
        city: stage.city,
        club: club?.name ?? stage.city,
        dates: [stage.start, stage.end],
        billards,
        rules,
      },
    },
    { type: "players.imported", payload: { players } },
    {
      type: "billards.assigned",
      payload: { phase: "PREQ", assignments: drawPreqBillards(count, billards, random) },
    },
    ...drawLaterPhaseEvents(billards, random),
  ];
}

/** Le tournoi est-il terminé (finales Masters et National jouées) ? */
export function tournamentFinished(state: TournamentState): boolean {
  const done = (phase: "N" | "M") => {
    const b = state.brackets[phase];
    const f = b.find((m) => m.round === "F");
    return Boolean(f && f.sa !== null && f.sb !== null && f.a !== "" && f.b !== "");
  };
  return done("N") && done("M");
}

/** Points attribués à l'issue du tournoi (classement final du moteur, SPEC §7). */
export function tournamentAwards(state: TournamentState): TournamentAward[] {
  const identity: Record<string, { licence: string; club: string }> = {};
  for (const p of state.players) identity[p.name] = { licence: p.licence, club: p.club };
  return awardsFromRanking(finalRanking(state), identity);
}

/** Clôture : intègre les points dans la fenêtre glissante et met à jour la base joueurs. */
export function closeStage(
  doc: SeasonDocument,
  stage: Stage,
  awards: TournamentAward[],
  juniors: string[],
  now: string,
): SeasonDocument {
  const rankingBefore: RankingEntry[] = doc.ranking;
  const ranking = applyTournament(doc.ranking, awards, { season: stage.season, tn: stage.number });
  const rows = rankingRows(ranking);
  const junior = new Set(juniors);
  const players = updatePlayerBase(
    doc.players,
    rows,
    stage.season,
    awards.map((a) => ({
      licence: a.licence,
      name: a.name,
      club: a.club,
      junior: junior.has(a.licence),
    })),
  );
  const closure: StageClosure = {
    stageId: stage.id,
    closedAt: now,
    awards,
    rankingBefore,
    playersBefore: doc.players,
    rankedAfter: rows.length,
  };
  return {
    ...doc,
    ranking,
    players,
    closures: { ...doc.closures, [stage.id]: closure },
    stages: doc.stages.map((s) => (s.id === stage.id ? { ...s, closedAt: now } : s)),
  };
}

/** Annule une clôture (pour corriger) : fenêtre et base joueurs reviennent à leur état d'avant. */
export function reopenStage(doc: SeasonDocument, stage: Stage): SeasonDocument {
  const closure = doc.closures[stage.id];
  if (!closure) return doc;
  const closures = { ...doc.closures };
  delete closures[stage.id];
  return {
    ...doc,
    ranking: closure.rankingBefore,
    players: closure.playersBefore ?? doc.players,
    closures,
    stages: doc.stages.map((s) => (s.id === stage.id ? { ...s, closedAt: null } : s)),
  };
}

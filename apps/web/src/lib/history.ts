/**
 * Historique lisible du journal : ce que le bouton « Annuler » annulerait.
 * Chaque événement est décrit en une ligne courte (« Score 100–64 · poule 3 »).
 */
import type { PhaseId, TournamentEvent } from "@pilot5q/domain";

import { shortName } from "./format";

const PHASE_NAMES: Record<PhaseId, string> = {
  PREQ: "préqualifications",
  B: "barrages",
  QN: "poules National",
  QM: "poules Masters",
  N: "tableau National",
  M: "tableau Masters",
  CLS: "consolante",
};

export function phaseName(phase: PhaseId): string {
  return PHASE_NAMES[phase];
}

/** Lieu d'un match à partir de son identifiant (« P3-M2 » → « poule 3 »). */
export function matchPlace(phase: PhaseId, matchId: string): string {
  const poule = /^P(\d+)-M\d+$/.exec(matchId);
  if (poule) {
    const n = poule[1];
    return phase === "PREQ"
      ? `poule ${n}`
      : phase === "QM"
        ? `poule Masters ${n}`
        : `poule National ${n}`;
  }
  if (phase === "B") return `barrage ${matchId}`;
  const round = /(R64|R32|R16|QF|SF|F)-?(\d*)$/.exec(matchId);
  const roundName: Record<string, string> = {
    R64: "32e",
    R32: "16e",
    R16: "8e",
    QF: "quart",
    SF: "demie",
    F: "finale",
  };
  const where = phase === "M" ? "Masters" : phase === "N" ? "National" : "consolante";
  if (round) {
    const r = roundName[round[1] ?? ""] ?? "";
    return `${r}${round[2] && round[1] !== "F" ? ` ${round[2]}` : ""} ${where}`;
  }
  return `${matchId} ${where}`;
}

/** Description courte d'un événement. */
export function describeEvent(e: TournamentEvent): string {
  switch (e.type) {
    case "tournament.created":
      return "Création du tournoi";
    case "players.imported":
      return "Import des inscrits";
    case "billards.assigned":
      return `Billards · ${phaseName(e.payload.phase)}`;
    case "poules.drawn":
      return e.payload.phase === "PREQ"
        ? "Tirage des poules du vendredi"
        : `Composition · ${phaseName(e.payload.phase)}`;
    case "score.entered": {
      const { sa, sb, phase, matchId } = e.payload;
      const where = matchPlace(phase, matchId);
      if (sa === null && sb === null) return `Score effacé · ${where}`;
      return `Score ${sa ?? "?"}–${sb ?? "?"} · ${where}`;
    }
    case "forfait.declared":
      return `${e.payload.kind === "abandon" ? "Abandon" : "Forfait"} de ${shortName(e.payload.player)}`;
    case "phase.closed":
      return `Classement · ${phaseName(e.payload.phase)}`;
    case "phase.reopened":
      return `Réouverture · ${phaseName(e.payload.phase)}`;
    case "consolante.created":
      return `Création de la consolante (${e.payload.players.length} joueurs)`;
    case "arbitre.set":
      return `Arbitre ${e.payload.slot ?? 1} · ${matchPlace(e.payload.phase, e.payload.matchId)}`;
    default:
      return "Action";
  }
}

export interface HistoryEntry {
  /** Index dans le journal. */
  index: number;
  at: string;
  label: string;
}

/** Dernières actions annulables, la plus récente en premier. */
export function undoableHistory(
  events: TournamentEvent[],
  protectedTypes: TournamentEvent["type"][],
  limit = 12,
): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (let i = events.length - 1; i >= 0 && out.length < limit; i--) {
    const e = events[i]!;
    if (protectedTypes.includes(e.type)) break;
    out.push({ index: i, at: e.at, label: describeEvent(e) });
  }
  return out;
}

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
    case "tournament.closed":
      return "Clôture du tournoi";
    case "tournament.reopened":
      return "Réouverture du tournoi";
    default:
      return "Action";
  }
}

/** Nature d'une action, pour l'icône et le résumé d'une annulation. */
export type EventKind =
  | "score"
  | "classement"
  | "tirage"
  | "billards"
  | "forfait"
  | "consolante"
  | "arbitre"
  | "cloture"
  | "autre";

export function eventKind(e: TournamentEvent): EventKind {
  switch (e.type) {
    case "score.entered":
      return "score";
    case "phase.closed":
    case "phase.reopened":
      return "classement";
    case "poules.drawn":
      return "tirage";
    case "billards.assigned":
      return "billards";
    case "forfait.declared":
      return "forfait";
    case "consolante.created":
      return "consolante";
    case "arbitre.set":
      return "arbitre";
    case "tournament.closed":
    case "tournament.reopened":
      return "cloture";
    default:
      return "autre";
  }
}

export type Journee = "Jeudi" | "Vendredi" | "Samedi" | "Dimanche";

const PHASE_DAY: Record<PhaseId, Journee> = {
  PREQ: "Vendredi",
  B: "Vendredi",
  QN: "Samedi",
  QM: "Samedi",
  CLS: "Samedi",
  N: "Dimanche",
  M: "Dimanche",
};

/** Journée à laquelle une action appartient par nature (null : celle de l'action précédente). */
function naturalDay(e: TournamentEvent): Journee | null {
  switch (e.type) {
    case "score.entered":
    case "phase.closed":
    case "phase.reopened":
    case "arbitre.set":
      return PHASE_DAY[e.payload.phase];
    case "poules.drawn":
      return e.payload.phase === "PREQ" ? "Jeudi" : null;
    case "tournament.closed":
    case "tournament.reopened":
      return "Dimanche";
    default:
      return null;
  }
}

export interface HistoryEntry {
  /** Index dans le journal. */
  index: number;
  at: string;
  label: string;
  kind: EventKind;
  /** Journée du tournoi (les billards et la consolante suivent l'action qui les précède). */
  day: Journee;
}

/** Actions annulables, la plus récente en premier (toutes par défaut). */
export function undoableHistory(
  events: TournamentEvent[],
  protectedTypes: TournamentEvent["type"][],
  limit = Number.POSITIVE_INFINITY,
): HistoryEntry[] {
  // Journée de chaque action, dans l'ordre du journal
  const days: Journee[] = [];
  let running: Journee = "Jeudi";
  for (const e of events) {
    running = naturalDay(e) ?? running;
    days.push(running);
  }
  const out: HistoryEntry[] = [];
  for (let i = events.length - 1; i >= 0 && out.length < limit; i--) {
    const e = events[i]!;
    if (protectedTypes.includes(e.type)) break;
    out.push({
      index: i,
      at: e.at,
      label: describeEvent(e),
      kind: eventKind(e),
      day: days[i] ?? "Jeudi",
    });
  }
  return out;
}

const KIND_WORDS: Record<EventKind, [string, string]> = {
  score: ["score", "scores"],
  classement: ["classement", "classements"],
  tirage: ["tirage ou composition", "tirages ou compositions"],
  billards: ["affectation de billards", "affectations de billards"],
  forfait: ["forfait ou abandon", "forfaits ou abandons"],
  consolante: ["création de consolante", "créations de consolante"],
  arbitre: ["arbitre", "arbitres"],
  cloture: ["réouverture du tournoi", "réouvertures du tournoi"],
  autre: ["autre action", "autres actions"],
};

/** Actions dont l'annulation entraîne beaucoup de choses : citées une à une avant de confirmer. */
const HEAVY: EventKind[] = ["tirage", "classement", "consolante", "forfait", "cloture"];

/**
 * Résumé d'une annulation : décompte par nature (« 12 scores », « 1 classement ») et libellés
 * des actions lourdes de conséquences (tirage, classement, consolante, forfait).
 */
export function summarizeUndo(entries: HistoryEntry[]): { parts: string[]; heavy: string[] } {
  const counts = new Map<EventKind, number>();
  for (const e of entries) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  const parts = [...counts.entries()].map(([kind, n]) => {
    const [one, many] = KIND_WORDS[kind];
    return `${n} ${n > 1 ? many : one}`;
  });
  const heavy = entries.filter((e) => HEAVY.includes(e.kind)).map((e) => e.label);
  return { parts, heavy };
}

/**
 * Accès au moteur de règles `@pilot5q/domain` et quelques aides d'affichage.
 *
 * Toute la logique métier vient du domaine ; ce module n'ajoute que des libellés et des
 * raccourcis de distance utilisés par les vues.
 */
import type { BracketRound, Distance, PhaseId, Rules } from "@pilot5q/domain";
import { bracketDistance, pouleDistance } from "@pilot5q/domain";

export {
  DEFAULT_RULES,
  advanceBracket,
  arriveeOf,
  barragePairs,
  barrageRanking,
  barrageResults,
  clubConflicts,
  clubOf,
  composeMasters,
  composeNational,
  consolanteBracket,
  forfaitsOf,
  initialState,
  isValidScore,
  mastersClubConflicts,
  mastersQF,
  matchOutcome,
  matchWinner,
  nationalR16,
  orderParticipants,
  parseInscritsCsv,
  phaseComplete,
  phaseRanking,
  pouleMatches,
  pouleSizes,
  rankPhase,
  rankPoule,
  rankPouleInPhase,
  reduce,
  replay,
  resolveClubConflicts,
  serpentin,
  toLiveJson,
  bracketDistance,
  pouleDistance,
} from "@pilot5q/domain";

/** Distance d'une phase (poules ou tour de tableau). */
export function distanceFor(rules: Rules, phase: PhaseId, round: BracketRound = "F"): Distance {
  if (phase === "PREQ" || phase === "QN" || phase === "QM") return pouleDistance(rules, phase);
  if (phase === "B") return rules.distances.barrage;
  return bracketDistance(rules, phase, round);
}

/** Libellés de l'ordre des matchs d'une poule (SPEC §4). */
export function matchLabels(size: number): string[] {
  return size === 3
    ? ["2 contre 3", "1 contre gagnant", "Dernier"]
    : ["2 contre 3", "1 contre 4", "Perdants", "Gagnants", "Dernier de 4", "Dernier de 1"];
}

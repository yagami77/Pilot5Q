/**
 * Moteur de règles Pilot5Q — point d'agrégation.
 *
 * Chaque fonction correspond à une règle de docs/SPEC.md ; les implémentations sont réparties
 * dans les modules suivants (chacun documente en tête les règles et les choix retenus) :
 * - `rules.ts`   : paramètres par défaut (§8).
 * - `csv.ts`     : lecture du CSV fédéral et liste ordonnée des participants (§2).
 * - `draw.ts`    : serpentin, contrainte club, matchs d'une poule (§3, §4).
 * - `scoring.ts` : validité des scores, points, classements de poule et de phase (§1, §4).
 * - `phases.ts`  : barrages, poules du samedi, tableaux finaux, consolante (§4, §5, §6).
 * - `results.ts` : classements des phases finales, classement final du tournoi, primes (§6, §7).
 * - `reducer.ts` : réducteur pur du journal d'événements et sélecteurs dérivés.
 * - `live.ts`    : export JSON pour l'application 5 Quilles (§9).
 */
export { DEFAULT_RULES, cloneRules } from "./rules.js";
export {
  parseInscritsCsv,
  orderParticipants,
  parseCsvRows,
  parseFrenchDate,
  fixMojibake,
} from "./csv.js";
export {
  serpentin,
  serpentinWithSizes,
  serpentinOrder,
  pouleSizes,
  resolveClubConflicts,
  clubConflicts,
  pouleMatches,
} from "./draw.js";
export {
  isValidScore,
  matchOutcome,
  matchWinner,
  maxSets,
  setPoints,
  rankPoule,
  rankPouleInPhase,
  shouldCompensate3,
  rankPhase,
  rankBarrages,
} from "./scoring.js";
export type { MatchOutcome, RankPouleOptions } from "./scoring.js";
export {
  barragePairs,
  composeMasters,
  mastersClubConflicts,
  composeNational,
  toPoules,
  nationalR16,
  syncNationalR16,
  NATIONAL_R16_PAIRS,
  mastersQF,
  advanceBracket,
  consolanteBracket,
  seedOrder,
  bracketMatchId,
  roundSize,
  ordinal,
  BRACKET_ROUNDS,
} from "./phases.js";
export type { BarrageMatch } from "./phases.js";
export {
  rankTournamentPhase,
  tournamentRanking,
  primesTable,
  bracketLevelLabel,
  preqPoints,
  MASTERS_POINTS,
  NATIONAL_POINTS,
  CONSOLANTE_WINNER_POINTS,
} from "./results.js";
export type { TournamentRankingInput } from "./results.js";
export {
  initialState,
  reduce,
  replay,
  phaseRanking,
  barrageRanking,
  barrageResults,
  phaseComplete,
  pouleDistance,
  bracketDistance,
  arriveeOf,
  entryArrivee,
  clubOf,
  forfaitsOf,
  forfaitSubisOf,
  walkoverPoints,
  playerTotals,
  bracketRanking,
  finalRanking,
  primesOf,
  journalClosed,
  canCloseTournament,
} from "./reducer.js";
export { toLiveJson } from "./live.js";
export type { LiveJson, LiveCompetition, LivePoule, LiveMatch } from "./live.js";

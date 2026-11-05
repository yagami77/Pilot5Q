// Espace du responsable national : saison, clubs, calendrier, base joueurs, classement glissant.
export type * from "./types.js";
export {
  baremeTable,
  otherPointsTable,
  basePoints,
  decimalPoints,
  abandonCancelsPoints,
  awardPoints,
  awardsFromRanking,
  awardTotal,
} from "./bareme.js";
export {
  WINDOW_SIZE,
  TN_PER_SEASON,
  seasonStartYear,
  nextSeason,
  stageIndex,
  stageOfIndex,
  windowStages,
  latestStage,
  windowScore,
  rankingRows,
  applyTournament,
  rankingPlaces,
  rankingCsv,
} from "./glissant.js";
export {
  normalizeLicence,
  normalizeName,
  updatePlayerBase,
  lastKnownPlaces,
  searchPlayers,
} from "./players.js";
export { capacityFor, toPlayer, acceptRegistrations, acceptedListCsv } from "./registration.js";
export type { Acceptance } from "./registration.js";
export {
  DEFAULT_MAIL_TEMPLATE,
  renderTemplate,
  splitName,
  convocationTime,
  recipients,
} from "./convocation.js";
export {
  DEFAULT_SEASON_SETTINGS,
  stageStatus,
  stageStatusLabel,
  sundayOf,
  hostCapable,
} from "./calendar.js";

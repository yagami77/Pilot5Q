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
  currentPlaces,
  searchPlayers,
} from "./players.js";
export {
  capacityFor,
  toPlayer,
  acceptRegistrations,
  markLegacyIntegrations,
  acceptedListCsv,
  WAIT_STATUS_LABELS,
} from "./registration.js";
export type { Acceptance } from "./registration.js";
export type { MailSegment } from "./convocation.js";
export {
  DEFAULT_MAIL_TEMPLATE,
  MAIL_ALERT_STARTS,
  MAIL_ALERT_COLOR,
  mailSegments,
  mailHtml,
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
  stageSettings,
  consolanteCheck,
} from "./calendar.js";
export type { ConsolanteCheck } from "./calendar.js";

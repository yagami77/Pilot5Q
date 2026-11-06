/**
 * Types de l'espace du responsable national : saison, clubs hôtes, calendrier, base joueurs,
 * classement glissant et paramétrage des TN (SPEC §2, §7, §8).
 *
 * Les structures sont plates et identifiées par des clés simples (licence, id de club, id
 * d'étape) pour se transposer telles quelles en tables d'une base relationnelle.
 */
import type { Rules } from "../types.js";

/** Saison sportive, de l'automne à l'été : « 2026-2027 ». */
export type SeasonId = string;

/** Club hôte d'une étape. */
export interface HostClub {
  id: string;
  name: string;
  /** Numéro FFB du club (5 chiffres). */
  ffbNumber: string;
  address: string;
  postcode: string;
  city: string;
  phone: string;
  email: string;
  lat: number | null;
  lng: number | null;
  /** Billards 3m10. */
  big: number;
  /** Billards 2m80 (ou 2m60). */
  small: number;
}

/** Coordonnées du directeur de jeu désigné pour une étape. */
export interface DjContact {
  /** « NOM Prénom ». */
  name: string;
  email: string;
  licence: string;
  phone: string;
}

/**
 * Surcharges propres à une étape des horaires de convocation et du canevas du mail ; une valeur
 * absente reprend celle de la saison.
 */
export interface StageConvocation {
  convocationFriday?: string;
  convocationWeekend?: string;
  convocationWeekendThreeBig?: string;
  mailTemplate?: string;
}

/** Étape du calendrier : un TN (ou, à terme, une finale). */
export interface Stage {
  id: string;
  season: SeasonId;
  /** Numéro de l'étape dans la saison (TN 1 à 5). */
  number: number;
  kind: "TN" | "FINALE";
  name: string;
  clubId: string | null;
  city: string;
  /** Jours de compétition (AAAA-MM-JJ), vendredi → dimanche. */
  start: string;
  end: string;
  /** Ouverture et fermeture des inscriptions (ISO 8601 avec heure). */
  registrationOpen: string | null;
  registrationClose: string | null;
  registrationUrl: string;
  /** Billards disponibles pour l'étape (par défaut ceux du club). */
  big: number;
  small: number;
  /** Licence du directeur de jeu désigné pour le tournoi. */
  djLicence: string | null;
  /** Identifiant du journal du tournoi dans le cockpit, une fois ouvert pour le club hôte. */
  tournamentId: string | null;
  openedAt: string | null;
  closedAt: string | null;
  /** Directeur de jeu (nom, email, licence, téléphone). */
  dj?: DjContact | null;
  /** Horaires et canevas propres à l'étape (surcharge des paramètres de la saison). */
  convocation?: StageConvocation | null;
  /** Nombre de juniors (U21) parmi les acceptés, enregistré avec l'étape. */
  juniorCount?: number | null;
}

/** Joueur de la base historique (clé : licence). */
export interface PlayerRecord {
  licence: string;
  name: string;
  club: string;
  /** Saison du dernier TN joué (null : jamais vu). */
  lastSeason: SeasonId | null;
  /** Place au classement glissant en cours (null : absent des 5 derniers TN). */
  currentPlace: number | null;
  /** Dernier classement connu : le classement en cours si actif, sinon celui à l'issue du dernier TN joué. */
  lastPlace: number | null;
  junior?: boolean;
  email?: string;
}

/** Résultat d'un joueur à un TN, tel qu'il entre dans la fenêtre glissante. */
export interface TnResult {
  season: SeasonId;
  tn: number;
  /** Points du barème + décimale (0 pour un abandon). */
  pts: number;
  faits: number;
  subis: number;
}

/** Désignation d'un TN sur l'axe des saisons. */
export interface StageRef {
  season: SeasonId;
  tn: number;
}

/**
 * Résultats d'un joueur, TN par TN. Tout l'historique est conservé : le classement ne retient
 * que les 5 derniers TN (la fenêtre), les autres restent visibles mais ne comptent plus.
 */
export interface RankingEntry {
  licence: string;
  name: string;
  club: string;
  results: TnResult[];
}

/** Case d'un TN de la fenêtre pour un joueur : ses points, ou null s'il ne l'a pas joué. */
export interface WindowCell extends StageRef {
  pts: number | null;
  /** Faux pour le résultat retiré par la règle des 4 meilleurs sur 5 (ou un TN non joué). */
  counted: boolean;
}

/** Ligne du classement glissant. */
export interface RankingRow extends RankingEntry {
  position: number;
  /** Score : somme des 4 meilleurs résultats si 5 TN joués, somme simple sinon. */
  pts: number;
  /** Moyenne cumulée : points faits / points subis sur la fenêtre. */
  moy: number;
  /** Nombre de TN joués dans la fenêtre. */
  count: number;
  /** Les 5 TN de la fenêtre, du plus ancien au plus récent. */
  window: WindowCell[];
  /** Le TN qui vient de sortir de la fenêtre à la dernière clôture (ses points ne comptent plus). */
  left: StageRef & { pts: number | null };
  /** Le plus ancien TN de la fenêtre : il sortira à la prochaine clôture. */
  leavingNext: WindowCell;
  /** Le résultat le plus faible, non compté (règle des 4 meilleurs sur 5), si 5 TN joués. */
  dropped: (StageRef & { pts: number }) | null;
  /** Évolution de place depuis le classement précédent (> 0 : monte) ; null si inconnue ou nouveau. */
  delta: number | null;
}

/** Points attribués à un joueur à l'issue d'un TN (entrée du classement glissant). */
export interface TournamentAward {
  name: string;
  licence: string;
  club: string;
  /** Points du barème (0 pour un abandon hors consolante). */
  points: number;
  /** Décimale de départage : points de set / matchs joués / 100 (0 pour un abandon). */
  decimal: number;
  faits: number;
  subis: number;
  abandon: boolean;
  /** Tableau d'origine des points. */
  origin: "M" | "N" | "CLS" | "PREQ";
}

/** Résultat brut d'un joueur à un TN (placements + cumuls), avant application du barème. */
export interface TournamentResult {
  name: string;
  licence?: string;
  club?: string;
  /** Tableau dans lequel le joueur a fini : Masters, National, ou hors tableaux (consolante / poules). */
  table: "M" | "N" | "CLS";
  /** Place dans ce tableau (1 = vainqueur ; consolante : 1 = vainqueur de la consolante). */
  rank: number;
  /** Rang dans la poule du vendredi (null pour un préqualifié Masters). */
  preqPouleRank: number | null;
  /** Points de set cumulés (vendredi, barrage, samedi, tableau ; hors consolante). */
  setPoints: number;
  /** Matchs joués (même périmètre). */
  matches: number;
  faits: number;
  subis: number;
  /** Phase de l'abandon, s'il y a lieu (un abandon en consolante ne retire pas les points). */
  abandon?: string;
}

/** Paramétrage d'une saison (valeurs par défaut : SPEC §8 et outil de référence). */
export interface SeasonSettings {
  /** Billards minimum pour accueillir un TN, dont `minBigTables` de 3m10. */
  minTables: number;
  minBigTables: number;
  /** Joueurs acceptés = billards × `playersPerTable` + `extraPlayers`, plafonné à `maxPlayers`. */
  playersPerTable: number;
  extraPlayers: number;
  maxPlayers: number;
  /** Liste d'attente : priorité aux `waitlistPriority` premiers du classement, puis ordre d'inscription. */
  waitlistPriority: number;
  /** Consolante seulement si au moins `consolanteMinSmallTables` billards 2m80. */
  consolanteMinSmallTables: number;
  /** Droit d'inscription (U21 exemptés). */
  inscriptionFee: number;
  ffbShare: number;
  clubShare: number;
  /** Parts des primes en pourcentage de la cagnotte (Masters puis National). */
  prizesMasters: { label: string; pct: number; count: number }[];
  prizesNational: { label: string; pct: number; count: number }[];
  /** Horaires de convocation. */
  convocationFriday: string;
  convocationWeekend: string;
  /** Samedi et dimanche quand le club n'a que 3 billards 3m10. */
  convocationWeekendThreeBig: string;
  /** Distances par phase (SPEC §8). */
  distances: Rules["distances"];
  /** Canevas du mail de convocation (variables entre accolades doubles). */
  mailTemplate: string;
}

/** Suivi d'un joueur en liste d'attente (appels du responsable avant de l'intégrer). */
export type WaitStatus = "a-contacter" | "confirme" | "indisponible";

/** Inscription d'un joueur à une étape (ligne du CSV fédéral enrichie). */
export interface Registration {
  licence: string;
  name: string;
  club: string;
  email: string;
  /** Rang d'inscription (ordre chronologique du CSV). */
  order: number;
  registeredAt: string;
  junior: boolean;
  /** Forfait déclaré avant le tirage. */
  forfait: boolean;
  /** Intégré par le responsable depuis la liste d'attente (place libérée par un forfait). */
  integrated?: boolean;
  /** Suivi en liste d'attente (absent : « à contacter »). */
  waitStatus?: WaitStatus;
}

/** État des inscriptions d'une étape (base d'un futur `registrations` en base de données). */
export interface StageRegistrations {
  stageId: string;
  importedAt: string | null;
  fileName: string;
  registrations: Registration[];
  /**
   * Liste d'attente gérée à la main (un forfait libère une place sans intégrer personne). Absent
   * sur les données enregistrées avant ce fonctionnement : voir `markLegacyIntegrations`.
   */
  manualWaitlist?: boolean;
}

/** Statut d'une étape, dérivé des dates et de l'ouverture/clôture du tournoi. */
export type StageStatus =
  "a-venir" | "inscriptions-ouvertes" | "inscriptions-closes" | "ouvert-dj" | "cloture";

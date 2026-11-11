/**
 * Contrat de types du domaine Pilot5Q.
 *
 * Ce fichier est le contrat partagé entre le moteur de règles (packages/domain)
 * et l'interface (apps/web). Les règles métier sont décrites dans docs/SPEC.md.
 * Les joueurs sont identifiés par leur `name` dans les poules et les matchs
 * (cf. fixture test/fixtures/tn-exemple.json) ; la `licence` reste l'identifiant
 * fédéral unique.
 */

/** Type de billard : grand (3m10) ou petit (2m80). */
export type BillardType = "3m10" | "2m80";

export interface Billard {
  num: number;
  type: BillardType;
}

/** Joueur inscrit au tournoi. `seed` = rang dans la liste ordonnée (ordre du serpentin). */
export interface Player {
  licence: string;
  name: string;
  club: string;
  seed: number;
  /** Place au classement glissant (ou place dérivée), null pour un nouveau joueur. */
  place: number | null;
  lastSeason?: number | null;
  junior?: boolean;
  email?: string;
  /** Photo du joueur, fournie par l'application 5 Quilles (reliée par la licence). */
  photoUrl?: string;
}

/** Match entre deux joueurs. `sa`/`sb` = score (points ou sets selon la distance). */
export interface Match {
  id: string;
  a: string;
  b: string;
  sa: number | null;
  sb: number | null;
  setsA?: number[];
  setsB?: number[];
  billard?: number | null;
  /** Licence de l'arbitre 1 (dimanche : quarts, demies, finales). */
  arbitre?: string | null;
  /** Licence de l'arbitre 2. */
  arbitre2?: string | null;
  forfait?: "a" | "b" | null;
}

export interface Poule {
  num: number;
  players: string[];
  billards: number[];
  matches: Match[];
}

/** Distance d'une phase : points par set et nombre de sets gagnants. */
export interface Distance {
  pointsParSet: number;
  setsGagnants: number;
}

/** Ligne du classement d'une poule (SPEC §4). */
export interface PouleRankRow {
  name: string;
  rang: number | null;
  /** Points de match (2 par victoire). */
  ptm: number;
  /** Points de set. */
  pts: number;
  faits: number;
  subis: number;
  moy: number;
  joues: number;
  /** Ordre d'arrivée = place dans la liste ordonnée des participants. */
  arrivee: number;
}

/** Ligne du classement d'une phase (toutes poules confondues). */
export interface PhaseRankRow extends PouleRankRow {
  poule: number;
  place: number;
}

/** Identifiants de phases : préqualifications, barrages, qualifs National/Masters, finales, consolante. */
export type PhaseId = "PREQ" | "B" | "QN" | "QM" | "N" | "M" | "CLS";

/** Tours d'un tableau à élimination directe (R64/R32 : consolante à plus de 16 joueurs). */
export type BracketRound = "R64" | "R32" | "R16" | "QF" | "SF" | "F";

/** Tour atteint dans un tableau : un tour, ou `W` pour le vainqueur du tableau. */
export type BracketLevel = BracketRound | "W";

/** Ligne du classement d'une phase finale (qualification + tableau cumulés). */
export interface TournamentPhaseRow extends PhaseRankRow {
  /** Tour atteint dans le tableau (null : non qualifié pour le tableau). */
  reached: BracketLevel | null;
  /** Dernier tour gagné dans le tableau (null : aucun match gagné). */
  won: BracketRound | null;
  /** Libellé du tour atteint (« Gagnant », « Finale », « 1/2 finale »…), vide sinon. */
  label: string;
}

/** Cumuls d'un joueur sur l'ensemble du tournoi (pour le classement final). */
export interface PlayerTotals {
  ptm: number;
  pts: number;
  faits: number;
  subis: number;
  joues: number;
}

/** Ligne du classement final du tournoi (SPEC §7). */
export interface TournamentRankRow extends PlayerTotals {
  place: number;
  name: string;
  /** Phase qui fixe les points : Masters, National, consolante ou poules du vendredi. */
  origin: "M" | "N" | "CLS" | "PREQ";
  /** Points du barème (0 pour un forfait/abandon). */
  points: number;
  /** Décimale de départage : points de set / matchs joués / 100. */
  decimal: number;
  moy: number;
  arrivee: number;
  abandon: boolean;
}

/** Ligne du tableau des primes (SPEC §6). */
export interface PrimeRow {
  label: string;
  pct: number;
  amount: number;
  name: string;
}

/** Tableau des primes (SPEC §6). */
export interface PrimesTable {
  players: number;
  juniors: number;
  inscriptions: number;
  ffb: number;
  club: number;
  total: number;
  masters: PrimeRow[];
  national: PrimeRow[];
}

/** Match d'un tableau à élimination directe. `a`/`b` vides tant que le joueur n'est pas connu. */
export interface BracketMatch extends Match {
  round: BracketRound;
  slot: number;
  labelA?: string;
  labelB?: string;
  /**
   * Huitième National à vérifier : un score de poule a été corrigé après coup et les qualifiés
   * ont changé (score effacé) ou ne sont plus certains. Effacé à la saisie suivante du match.
   */
  needsReview?: boolean;
}

/** Paramètres du tournoi (valeurs par défaut : SPEC §8). */
export interface Rules {
  distances: Record<"preq" | "barrage" | "qn" | "qm" | "huitiemes" | "cls" | "final", Distance>;
  mastersPrequalified: number;
  barrageSize: number;
  nationalSize: number;
  consolanteMax: number;
  consolanteMinSmallTables: number;
  maxPoulesOf3: number;
  inscriptionFee: number;
}

/** Événements du journal du tournoi (event sourcing). `at` = horodatage ISO 8601. */
export type TournamentEvent =
  | {
      type: "tournament.created";
      at: string;
      payload: {
        name: string;
        season: string;
        city: string;
        club: string;
        dates: [string, string];
        billards: Billard[];
        rules: Rules;
      };
    }
  | { type: "players.imported"; at: string; payload: { players: Player[] } }
  | {
      type: "billards.assigned";
      at: string;
      payload: { phase: PhaseId; assignments: Record<string, number[]> };
    }
  | { type: "poules.drawn"; at: string; payload: { phase: "PREQ" | "QN" | "QM"; poules: Poule[] } }
  | {
      type: "score.entered";
      at: string;
      payload: {
        phase: PhaseId;
        matchId: string;
        sa: number | null;
        sb: number | null;
        setsA?: number[];
        setsB?: number[];
      };
    }
  | {
      type: "forfait.declared";
      at: string;
      payload: { phase: PhaseId; player: string; kind: "forfait" | "abandon" };
    }
  | { type: "phase.closed"; at: string; payload: { phase: PhaseId } }
  | { type: "phase.reopened"; at: string; payload: { phase: PhaseId } }
  | { type: "consolante.created"; at: string; payload: { players: string[] } }
  | {
      type: "arbitre.set";
      at: string;
      /**
       * Licence de l'arbitre d'un match ; `slot` 1 (par défaut, anciens journaux) ou 2 ; une
       * licence vide efface l'arbitre.
       */
      payload: { phase: PhaseId; matchId: string; licence: string; slot?: 1 | 2 };
    }
  /**
   * Clôture du tournoi par le directeur de jeu : au-delà, seul le responsable national peut
   * rouvrir (`tournament.reopened`), corriger, puis clôturer de nouveau ; le directeur de jeu
   * ne retrouve plus la saisie. `by` = nom de la personne qui agit.
   */
  | { type: "tournament.closed"; at: string; payload: { by?: string } }
  | { type: "tournament.reopened"; at: string; payload: { by?: string } };

/** État complet du tournoi, obtenu par rejeu des événements. */
export interface TournamentState {
  info: {
    name: string;
    season: string;
    city: string;
    club: string;
    dates: [string, string];
  } | null;
  billards: Billard[];
  rules: Rules;
  players: Player[];
  /** Noms des 8 préqualifiés Masters. */
  masters: string[];
  poules: Record<"PREQ" | "QN" | "QM", Poule[]>;
  barrages: Match[];
  brackets: Record<"N" | "M" | "CLS", BracketMatch[]>;
  closed: Partial<Record<PhaseId, boolean>>;
  forfaits: { phase: PhaseId; player: string; kind: "forfait" | "abandon" }[];
  billardAssignments: Partial<Record<PhaseId, Record<string, number[]>>>;
  /**
   * Clôture du tournoi par le directeur de jeu (date et auteur) ; null ou absent tant que le
   * tournoi est ouvert, ou après une réouverture par le responsable.
   */
  closure?: { at: string; by: string } | null;
  /**
   * Réouverture en cours par le responsable (date et auteur), après une clôture : lui seul peut
   * corriger, jusqu'à la nouvelle clôture. Null ou absent sinon.
   */
  reopening?: { at: string; by: string } | null;
}

/**
 * Où en est la clôture d'un tournoi : jamais clôturé (« open »), clôturé (« closed », plus aucune
 * modification), ou rouvert par le responsable pour correction (« reopened », lui seul modifie).
 */
export type ClosureStatus = "open" | "closed" | "reopened";

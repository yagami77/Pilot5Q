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
  arbitre?: string | null;
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

/** Match d'un tableau à élimination directe. `a`/`b` vides tant que le joueur n'est pas connu. */
export interface BracketMatch extends Match {
  round: BracketRound;
  slot: number;
  labelA?: string;
  labelB?: string;
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
      payload: { phase: PhaseId; matchId: string; licence: string };
    };

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
}

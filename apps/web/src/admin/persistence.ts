/**
 * Persistance locale de l'espace du responsable national (IndexedDB via idb-keyval).
 *
 * Clés `pilot5q:season:*`. Le document de saison regroupe des collections plates (clubs, étapes,
 * joueurs, fenêtres du classement, inscriptions, clôtures) qui correspondent une à une aux tables
 * d'une future base relationnelle ; le serveur partagé remplacera ce module sans toucher aux vues.
 */
import type {
  HostClub,
  PlayerRecord,
  RankingEntry,
  SeasonId,
  SeasonSettings,
  Stage,
  StageRegistrations,
  TournamentAward,
} from "@pilot5q/domain";
import { del, get, set } from "idb-keyval";

/**
 * Liste de contrôle de la clôture : date (ISO 8601) à laquelle chaque étape a été faite dans ce
 * navigateur (PDF du classement glissant, `RANKING.json`, PDF récapitulatif, message au
 * secrétariat). Une étape absente reste à faire.
 */
export interface ClosureChecklist {
  rankingPdf?: string;
  rankingJson?: string;
  recapPdf?: string;
  secretariat?: string;
}

/** Trace d'une clôture de TN : points attribués et fenêtre avant intégration (pour corriger). */
export interface StageClosure {
  stageId: string;
  closedAt: string;
  awards: TournamentAward[];
  rankingBefore: RankingEntry[];
  /** Base joueurs avant intégration (pour annuler la clôture). */
  playersBefore?: PlayerRecord[];
  /** Nombre de joueurs classés après intégration. */
  rankedAfter: number;
  /** Suites de la clôture déjà faites par le responsable. */
  checklist?: ClosureChecklist;
}

/** Document d'une saison : toutes les données du responsable national. */
export interface SeasonDocument {
  id: SeasonId;
  settings: SeasonSettings;
  clubs: HostClub[];
  stages: Stage[];
  players: PlayerRecord[];
  /** Fenêtres glissantes individuelles (classement courant). */
  ranking: RankingEntry[];
  registrations: Record<string, StageRegistrations>;
  closures: Record<string, StageClosure>;
  /** Juniors (U21) signalés par licence pour la saison. */
  juniors: string[];
  updatedAt: string;
}

const CURRENT_KEY = "pilot5q:season:current";
export const seasonKey = (id: SeasonId) => `pilot5q:season:${id}`;

export async function loadCurrentSeasonId(): Promise<SeasonId | null> {
  try {
    return (await get<SeasonId>(CURRENT_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function saveCurrentSeasonId(id: SeasonId | null): Promise<void> {
  try {
    if (id === null) await del(CURRENT_KEY);
    else await set(CURRENT_KEY, id);
  } catch {
    /* stockage indisponible : on continue en mémoire */
  }
}

export async function loadSeason(id: SeasonId): Promise<SeasonDocument | null> {
  try {
    return (await get<SeasonDocument>(seasonKey(id))) ?? null;
  } catch {
    return null;
  }
}

export async function saveSeason(doc: SeasonDocument): Promise<void> {
  await set(seasonKey(doc.id), doc);
}

export async function removeSeason(id: SeasonId): Promise<void> {
  try {
    await del(seasonKey(id));
  } catch {
    /* ignoré */
  }
}

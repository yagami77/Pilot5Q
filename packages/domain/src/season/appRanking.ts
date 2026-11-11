/**
 * `RANKING.json` : le classement glissant tel que l'application mobile 5 Quilles le lit
 * (aujourd'hui via `getRANKING.php`, qui sert le fichier déposé par le responsable national).
 *
 * Format lu par l'application (`mobile/src/lib/rankingLive.ts`, types `ApiRanking`,
 * `ApiJoueur`, `ApiTn`) :
 * - `ranking` : libellé historique, « après TN2 2026-2027 » (l'application y lit le numéro du
 *   TN et la saison quand `saison` et `type` manquent) ;
 * - `saison` : « 2026-2027 » ; `type` : « Début », « Après TN2 » ou « Final » ;
 * - `joueurs` : dans l'ordre du classement (le rang est l'indice + 1), chacun avec `nom`
 *   (« NOM PRENOM » en majuscules : l'application retrouve club et licence par le nom),
 *   `points` (total avec la décimale de départage) et `TNs`, les 5 TN de la fenêtre du plus
 *   ancien au plus récent : `nom` « TN 3 2025-2026 », `points` le résultat du joueur, ou la
 *   chaîne « - » s'il n'a pas joué ce TN.
 *
 * Les nombres sont écrits avec 15 chiffres significatifs, comme dans les fichiers servis
 * aujourd'hui (« 320.082857142857 »), sans bruit de virgule flottante.
 */
import type { RankingRow, StageRef } from "./types.js";

import { windowStages } from "./glissant.js";

/** Résultat d'un joueur à un TN de la fenêtre (« - » : TN non joué). */
export interface AppRankingTn {
  nom: string;
  points: number | "-";
}

export interface AppRankingPlayer {
  nom: string;
  points: number;
  TNs: AppRankingTn[];
}

/** Contenu de `RANKING.json`. */
export interface AppRanking {
  ranking: string;
  saison: string;
  type: string;
  joueurs: AppRankingPlayer[];
}

/** Nom du fichier attendu par l'application. */
export const APP_RANKING_FILE = "RANKING.json";

/** 15 chiffres significatifs : la précision d'Excel, sans bruit de virgule flottante. */
function excelNumber(n: number): number {
  return Number(n.toPrecision(15));
}

/** Nom d'un TN de la fenêtre dans le fichier : « TN 3 2025-2026 ». */
export function appRankingStageName(stage: StageRef): string {
  return `TN ${stage.tn} ${stage.season}`;
}

/**
 * Classement glissant au format de l'application 5 Quilles, pour la fenêtre se terminant à
 * `last` (le dernier TN clôturé). `rows` est le classement trié (`rankingRows`).
 */
export function appRanking(rows: RankingRow[], last: StageRef): AppRanking {
  const stages = windowStages(last.season, last.tn);
  return {
    ranking: `après TN${last.tn} ${last.season}`,
    saison: last.season,
    type: `Après TN${last.tn}`,
    joueurs: [...rows]
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        nom: r.name,
        points: excelNumber(r.pts),
        TNs: stages.map((s) => {
          const cell = r.window.find((w) => w.season === s.season && w.tn === s.tn);
          return {
            nom: appRankingStageName(s),
            points: cell && cell.pts !== null ? excelNumber(cell.pts) : "-",
          };
        }),
      })),
  };
}

/** Texte du fichier `RANKING.json` (UTF-8, indenté pour rester lisible). */
export function appRankingJson(rows: RankingRow[], last: StageRef): string {
  return `${JSON.stringify(appRanking(rows, last), null, 2)}\n`;
}

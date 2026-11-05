/**
 * Classement glissant sur les 5 derniers TN (SPEC §7, réforme 2026-2027).
 *
 * Règles déduites de l'outil Excel de référence (onglet CLASSEMENTS, plages FENETRE et
 * JOUEURS_RANKING, formules `DM`/`DN`/`DO`) :
 * - La fenêtre est celle du calendrier : les 5 derniers TN joués (toutes saisons confondues).
 *   À chaque clôture, le TN le plus ancien sort de la fenêtre pour tout le monde.
 * - Score d'un joueur = somme de ses points (barème + décimale) sur la fenêtre ; s'il a joué les
 *   5 TN, son plus mauvais résultat est retiré (`SUM − MIN × (Nb = 5)`).
 * - Nombre de tournois = TN joués dans la fenêtre (un abandon compte comme joué, avec 0 point).
 * - Moyenne = Σ points faits / Σ points subis sur la fenêtre.
 * - Ordre : score décroissant (totaux comparés tels quels, sans arrondi, comme l'outil de
 *   référence), puis moyenne décroissante, puis nom (choix : l'outil ne précise pas le départage
 *   au-delà de la moyenne).
 * - Un joueur sans TN dans la fenêtre disparaît du classement.
 */
import type { RankingEntry, RankingRow, SeasonId, TnResult, TournamentAward } from "./types.js";

import { awardTotal } from "./bareme.js";

/** Taille de la fenêtre glissante (TN). */
export const WINDOW_SIZE = 5;
/** Nombre de TN par saison. */
export const TN_PER_SEASON = 5;

/** Année de début d'une saison « 2026-2027 » → 2026. */
export function seasonStartYear(season: SeasonId): number {
  return Number.parseInt(season.slice(0, 4), 10);
}

/** Saison suivante : « 2026-2027 » → « 2027-2028 ». */
export function nextSeason(season: SeasonId): SeasonId {
  const y = seasonStartYear(season);
  return `${y + 1}-${y + 2}`;
}

/** Indice absolu d'un TN sur l'axe des saisons (TN 1 de 2026-2027 → 2026 × 5 + 0). */
export function stageIndex(season: SeasonId, tn: number): number {
  return seasonStartYear(season) * TN_PER_SEASON + (tn - 1);
}

/** TN désigné par un indice absolu. */
export function stageOfIndex(index: number): { season: SeasonId; tn: number } {
  const year = Math.floor(index / TN_PER_SEASON);
  return { season: `${year}-${year + 1}`, tn: (index % TN_PER_SEASON) + 1 };
}

/** Les TN de la fenêtre qui se termine à (season, tn), du plus ancien au plus récent. */
export function windowStages(season: SeasonId, tn: number): { season: SeasonId; tn: number }[] {
  const last = stageIndex(season, tn);
  const out: { season: SeasonId; tn: number }[] = [];
  for (let i = last - WINDOW_SIZE + 1; i <= last; i++) out.push(stageOfIndex(i));
  return out;
}

/** Dernier TN présent dans une fenêtre (null si vide). */
export function latestStage(entries: RankingEntry[]): { season: SeasonId; tn: number } | null {
  let best: number | null = null;
  for (const e of entries)
    for (const r of e.results) {
      const i = stageIndex(r.season, r.tn);
      if (best === null || i > best) best = i;
    }
  return best === null ? null : stageOfIndex(best);
}

/** Score, nombre de TN et moyenne d'une fenêtre de résultats. */
export function windowScore(results: TnResult[]): { pts: number; count: number; moy: number } {
  const count = results.length;
  if (count === 0) return { pts: 0, count: 0, moy: 0 };
  const values = results.map((r) => r.pts);
  const sum = values.reduce((a, b) => a + b, 0);
  const pts = count >= WINDOW_SIZE ? sum - Math.min(...values) : sum;
  const faits = results.reduce((a, r) => a + r.faits, 0);
  const subis = results.reduce((a, r) => a + r.subis, 0);
  return { pts, count, moy: subis > 0 ? faits / subis : 0 };
}

/** Classement glissant à partir des fenêtres individuelles. */
export function rankingRows(entries: RankingEntry[]): RankingRow[] {
  const rows = entries
    .filter((e) => e.results.length > 0)
    .map((e) => {
      const s = windowScore(e.results);
      return { ...e, position: 0, pts: s.pts, moy: s.moy, count: s.count };
    });
  // Comparaison des totaux tels quels (comme l'outil de référence), puis moyenne, puis nom.
  rows.sort((x, y) => y.pts - x.pts || y.moy - x.moy || x.name.localeCompare(y.name, "fr"));
  return rows.map((r, i) => ({ ...r, position: i + 1 }));
}

/**
 * Intègre les points d'un TN dans les fenêtres et fait glisser la fenêtre (les TN antérieurs
 * aux 5 derniers sortent). Les joueurs sont appariés par licence, à défaut par nom.
 */
export function applyTournament(
  entries: RankingEntry[],
  awards: TournamentAward[],
  stage: { season: SeasonId; tn: number },
): RankingEntry[] {
  const key = (licence: string, name: string): string =>
    licence !== "" ? `L:${licence}` : `N:${name}`;
  const byKey = new Map<string, RankingEntry>();
  const byName = new Map<string, RankingEntry>();
  const out: RankingEntry[] = entries.map((e) => ({ ...e, results: [...e.results] }));
  for (const e of out) {
    byKey.set(key(e.licence, e.name), e);
    byName.set(e.name, e);
  }
  for (const a of awards) {
    let e = byKey.get(key(a.licence, a.name)) ?? byName.get(a.name);
    if (!e) {
      e = { licence: a.licence, name: a.name, club: a.club, results: [] };
      out.push(e);
      byKey.set(key(a.licence, a.name), e);
      byName.set(a.name, e);
    } else if (a.club !== "") e.club = a.club;
    if (e.licence === "" && a.licence !== "") e.licence = a.licence;
    e.results = e.results.filter((r) => !(r.season === stage.season && r.tn === stage.tn));
    e.results.push({
      season: stage.season,
      tn: stage.tn,
      pts: awardTotal(a),
      faits: a.faits,
      subis: a.subis,
    });
  }
  const keep = new Set(windowStages(stage.season, stage.tn).map((s) => stageIndex(s.season, s.tn)));
  return out
    .map((e) => ({
      ...e,
      results: e.results
        .filter((r) => keep.has(stageIndex(r.season, r.tn)))
        .sort((x, y) => stageIndex(x.season, x.tn) - stageIndex(y.season, y.tn)),
    }))
    .filter((e) => e.results.length > 0);
}

/** Places au classement glissant par licence (et par nom en secours), pour `orderParticipants`. */
export function rankingPlaces(rows: RankingRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.licence !== "") out[r.licence] = r.position;
    out[r.name] = r.position;
  }
  return out;
}

/** Lignes du classement en CSV (séparateur `;`), colonnes par TN de la fenêtre. */
export function rankingCsv(rows: RankingRow[], stages: { season: SeasonId; tn: number }[]): string {
  const head = [
    "Position",
    "Nom",
    "Club",
    "Licence",
    "Points",
    "Moyenne",
    "Nb tournois",
    ...stages.map((s) => `TN${s.tn} ${s.season}`),
  ];
  const fmt = (n: number): string => n.toFixed(3).replace(".", ",");
  const lines = rows.map((r) => {
    const cells = stages.map((s) => {
      const res = r.results.find((x) => x.season === s.season && x.tn === s.tn);
      return res ? fmt(res.pts) : "";
    });
    return [
      String(r.position),
      r.name,
      r.club,
      r.licence,
      fmt(r.pts),
      fmt(r.moy),
      String(r.count),
      ...cells,
    ].join(";");
  });
  return [head.join(";"), ...lines].join("\n");
}

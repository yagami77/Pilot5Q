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
 *
 * L'historique complet des résultats est conservé dans `results` (il est léger) : un TN sorti de
 * la fenêtre reste visible, mais ne compte plus. Seule la fenêtre entre dans le score.
 */
import type {
  RankingEntry,
  RankingRow,
  SeasonId,
  StageRef,
  TnResult,
  TournamentAward,
  WindowCell,
} from "./types.js";

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
export function stageOfIndex(index: number): StageRef {
  const year = Math.floor(index / TN_PER_SEASON);
  return { season: `${year}-${year + 1}`, tn: (index % TN_PER_SEASON) + 1 };
}

/** Les TN de la fenêtre qui se termine à (season, tn), du plus ancien au plus récent. */
export function windowStages(season: SeasonId, tn: number): StageRef[] {
  const last = stageIndex(season, tn);
  const out: StageRef[] = [];
  for (let i = last - WINDOW_SIZE + 1; i <= last; i++) out.push(stageOfIndex(i));
  return out;
}

/** Le TN qui vient de sortir de la fenêtre se terminant à (season, tn) : celui juste avant. */
export function leftStage(season: SeasonId, tn: number): StageRef {
  return stageOfIndex(stageIndex(season, tn) - WINDOW_SIZE);
}

/** Dernier TN présent dans les résultats (null si aucun). */
export function latestStage(entries: RankingEntry[]): StageRef | null {
  let best: number | null = null;
  for (const e of entries)
    for (const r of e.results) {
      const i = stageIndex(r.season, r.tn);
      if (best === null || i > best) best = i;
    }
  return best === null ? null : stageOfIndex(best);
}

/** Résultats d'un joueur restreints à la fenêtre se terminant à `stage`, du plus ancien au plus récent. */
export function windowResults(results: TnResult[], stage: StageRef): TnResult[] {
  const last = stageIndex(stage.season, stage.tn);
  const first = last - WINDOW_SIZE + 1;
  return results
    .filter((r) => {
      const i = stageIndex(r.season, r.tn);
      return i >= first && i <= last;
    })
    .sort((x, y) => stageIndex(x.season, x.tn) - stageIndex(y.season, y.tn));
}

/** Indice (dans `results`) du résultat retiré par la règle des 4 meilleurs sur 5 (−1 si aucun). */
function droppedIndex(results: TnResult[]): number {
  if (results.length < WINDOW_SIZE) return -1;
  let best = 0;
  results.forEach((r, i) => {
    const b = results[best];
    if (b && r.pts < b.pts) best = i;
  });
  return best;
}

/**
 * Score, nombre de TN et moyenne d'une fenêtre de résultats. Avec `stage`, seuls les résultats
 * de la fenêtre se terminant à ce TN comptent ; sans, tous les résultats passés sont la fenêtre.
 */
export function windowScore(
  results: TnResult[],
  stage?: StageRef,
): { pts: number; count: number; moy: number } {
  const inWindow = stage ? windowResults(results, stage) : results;
  const count = inWindow.length;
  if (count === 0) return { pts: 0, count: 0, moy: 0 };
  const sum = inWindow.reduce((a, r) => a + r.pts, 0);
  const dropped = droppedIndex(inWindow);
  const pts = dropped >= 0 ? sum - (inWindow[dropped]?.pts ?? 0) : sum;
  const faits = inWindow.reduce((a, r) => a + r.faits, 0);
  const subis = inWindow.reduce((a, r) => a + r.subis, 0);
  return { pts, count, moy: subis > 0 ? faits / subis : 0 };
}

const sameStage = (a: StageRef, b: StageRef): boolean => a.season === b.season && a.tn === b.tn;

/** Résultat d'un joueur à un TN donné (undefined s'il ne l'a pas joué). */
export function resultAt(results: TnResult[], stage: StageRef): TnResult | undefined {
  return results.find((r) => sameStage(r, stage));
}

/** Clé d'appariement d'un joueur entre deux classements : licence, à défaut nom. */
export function entryKey(e: { licence: string; name: string }): string {
  return e.licence !== "" ? e.licence : e.name;
}

/** Options du classement : fin de fenêtre (par défaut le dernier TN joué) et classement précédent. */
export interface RankingOptions {
  /** TN qui termine la fenêtre ; par défaut, le dernier TN présent dans les résultats. */
  stage?: StageRef | null;
  /** Fenêtres d'avant la dernière clôture, pour l'évolution des places (`delta`). */
  previous?: RankingEntry[] | null;
}

/** Lignes classées (sans évolution) pour la fenêtre se terminant à `stage`. */
function rankWindow(entries: RankingEntry[], stage: StageRef): RankingRow[] {
  const stages = windowStages(stage.season, stage.tn);
  const left = leftStage(stage.season, stage.tn);
  const oldest = stages[0] ?? stage;
  const rows: RankingRow[] = [];
  for (const e of entries) {
    const inWindow = windowResults(e.results, stage);
    if (inWindow.length === 0) continue;
    const s = windowScore(inWindow);
    const dropped = droppedIndex(inWindow);
    const droppedResult = dropped >= 0 ? inWindow[dropped] : undefined;
    const cell = (ref: StageRef): WindowCell => {
      const res = resultAt(inWindow, ref);
      return {
        season: ref.season,
        tn: ref.tn,
        pts: res ? res.pts : null,
        counted: res !== undefined && !(droppedResult !== undefined && res === droppedResult),
      };
    };
    const leftResult = resultAt(e.results, left);
    rows.push({
      ...e,
      position: 0,
      pts: s.pts,
      moy: s.moy,
      count: s.count,
      window: stages.map(cell),
      left: { season: left.season, tn: left.tn, pts: leftResult ? leftResult.pts : null },
      leavingNext: cell(oldest),
      dropped: droppedResult
        ? { season: droppedResult.season, tn: droppedResult.tn, pts: droppedResult.pts }
        : null,
      delta: null,
    });
  }
  // Comparaison des totaux tels quels (comme l'outil de référence), puis moyenne, puis nom.
  rows.sort((x, y) => y.pts - x.pts || y.moy - x.moy || x.name.localeCompare(y.name, "fr"));
  return rows.map((r, i) => ({ ...r, position: i + 1 }));
}

/**
 * Classement glissant. La fenêtre se termine au dernier TN joué (ou à `options.stage`) ; un
 * joueur sans TN dans la fenêtre n'y figure pas. Avec `options.previous` (fenêtres d'avant la
 * dernière clôture), chaque ligne porte son évolution de place (`delta` > 0 : le joueur monte ;
 * null : il n'était pas classé).
 */
export function rankingRows(entries: RankingEntry[], options: RankingOptions = {}): RankingRow[] {
  const stage = options.stage ?? latestStage(entries);
  if (!stage) return [];
  const rows = rankWindow(entries, stage);
  const previous = options.previous;
  if (!previous) return rows;
  const before = new Map<string, number>();
  for (const r of rankingRows(previous)) before.set(entryKey(r), r.position);
  return rows.map((r) => {
    const prev = before.get(entryKey(r));
    return { ...r, delta: prev === undefined ? null : prev - r.position };
  });
}

/**
 * Intègre les points d'un TN dans les résultats des joueurs. Tout l'historique est conservé (le
 * classement ne retient que la fenêtre) ; un résultat déjà présent pour ce TN est remplacé. Les
 * joueurs sont appariés par licence, à défaut par nom.
 */
export function applyTournament(
  entries: RankingEntry[],
  awards: TournamentAward[],
  stage: StageRef,
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
    e.results = e.results.filter((r) => !sameStage(r, stage));
    e.results.push({
      season: stage.season,
      tn: stage.tn,
      pts: awardTotal(a),
      faits: a.faits,
      subis: a.subis,
    });
  }
  return out.map((e) => ({
    ...e,
    results: [...e.results].sort((x, y) => stageIndex(x.season, x.tn) - stageIndex(y.season, y.tn)),
  }));
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

/**
 * Lignes du classement en CSV (séparateur `;`) : le TN sorti de la fenêtre (grisé à l'écran, il
 * ne compte plus) puis les TN de la fenêtre, du plus ancien au plus récent. Un résultat non
 * compté (4 meilleurs sur 5) est suivi d'un astérisque.
 */
export function rankingCsv(rows: RankingRow[], stages?: StageRef[]): string {
  const window = stages ?? rows[0]?.window ?? [];
  const first = window[0];
  const left = first ? stageOfIndex(stageIndex(first.season, first.tn) - 1) : null;
  const head = [
    "Position",
    "Nom",
    "Club",
    "Licence",
    "Points",
    "Moyenne",
    "Nb tournois",
    ...(left ? [`TN${left.tn} ${left.season} (sorti, ne compte plus)`] : []),
    ...window.map((s) => `TN${s.tn} ${s.season}`),
  ];
  const fmt = (n: number): string => n.toFixed(3).replace(".", ",");
  const lines = rows.map((r) => {
    const cells = window.map((s) => {
      const res = resultAt(r.results, s);
      if (!res) return "";
      const dropped = r.dropped !== null && sameStage(r.dropped, s);
      return `${fmt(res.pts)}${dropped ? "*" : ""}`;
    });
    const leftRes = left ? resultAt(r.results, left) : undefined;
    return [
      String(r.position),
      r.name,
      r.club,
      r.licence,
      fmt(r.pts),
      fmt(r.moy),
      String(r.count),
      ...(left ? [leftRes ? fmt(leftRes.pts) : ""] : []),
      ...cells,
    ].join(";");
  });
  return [head.join(";"), ...lines].join("\n");
}

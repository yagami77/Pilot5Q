/**
 * Base historique des joueurs (SPEC §2) et sa mise à jour à la clôture d'un TN.
 *
 * Algorithme donné par le responsable national (remarques du 11 novembre 2026) :
 * - La licence est la clé (le nom en secours). Un joueur inconnu rencontré à un TN est ajouté.
 * - À la clôture, le classement glissant est d'abord mis à jour (le TN le plus ancien sort, le
 *   nouveau entre, tri), puis on le balaie. Pour chaque joueur :
 *   - il a joué ce TN → « classement » (`currentPlace`) ET « dernier » (`lastPlace`) prennent sa
 *     place actuelle, et `lastSeason` = saison en cours ;
 *   - il n'a pas joué ce TN mais a encore des points → `currentPlace` = sa place actuelle,
 *     `lastPlace` inchangé ;
 *   - il est à 0 (sorti du classement) → `currentPlace` effacé, `lastPlace` inchangé.
 * - `lastPlace` est donc la place au classement glissant à l'issue du dernier TN joué.
 * - Un joueur inscrit qui abandonne sans marquer de point (0 au barème) n'est pas compté comme
 *   ayant joué pour le « dernier » : c'est ce que montre la base remise d'équerre par le
 *   responsable le 11 novembre 2026 (un abandon du vendredi au TN 2 garde son « dernier »).
 * - Pour la liste ordonnée (`orderParticipants`), un joueur hors classement avec un dernier
 *   classement `P` prend la place 9 si `P ≤ 8`, sinon `P + 0,5` (SPEC §2). Point à confirmer :
 *   l'outil Excel place au contraire un ancien joueur Masters (`P < 8`) en tête de liste.
 *
 * Point à confirmer : un joueur encore dans la fenêtre avec 0 point (uniquement des abandons)
 * et absent du TN clôturé est traité comme « à 0 » : son `currentPlace` est effacé, alors qu'il
 * figure encore en queue du classement glissant.
 */
import type { PlayerRecord, RankingRow, SeasonId } from "./types.js";

import { seasonStartYear } from "./glissant.js";

/** Normalise une licence (majuscules, sans espaces). */
export function normalizeLicence(licence: string): string {
  return licence.trim().toUpperCase();
}

/** Normalise un nom « NOM PRENOM » (majuscules, espaces simples). */
export function normalizeName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Met à jour la base après la clôture d'un TN. `ranking` est le classement glissant recalculé
 * (TN clôturé inclus) ; `participants` sont les joueurs de ce TN.
 */
export function updatePlayerBase(
  base: PlayerRecord[],
  ranking: RankingRow[],
  season: SeasonId,
  participants: {
    licence: string;
    name: string;
    club: string;
    junior?: boolean;
    /** Abandon sans aucun point au barème : inscrit, mais pas « joué » pour le « dernier ». */
    scoreless?: boolean;
  }[],
): PlayerRecord[] {
  const byLicence = new Map<string, PlayerRecord>();
  const byName = new Map<string, PlayerRecord>();
  const out = base.map((p) => ({ ...p }));
  for (const p of out) {
    byLicence.set(normalizeLicence(p.licence), p);
    byName.set(normalizeName(p.name), p);
  }
  const find = (licence: string, name: string): PlayerRecord | undefined =>
    (licence !== "" ? byLicence.get(normalizeLicence(licence)) : undefined) ??
    byName.get(normalizeName(name));
  const ensure = (licence: string, name: string, club: string): PlayerRecord => {
    let p = find(licence, name);
    if (!p) {
      p = {
        licence: normalizeLicence(licence),
        name: normalizeName(name),
        club,
        lastSeason: null,
        currentPlace: null,
        lastPlace: null,
      };
      out.push(p);
      byLicence.set(p.licence, p);
      byName.set(p.name, p);
    }
    if (club !== "") p.club = club;
    return p;
  };
  // Joueurs du TN clôturé : saison en cours (et drapeau U21 s'il est fourni).
  const played = new Set<PlayerRecord>();
  for (const pl of participants) {
    const p = ensure(pl.licence, pl.name, pl.club);
    if (!pl.scoreless) played.add(p);
    if (p.lastSeason === null || seasonStartYear(season) >= seasonStartYear(p.lastSeason))
      p.lastSeason = season;
    if (pl.junior !== undefined) p.junior = pl.junior;
  }
  // Balayage du classement glissant : place actuelle de chaque joueur classé.
  const ranked = new Map<PlayerRecord, RankingRow>();
  for (const r of ranking) ranked.set(ensure(r.licence, r.name, r.club), r);
  for (const p of out) {
    const row = ranked.get(p);
    if (row && played.has(p)) {
      // A joué ce TN : « classement » et « dernier » prennent la place actuelle.
      p.currentPlace = row.position;
      p.lastPlace = row.position;
    } else if (row && row.pts > 0) {
      // N'a pas joué ce TN mais a encore des points : « classement » seul.
      p.currentPlace = row.position;
    } else {
      // À 0 (sorti du classement) : « classement » effacé, « dernier » conservé.
      p.currentPlace = null;
    }
  }
  return out;
}

/**
 * Classement en cours par licence (et nom en secours), tel que la base le porte : c'est la
 * place utilisée pour la liste ordonnée d'un TN (colonne « classement en cours » de l'onglet
 * INSCRITS de l'outil de référence), mise à jour à chaque clôture.
 */
export function currentPlaces(base: PlayerRecord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of base) {
    if (p.currentPlace === null) continue;
    out[p.licence] = p.currentPlace;
    out[p.name] = p.currentPlace;
  }
  return out;
}

/** Derniers classements connus par licence (et nom en secours), pour `orderParticipants`. */
export function lastKnownPlaces(
  base: PlayerRecord[],
): Record<string, { place: number; season: number }> {
  const out: Record<string, { place: number; season: number }> = {};
  for (const p of base) {
    const place = p.currentPlace ?? p.lastPlace;
    if (place === null) continue;
    const season = p.lastSeason === null ? 0 : seasonStartYear(p.lastSeason);
    out[p.licence] = { place, season };
    out[p.name] = { place, season };
  }
  return out;
}

/** Recherche plein texte simple (nom, club, licence), sans accents ni casse. */
export function searchPlayers(base: PlayerRecord[], query: string): PlayerRecord[] {
  const q = query.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (q === "") return base;
  const norm = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return base.filter((p) => norm(`${p.name} ${p.club} ${p.licence}`).includes(q));
}

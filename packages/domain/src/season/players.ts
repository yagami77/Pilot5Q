/**
 * Base historique des joueurs (SPEC §2) et sa mise à jour à la clôture d'un TN.
 *
 * Règles (onglet `database` de l'outil Excel : DERNIERE_SAISON, POS_THIS_S, CLS GLIS) :
 * - La licence est la clé. Un joueur inconnu rencontré à un TN est ajouté.
 * - Après chaque clôture, chaque joueur présent au classement glissant reçoit `currentPlace` =
 *   sa place et `lastPlace` = cette même place ; un joueur sorti de la fenêtre garde son
 *   `lastPlace` (classement en cours au moment de son dernier TN dans la fenêtre) et perd son
 *   `currentPlace`.
 * - `lastSeason` = saison du dernier TN joué (les participants du TN clôturé).
 * - Pour la liste ordonnée (`orderParticipants`), un joueur hors classement avec un dernier
 *   classement `P` prend la place 9 si `P ≤ 8`, sinon `P + 0,5` (SPEC §2). Point à confirmer :
 *   l'outil Excel place au contraire un ancien joueur Masters (`P < 8`) en tête de liste.
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

/** Met à jour la base après la clôture d'un TN. */
export function updatePlayerBase(
  base: PlayerRecord[],
  ranking: RankingRow[],
  season: SeasonId,
  participants: { licence: string; name: string; club: string; junior?: boolean }[],
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
  for (const pl of participants) {
    const p = ensure(pl.licence, pl.name, pl.club);
    if (p.lastSeason === null || seasonStartYear(season) >= seasonStartYear(p.lastSeason))
      p.lastSeason = season;
    if (pl.junior !== undefined) p.junior = pl.junior;
  }
  for (const p of out) p.currentPlace = null;
  for (const r of ranking) {
    const p = ensure(r.licence, r.name, r.club);
    p.currentPlace = r.position;
    p.lastPlace = r.position;
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

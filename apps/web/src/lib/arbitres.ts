/**
 * Arbitres du dimanche (SPEC §6 ; retours du 6 novembre : deux arbitres par match, saisis par
 * licence avec le nom retrouvé). Les personnes connues sont les joueurs du tournoi puis, si la
 * saison du responsable est présente dans ce navigateur, la base joueurs de la saison (lecture
 * seule).
 */
import type { TournamentState } from "@pilot5q/domain";
import { useEffect, useMemo, useState } from "react";

import { loadCurrentSeasonId, loadSeason } from "@/admin/persistence";

export interface KnownPerson {
  licence: string;
  name: string;
  club: string;
  source: "tournoi" | "saison";
}

/** Licence normalisée pour la comparaison (majuscules, sans espaces). */
export function normLicence(s: string): string {
  return s.replace(/\s+/g, "").toUpperCase();
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Joueurs du tournoi, puis personnes de la saison absentes du tournoi (sans doublon de licence). */
export function knownPeople(
  state: TournamentState,
  season: { licence: string; name: string; club: string }[] = [],
): KnownPerson[] {
  const out: KnownPerson[] = [];
  const seen = new Set<string>();
  for (const p of state.players) {
    const k = normLicence(p.licence);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ licence: p.licence, name: p.name, club: p.club, source: "tournoi" });
  }
  for (const p of season) {
    const k = normLicence(p.licence);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ licence: p.licence, name: p.name, club: p.club, source: "saison" });
  }
  return out;
}

/** Personne d'après sa licence exacte (null si inconnue). */
export function findByLicence(people: KnownPerson[], licence: string | null | undefined) {
  const k = normLicence(licence ?? "");
  if (!k) return null;
  return people.find((p) => normLicence(p.licence) === k) ?? null;
}

/**
 * Suggestions pendant la saisie : licences qui commencent par le texte saisi, puis noms qui le
 * contiennent (sans accents ni casse), joueurs du tournoi d'abord.
 */
export function searchPeople(people: KnownPerson[], query: string, limit = 6): KnownPerson[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const lic = normLicence(q);
  const f = fold(q);
  const byLicence = people.filter((p) => normLicence(p.licence).startsWith(lic));
  const byName = people.filter((p) => !byLicence.includes(p) && fold(p.name).includes(f));
  const rank = (p: KnownPerson) => (p.source === "tournoi" ? 0 : 1);
  return [
    ...byLicence.sort((a, b) => rank(a) - rank(b)),
    ...byName.sort((a, b) => rank(a) - rank(b)),
  ].slice(0, limit);
}

/** Personnes connues (tournoi + base joueurs de la saison si elle est dans ce navigateur). */
export function useKnownPeople(state: TournamentState): KnownPerson[] {
  const [season, setSeason] = useState<{ licence: string; name: string; club: string }[]>([]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const id = await loadCurrentSeasonId();
      const doc = id ? await loadSeason(id) : null;
      if (alive && doc) setSeason(doc.players);
    })();
    return () => {
      alive = false;
    };
  }, []);
  return useMemo(() => knownPeople(state, season), [state, season]);
}

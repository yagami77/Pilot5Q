/**
 * Tirage des poules : serpentin, contrainte club, matchs d'une poule (SPEC §3, §4).
 *
 * Règles implémentées :
 * - Serpentin (§1, §3) : joueurs déjà ordonnés, répartis en zigzag (1→n, n→1, 1→n, n→1) dans
 *   des poules de 4, avec au plus `maxPoulesOf3` poules de 3. Le nombre de poules de 3 est le
 *   plus petit possible ((4 − n mod 4) mod 4) ; s'il dépasse le maximum, une erreur explicite
 *   est levée. Les poules de 3 sont les PREMIÈRES (poules 1 à k3), comme dans l'outil Excel de
 *   référence (VBA : une poule est de 3 si son numéro ≤ POULES_3_NB) et le livret (« les poules
 *   de 4 commenceront nécessairement avant les poules de 3 ») : au dernier passage (n→1), les
 *   poules 1 à k3 sont sautées, ce sont donc les joueurs les plus faibles du tirage qui manquent,
 *   et les têtes de série 1 à k3 jouent un match de moins.
 * - Contrainte club (§3) : jamais 3 joueurs du même club dans une poule. Résolution : on
 *   reconstitue la liste linéaire du serpentin, on décale d'un cran vers le bas le moins bien
 *   classé des joueurs en conflit (échange avec son suivant), on recalcule le serpentin et on
 *   recommence. Boucle bornée avec détection de cycle ; les poules encore en conflit sont
 *   signalées (numéros 1-based) pour correction manuelle.
 * - Matchs d'une poule (§4) : ids stables `P{num}-M{i}`. Pour 4 joueurs, les 6 confrontations
 *   sont générées dans un ordre fixe : 2–3, 1–4, 1–3, 2–4, 1–2, 3–4. Le code sportif prévoit
 *   « 2–3, 1–4, perdants, gagnants, dernier match de 4, dernier match de 1 » : l'ordre réel
 *   des matchs 3 à 6 dépend donc des résultats et n'est pas connu au tirage ; seuls les deux
 *   premiers (M1, M2) sont certains. Pour 3 joueurs : 2–3, 1–3, 1–2 (§4 : « 2–3, 1–gagnant,
 *   dernier » ; même remarque).
 */
import type { Match } from "./types.js";

/** Remplit des poules de tailles données en serpentin (tête de poule en premier). */
export function serpentinWithSizes(players: string[], sizes: number[]): string[][] {
  const poules: string[][] = sizes.map(() => []);
  const k = sizes.length;
  let next = 0;
  for (let pass = 0; next < players.length; pass++) {
    const before = next;
    for (let step = 0; step < k && next < players.length; step++) {
      const i = pass % 2 === 0 ? step : k - 1 - step;
      const poule = poules[i];
      const size = sizes[i];
      if (poule === undefined || size === undefined || poule.length >= size) continue;
      const p = players[next];
      if (p === undefined) break;
      poule.push(p);
      next++;
    }
    if (next === before) throw new Error("Capacité des poules insuffisante pour tous les joueurs");
  }
  return poules;
}

/** Tailles des poules pour `n` joueurs : poules de 4, au plus `maxPoulesOf3` poules de 3, placées en premier. */
export function pouleSizes(n: number, maxPoulesOf3: number): number[] {
  if (!Number.isInteger(n) || n < 3) {
    throw new Error(`Impossible de former des poules avec ${n} joueur(s)`);
  }
  const k3 = (4 - (n % 4)) % 4;
  const k = (n + k3) / 4;
  if (k3 > maxPoulesOf3 || k3 > k) {
    throw new Error(
      `${n} joueurs : il faudrait ${k3} poule(s) de 3 (maximum ${Math.min(maxPoulesOf3, k)}) ; ajuster le nombre de joueurs`,
    );
  }
  return Array.from({ length: k }, (_, i) => (i < k3 ? 3 : 4));
}

/** Répartition en serpentin, poules de 4 et au plus `maxPoulesOf3` poules de 3 (SPEC §3). */
export function serpentin(players: string[], maxPoulesOf3: number): string[][] {
  return serpentinWithSizes(players, pouleSizes(players.length, maxPoulesOf3));
}

/** Reconstitue la liste linéaire (ordre du serpentin) à partir de poules remplies en serpentin. */
export function serpentinOrder(poules: string[][]): string[] {
  const k = poules.length;
  const maxSize = Math.max(0, ...poules.map((p) => p.length));
  const out: string[] = [];
  for (let pass = 0; pass < maxSize; pass++) {
    for (let step = 0; step < k; step++) {
      const i = pass % 2 === 0 ? step : k - 1 - step;
      const p = poules[i]?.[pass];
      if (p !== undefined) out.push(p);
    }
  }
  return out;
}

/** Numéros (1-based) des poules contenant au moins 3 joueurs du même club. */
export function clubConflicts(poules: string[][], clubOf: Record<string, string>): number[] {
  const out: number[] = [];
  poules.forEach((poule, i) => {
    if (conflictingPlayers(poule, clubOf).length > 0) out.push(i + 1);
  });
  return out;
}

/** Joueurs d'une poule appartenant à un club représenté au moins 3 fois (ordre de la poule). */
function conflictingPlayers(poule: string[], clubOf: Record<string, string>): string[] {
  const counts = new Map<string, number>();
  for (const name of poule) {
    const club = clubOf[name];
    if (club === undefined || club === "") continue;
    counts.set(club, (counts.get(club) ?? 0) + 1);
  }
  return poule.filter((name) => {
    const club = clubOf[name];
    return club !== undefined && (counts.get(club) ?? 0) >= 3;
  });
}

/** Contrainte club : jamais 3 joueurs du même club dans une poule (SPEC §3). */
export function resolveClubConflicts(
  poules: string[][],
  clubOf: Record<string, string>,
): { poules: string[][]; unresolved: number[] } {
  const sizes = poules.map((p) => p.length);
  let linear = serpentinOrder(poules);
  const seen = new Set<string>();
  let best: { poules: string[][]; unresolved: number[] } = {
    poules: poules.map((p) => [...p]),
    unresolved: clubConflicts(poules, clubOf),
  };
  const maxIterations = Math.max(50, linear.length * linear.length);
  for (let iter = 0; iter < maxIterations; iter++) {
    const key = linear.join("\u0000");
    if (seen.has(key)) break; // cycle : on s'arrête sur la meilleure configuration vue
    seen.add(key);
    const current = serpentinWithSizes(linear, sizes);
    const conflicts = clubConflicts(current, clubOf);
    if (conflicts.length < best.unresolved.length)
      best = { poules: current, unresolved: conflicts };
    if (conflicts.length === 0) return { poules: current, unresolved: [] };
    const first = conflicts[0];
    const poule = first === undefined ? undefined : current[first - 1];
    if (poule === undefined) break;
    const names = conflictingPlayers(poule, clubOf);
    // Le moins bien classé des joueurs en conflit = le plus bas dans la liste linéaire.
    const idx = Math.max(...names.map((n) => linear.indexOf(n)));
    if (idx < 0 || idx >= linear.length - 1) break; // impossible de décaler plus bas
    const shifted = [...linear];
    const a = shifted[idx];
    const b = shifted[idx + 1];
    if (a === undefined || b === undefined) break;
    shifted[idx] = b;
    shifted[idx + 1] = a;
    linear = shifted;
  }
  return { poules: best.poules.map((p) => [...p]), unresolved: [...best.unresolved] };
}

/** Ordre fixe des confrontations selon la taille de la poule (indices 0-based). */
function pairings(n: number): [number, number][] {
  if (n === 4) {
    return [
      [1, 2],
      [0, 3],
      [0, 2],
      [1, 3],
      [0, 1],
      [2, 3],
    ];
  }
  if (n === 3) {
    return [
      [1, 2],
      [0, 2],
      [0, 1],
    ];
  }
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
  return out;
}

/** Matchs d'une poule dans l'ordre du code sportif (SPEC §4). */
export function pouleMatches(pouleNum: number, players: string[]): Match[] {
  const out: Match[] = [];
  pairings(players.length).forEach(([i, j], k) => {
    const a = players[i];
    const b = players[j];
    if (a === undefined || b === undefined) return;
    out.push({ id: `P${pouleNum}-M${k + 1}`, a, b, sa: null, sb: null });
  });
  return out;
}

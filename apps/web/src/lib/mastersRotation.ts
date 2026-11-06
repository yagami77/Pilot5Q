/**
 * Tours de jeu Masters (livret, « Tournoi de Qualification Masters ») : quand le club n'a que
 * 3 billards 3m10 pour les 4 poules Masters, les poules tournent. Les poules 1 à 3 commencent ;
 * le premier billard libéré prend le premier match de la poule 4, puis la rotation continue :
 * poule 1 match 2, poule 2 match 2, poule 3 match 2, poule 4 match 2, poule 1 match 3…
 *
 * Fonction pure : la liste ordonnée des matchs, avec le billard de départ des premiers matchs
 * et un tour indicatif (à durée de match égale). Les matchs 3 à 6 d'une poule dépendent des
 * résultats des deux premiers : tant qu'ils sont inconnus, la ligne décrit les joueurs
 * (« Perdant du 2 c. 3 »…).
 */
import type { Billard, Distance, Poule, TournamentState } from "@pilot5q/domain";

import { isValidScore, matchLabels, matchWinner } from "./engine";
import { orderedMatches, phaseDistance, pouleBillards } from "./tournament";

export interface RotationRow {
  /** Rang dans la rotation (1, 2, 3…). */
  order: number;
  /** Tour indicatif, à durée de match égale (1 = premiers matchs). */
  tour: number;
  poule: number;
  /** Numéro du match dans la poule (1 à 6), ordre du code sportif. */
  match: number;
  label: string;
  /** Joueurs, ou leur description tant que les résultats précédents manquent. */
  a: string;
  b: string;
  /** Les deux noms sont-ils connus (sinon `a`/`b` sont en partie des descriptions) ? */
  known: boolean;
  /** `a` (et `b`) est-il un nom de joueur, ou une description ? */
  aIsName: boolean;
  bIsName: boolean;
  arbitre: string | null;
  /** Billard de départ (premiers matchs), sinon null : premier billard libéré. */
  billard: number | null;
  /** Billard indicatif (durées égales) pour les matchs suivants. */
  billardHint: number | null;
  played: boolean;
}

export interface Rotation {
  rows: RotationRow[];
  /** Billards utilisés, dans l'ordre de départ. */
  billards: number[];
  /** Vrai s'il y a moins de billards que de poules (rotation nécessaire). */
  needed: boolean;
}

/**
 * Joueurs d'un match dont les adversaires dépendent des résultats : nom quand il est connu
 * (le 1 ou le 4 de la poule), sinon description.
 */
function placeholders(poule: Poule, index: number): [string, boolean, string, boolean] {
  const [p1, , , p4] = poule.players;
  if (poule.players.length === 3) {
    return [
      p1 ?? "Joueur 1",
      Boolean(p1),
      index === 1 ? "Gagnant du 2 c. 3" : "Perdant du 2 c. 3",
      false,
    ];
  }
  switch (index) {
    case 2:
      return ["Perdant du 2 c. 3", false, "Perdant du 1 c. 4", false];
    case 3:
      return ["Gagnant du 2 c. 3", false, "Gagnant du 1 c. 4", false];
    case 4:
      return [p4 ?? "Joueur 4", Boolean(p4), "Adversaire restant", false];
    default:
      return [p1 ?? "Joueur 1", Boolean(p1), "Adversaire restant", false];
  }
}

/** Les deux premiers matchs (un seul pour une poule de 3) sont-ils joués ? */
function openingKnown(poule: Poule, d: Distance): boolean {
  const om = orderedMatches(poule, d);
  const first = poule.players.length === 3 ? om.slice(0, 1) : om.slice(0, 2);
  return first.length > 0 && first.every((o) => matchWinner(o.match, d) !== null);
}

/**
 * Rotation des matchs Masters sur les billards disponibles.
 * @param poules poules Masters (dans l'ordre des numéros)
 * @param billardsOf billards affectés à une poule
 * @param bigBillards billards 3m10 du club (repli si aucune affectation)
 */
export function mastersRotation(
  poules: Poule[],
  billardsOf: (p: Poule) => number[],
  bigBillards: Billard[],
  d: Distance,
): Rotation {
  const sorted = [...poules].sort((a, b) => a.num - b.num);
  // Billards : ceux affectés aux poules (ordre des poules), sinon les 3m10 du club
  const tables: number[] = [];
  for (const p of sorted) for (const b of billardsOf(p)) if (!tables.includes(b)) tables.push(b);
  if (tables.length === 0)
    for (const b of [...bigBillards].sort((x, y) => x.num - y.num)) tables.push(b.num);
  const n = Math.max(1, Math.min(tables.length, sorted.length));
  const needed = tables.length > 0 && tables.length < sorted.length;

  const ordered = sorted.map((p) => ({
    poule: p,
    om: orderedMatches(p, d),
    known: openingKnown(p, d),
  }));
  const rounds = Math.max(0, ...ordered.map((o) => o.om.length));
  const rows: RotationRow[] = [];
  // Billard de départ de chaque poule qui commence : le sien s'il est libre, sinon un autre
  const startTables = new Map<number, number>();
  const used = new Set<number>();
  for (const p of sorted.slice(0, n)) {
    const own = billardsOf(p).find((b) => tables.includes(b) && !used.has(b));
    if (own !== undefined) {
      startTables.set(p.num, own);
      used.add(own);
    }
  }
  for (const p of sorted.slice(0, n)) {
    if (startTables.has(p.num)) continue;
    const free = tables.find((b) => !used.has(b));
    if (free !== undefined) {
      startTables.set(p.num, free);
      used.add(free);
    }
  }

  for (let m = 0; m < rounds; m++) {
    for (const { poule, om, known } of ordered) {
      const o = om[m];
      if (!o) continue;
      const k = rows.length;
      const isKnown = m < (poule.players.length === 3 ? 1 : 2) || known;
      const [pa, aIsName, pb, bIsName] = isKnown
        ? [o.match.a, true, o.match.b, true]
        : placeholders(poule, m);
      // Sans rotation, chaque poule garde son billard
      const own = needed ? null : (billardsOf(poule)[0] ?? null);
      const start = k < n ? (startTables.get(poule.num) ?? null) : null;
      const hint = needed ? (k < n ? start : (rows[k - n]?.billardHint ?? null)) : own;
      rows.push({
        order: k + 1,
        tour: Math.floor(k / n) + 1,
        poule: poule.num,
        match: m + 1,
        label: o.label || matchLabels(poule.players.length)[m] || `Match ${m + 1}`,
        a: pa,
        b: pb,
        known: isKnown,
        aIsName,
        bIsName,
        arbitre: isKnown ? o.arbitre || null : null,
        billard: needed ? start : own,
        billardHint: hint,
        played: isValidScore(o.match, d),
      });
    }
  }
  return { rows, billards: tables, needed };
}

/** Rotation des poules Masters d'un tournoi (billards affectés, sinon 3m10 du club). */
export function mastersRotationOf(state: TournamentState): Rotation {
  return mastersRotation(
    state.poules.QM,
    (p) => pouleBillards(state, "QM", p),
    state.billards.filter((b) => b.type === "3m10"),
    phaseDistance(state, "QM"),
  );
}

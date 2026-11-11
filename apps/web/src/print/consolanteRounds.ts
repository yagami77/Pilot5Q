/**
 * Tours de jeu de la consolante (onglet « TDJ CLS » de l'outil Excel de référence) : la liste
 * ordonnée des matchs du tableau, tour par tour (barrages éventuels, seizièmes, huitièmes,
 * quarts, demi-finales, finale), avec leur billard et leur passage.
 *
 * Billards (SPEC §5 : la consolante se joue sur des 2m80) : le journal du tournoi ne porte pas
 * de tirage des billards pour la consolante. Un match garde son billard s'il en a un
 * (`billardAssignments.CLS`) ; sinon les matchs d'un tour sont répartis dans l'ordre du tableau
 * sur les billards 2m80 laissés libres par les poules du samedi (National et Masters), ou sur
 * tous les 2m80 si aucun n'est libre. Quand un tour compte plus de matchs que de billards, les
 * matchs suivants forment un 2e passage, un 3e… : leur billard est alors indicatif (à durée de
 * match égale), le premier billard libéré prenant le match suivant de la liste, comme pour les
 * tours de jeu Masters.
 *
 * Fonction pure, sans effet sur l'état.
 */
import type { BracketMatch, BracketRound, Distance, TournamentState } from "@pilot5q/domain";

import { matchWinner } from "@/lib/engine";
import { phaseDistance, pouleBillards, roundLabel, roundShort } from "@/lib/tournament";

const ROUNDS: BracketRound[] = ["R64", "R32", "R16", "QF", "SF", "F"];
/** Nombre de matchs d'un tour complet. */
const FULL: Record<BracketRound, number> = { R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 };

export interface ConsolanteRow {
  /** Rang dans la liste, tous tours confondus : ordre de lancement des matchs. */
  order: number;
  id: string;
  /** Code du match, celui du tableau à l'écran : « S2 », « H3 », « Q1 », « D2 », « F ». */
  code: string;
  /** Nom du joueur, ou provenance tant qu'il n'est pas connu (« Vainqueur H3 »). */
  a: string;
  b: string;
  aKnown: boolean;
  bKnown: boolean;
  billard: number | null;
  /** Billard ferme (tiré, ou 1er passage) ; sinon indicatif : premier billard libéré. */
  billardFirm: boolean;
  /** Passage sur les billards dans le tour (1 = premiers matchs lancés). */
  passage: number;
  played: boolean;
  /** Match du tableau (scores déjà saisis, pour la réimpression). */
  match: BracketMatch;
}

export interface ConsolanteTour {
  round: BracketRound;
  /** « Seizièmes (barrages) », « Huitièmes », « Finale »… */
  label: string;
  distance: Distance;
  rows: ConsolanteRow[];
  /** Nombre de passages (1 : tous les matchs du tour démarrent ensemble). */
  passages: number;
}

export interface ConsolanteRounds {
  /** Billards de la consolante, dans l'ordre de répartition. */
  billards: number[];
  /** Vrai si au moins un match porte un billard tiré (affectation enregistrée). */
  drawn: boolean;
  tours: ConsolanteTour[];
}

/** Libellé d'attente lisible : « Vainqueur R32-2 » → « Vainqueur S2 ». */
export function waitingLabel(label: string | undefined): string {
  return (label ?? "").replace(
    /\b(R64|R32|R16|QF|SF)-?(\d+)/g,
    (_, r: BracketRound, n: string) => `${roundShort(r)}${n}`,
  );
}

/**
 * Billards de la consolante : les 2m80 que les poules du samedi n'occupent pas ; à défaut tous
 * les 2m80 ; à défaut (club sans 2m80) tous les billards.
 */
export function consolanteBillards(state: TournamentState): number[] {
  const small = state.billards.filter((b) => b.type === "2m80").map((b) => b.num);
  const taken = new Set<number>();
  for (const phase of ["QN", "QM"] as const) {
    for (const p of state.poules[phase])
      for (const b of pouleBillards(state, phase, p)) taken.add(b);
    // Poules du samedi pas encore composées : on lit le tirage des billards déjà enregistré
    if (state.poules[phase].length === 0)
      for (const list of Object.values(state.billardAssignments[phase] ?? {}))
        for (const b of list) taken.add(b);
  }
  const free = small.filter((b) => !taken.has(b));
  const tables =
    free.length > 0 ? free : small.length > 0 ? small : state.billards.map((b) => b.num);
  return [...tables].sort((x, y) => x - y);
}

/** Tours de jeu de la consolante d'un tournoi (vide tant que le tableau n'est pas créé). */
export function consolanteRounds(state: TournamentState): ConsolanteRounds {
  const bracket = state.brackets.CLS;
  const billards = consolanteBillards(state);
  const tours: ConsolanteTour[] = [];
  let order = 0;
  let drawn = false;
  for (const round of ROUNDS) {
    const matches = bracket.filter((m) => m.round === round).sort((x, y) => x.slot - y.slot);
    if (matches.length === 0) continue;
    const distance = phaseDistance(state, "CLS", round);
    // Charge de chaque billard dans le tour : d'abord les matchs dont le billard est tiré, puis
    // les autres dans l'ordre du tableau, chacun sur le billard le moins chargé
    const load = new Map<number, number>(billards.map((b) => [b, 0]));
    const take = (billard: number): number => {
      const passage = (load.get(billard) ?? 0) + 1;
      load.set(billard, passage);
      return passage;
    };
    const placed = new Map<string, { billard: number | null; passage: number; own: boolean }>();
    for (const m of matches) {
      if (m.billard === null || m.billard === undefined) continue;
      drawn = true;
      placed.set(m.id, { billard: m.billard, passage: take(m.billard), own: true });
    }
    for (const m of matches) {
      if (placed.has(m.id)) continue;
      let billard: number | null = null;
      for (const b of billards)
        if (billard === null || (load.get(b) ?? 0) < (load.get(billard) ?? 0)) billard = b;
      placed.set(m.id, {
        billard,
        passage: billard === null ? 1 : take(billard),
        own: false,
      });
    }
    const ordered = matches
      .map((m) => ({ m, ...placed.get(m.id)! }))
      .sort((x, y) => x.passage - y.passage || x.m.slot - y.m.slot);
    const rows: ConsolanteRow[] = ordered.map(({ m, billard, passage, own }) => ({
      order: ++order,
      id: m.id,
      code: round === "F" ? "F" : `${roundShort(round)}${m.slot}`,
      a: m.a || waitingLabel(m.labelA),
      b: m.b || waitingLabel(m.labelB),
      aKnown: Boolean(m.a),
      bKnown: Boolean(m.b),
      billard,
      billardFirm: own || passage === 1,
      passage,
      played: Boolean(m.a && m.b && matchWinner(m, distance)),
      match: m,
    }));
    // Premier tour rempli à moitié au plus : ce sont les « barrages » de l'outil Excel (tour
    // préliminaire, cf. `consolanteBracket`) ; au-delà, c'est un tour normal avec des exempts
    const preliminary = tours.length === 0 && matches.length <= FULL[round] / 2;
    tours.push({
      round,
      label: preliminary ? `${roundLabel(round)} (barrages)` : roundLabel(round),
      distance,
      rows,
      passages: Math.max(1, ...rows.map((r) => r.passage)),
    });
  }
  return { billards, drawn, tours };
}

/**
 * Tours répartis en pages A4 : lignes de 7,6 mm, un titre de tour compte pour 1,3 ligne, un
 * tour n'est pas coupé entre deux pages (le plus long, seize matchs, tient sur une page).
 */
export function consolantePages(rounds: ConsolanteRounds, capacity = 29): ConsolanteTour[][] {
  const pages: ConsolanteTour[][] = [];
  let current: ConsolanteTour[] = [];
  let used = 0;
  for (const tour of rounds.tours) {
    const cost = tour.rows.length + 1.3;
    if (current.length > 0 && used + cost > capacity) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(tour);
    used += cost;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

/**
 * Tours de jeu de la consolante (onglet « TDJ CLS » de l'outil Excel de référence) : la liste
 * ordonnée des matchs du tableau, tour par tour (barrages éventuels, seizièmes, huitièmes,
 * quarts, demi-finales, finale), dans l'ordre du tableau.
 *
 * Billards : aucun n'est proposé (réponse du responsable national, 11 novembre : « pas besoin
 * d'indiquer les billards pour la consolante »). Le document garde une colonne « Billard » vide,
 * à remplir à la main sur place, comme l'onglet du classeur.
 *
 * Noms des tours et codes des matchs : `bracketNaming` (B = barrages, S, H, Q, D, F), les mêmes
 * qu'à l'écran et sur le tableau imprimé.
 *
 * Fonction pure, sans effet sur l'état.
 */
import type { BracketMatch, BracketRound, Distance, TournamentState } from "@pilot5q/domain";

import { bracketNaming } from "@/lib/bracketNaming";
import { matchWinner } from "@/lib/engine";
import { phaseDistance } from "@/lib/tournament";

const ROUNDS: BracketRound[] = ["R64", "R32", "R16", "QF", "SF", "F"];

export interface ConsolanteRow {
  /** Rang dans la liste, tous tours confondus : ordre de lancement des matchs. */
  order: number;
  id: string;
  /** Code du match, celui du tableau à l'écran : « B1 », « H3 », « Q1 », « D2 », « F ». */
  code: string;
  /** Nom du joueur, ou provenance tant qu'il n'est pas connu (« Vainqueur B1 »). */
  a: string;
  b: string;
  aKnown: boolean;
  bKnown: boolean;
  played: boolean;
  /** Match du tableau (scores déjà saisis, pour la réimpression). */
  match: BracketMatch;
}

export interface ConsolanteTour {
  round: BracketRound;
  /** « Barrages », « Seizièmes », « Huitièmes », « Finale »… */
  label: string;
  distance: Distance;
  rows: ConsolanteRow[];
}

export interface ConsolanteRounds {
  tours: ConsolanteTour[];
}

/** Tours de jeu de la consolante d'un tournoi (vide tant que le tableau n'est pas créé). */
export function consolanteRounds(state: TournamentState): ConsolanteRounds {
  const bracket = state.brackets.CLS;
  const naming = bracketNaming(bracket);
  const tours: ConsolanteTour[] = [];
  let order = 0;
  for (const round of ROUNDS) {
    const matches = bracket.filter((m) => m.round === round).sort((x, y) => x.slot - y.slot);
    if (matches.length === 0) continue;
    const distance = phaseDistance(state, "CLS", round);
    const rows: ConsolanteRow[] = matches.map((m) => ({
      order: ++order,
      id: m.id,
      code: naming.code(m),
      a: m.a || naming.waiting(m.labelA),
      b: m.b || naming.waiting(m.labelB),
      aKnown: Boolean(m.a),
      bKnown: Boolean(m.b),
      played: Boolean(m.a && m.b && matchWinner(m, distance)),
      match: m,
    }));
    tours.push({ round, label: naming.round(round), distance, rows });
  }
  return { tours };
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

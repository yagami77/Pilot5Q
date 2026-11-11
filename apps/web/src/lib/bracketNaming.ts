/**
 * Noms des tours et codes des matchs d'un tableau à élimination directe, tels que le directeur
 * de jeu les lit à l'écran et sur les documents. C'est le seul endroit où ils sont dérivés :
 * tableau à l'écran, tableau imprimé et tours de jeu de la consolante disent la même chose.
 *
 * Réponse du responsable national (11 novembre) : « B = barrages, S = seizièmes, H = huitièmes,
 * Q = quarts, D = demies, F = finale ». Les barrages sont les matchs préliminaires d'un tableau
 * (`preliminaryRound` du domaine : 3 matchs avant les huitièmes pour 19 joueurs, 8 avant les
 * seizièmes pour 40) ; ils sont numérotés B1, B2… dans l'ordre du tableau, comme dans le classeur
 * Excel. « Seizièmes » et S1 à S16 sont réservés à un vrai tour de seizièmes.
 *
 * Les identifiants des matchs (`CLS-R32-2`) et les libellés du domaine (« Vainqueur R32-2 ») ne
 * changent pas : seuls l'affichage et l'impression passent par ici.
 */
import type { BracketMatch, BracketRound } from "@pilot5q/domain";
import { preliminaryRound } from "@pilot5q/domain";

import { roundLabel, roundShort } from "./tournament";

type Slot = Pick<BracketMatch, "round" | "slot">;

export interface BracketNaming {
  /** Tour de barrages du tableau, s'il y en a un. */
  barrages: BracketRound | null;
  /** Numéro du match dans son tour : rang du barrage, sinon place dans le tour. */
  number: (m: Slot) => number;
  /** Code du match : « B1 », « S4 », « H3 », « Q1 », « D2 », « F ». */
  code: (m: Slot) => string;
  /** Intitulé du tour : « Barrages », « Seizièmes », « Huitièmes », « Finale »… */
  round: (round: BracketRound) => string;
  /** Intitulé du match : « Barrage 2 », « Huitième 3 », « Finale ». */
  match: (m: Slot) => string;
  /** Joueur attendu : « Vainqueur R32-2 » → « Vainqueur B1 », « Vainqueur QF1 » → « Vainqueur Q1 ». */
  waiting: (label: string | undefined) => string;
}

export function bracketNaming(matches: BracketMatch[]): BracketNaming {
  const barrages = preliminaryRound(matches);
  // Rang de chaque barrage dans l'ordre du tableau (de haut en bas)
  const rank = new Map<number, number>(
    matches
      .filter((m) => m.round === barrages)
      .map((m) => m.slot)
      .sort((a, b) => a - b)
      .map((slot, i) => [slot, i + 1]),
  );
  const number = (m: Slot) => (m.round === barrages ? (rank.get(m.slot) ?? m.slot) : m.slot);
  const code = (m: Slot) =>
    m.round === "F" ? "F" : `${m.round === barrages ? "B" : roundShort(m.round)}${number(m)}`;
  const round = (r: BracketRound) => (r === barrages ? "Barrages" : roundLabel(r));
  const singular = (r: BracketRound) => round(r).replace(/s$/, "");
  return {
    barrages,
    number,
    code,
    round,
    match: (m) => (m.round === "F" ? "Finale" : `${singular(m.round)} ${number(m)}`),
    waiting: (label) =>
      (label ?? "").replace(/\b(R64|R32|R16|QF|SF)-?(\d+)\b/g, (_, r: BracketRound, n: string) =>
        code({ round: r, slot: Number(n) }),
      ),
  };
}

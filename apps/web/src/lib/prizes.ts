/** Tableau des primes (SPEC §6). */
import type { TournamentState } from "@pilot5q/domain";

import { bracketPlacement, phaseRanking } from "./tournament";

export interface PrizeLine {
  label: string;
  /** Part en pourcentage de la cagnotte (unité = 1 %). */
  shares: number;
  count: number;
  amount: number;
  players: string[];
}

export interface Prizes {
  cagnotte: number;
  payers: number;
  ffb: number;
  club: number;
  masters: { total: number; lines: PrizeLine[] };
  national: { total: number; lines: PrizeLine[] };
}

export const FFB_SHARE = 450;
export const CLUB_SHARE = 200;

export function computePrizes(state: TournamentState): Prizes {
  const payers = state.players.filter((p) => !p.junior).length;
  const cagnotte = state.rules.inscriptionFee * payers + FFB_SHARE + CLUB_SHARE;
  const unit = cagnotte / 100;
  const place = (phase: "N" | "M") => bracketPlacement(state, phase);
  const pm = place("M");
  const pn = place("N");
  const byRank = (m: Map<string, number>, r: number) =>
    [...m.entries()].filter(([, v]) => v === r).map(([k]) => k);
  const qm = phaseRanking(state, "QM");
  const poule34 = state.closed.QM
    ? qm.filter((r) => r.rang === 3 || r.rang === 4).map((r) => r.name)
    : [];
  const line = (label: string, shares: number, count: number, players: string[]): PrizeLine => ({
    label,
    shares,
    count,
    amount: Math.round(shares * unit),
    players,
  });
  const masters = [
    line("Vainqueur", 20, 1, byRank(pm, 1)),
    line("Finaliste", 12, 1, byRank(pm, 2)),
    line("Demi-finalistes", 8, 2, byRank(pm, 3)),
    line("Quarts de finale", 4, 4, byRank(pm, 5)),
    line("3e et 4e de poule", 2, 8, poule34),
  ];
  const national = [
    line("Vainqueur", 8, 1, byRank(pn, 1)),
    line("Finaliste", 4, 1, byRank(pn, 2)),
    line("Demi-finalistes", 2, 2, byRank(pn, 3)),
    line("Quarts de finale", 1, 4, byRank(pn, 5)),
  ];
  return {
    cagnotte,
    payers,
    ffb: FFB_SHARE,
    club: CLUB_SHARE,
    masters: { total: Math.round(cagnotte * 0.8), lines: masters },
    national: { total: Math.round(cagnotte * 0.2), lines: national },
  };
}

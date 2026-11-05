/**
 * Primes progressives (SPEC §6) : montants prévus dès le départ (`primesOf` du domaine), chaque
 * ligne se remplit dès que son bénéficiaire est connu — samedi : 3e et 4e de chaque poule
 * Masters terminée ; dimanche : perdants des quarts, des demies, puis finalistes.
 */
import type { BracketMatch, PrimeRow, TournamentState } from "@pilot5q/domain";
import { primesOf } from "@pilot5q/domain";

import { matchWinner } from "./engine";
import { phaseDistance, pouleState } from "./tournament";

export interface PrimeLine {
  /** Clé stable de la ligne (suivi « payé »). */
  key: string;
  phase: "M" | "N";
  label: string;
  pct: number;
  amount: number;
  /** Bénéficiaire, vide tant qu'il n'est pas connu. */
  name: string;
  /** Moment où le bénéficiaire est connu. */
  when: string;
  /** Précision (« poule 2 », « quart 3 »). */
  detail: string;
}

export interface PrimesSheet {
  total: number;
  inscriptions: number;
  ffb: number;
  club: number;
  players: number;
  juniors: number;
  lines: PrimeLine[];
}

const ROUND_LOSER: Record<string, "QF" | "SF" | "F"> = {
  "Perdants quarts": "QF",
  "Perdants demies": "SF",
  "2e": "F",
};

function losersOf(state: TournamentState, phase: "M" | "N", round: "QF" | "SF" | "F"): string[] {
  const out: string[] = [];
  const matches = state.brackets[phase]
    .filter((m: BracketMatch) => m.round === round)
    .sort((a, b) => a.slot - b.slot);
  for (const m of matches) {
    if (!m.a || !m.b) {
      out.push("");
      continue;
    }
    const w = matchWinner(m, phaseDistance(state, phase, m.round));
    out.push(w ? (w === m.a ? m.b : m.a) : "");
  }
  return out;
}

function winnerOf(state: TournamentState, phase: "M" | "N"): string {
  const f = state.brackets[phase].find((m) => m.round === "F");
  if (!f || !f.a || !f.b) return "";
  return matchWinner(f, phaseDistance(state, phase, "F")) ?? "";
}

/** 3e et 4e de chaque poule Masters terminée (dans l'ordre des poules). */
function mastersPoule34(state: TournamentState): { name: string; detail: string }[] {
  const out: { name: string; detail: string }[] = [];
  const poules = [...state.poules.QM].sort((a, b) => a.num - b.num);
  for (let i = 0; i < 4; i++) {
    const p = poules[i];
    const r = p ? pouleState(state, "QM", p) : null;
    const done = Boolean(r?.complete);
    for (const rank of [3, 4]) {
      out.push({
        name: done ? (r?.rows[rank - 1]?.name ?? "") : "",
        detail: `${rank}e poule ${p?.num ?? i + 1}`,
      });
    }
  }
  return out;
}

export function progressivePrimes(state: TournamentState): PrimesSheet {
  const table = primesOf(state);
  const lines: PrimeLine[] = [];
  const build = (phase: "M" | "N", rows: PrimeRow[]) => {
    const counters = new Map<string, number>();
    const poule34 = phase === "M" ? mastersPoule34(state) : [];
    for (const r of rows) {
      const i = counters.get(r.label) ?? 0;
      counters.set(r.label, i + 1);
      let name = "";
      let when = "dimanche";
      let detail = "";
      if (r.label === "1er") {
        name = winnerOf(state, phase);
        detail = "vainqueur";
      } else if (r.label === "3e et 4e de poule") {
        name = poule34[i]?.name ?? "";
        detail = poule34[i]?.detail ?? "";
        when = "samedi";
      } else {
        const round = ROUND_LOSER[r.label];
        if (round) {
          name = losersOf(state, phase, round)[i] ?? "";
          detail =
            round === "QF" ? `quart ${i + 1}` : round === "SF" ? `demie ${i + 1}` : "finaliste";
        }
      }
      lines.push({
        key: `${phase}:${r.label}:${i}`,
        phase,
        label: r.label,
        pct: r.pct,
        amount: r.amount,
        name,
        when,
        detail,
      });
    }
  };
  build("M", table.masters);
  build("N", table.national);
  return {
    total: table.total,
    inscriptions: table.inscriptions,
    ffb: table.ffb,
    club: table.club,
    players: table.players,
    juniors: table.juniors,
    lines,
  };
}

/** Totaux payés / restants (sur les lignes dont le bénéficiaire est connu ou non). */
export function primesTotals(
  lines: PrimeLine[],
  paid: Record<string, string>,
): { paid: number; remaining: number; known: number; paidCount: number } {
  let p = 0;
  let r = 0;
  let known = 0;
  let paidCount = 0;
  for (const l of lines) {
    if (l.name) known++;
    if (paid[l.key] && l.name) {
      p += l.amount;
      paidCount++;
    } else r += l.amount;
  }
  return {
    paid: Math.round(p * 100) / 100,
    remaining: Math.round(r * 100) / 100,
    known,
    paidCount,
  };
}

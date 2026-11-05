/**
 * Démonstration : rejoue les scores réels de tout le week-end du tournoi d'exemple (TN 2
 * 2026-2027, noms fictifs) dans le journal du cockpit, phase par phase, comme le ferait le
 * directeur de jeu. Sert de preuve : une fois le tournoi clôturé par le responsable, le
 * classement glissant devient celui « après TN 2 » du classeur de référence.
 */
import type { Match, Poule, TournamentEvent, TournamentState } from "@pilot5q/domain";
import { pouleMatches, replay } from "@pilot5q/domain";

import fixture from "@/data/tn-exemple.json";
import type { EventInput } from "@/store/tournament";

interface FxMatch {
  a: string;
  b: string;
  sa: number;
  sb: number;
  setsA?: number[];
  setsB?: number[];
}
interface FxPoule {
  num: number;
  billards: number[];
  players: string[];
  matches: FxMatch[];
}
interface Fx {
  players: { name: string }[];
  poules: FxPoule[];
  barrages: { m: string; a: string; b: string; sa: number; sb: number }[];
  abandons: { player: string; phase: string }[];
  saturday: Record<"QN" | "QM", { poules: FxPoule[] }>;
  brackets: Record<"N" | "M" | "CLS", { matches: FxMatch[]; players?: string[] }>;
}

const FX = fixture as unknown as Fx;

/** Le journal correspond-il au tournoi d'exemple (mêmes 76 joueurs, même ordre) ? */
export function isExampleTournament(state: TournamentState): boolean {
  return (
    state.players.length === FX.players.length &&
    state.players.every((p, i) => p.name === FX.players[i]?.name)
  );
}

/** Événement de score d'un match réel sur un match du journal (ordre des joueurs respecté). */
function scoreEvent(
  phase: "PREQ" | "B" | "QN" | "QM" | "N" | "M" | "CLS",
  m: Match,
  r: FxMatch,
): EventInput {
  const swap = r.a !== m.a;
  return {
    type: "score.entered",
    payload: {
      phase,
      matchId: m.id,
      sa: swap ? r.sb : r.sa,
      sb: swap ? r.sa : r.sb,
      ...(r.setsA && r.setsB
        ? { setsA: swap ? r.setsB : r.setsA, setsB: swap ? r.setsA : r.setsB }
        : {}),
    },
  };
}

const same = (m: Match, r: FxMatch) => (m.a === r.a && m.b === r.b) || (m.a === r.b && m.b === r.a);

/**
 * Événements à ajouter au journal pour terminer le tournoi avec les scores réels (les phases
 * déjà jouées ne sont pas touchées). Lève une erreur si le journal n'est pas celui du tournoi
 * d'exemple.
 */
export function realWeekendEvents(events: TournamentEvent[]): EventInput[] {
  const out: EventInput[] = [];
  const at = new Date().toISOString();
  const state = () => replay([...events, ...out.map((e) => ({ ...e, at }) as TournamentEvent)]);
  let s = state();
  if (!isExampleTournament(s)) throw new Error("Ce tournoi n'est pas le tournoi d'exemple");
  const push = (...e: EventInput[]) => {
    out.push(...e);
    s = state();
  };
  const poulesScores = (phase: "PREQ" | "QN" | "QM", real: FxPoule[]) => {
    const evs: EventInput[] = [];
    for (const fp of real) {
      const poule = s.poules[phase].find((p) => p.num === fp.num);
      if (!poule) throw new Error(`Poule ${phase} ${fp.num} absente`);
      for (const r of fp.matches) {
        const m = poule.matches.find((x) => same(x, r));
        if (!m) throw new Error(`Match ${r.a}–${r.b} absent`);
        if (m.sa === null && !m.forfait) evs.push(scoreEvent(phase, m, r));
      }
    }
    push(...evs);
  };
  const bracketScores = (phase: "N" | "M" | "CLS", real: FxMatch[]) => {
    for (let round = 0; round < 7; round++) {
      const evs: EventInput[] = [];
      for (const m of s.brackets[phase]) {
        if (m.a === "" || m.b === "" || m.sa !== null || m.forfait) continue;
        const r = real.find((x) => same(m, x));
        if (r) evs.push(scoreEvent(phase, m, r));
      }
      if (evs.length === 0) break;
      push(...evs);
    }
  };
  // Vendredi : poules (mêmes que le tirage réel), abandon, barrages.
  if (s.poules.PREQ.length === 0) {
    const poules: Poule[] = FX.poules.map((p) => ({
      num: p.num,
      players: [...p.players],
      billards: [...p.billards],
      matches: pouleMatches(p.num, p.players),
    }));
    push({ type: "poules.drawn", payload: { phase: "PREQ", poules } });
  }
  if (!s.closed.PREQ) {
    poulesScores("PREQ", FX.poules);
    for (const a of FX.abandons.filter((x) => x.phase === "PREQ"))
      if (!s.forfaits.some((f) => f.player === a.player))
        push({
          type: "forfait.declared",
          payload: { phase: "PREQ", player: a.player, kind: "abandon" },
        });
    push({ type: "phase.closed", payload: { phase: "PREQ" } });
  }
  if (!s.closed.B) {
    const evs: EventInput[] = [];
    for (const b of FX.barrages) {
      const m = s.barrages.find((x) => same(x, b));
      if (m && m.sa === null) evs.push(scoreEvent("B", m, b));
    }
    push(...evs);
    push({ type: "phase.closed", payload: { phase: "B" } });
  }
  // Samedi : poules National et Masters.
  if (!s.closed.QN) {
    poulesScores("QN", FX.saturday.QN.poules);
    push({ type: "phase.closed", payload: { phase: "QN" } });
  }
  if (!s.closed.QM) {
    poulesScores("QM", FX.saturday.QM.poules);
    push({ type: "phase.closed", payload: { phase: "QM" } });
  }
  // Consolante (volontaires du classement de sortie, hors abandons).
  if (s.brackets.CLS.length === 0 && FX.brackets.CLS.players) {
    push({ type: "consolante.created", payload: { players: FX.brackets.CLS.players } });
  }
  bracketScores("CLS", FX.brackets.CLS.matches);
  // Dimanche : tableaux National et Masters.
  bracketScores("N", FX.brackets.N.matches);
  bracketScores("M", FX.brackets.M.matches);
  for (const phase of ["N", "M", "CLS"] as const)
    if (!s.closed[phase] && s.brackets[phase].length > 0)
      push({ type: "phase.closed", payload: { phase } });
  return out;
}

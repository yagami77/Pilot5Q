/** Tournoi d'exemple : construit le journal initial à partir de la fixture. */
import type { Billard, Match, Player, Poule, TournamentState } from "@pilot5q/domain";

import fixture from "@/data/tn-exemple.json";
import type { EventInput } from "@/store/tournament";

import { DEFAULT_RULES } from "./engine";
import { drawLaterPhaseEvents } from "./setup";

interface Fixture {
  tournament: {
    name: string;
    season: string;
    city: string;
    club: string;
    dates: [string, string];
  };
  billards: Billard[];
  players: Player[];
  poules: Poule[];
  barrages: { m: string; a: string; b: string; sa: number; sb: number }[];
  barrageBillards: Record<string, number>;
  expectedPhaseRanking: { rank: number; name: string }[];
}

/** Joueur ayant abandonné dans le tournoi d'exemple (dernier du classement de référence). */
export function demoAbandon(): string | null {
  const last = DEMO.expectedPhaseRanking[DEMO.expectedPhaseRanking.length - 1];
  return last?.name ?? null;
}

export const DEMO = fixture as unknown as Fixture;

/** Journal initial : tournoi créé, inscrits importés, billards tirés (poules et barrages). */
export function demoEvents(): EventInput[] {
  const preq: Record<string, number[]> = {};
  for (const p of DEMO.poules) preq[String(p.num)] = [...p.billards];
  const barrages: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(DEMO.barrageBillards)) barrages[k] = [v];
  return [
    {
      type: "tournament.created",
      payload: {
        name: DEMO.tournament.name,
        season: DEMO.tournament.season,
        city: DEMO.tournament.city,
        club: DEMO.tournament.club,
        dates: DEMO.tournament.dates,
        billards: DEMO.billards.map((b) => ({ ...b })),
        rules: DEFAULT_RULES,
      },
    },
    {
      type: "players.imported",
      payload: { players: DEMO.players.map((p) => ({ ...p })) },
    },
    { type: "billards.assigned", payload: { phase: "PREQ", assignments: preq } },
    ...drawLaterPhaseEvents(DEMO.billards).filter(
      (e) => e.type !== "billards.assigned" || e.payload.phase !== "B",
    ),
    { type: "billards.assigned", payload: { phase: "B", assignments: barrages } },
  ];
}

/** Score réel d'un match des poules du vendredi (apparié par noms), sinon null. */
export function demoPreqScore(m: Match): { sa: number; sb: number } | null {
  for (const p of DEMO.poules)
    for (const r of p.matches) {
      if (r.sa === null || r.sb === null) continue;
      if (r.a === m.a && r.b === m.b) return { sa: r.sa, sb: r.sb };
      if (r.a === m.b && r.b === m.a) return { sa: r.sb, sb: r.sa };
    }
  return null;
}

/** Score réel d'un barrage (apparié par noms), sinon null. */
export function demoBarrageScore(m: Match): { sa: number; sb: number } | null {
  for (const r of DEMO.barrages) {
    if (r.a === m.a && r.b === m.b) return { sa: r.sa, sb: r.sb };
    if (r.a === m.b && r.b === m.a) return { sa: r.sb, sb: r.sa };
  }
  return null;
}

/** Score plausible aléatoire pour une distance donnée (mode test des phases sans fixture). */
export function randomScore(
  pointsParSet: number,
  setsGagnants: number,
  random: () => number = Math.random,
): { sa: number; sb: number; setsA?: number[]; setsB?: number[] } {
  const loserPoints = () => Math.floor(pointsParSet * (0.35 + random() * 0.6));
  if (setsGagnants === 1) {
    return random() < 0.5
      ? { sa: pointsParSet, sb: loserPoints() }
      : { sa: loserPoints(), sb: pointsParSet };
  }
  const setsA: number[] = [];
  const setsB: number[] = [];
  let wa = 0;
  let wb = 0;
  while (wa < setsGagnants && wb < setsGagnants) {
    if (random() < 0.5) {
      setsA.push(pointsParSet);
      setsB.push(loserPoints());
      wa++;
    } else {
      setsA.push(loserPoints());
      setsB.push(pointsParSet);
      wb++;
    }
  }
  return { sa: wa, sb: wb, setsA, setsB };
}

export function isDemo(state: TournamentState): boolean {
  return state.info?.name === DEMO.tournament.name && state.info.city === DEMO.tournament.city;
}

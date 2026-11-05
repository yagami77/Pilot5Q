/** Mode test : remplissage progressif et animé des scores. */
import type { Distance, Match, PhaseId } from "@pilot5q/domain";
import { useEffect, useRef, useState } from "react";

import { useTournament, type EventInput } from "@/store/tournament";

import { randomScore } from "./demo";
import { isValidScore } from "./engine";

/** Envoie des événements par petits paquets (animation de saisie). */
export function useProgressiveFill() {
  const { dispatchMany } = useTournament();
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );
  return (events: EventInput[], onDone?: () => void, batch = 3, every = 70) => {
    let k = 0;
    const step = () => {
      dispatchMany(events.slice(k, k + batch));
      k += batch;
      if (k < events.length) timer.current = window.setTimeout(step, every);
      else onDone?.();
    };
    step();
  };
}

export interface PendingMatch {
  phase: PhaseId;
  match: Match;
  distance: Distance;
}

interface Plan {
  sa: number;
  sb: number;
  setsA?: number[];
  setsB?: number[];
}

/** Score partiel après `n` sets d'un plan (match encore en cours). */
function partial(plan: Plan, n: number, d: Distance): Plan {
  const setsA = (plan.setsA ?? []).slice(0, n);
  const setsB = (plan.setsB ?? []).slice(0, n);
  let sa = 0;
  let sb = 0;
  setsA.forEach((a, i) => {
    if (a === d.pointsParSet) sa++;
    else if (setsB[i] === d.pointsParSet) sb++;
  });
  return { sa, sb, setsA, setsB };
}

/**
 * Remplissage automatique des matchs en attente avec des scores plausibles : tant que
 * `pending()` renvoie des matchs (recalculés à chaque rendu, donc après chaque avancée
 * de tableau), on en saisit quelques-uns à chaque tic. Les matchs en plusieurs sets sont
 * saisis set par set (le match passe par l'état « en direct »).
 */
export function useAutoFill(
  pending: () => PendingMatch[],
  opts: { batch?: number; every?: number } = {},
) {
  const { dispatchMany } = useTournament();
  const [running, setRunning] = useState(false);
  const plans = useRef(new Map<string, Plan>());
  const batch = opts.batch ?? 3;
  const every = opts.every ?? 90;
  const list = running ? pending() : [];
  // Clé des matchs en attente et de leur avancement : relance l'effet à chaque changement.
  const key = list.map((p) => `${p.match.id}:${p.match.setsA?.length ?? 0}`).join(",");
  useEffect(() => {
    if (!running) return;
    if (key === "") {
      setRunning(false);
      plans.current.clear();
      return;
    }
    const t = window.setTimeout(() => {
      dispatchMany(
        list.slice(0, batch).map((p) => {
          const d = p.distance;
          let score: Plan;
          if (d.setsGagnants > 1) {
            const id = `${p.phase}:${p.match.id}`;
            let plan = plans.current.get(id);
            if (!plan) {
              plan = randomScore(d.pointsParSet, d.setsGagnants);
              plans.current.set(id, plan);
            }
            const done = p.match.setsA?.length ?? 0;
            score = partial(plan, done + 1, d);
          } else {
            score = randomScore(d.pointsParSet, d.setsGagnants);
          }
          return {
            type: "score.entered" as const,
            payload: { phase: p.phase, matchId: p.match.id, ...score },
          };
        }),
      );
    }, every);
    return () => window.clearTimeout(t);
    // `list` change à chaque rendu ; `key` suffit à relancer l'effet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, key, dispatchMany, batch, every]);
  return { running, start: () => setRunning(true) };
}

/** Matchs en attente d'une liste (joueurs connus, score absent ou invalide). */
export function pendingOf(phase: PhaseId, matches: Match[], d: Distance): PendingMatch[] {
  return matches
    .filter((m) => m.a && m.b && !m.forfait && !isValidScore(m, d))
    .map((m) => ({ phase, match: m, distance: d }));
}

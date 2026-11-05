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

/**
 * Remplissage automatique de matchs en attente avec des scores plausibles : tant que
 * `pending()` renvoie des matchs (recalculés à chaque rendu, donc après chaque avancée
 * de tableau), on en saisit quelques-uns à chaque tic.
 */
export function useAutoFill(pending: () => PendingMatch[]) {
  const { dispatchMany } = useTournament();
  const [running, setRunning] = useState(false);
  const list = running ? pending() : [];
  // Clé des matchs en attente : relance l'effet dès que la liste change (pas seulement sa taille).
  const key = list.map((p) => p.match.id).join(",");
  useEffect(() => {
    if (!running) return;
    if (key === "") {
      setRunning(false);
      return;
    }
    const t = window.setTimeout(() => {
      dispatchMany(
        list.slice(0, 3).map((p) => ({
          type: "score.entered" as const,
          payload: {
            phase: p.phase,
            matchId: p.match.id,
            ...randomScore(p.distance.pointsParSet, p.distance.setsGagnants),
          },
        })),
      );
    }, 90);
    return () => window.clearTimeout(t);
    // `list` change à chaque rendu ; `key` suffit à relancer l'effet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, key, dispatchMany]);
  return { running, start: () => setRunning(true) };
}

/** Matchs en attente d'une liste (joueurs connus, score absent ou invalide). */
export function pendingOf(phase: PhaseId, matches: Match[], d: Distance): PendingMatch[] {
  return matches
    .filter((m) => m.a && m.b && !m.forfait && !isValidScore(m, d))
    .map((m) => ({ phase, match: m, distance: d }));
}

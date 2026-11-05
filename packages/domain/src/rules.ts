/**
 * Paramètres par défaut du tournoi (SPEC §8) et utilitaires associés.
 */
import type { Distance, Rules } from "./types.js";

/** Paramètres par défaut (SPEC §8). */
export const DEFAULT_RULES: Rules = {
  distances: {
    preq: { pointsParSet: 100, setsGagnants: 1 },
    barrage: { pointsParSet: 100, setsGagnants: 1 },
    qn: { pointsParSet: 100, setsGagnants: 1 },
    qm: { pointsParSet: 60, setsGagnants: 2 },
    huitiemes: { pointsParSet: 100, setsGagnants: 1 },
    cls: { pointsParSet: 100, setsGagnants: 1 },
    final: { pointsParSet: 60, setsGagnants: 3 },
  },
  mastersPrequalified: 8,
  barrageSize: 16,
  nationalSize: 32,
  consolanteMax: 40,
  consolanteMinSmallTables: 5,
  maxPoulesOf3: 3,
  inscriptionFee: 30,
};

/** Copie profonde des paramètres (les règles ne doivent jamais être partagées entre états). */
export function cloneRules(rules: Rules): Rules {
  const distances = {} as Record<keyof Rules["distances"], Distance>;
  for (const key of Object.keys(rules.distances) as (keyof Rules["distances"])[]) {
    const d = rules.distances[key];
    distances[key] = { pointsParSet: d.pointsParSet, setsGagnants: d.setsGagnants };
  }
  return { ...rules, distances };
}

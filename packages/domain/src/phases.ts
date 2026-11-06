/**
 * Enchaînement des phases : barrages, poules du samedi, tableaux finaux, consolante
 * (SPEC §4, §5, §6).
 *
 * Règles implémentées :
 * - Barrages (§4) : places 1 à `size` du classement de phase → `size/2` matchs `1–16, 2–15, …`,
 *   ids `B1..B8`, libellés « 1er du classement » / « 16e du classement ».
 * - Masters (§5) : préqualifiés + vainqueurs de barrage, ordonnés par ordre d'arrivée (place
 *   dans la liste des participants), serpentin en 4 poules de 4, contrainte club. Les conflits
 *   non résolus sont laissés tels quels (à corriger à la main, voir `clubConflicts`).
 * - National (§5) : perdants de barrage (dans l'ordre fourni) puis classement de `from` à `to`,
 *   serpentin en 8 poules de 4, sans contrainte club.
 * - Huitièmes National (§5) : les huit croisements de SPEC (`1er P1–2e P8, 2e P1–1er P8, 1er
 *   P2–2e P7, …`), placés dans l'ordre du tableau réel de l'outil Excel (plage MATCHS_HUITIEMES,
 *   `NATIONAL_R16_PAIRS`) :
 *   `H1 = 1er P1–2e P8, H2 = 1er P7–2e P2, H3 = 1er P4–2e P5, H4 = 1er P6–2e P3, H5 = 1er P8–2e P1,
 *   H6 = 1er P2–2e P7, H7 = 1er P5–2e P4, H8 = 1er P3–2e P6`, ids `N-R16-1..8`, puis quarts
 *   `H1–H2, H3–H4, H5–H6, H7–H8` et demies `Q1–Q2, Q3–Q4` : les deux qualifiés d'une même poule
 *   sont dans des moitiés opposées et ne peuvent se retrouver qu'en finale. Les huitièmes se
 *   remplissent progressivement, paire de poules par paire de poules (`syncNationalR16`).
 * - Quarts Masters (§5) : `Q1 = 1er P1 vs 2e P4`, `Q2 = 1er P3 vs 2e P2`, `Q3 = 1er P4 vs 2e P1`,
 *   `Q4 = 1er P2 vs 2e P3`, ids `M-QF1..4` ; demies `Q1–Q2`, `Q3–Q4`.
 * - Avancement d'un tableau : les vainqueurs du tour `t` alimentent le tour `t+1` (slots
 *   `2k−1` et `2k` → slot `k`, côté A pour l'impair, B pour le pair). Les tours suivants sont
 *   créés jusqu'à la finale avec des ids stables (`N-QF1`, `M-SF2`, `N-F`) et des joueurs vides
 *   (`""`) tant qu'ils ne sont pas connus ; `labelA`/`labelB` indiquent la provenance. Si le
 *   vainqueur d'un match change (score corrigé), le match aval est remis à zéro.
 * - Consolante (§5) : élimination directe, joueurs dans l'ordre fourni (têtes de série),
 *   appariement classique (1 vs n, 2 vs n−1… de sorte que 1 et 2 ne se rencontrent qu'en
 *   finale), ids `CLS-R32-3`, `CLS-QF1`, `CLS-F`. Taille du tableau selon la règle de l'outil
 *   Excel (`createTableauClassement`) : pour 2^k < n ≤ 1,5 × 2^k, tableau de 2^k places avec
 *   b = n − 2^k « barrages » (tour préliminaire) ; le barrage i oppose la tête de série 2^k − b + i
 *   à la tête de série n + 1 − i et son vainqueur rencontre la tête de série i (pour 19 joueurs :
 *   TS 1 contre le vainqueur de 14–19, TS 2 contre 15–18, TS 3 contre 16–17). Au-delà de
 *   1,5 × 2^k, tableau de 2^(k+1) places avec exemptions pour les meilleures têtes de série
 *   (l'exempt est placé directement au tour suivant).
 *
 * Choix sur les points laissés ouverts :
 * - L'appariement des quarts National n'est pas précisé par SPEC : les huitièmes sont
 *   enchaînés dans l'ordre (`V(R16-1) vs V(R16-2)` → QF1, etc.). De même pour les demies
 *   Masters (`Q1–Q2`, `Q3–Q4`), conformes à SPEC.
 * - Pour qualifier les 1er/2e d'une poule, les poules sont classées avec `rankPouleInPhase`
 *   (forfaits et compensation déduits). Une poule incomplète fournit son classement
 *   provisoire.
 */
import { clubConflicts, pouleMatches, resolveClubConflicts, serpentin } from "./draw.js";
import { matchWinner, rankPouleInPhase } from "./scoring.js";
import type { BracketMatch, BracketRound, Distance, Match, PhaseRankRow, Poule } from "./types.js";

/** Match de barrage : un match avec la provenance de chaque joueur. */
export interface BarrageMatch extends Match {
  labelA: string;
  labelB: string;
}

/** Libellé ordinal français (1er, 2e, …). */
export function ordinal(n: number): string {
  return n === 1 ? "1er" : `${n}e`;
}

/** Appariement des barrages : 1–16, 2–15, … (SPEC §4). */
export function barragePairs(ranking: PhaseRankRow[], size: number): BarrageMatch[] {
  const byPlace = new Map(ranking.map((r) => [r.place, r.name]));
  const out: BarrageMatch[] = [];
  for (let i = 1; i <= size / 2; i++) {
    const j = size + 1 - i;
    const a = byPlace.get(i);
    const b = byPlace.get(j);
    if (a === undefined || b === undefined) {
      throw new Error(`Classement incomplet : ${size} joueurs sont nécessaires pour les barrages`);
    }
    out.push({
      id: `B${i}`,
      a,
      b,
      sa: null,
      sb: null,
      labelA: `${ordinal(i)} du classement`,
      labelB: `${ordinal(j)} du classement`,
    });
  }
  return out;
}

/** Construit des poules complètes (numéros, matchs) à partir de listes de joueurs. */
export function toPoules(groups: string[][], firstNum = 1): Poule[] {
  return groups.map((players, i) => ({
    num: firstNum + i,
    players: [...players],
    billards: [],
    matches: pouleMatches(firstNum + i, players),
  }));
}

/** Poules Masters du samedi (SPEC §5). */
export function composeMasters(
  prequalified: string[],
  barrageWinners: string[],
  arrivee: Record<string, number>,
  clubOf: Record<string, string>,
): Poule[] {
  const all = [...new Set([...prequalified, ...barrageWinners])];
  all.sort(
    (x, y) =>
      (arrivee[x] ?? Number.POSITIVE_INFINITY) - (arrivee[y] ?? Number.POSITIVE_INFINITY) ||
      x.localeCompare(y, "fr"),
  );
  const drawn = serpentin(all, 3);
  const { poules } = resolveClubConflicts(drawn, clubOf);
  return toPoules(poules);
}

/** Numéros des poules Masters en conflit de club (après tirage). */
export function mastersClubConflicts(poules: Poule[], clubOf: Record<string, string>): number[] {
  return clubConflicts(
    poules.map((p) => p.players),
    clubOf,
  ).map((i) => poules[i - 1]?.num ?? i);
}

/** Poules National du samedi (SPEC §5). */
export function composeNational(
  barrageLosers: string[],
  ranking: PhaseRankRow[],
  from: number,
  to: number,
): Poule[] {
  const rest = ranking
    .filter((r) => r.place >= from && r.place <= to)
    .sort((x, y) => x.place - y.place)
    .map((r) => r.name);
  const all = [...new Set([...barrageLosers, ...rest])];
  return toPoules(serpentin(all, 3));
}

/** Les deux premiers de chaque poule (`""` si la poule n'a pas assez de joueurs). */
function qualified(
  poules: Poule[],
  d: Distance,
  forfaits: string[],
): { first: string; second: string }[] {
  return poules.map((p) => {
    const { rows } = rankPouleInPhase(p, d, undefined, forfaits);
    return { first: rows[0]?.name ?? "", second: rows[1]?.name ?? "" };
  });
}

/** Un match de tableau vide. */
function bracketMatch(
  id: string,
  round: BracketRound,
  slot: number,
  a: string,
  b: string,
  labelA: string,
  labelB: string,
): BracketMatch {
  return { id, round, slot, a, b, sa: null, sb: null, labelA, labelB };
}

/**
 * Croisements des huitièmes National dans l'ordre du tableau réel (H1..H8) :
 * `[poule du 1er, poule du 2e]` (numéros d'ordre des poules, 1 à 8).
 */
export const NATIONAL_R16_PAIRS: readonly (readonly [number, number])[] = [
  [1, 8],
  [7, 2],
  [4, 5],
  [6, 3],
  [8, 1],
  [2, 7],
  [5, 4],
  [3, 6],
];

/** Huitièmes de finale National prédéfinis (SPEC §5). */
export function nationalR16(
  poulesQN: Poule[],
  d: Distance,
  forfaits: string[] = [],
): BracketMatch[] {
  const q = qualified(poulesQN, d, forfaits);
  const pick = (poule: number, rank: 1 | 2): { name: string; label: string } => {
    const entry = q[poule - 1];
    const pouleNum = poulesQN[poule - 1]?.num ?? poule;
    return {
      name: entry === undefined ? "" : rank === 1 ? entry.first : entry.second,
      label: `${ordinal(rank)} P${pouleNum}`,
    };
  };
  return NATIONAL_R16_PAIRS.map(([pa, pb], i) => {
    const a = pick(pa, 1);
    const b = pick(pb, 2);
    return bracketMatch(`N-R16-${i + 1}`, "R16", i + 1, a.name, b.name, a.label, b.label);
  });
}

/**
 * Huitièmes National progressifs (retours du 6 novembre) : un huitième reçoit ses joueurs dès
 * que ses deux poules couplées (1 et 8, 2 et 7, 3 et 6, 4 et 5) sont complètes, sans attendre la
 * clôture du National. `existing` = huitièmes déjà dérivés (scores conservés).
 *
 * - Poules complètes, mêmes joueurs : le huitième est gardé tel quel (score compris) et n'est
 *   plus à vérifier.
 * - Poules complètes, joueurs différents (score de poule corrigé) : les joueurs sont remplacés ;
 *   si le huitième avait déjà un score, celui-ci est effacé et le match est signalé à vérifier
 *   (`needsReview`).
 * - Poules redevenues incomplètes : un huitième non joué perd ses joueurs ; un huitième déjà
 *   joué est gardé mais signalé à vérifier.
 */
export function syncNationalR16(
  poulesQN: Poule[],
  d: Distance,
  forfaits: string[] = [],
  existing: BracketMatch[] = [],
): BracketMatch[] {
  const complete = poulesQN.map((p) => rankPouleInPhase(p, d, undefined, forfaits).complete);
  const fresh = nationalR16(poulesQN, d, forfaits);
  return fresh.map((f, i) => {
    const [pa, pb] = NATIONAL_R16_PAIRS[i] ?? [0, 0];
    const ready = Boolean(complete[pa - 1] && complete[pb - 1]);
    const old = existing.find((m) => m.round === "R16" && m.slot === f.slot);
    const played =
      old !== undefined &&
      (old.sa !== null || old.sb !== null || Boolean(old.forfait) || Boolean(old.setsA?.length));
    const blank: BracketMatch = { ...f, a: "", b: "" };
    if (!old) return ready ? f : blank;
    const keep: BracketMatch = { ...old, labelA: f.labelA, labelB: f.labelB };
    if (!ready) {
      if (!played) {
        const out = { ...keep, a: "", b: "" };
        delete out.needsReview;
        return out;
      }
      return keep.a && keep.b ? { ...keep, needsReview: true } : keep;
    }
    if (old.a === f.a && old.b === f.b) {
      const out = { ...keep };
      delete out.needsReview;
      return out;
    }
    if (!played || (old.a === "" && old.b === "")) {
      const out: BracketMatch = { ...keep, a: f.a, b: f.b, sa: null, sb: null, forfait: null };
      delete out.setsA;
      delete out.setsB;
      delete out.needsReview;
      return out;
    }
    const out: BracketMatch = {
      ...keep,
      a: f.a,
      b: f.b,
      sa: null,
      sb: null,
      forfait: null,
      needsReview: true,
    };
    delete out.setsA;
    delete out.setsB;
    return out;
  });
}

/** Quarts de finale Masters prédéfinis (SPEC §5). */
export function mastersQF(poulesQM: Poule[], d: Distance, forfaits: string[] = []): BracketMatch[] {
  const q = qualified(poulesQM, d, forfaits);
  const pick = (poule: number, rank: 1 | 2): { name: string; label: string } => {
    const entry = q[poule - 1];
    const pouleNum = poulesQM[poule - 1]?.num ?? poule;
    return {
      name: entry === undefined ? "" : rank === 1 ? entry.first : entry.second,
      label: `${ordinal(rank)} P${pouleNum}`,
    };
  };
  const pairs: [number, 1 | 2, number, 1 | 2][] = [
    [1, 1, 4, 2],
    [3, 1, 2, 2],
    [4, 1, 1, 2],
    [2, 1, 3, 2],
  ];
  return pairs.map(([pa, ra, pb, rb], i) => {
    const a = pick(pa, ra);
    const b = pick(pb, rb);
    return bracketMatch(`M-QF${i + 1}`, "QF", i + 1, a.name, b.name, a.label, b.label);
  });
}

/** Tours d'un tableau, du plus grand au plus petit. */
export const BRACKET_ROUNDS: readonly BracketRound[] = ["R64", "R32", "R16", "QF", "SF", "F"];

/** Nombre de joueurs d'un tour. */
export function roundSize(round: BracketRound): number {
  return { R64: 64, R32: 32, R16: 16, QF: 8, SF: 4, F: 2 }[round];
}

/** Tour correspondant à une taille de tableau (puissance de 2 entre 2 et 64). */
function roundOfSize(size: number): BracketRound {
  const found = BRACKET_ROUNDS.find((r) => roundSize(r) === size);
  if (!found) throw new Error(`Taille de tableau non prise en charge : ${size}`);
  return found;
}

/** Id stable d'un match de tableau : `N-R16-3`, `M-QF1`, `CLS-F`. */
export function bracketMatchId(prefix: string, round: BracketRound, slot: number): string {
  if (round === "F") return `${prefix}-F`;
  if (round === "QF" || round === "SF") return `${prefix}-${round}${slot}`;
  return `${prefix}-${round}-${slot}`;
}

/** Id sans préfixe de phase (`R16-3`, `QF1`, `F`), pour les libellés. */
function shortId(id: string): string {
  const i = id.indexOf("-");
  return i < 0 ? id : id.slice(i + 1);
}

/** Préfixe de phase déduit des ids (`N`, `M`, `CLS`). */
function idPrefix(matches: BracketMatch[]): string {
  const id = matches[0]?.id ?? "";
  const i = id.indexOf("-");
  return i < 0 ? id : id.slice(0, i);
}

/** Fait avancer les vainqueurs au tour suivant d'un tableau (crée les tours manquants). */
export function advanceBracket(
  matches: BracketMatch[],
  d: Distance,
  distanceByRound?: Partial<Record<BracketRound, Distance>>,
): BracketMatch[] {
  if (matches.length === 0) return [];
  const prefix = idPrefix(matches);
  const byKey = new Map<string, BracketMatch>();
  for (const m of matches) {
    byKey.set(`${m.round}:${m.slot}`, {
      ...m,
      setsA: m.setsA ? [...m.setsA] : m.setsA,
      setsB: m.setsB ? [...m.setsB] : m.setsB,
    });
  }
  for (let r = 0; r < BRACKET_ROUNDS.length - 1; r++) {
    const round = BRACKET_ROUNDS[r];
    const next = BRACKET_ROUNDS[r + 1];
    if (round === undefined || next === undefined) continue;
    const dist = distanceByRound?.[round] ?? d;
    const current = [...byKey.values()]
      .filter((m) => m.round === round)
      .sort((x, y) => x.slot - y.slot);
    for (const m of current) {
      const targetSlot = Math.ceil(m.slot / 2);
      const side: "a" | "b" = m.slot % 2 === 1 ? "a" : "b";
      const key = `${next}:${targetSlot}`;
      let target = byKey.get(key);
      if (!target) {
        target = bracketMatch(
          bracketMatchId(prefix, next, targetSlot),
          next,
          targetSlot,
          "",
          "",
          "",
          "",
        );
        byKey.set(key, target);
      }
      const label = `Vainqueur ${shortId(m.id)}`;
      if (side === "a") target.labelA = label;
      else target.labelB = label;
      const winner = matchWinner(m, dist) ?? "";
      if (target[side] !== winner) {
        if (target[side] !== "") {
          // Le joueur change : le score saisi ne le concerne plus.
          target.sa = null;
          target.sb = null;
          delete target.setsA;
          delete target.setsB;
          target.forfait = null;
        }
        target[side] = winner;
      }
    }
  }
  const order = (m: BracketMatch): number => BRACKET_ROUNDS.indexOf(m.round) * 1000 + m.slot;
  return [...byKey.values()].sort((x, y) => order(x) - order(y));
}

/** Ordre classique des têtes de série pour un tableau de `size` places (1 vs size, …). */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

/** Tableau de la consolante, élimination directe (SPEC §5, règle de taille de l'outil Excel). */
export function consolanteBracket(players: string[], max: number): BracketMatch[] {
  const n = players.length;
  if (n > max) throw new Error(`Consolante : ${n} joueurs pour un maximum de ${max}`);
  if (n < 2) throw new Error("Consolante : au moins 2 joueurs sont nécessaires");
  let size = 2;
  while (size < n) size *= 2;
  const half = size / 2;
  const nameOf = (seed: number): string => players[seed - 1] ?? "";
  const byKey = new Map<string, BracketMatch>();
  const place = (round: BracketRound, slot: number, side: "a" | "b", seed: number): void => {
    const key = `${round}:${slot}`;
    const target =
      byKey.get(key) ??
      bracketMatch(bracketMatchId("CLS", round, slot), round, slot, "", "", "", "");
    target[side] = nameOf(seed);
    if (side === "a") target.labelA = `TS ${seed}`;
    else target.labelB = `TS ${seed}`;
    byKey.set(key, target);
  };
  const barrages = n - half;
  if (n !== size && barrages <= half / 2) {
    // Tableau de `half` places et `barrages` matchs préliminaires (règle de l'outil Excel).
    const round = roundOfSize(half);
    const pre = roundOfSize(size);
    const order = seedOrder(half);
    for (let i = 0; i < half / 2; i++) {
      const p = order[2 * i] ?? 0;
      const q = order[2 * i + 1] ?? 0;
      const slot = i + 1;
      if (p <= barrages) {
        // La tête de série p attend le vainqueur du barrage p : TS (half − b + p) contre TS (n + 1 − p).
        place(round, slot, "a", p);
        const x = half - barrages + p;
        const y = n + 1 - p;
        byKey.set(
          `${pre}:${2 * slot}`,
          bracketMatch(
            bracketMatchId("CLS", pre, 2 * slot),
            pre,
            2 * slot,
            nameOf(x),
            nameOf(y),
            `TS ${x}`,
            `TS ${y}`,
          ),
        );
      } else {
        place(round, slot, "a", p);
        place(round, slot, "b", q);
      }
    }
    return advanceBracket([...byKey.values()], { pointsParSet: 100, setsGagnants: 1 });
  }
  // Puissance de 2, ou plus de 1,5 × 2^k joueurs : tableau de `size` places avec exemptions.
  const round = roundOfSize(size);
  const nextRound = BRACKET_ROUNDS[BRACKET_ROUNDS.indexOf(round) + 1];
  const order = seedOrder(size);
  for (let i = 0; i < size / 2; i++) {
    const p = order[2 * i] ?? 0;
    const q = order[2 * i + 1] ?? 0;
    const slot = i + 1;
    if (p <= n && q <= n) {
      place(round, slot, "a", p);
      place(round, slot, "b", q);
      continue;
    }
    // Exemption : la tête de série présente passe directement au tour suivant.
    const present = p <= n ? p : q;
    if (present > n || nextRound === undefined) continue;
    const targetSlot = Math.ceil(slot / 2);
    const side: "a" | "b" = slot % 2 === 1 ? "a" : "b";
    place(nextRound, targetSlot, side, present);
    const target = byKey.get(`${nextRound}:${targetSlot}`);
    if (target) {
      if (side === "a") target.labelA = `TS ${present} (exempt)`;
      else target.labelB = `TS ${present} (exempt)`;
    }
  }
  return advanceBracket([...byKey.values()], { pointsParSet: 100, setsGagnants: 1 });
}

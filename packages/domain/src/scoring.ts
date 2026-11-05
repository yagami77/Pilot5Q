/**
 * Scores, points et classements (SPEC §1, §4, §5).
 *
 * Règles implémentées :
 * - Validité d'un score (§4) : pour 1 set, un joueur exactement à `pointsParSet`, l'autre
 *   entre 0 et `pointsParSet - 1`. Pour plusieurs sets gagnants, `setsA`/`setsB` détaillent les
 *   points de chaque set (chaque set valide), le match s'arrête dès qu'un joueur atteint
 *   `setsGagnants`, et `sa`/`sb` sont les nombres de sets gagnés. Tolérance : sans détail des
 *   sets, `sa`/`sb` seuls sont acceptés comme décompte de sets (mais faits/subis valent alors 0).
 *   Un match avec `forfait` est toujours valide, l'adversaire est vainqueur.
 * - Points de match : 2 par victoire. Points de set : gagnant = max sets possibles − sets
 *   subis ; perdant = sets gagnés (§1). Max sets possibles = 2 × setsGagnants − 1.
 * - Classement d'une poule (§4) : Pm ; égalité à deux → match direct ; égalité à trois ou plus
 *   → Ps, puis moyenne, puis ordre d'arrivée. `rang` reste null tant que la poule n'est pas
 *   complète.
 * - Compensation d'une poule de 3 (§4 et §5) : +2 Pm et +max sets possibles en Ps à chaque joueur
 *   restant (1 pour une distance en 1 set, 3 pour 2 sets gagnants) ; la moyenne reste réelle.
 *
 * Choix sur les points laissés ouverts par SPEC :
 * - Joueur forfait/abandon (`opts.forfaits`) : classé dernier de la poule avec 0 partout. Ses
 *   matchs sont comptés comme gagnés par l'adversaire. Si le match avait été réellement joué
 *   (score saisi), les points réels sont conservés pour l'adversaire (c'est le comportement de
 *   l'outil Excel de référence, cf. fixture : le joueur ayant abandonné garde ses matchs joués,
 *   contrairement à SPEC §4 qui parle d'annulation). Sinon (match non joué), l'adversaire
 *   marque `pointsParSet × setsGagnants` points faits et des points subis égaux à
 *   `opts.forfaitSubis[adversaire]` (SPEC §5 : moyenne des points subis dans la phase
 *   précédente, à fournir par l'appelant), 0 à défaut.
 * - Un match marqué `forfait: "a" | "b"` sans que le joueur soit déclaré forfait pour la poule
 *   est une simple défaite par forfait sur ce match. Si des points sont renseignés sur le match
 *   (`sa`/`sb` ou `setsA`/`setsB`, comme le fait l'outil Excel qui écrit « distance » pour le
 *   vainqueur et la moyenne des points subis pour le forfait), ils sont comptés tels quels ;
 *   sinon le vainqueur marque la distance et les points subis valent `opts.forfaitSubis`.
 * - Classement cumulé des barrages (`rankBarrages`, formule RNK_B de l'outil Excel) : les
 *   vainqueurs de barrage d'abord, puis Pm, Ps et moyenne cumulés (poule + barrage), puis ordre
 *   d'arrivée.
 * - Classement d'une phase finale (`rankTournamentPhase`, formules RNK_N / RNK_M / RNK_CLS) :
 *   tour atteint dans le tableau (vainqueur, finale, demie, quart, huitième, barrage), puis Pm,
 *   Ps et moyenne cumulés (poules de qualification + tableau), puis ordre d'arrivée ; les
 *   joueurs non qualifiés pour le tableau conservent l'ordre du classement de qualification.
 * - Moyenne : faits / subis ; si aucun point subi, la moyenne vaut les points faits (évite la
 *   division par zéro et reste sérialisable en JSON).
 * - `joues` compte les matchs ayant un résultat (score ou forfait), y compris les victoires
 *   par forfait.
 */
import type { Distance, Match, PhaseRankRow, Poule, PouleRankRow } from "./types.js";

/** Nombre maximal de sets d'un match à `setsGagnants` sets gagnants. */
export function maxSets(d: Distance): number {
  return 2 * d.setsGagnants - 1;
}

/** Un set est valide si un joueur est exactement à la distance et l'autre en dessous. */
function isValidSet(x: number, y: number, pointsParSet: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  return (
    (x === pointsParSet && y >= 0 && y < pointsParSet) ||
    (y === pointsParSet && x >= 0 && x < pointsParSet)
  );
}

/** Vérifie qu'un score est cohérent avec la distance (SPEC §4). */
export function isValidScore(m: Match, d: Distance): boolean {
  if (m.forfait === "a" || m.forfait === "b") return true;
  if (m.sa === null || m.sb === null) return false;
  const { sa, sb } = m;
  if (d.setsGagnants <= 1) {
    if (m.setsA && m.setsB) {
      // Tolérance : un détail de sets à un seul set doit être cohérent avec sa/sb.
      if (m.setsA.length !== 1 || m.setsB.length !== 1) return false;
      if (m.setsA[0] !== sa || m.setsB[0] !== sb) return false;
    }
    return isValidSet(sa, sb, d.pointsParSet);
  }
  const g = d.setsGagnants;
  if (m.setsA && m.setsB) {
    if (m.setsA.length === 0 || m.setsA.length !== m.setsB.length) return false;
    let wa = 0;
    let wb = 0;
    for (let i = 0; i < m.setsA.length; i++) {
      // Le match aurait dû s'arrêter : un set de trop.
      if (wa === g || wb === g) return false;
      const x = m.setsA[i];
      const y = m.setsB[i];
      if (x === undefined || y === undefined || !isValidSet(x, y, d.pointsParSet)) return false;
      if (x > y) wa++;
      else wb++;
    }
    if (wa !== g && wb !== g) return false;
    return sa === wa && sb === wb;
  }
  // Sans détail des sets : on accepte le décompte seul.
  if (!Number.isInteger(sa) || !Number.isInteger(sb)) return false;
  return (sa === g && sb >= 0 && sb < g) || (sb === g && sa >= 0 && sa < g);
}

/** Résultat d'un match décidé : vainqueur, perdant et sets gagnés par chacun. */
export interface MatchOutcome {
  winner: string;
  loser: string;
  /** Sets gagnés par le vainqueur et par le perdant (1/0 pour une distance en 1 set). */
  setsWinner: number;
  setsLoser: number;
  /** Points faits par le vainqueur et par le perdant (somme des sets). */
  pointsWinner: number;
  pointsLoser: number;
  /** Vrai si le match a été gagné par forfait (aucun point joué). */
  walkover: boolean;
}

/** Points totaux de chaque joueur (somme des sets, ou sa/sb pour une distance en 1 set). */
function pointsOf(m: Match, d: Distance): [number, number] {
  if (d.setsGagnants <= 1) return [m.sa ?? 0, m.sb ?? 0];
  if (m.setsA && m.setsB) {
    const sum = (xs: number[]): number => xs.reduce((acc, x) => acc + x, 0);
    return [sum(m.setsA), sum(m.setsB)];
  }
  return [0, 0];
}

/** Issue d'un match, ou null s'il n'est pas (encore) décidé. */
export function matchOutcome(m: Match, d: Distance): MatchOutcome | null {
  if (m.forfait === "a" || m.forfait === "b") {
    const aForfait = m.forfait === "a";
    const [pa, pb] = pointsOf(m, d);
    const pw = aForfait ? pb : pa;
    const pl = aForfait ? pa : pb;
    return {
      winner: aForfait ? m.b : m.a,
      loser: aForfait ? m.a : m.b,
      setsWinner: d.setsGagnants,
      setsLoser: 0,
      pointsWinner: pw > 0 ? pw : d.pointsParSet * d.setsGagnants,
      pointsLoser: pl > 0 ? pl : 0,
      walkover: true,
    };
  }
  if (!isValidScore(m, d) || m.sa === null || m.sb === null) return null;
  const aWins = m.sa > m.sb;
  const [pa, pb] = pointsOf(m, d);
  const setsA = d.setsGagnants <= 1 ? (aWins ? 1 : 0) : m.sa;
  const setsB = d.setsGagnants <= 1 ? (aWins ? 0 : 1) : m.sb;
  return {
    winner: aWins ? m.a : m.b,
    loser: aWins ? m.b : m.a,
    setsWinner: aWins ? setsA : setsB,
    setsLoser: aWins ? setsB : setsA,
    pointsWinner: aWins ? pa : pb,
    pointsLoser: aWins ? pb : pa,
    walkover: false,
  };
}

/** Nom du vainqueur d'un match, ou null s'il n'est pas décidé. */
export function matchWinner(m: Match, d: Distance): string | null {
  return matchOutcome(m, d)?.winner ?? null;
}

/** Points de set d'un match décidé : [gagnant, perdant] (SPEC §1). */
export function setPoints(outcome: MatchOutcome, d: Distance): [number, number] {
  return [maxSets(d) - outcome.setsLoser, outcome.setsLoser];
}

/** Options du classement d'une poule. */
export interface RankPouleOptions {
  /** Poule de 3 : +2 Pm et +max sets en Ps à chaque joueur (SPEC §4, §5). */
  compensate3?: boolean;
  /** Joueurs forfait ou ayant abandonné : classés derniers avec 0 partout. */
  forfaits?: string[];
  /** Ordre d'arrivée (place dans la liste ordonnée) ; par défaut la position dans la poule. */
  arrivee?: Record<string, number>;
  /** Points subis crédités à l'adversaire d'un forfait pour un match non joué (SPEC §5). */
  forfaitSubis?: Record<string, number>;
}

/** Ligne de classement vierge. */
function emptyRow(name: string, arrivee: number): PouleRankRow {
  return { name, rang: null, ptm: 0, pts: 0, faits: 0, subis: 0, moy: 0, joues: 0, arrivee };
}

/** Compare deux lignes par points de set, moyenne puis ordre d'arrivée (triangulaire, SPEC §4). */
function compareTriangular(x: PouleRankRow, y: PouleRankRow): number {
  return y.pts - x.pts || y.moy - x.moy || x.arrivee - y.arrivee;
}

/** Classement d'une poule (SPEC §4). */
export function rankPoule(
  players: string[],
  matches: Match[],
  d: Distance,
  opts?: RankPouleOptions,
): { rows: PouleRankRow[]; complete: boolean } {
  const inPoule = new Set(players);
  const forfaits = new Set((opts?.forfaits ?? []).filter((n) => inPoule.has(n)));
  const rows = new Map<string, PouleRankRow>();
  players.forEach((name, i) => {
    rows.set(name, emptyRow(name, opts?.arrivee?.[name] ?? i + 1));
  });
  const row = (name: string): PouleRankRow => {
    const r = rows.get(name);
    if (!r) throw new Error(`Joueur inconnu dans la poule : ${name}`);
    return r;
  };
  const mSets = maxSets(d);
  /** Paires de joueurs (hors forfaits) dont le match est décidé. */
  const decided = new Set<string>();
  const pairKey = (x: string, y: string): string => (x < y ? `${x}|${y}` : `${y}|${x}`);
  /** Vainqueur de chaque confrontation (clé = paire), pour le match direct. */
  const directWinner = new Map<string, string>();

  const creditWalkover = (winner: string, loser: string | null, outcome?: MatchOutcome): void => {
    const w = row(winner);
    const faits = outcome?.pointsWinner ?? d.pointsParSet * d.setsGagnants;
    const subis =
      outcome !== undefined && outcome.pointsLoser > 0
        ? outcome.pointsLoser
        : (opts?.forfaitSubis?.[winner] ?? 0);
    w.ptm += 2;
    w.pts += mSets;
    w.faits += faits;
    w.subis += subis;
    w.joues += 1;
    if (loser !== null) {
      const l = row(loser);
      l.faits += subis;
      l.subis += faits;
      l.joues += 1;
    }
  };

  for (const m of matches) {
    if (!inPoule.has(m.a) || !inPoule.has(m.b) || m.a === m.b) continue;
    const fa = forfaits.has(m.a);
    const fb = forfaits.has(m.b);
    if (fa && fb) continue;
    const outcome = matchOutcome(m, d);
    if (fa || fb) {
      // Match contre un joueur forfait/abandon : l'adversaire est vainqueur.
      const opponent = fa ? m.b : m.a;
      if (outcome && !outcome.walkover) {
        // Match réellement joué : points réels conservés pour l'adversaire.
        const r = row(opponent);
        const won = outcome.winner === opponent;
        r.ptm += 2;
        r.pts += won ? mSets - outcome.setsLoser : mSets;
        r.faits += won ? outcome.pointsWinner : outcome.pointsLoser;
        r.subis += won ? outcome.pointsLoser : outcome.pointsWinner;
        r.joues += 1;
      } else {
        creditWalkover(opponent, null);
      }
      continue;
    }
    if (!outcome) continue;
    decided.add(pairKey(m.a, m.b));
    directWinner.set(pairKey(m.a, m.b), outcome.winner);
    if (outcome.walkover) {
      creditWalkover(outcome.winner, outcome.loser, outcome);
      continue;
    }
    const w = row(outcome.winner);
    const l = row(outcome.loser);
    const [psW, psL] = setPoints(outcome, d);
    w.ptm += 2;
    w.pts += psW;
    w.faits += outcome.pointsWinner;
    w.subis += outcome.pointsLoser;
    w.joues += 1;
    l.pts += psL;
    l.faits += outcome.pointsLoser;
    l.subis += outcome.pointsWinner;
    l.joues += 1;
  }

  const active = players.filter((n) => !forfaits.has(n));
  let complete = true;
  for (let i = 0; i < active.length && complete; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const x = active[i];
      const y = active[j];
      if (x !== undefined && y !== undefined && !decided.has(pairKey(x, y))) {
        complete = false;
        break;
      }
    }
  }

  for (const r of rows.values()) {
    r.moy = r.subis > 0 ? r.faits / r.subis : r.faits;
  }

  // Classement des joueurs actifs : groupes de Pm décroissants.
  const activeRows = active.map(row);
  const byPtm = new Map<number, PouleRankRow[]>();
  for (const r of activeRows) {
    const g = byPtm.get(r.ptm);
    if (g) g.push(r);
    else byPtm.set(r.ptm, [r]);
  }
  const sorted: PouleRankRow[] = [];
  for (const ptm of [...byPtm.keys()].sort((x, y) => y - x)) {
    const group = byPtm.get(ptm) ?? [];
    if (group.length === 2) {
      const [x, y] = group;
      if (x && y) {
        const winner = directWinner.get(pairKey(x.name, y.name));
        if (winner === y.name) group.reverse();
        else if (winner === undefined) group.sort(compareTriangular);
      }
    } else if (group.length > 2) {
      group.sort(compareTriangular);
    }
    sorted.push(...group);
  }
  const forfaitRows = players
    .filter((n) => forfaits.has(n))
    .map(row)
    .sort((x, y) => x.arrivee - y.arrivee);
  const ordered = [...sorted, ...forfaitRows];

  if (opts?.compensate3) {
    for (const r of sorted) {
      r.ptm += 2;
      r.pts += mSets;
    }
  }
  ordered.forEach((r, i) => {
    r.rang = complete ? i + 1 : null;
  });
  return { rows: ordered.map((r) => ({ ...r })), complete };
}

/**
 * Faut-il appliquer la compensation « poule de 3 » (SPEC §4, §5) ?
 * Oui pour une poule tirée à 3, ou pour une poule de 4 dont un joueur est forfait sans avoir
 * joué (forfait avant le début, ou abandon sans match joué). Non pour un abandon après des
 * matchs joués : les matchs joués sont conservés (comportement de l'outil de référence).
 */
export function shouldCompensate3(poule: Poule, d: Distance, forfaits: string[]): boolean {
  const inPoule = forfaits.filter((n) => poule.players.includes(n));
  const active = poule.players.length - inPoule.length;
  if (active !== 3) return false;
  if (poule.players.length === 3) return true;
  return !poule.matches.some(
    (m) =>
      (inPoule.includes(m.a) || inPoule.includes(m.b)) && matchOutcome(m, d) !== null && !m.forfait,
  );
}

/** Classement d'une poule dans le contexte d'une phase (compensation et forfaits déduits). */
export function rankPouleInPhase(
  poule: Poule,
  d: Distance,
  arrivee?: Record<string, number>,
  forfaits: string[] = [],
  forfaitSubis?: Record<string, number>,
): { rows: PouleRankRow[]; complete: boolean } {
  return rankPoule(poule.players, poule.matches, d, {
    compensate3: shouldCompensate3(poule, d, forfaits),
    forfaits,
    arrivee,
    forfaitSubis,
  });
}

/** Compare deux lignes de phase : rang de poule, Pm, Ps, moyenne, ordre d'arrivée (SPEC §4). */
function comparePhaseRows(
  x: PhaseRankRow & { provisional: number },
  y: PhaseRankRow & { provisional: number },
): number {
  return (
    x.provisional - y.provisional ||
    y.ptm - x.ptm ||
    y.pts - x.pts ||
    y.moy - x.moy ||
    x.arrivee - y.arrivee
  );
}

/** Classement de phase, toutes poules confondues (SPEC §4). Les forfaits sont classés en fin. */
export function rankPhase(
  poules: Poule[],
  d: Distance,
  arrivee: Record<string, number>,
  forfaits: string[] = [],
  forfaitSubis?: Record<string, number>,
): PhaseRankRow[] {
  const forfaitSet = new Set(forfaits);
  const active: (PhaseRankRow & { provisional: number })[] = [];
  const out: (PhaseRankRow & { provisional: number })[] = [];
  for (const poule of poules) {
    const { rows } = rankPouleInPhase(poule, d, arrivee, forfaits, forfaitSubis);
    rows.forEach((r, i) => {
      const line = { ...r, poule: poule.num, place: 0, provisional: i + 1 };
      if (forfaitSet.has(r.name)) out.push(line);
      else active.push(line);
    });
  }
  active.sort(comparePhaseRows);
  out.sort((x, y) => x.arrivee - y.arrivee);
  return [...active, ...out].map(({ provisional: _p, ...r }, i) => ({ ...r, place: i + 1 }));
}

/**
 * Classement cumulé de la journée du vendredi (poules + barrage), tel que produit par l'outil
 * de référence (fixture `expectedBarrageRanking`, formule RNK_B) : à chaque joueur de barrage,
 * on ajoute le résultat de son barrage (Pm, Ps, points) à sa ligne de phase, puis on trie les
 * vainqueurs de barrage avant les perdants, et à l'intérieur par Pm, Ps, moyenne cumulés et
 * ordre d'arrivée. Sert à ordonner les perdants pour le National.
 */
export function rankBarrages(
  ranking: PhaseRankRow[],
  barrages: Match[],
  d: Distance,
): PhaseRankRow[] {
  const byName = new Map(ranking.map((r) => [r.name, r]));
  const rows: (PhaseRankRow & { won: number })[] = [];
  for (const m of barrages) {
    const outcome = matchOutcome(m, d);
    for (const name of [m.a, m.b]) {
      const base = byName.get(name);
      if (!base) continue;
      const r: PhaseRankRow & { won: number } = { ...base, rang: null, place: 0, won: 0 };
      if (outcome) {
        const won = outcome.winner === name;
        r.won = won ? 1 : 0;
        const [psW, psL] = setPoints(outcome, d);
        r.ptm += won ? 2 : 0;
        r.pts += won ? psW : psL;
        r.faits += won ? outcome.pointsWinner : outcome.pointsLoser;
        r.subis += won ? outcome.pointsLoser : outcome.pointsWinner;
        r.joues += 1;
        r.moy = r.subis > 0 ? r.faits / r.subis : r.faits;
      }
      rows.push(r);
    }
  }
  rows.sort(
    (x, y) =>
      y.won - x.won || y.ptm - x.ptm || y.pts - x.pts || y.moy - x.moy || x.arrivee - y.arrivee,
  );
  return rows.map(({ won: _w, ...r }, i) => ({ ...r, place: i + 1 }));
}

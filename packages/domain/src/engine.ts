/**
 * Moteur de règles Pilot5Q — squelette.
 *
 * Chaque fonction ci-dessous correspond à une règle de docs/SPEC.md. Les corps
 * sont des stubs (`not implemented`) à remplacer par l'implémentation réelle ;
 * les signatures constituent le contrat consommé par apps/web.
 */
import type {
  BracketMatch,
  Distance,
  Match,
  PhaseRankRow,
  Player,
  Poule,
  PouleRankRow,
  Rules,
  TournamentEvent,
  TournamentState,
} from "./types.js";

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: ${name}`);
};

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

/** Lit le CSV des inscrits du site fédéral (séparateur `;`, SPEC §2). */
export function parseInscritsCsv(_text: string): Player[] {
  return notImplemented("parseInscritsCsv");
}

/** Liste ordonnée des participants (SPEC §2) : classement glissant, base joueurs, puis nouveaux. */
export function orderParticipants(
  _players: Player[],
  _ranking: Record<string, number>,
  _lastKnown: Record<string, { place: number; season: number }>,
): Player[] {
  return notImplemented("orderParticipants");
}

/** Répartition en serpentin, poules de 4 et au plus `maxPoulesOf3` poules de 3 (SPEC §3). */
export function serpentin(_players: string[], _maxPoulesOf3: number): string[][] {
  return notImplemented("serpentin");
}

/** Contrainte club : jamais 3 joueurs du même club dans une poule (SPEC §3). */
export function resolveClubConflicts(
  _poules: string[][],
  _clubOf: Record<string, string>,
): { poules: string[][]; unresolved: number[] } {
  return notImplemented("resolveClubConflicts");
}

/** Matchs d'une poule dans l'ordre du code sportif (SPEC §4). */
export function pouleMatches(_pouleNum: number, _players: string[]): Match[] {
  return notImplemented("pouleMatches");
}

/** Vérifie qu'un score est cohérent avec la distance (SPEC §4). */
export function isValidScore(_m: Match, _d: Distance): boolean {
  return notImplemented("isValidScore");
}

/** Classement d'une poule (SPEC §4). */
export function rankPoule(
  _players: string[],
  _matches: Match[],
  _d: Distance,
  _opts?: { compensate3?: boolean; forfaits?: string[] },
): { rows: PouleRankRow[]; complete: boolean } {
  return notImplemented("rankPoule");
}

/** Classement de phase, toutes poules confondues (SPEC §4). */
export function rankPhase(
  _poules: Poule[],
  _d: Distance,
  _arrivee: Record<string, number>,
  _forfaits?: string[],
): PhaseRankRow[] {
  return notImplemented("rankPhase");
}

/** Appariement des barrages : 1–16, 2–15, … (SPEC §4). */
export function barragePairs(_ranking: PhaseRankRow[], _size: number): Match[] {
  return notImplemented("barragePairs");
}

/** Poules Masters du samedi (SPEC §5). */
export function composeMasters(
  _prequalified: string[],
  _barrageWinners: string[],
  _arrivee: Record<string, number>,
  _clubOf: Record<string, string>,
): Poule[] {
  return notImplemented("composeMasters");
}

/** Poules National du samedi (SPEC §5). */
export function composeNational(
  _barrageLosers: string[],
  _ranking: PhaseRankRow[],
  _from: number,
  _to: number,
): Poule[] {
  return notImplemented("composeNational");
}

/** Huitièmes de finale National prédéfinis (SPEC §5). */
export function nationalR16(_poulesQN: Poule[], _d: Distance): BracketMatch[] {
  return notImplemented("nationalR16");
}

/** Quarts de finale Masters prédéfinis (SPEC §5). */
export function mastersQF(_poulesQM: Poule[], _d: Distance): BracketMatch[] {
  return notImplemented("mastersQF");
}

/** Fait avancer les vainqueurs au tour suivant d'un tableau. */
export function advanceBracket(_matches: BracketMatch[], _d: Distance): BracketMatch[] {
  return notImplemented("advanceBracket");
}

/** Tableau de la consolante, élimination directe (SPEC §5). */
export function consolanteBracket(_players: string[], _max: number): BracketMatch[] {
  return notImplemented("consolanteBracket");
}

/** Réducteur : applique un événement à l'état. */
export function reduce(_state: TournamentState, _event: TournamentEvent): TournamentState {
  return notImplemented("reduce");
}

/** État initial d'un tournoi vide. */
export function initialState(): TournamentState {
  return notImplemented("initialState");
}

/** Rejoue un journal d'événements depuis l'état initial. */
export function replay(_events: TournamentEvent[]): TournamentState {
  return notImplemented("replay");
}

/** Export JSON public au format de l'application 5 Quilles (SPEC §9). */
export function toLiveJson(_state: TournamentState): unknown {
  return notImplemented("toLiveJson");
}

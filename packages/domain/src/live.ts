/**
 * Export JSON public au format de l'application 5 Quilles (`getTNdata.php`, SPEC §9).
 *
 * Structure minimale cohérente (hors V1) :
 * `{ tournoi, lieu, infos: { joueurs: [[nom, poule, billard]], poules: [["POULE n - BILLARD(S) x",
 * j1..j4]], billards: [[n°, "POULE x", jA, jB]] }, competitions: [{ nom, nomLong, classement:
 * [[rang, nom, "", matchs, victoires, ptsPour, ptsContre, moyenne]], poules: [{ nom, distanceSet,
 * matchs: [{ j1, j2, j1Status, j2Status, setsJ1, setsJ2, billard }] }] }] }`.
 *
 * Choix : `infos` décrit le vendredi (poules PREQ, premier match de chaque poule sur son billard) ;
 * les compétitions sont `PRE Q`, `N1 Q`, `M Q`, `N1 KO`, `M KO` ; les tableaux à élimination
 * directe sont exportés comme une « poule » par tour. `j1Status`/`j2Status` : `V` (victoire),
 * `D` (défaite), `F` (forfait), `""` (à jouer). `setsJ1`/`setsJ2` : points pour une distance en
 * 1 set, sets gagnés sinon.
 */
import { bracketDistance, phaseRanking, pouleDistance } from "./reducer.js";
import { matchOutcome } from "./scoring.js";
import type { BracketMatch, Distance, Match, Poule, TournamentState } from "./types.js";

export interface LiveMatch {
  j1: string;
  j2: string;
  j1Status: string;
  j2Status: string;
  setsJ1: number | null;
  setsJ2: number | null;
  billard: number | null;
}

export interface LivePoule {
  nom: string;
  distanceSet: number;
  matchs: LiveMatch[];
}

export interface LiveCompetition {
  nom: "PRE Q" | "N1 Q" | "N1 KO" | "M Q" | "M KO";
  nomLong: string;
  classement: [number, string, string, number, number, number, number, number][];
  poules: LivePoule[];
}

export interface LiveJson {
  tournoi: string;
  lieu: string;
  infos: {
    joueurs: [string, string, string][];
    poules: string[][];
    billards: [number, string, string, string][];
  };
  competitions: LiveCompetition[];
}

function liveMatch(m: Match, d: Distance): LiveMatch {
  const o = matchOutcome(m, d);
  const status = (name: string): string => {
    if (!o) return "";
    if (o.walkover && o.loser === name) return "F";
    return o.winner === name ? "V" : "D";
  };
  return {
    j1: m.a,
    j2: m.b,
    j1Status: status(m.a),
    j2Status: status(m.b),
    setsJ1: m.sa,
    setsJ2: m.sb,
    billard: m.billard ?? null,
  };
}

function livePoules(poules: Poule[], d: Distance): LivePoule[] {
  return poules.map((p) => ({
    nom: `POULE ${p.num}`,
    distanceSet: d.pointsParSet,
    matchs: p.matches.map((m) => liveMatch(m, d)),
  }));
}

function liveBracket(
  matches: BracketMatch[],
  phase: "N" | "M" | "CLS",
  state: TournamentState,
): LivePoule[] {
  const rounds = [...new Set(matches.map((m) => m.round))];
  return rounds.map((round) => {
    const d = bracketDistance(state.rules, phase, round);
    return {
      nom: round,
      distanceSet: d.pointsParSet,
      matchs: matches.filter((m) => m.round === round).map((m) => liveMatch(m, d)),
    };
  });
}

function classement(
  state: TournamentState,
  phase: "PREQ" | "QN" | "QM",
): LiveCompetition["classement"] {
  return phaseRanking(state, phase).map((r) => [
    r.place,
    r.name,
    "",
    r.joues,
    r.ptm / 2,
    r.faits,
    r.subis,
    r.moy,
  ]);
}

/** Export JSON public au format de l'application 5 Quilles (SPEC §9). */
export function toLiveJson(state: TournamentState): LiveJson {
  const preq = state.poules.PREQ;
  const joueurs: [string, string, string][] = [];
  const poules: string[][] = [];
  const billards: [number, string, string, string][] = [];
  for (const p of preq) {
    const billardLabel = p.billards.join(", ");
    poules.push([`POULE ${p.num} - BILLARD(S) ${billardLabel}`, ...p.players]);
    for (const name of p.players) joueurs.push([name, `POULE ${p.num}`, billardLabel]);
    const first = p.matches[0];
    const billard = p.billards[0];
    if (first && billard !== undefined)
      billards.push([billard, `POULE ${p.num}`, first.a, first.b]);
  }
  joueurs.sort((x, y) => x[0].localeCompare(y[0], "fr"));
  billards.sort((x, y) => x[0] - y[0]);
  const competitions: LiveCompetition[] = [
    {
      nom: "PRE Q",
      nomLong: "Préqualifications",
      classement: classement(state, "PREQ"),
      poules: livePoules(preq, pouleDistance(state.rules, "PREQ")),
    },
    {
      nom: "N1 Q",
      nomLong: "Qualifications National",
      classement: classement(state, "QN"),
      poules: livePoules(state.poules.QN, pouleDistance(state.rules, "QN")),
    },
    {
      nom: "M Q",
      nomLong: "Qualifications Masters",
      classement: classement(state, "QM"),
      poules: livePoules(state.poules.QM, pouleDistance(state.rules, "QM")),
    },
    {
      nom: "N1 KO",
      nomLong: "National",
      classement: [],
      poules: liveBracket(state.brackets.N, "N", state),
    },
    {
      nom: "M KO",
      nomLong: "Masters",
      classement: [],
      poules: liveBracket(state.brackets.M, "M", state),
    },
  ];
  return {
    tournoi: state.info?.name ?? "",
    lieu: state.info?.city ?? "",
    infos: { joueurs, poules, billards },
    competitions,
  };
}

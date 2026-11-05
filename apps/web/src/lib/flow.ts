/** Modèle du schéma de flux du tournoi, calculé depuis l'état réel. */
import type { TournamentState } from "@pilot5q/domain";

import { isValidScore, matchWinner, phaseComplete } from "./engine";
import { bracketWinner, phaseDistance, qualifiers } from "./tournament";

export type FlowNodeId =
  | "insc"
  | "md"
  | "preq"
  | "bar"
  | "nd"
  | "cls"
  | "mas"
  | "nat"
  | "clst"
  | "qfm"
  | "r16"
  | "fcls"
  | "fm"
  | "fn";

export interface FlowNode {
  id: FlowNodeId;
  /** Colonne (0 = jeudi … 5 = dimanche). */
  col: number;
  /** Ordonnée du centre dans le viewBox. */
  y: number;
  label: string;
  sub: string;
  n: number;
  color: string;
  done: boolean;
}

export interface FlowLink {
  from: FlowNodeId;
  to: FlowNodeId;
  n: number;
  color: string;
  done: boolean;
}

export interface FlowModel {
  nodes: FlowNode[];
  links: FlowLink[];
}

export const FLOW_COLORS = {
  blue: "#4f7bf0",
  gold: "#e89f1f",
  green: "#1e9e62",
  grey: "#b7c0d3",
};

const ROW = { top: 90, mid: 300, low: 470 };

export function buildFlow(state: TournamentState): FlowModel {
  const { blue, gold, green, grey } = FLOW_COLORS;
  const rules = state.rules;
  const players = state.players.length;
  const masters = state.masters.length;
  const field = Math.max(0, players - masters);
  const poules = state.poules.PREQ.length;
  const barrage = Math.min(rules.barrageSize, field);
  const natDirect = Math.max(
    0,
    Math.min(rules.nationalSize - rules.barrageSize / 2, field - barrage),
  );
  const q = qualifiers(state);
  const eligible = state.closed.PREQ
    ? q.consolante.length
    : Math.max(0, field - barrage - natDirect);
  const clsPlayers = new Set(state.brackets.CLS.flatMap((m) => [m.a, m.b]).filter(Boolean)).size;
  const cls = clsPlayers || eligible;
  const dPreq = phaseDistance(state, "PREQ");
  const dQM = phaseDistance(state, "QM");
  const dQN = phaseDistance(state, "QN");
  const dFinal = phaseDistance(state, "M", "F");
  const dR16 = phaseDistance(state, "N", "R16");
  const dCls = phaseDistance(state, "CLS");
  const distLabel = (d: { pointsParSet: number; setsGagnants: number }) =>
    d.setsGagnants === 1 ? `set à ${d.pointsParSet}` : `${d.setsGagnants} sets à ${d.pointsParSet}`;

  const preqClosed = Boolean(state.closed.PREQ);
  const bClosed = Boolean(state.closed.B);
  const qmClosed = Boolean(state.closed.QM);
  const qnClosed = Boolean(state.closed.QN);
  const qfmDone =
    qmClosed &&
    state.brackets.M.filter((m) => m.round === "QF").every(
      (m) => m.a && m.b && matchWinner(m, dFinal),
    );
  const r16Done =
    qnClosed &&
    state.brackets.N.filter((m) => m.round === "R16").every(
      (m) => m.a && m.b && isValidScore(m, dR16),
    );
  const clsDone =
    Boolean(state.closed.CLS) || (state.brackets.CLS.length > 0 && phaseComplete(state, "CLS"));
  const winM = bracketWinner(state, "M");
  const winN = bracketWinner(state, "N");
  const winC = bracketWinner(state, "CLS");
  const nice = (n: string | null) =>
    n ? n.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase()) : "";

  const nodes: FlowNode[] = [
    {
      id: "insc",
      col: 0,
      y: ROW.mid,
      label: "Inscrits",
      sub: "liste ordonnée",
      n: players,
      color: blue,
      done: players > 0,
    },
    {
      id: "md",
      col: 1,
      y: ROW.top,
      label: "Masters directs",
      sub: `places 1 à ${masters}`,
      n: masters,
      color: gold,
      done: players > 0,
    },
    {
      id: "preq",
      col: 1,
      y: ROW.mid,
      label: "Poules du vendredi",
      sub: poules ? `${poules} poules · ${distLabel(dPreq)}` : "serpentin · poules de 4",
      n: field,
      color: blue,
      done: poules > 0,
    },
    {
      id: "bar",
      col: 2,
      y: 170,
      label: "Barrages",
      sub: `places 1 à ${barrage}`,
      n: barrage,
      color: blue,
      done: preqClosed,
    },
    {
      id: "nd",
      col: 2,
      y: ROW.mid,
      label: "National direct",
      sub: `places ${barrage + 1} à ${barrage + natDirect}`,
      n: natDirect,
      color: green,
      done: preqClosed,
    },
    {
      id: "cls",
      col: 2,
      y: ROW.low,
      label: "Consolante",
      sub: `places ${barrage + natDirect + 1}+ · volontariat`,
      n: cls,
      color: grey,
      done: preqClosed,
    },
    {
      id: "mas",
      col: 3,
      y: ROW.top,
      label: "Masters",
      sub: `4 poules · ${distLabel(dQM)}`,
      n: masters + barrage / 2,
      color: gold,
      done: bClosed,
    },
    {
      id: "nat",
      col: 3,
      y: ROW.mid,
      label: "National",
      sub: `8 poules · ${distLabel(dQN)}`,
      n: rules.nationalSize,
      color: green,
      done: bClosed,
    },
    {
      id: "clst",
      col: 3,
      y: ROW.low,
      label: "Tableau consolante",
      sub: `élimination · ${distLabel(dCls)}`,
      n: cls,
      color: grey,
      done: state.brackets.CLS.length > 0,
    },
    {
      id: "qfm",
      col: 4,
      y: ROW.top,
      label: "Quarts Masters",
      sub: distLabel(dFinal),
      n: 8,
      color: gold,
      done: qfmDone,
    },
    {
      id: "r16",
      col: 4,
      y: ROW.mid,
      label: "Huitièmes National",
      sub: distLabel(dR16),
      n: 16,
      color: green,
      done: r16Done,
    },
    {
      id: "fcls",
      col: 4,
      y: ROW.low,
      label: "Finale consolante",
      sub: winC ? `vainqueur : ${nice(winC)}` : "samedi soir",
      n: 2,
      color: grey,
      done: clsDone,
    },
    {
      id: "fm",
      col: 5,
      y: ROW.top,
      label: "Finale Masters",
      sub: winM ? `vainqueur : ${nice(winM)}` : "dimanche",
      n: 2,
      color: gold,
      done: Boolean(state.closed.M),
    },
    {
      id: "fn",
      col: 5,
      y: ROW.mid,
      label: "Finale National",
      sub: winN ? `vainqueur : ${nice(winN)}` : "dimanche",
      n: 2,
      color: green,
      done: Boolean(state.closed.N),
    },
  ];
  const doneOf = new Map(nodes.map((n) => [n.id, n.done]));
  const link = (from: FlowNodeId, to: FlowNodeId, n: number, color: string): FlowLink => ({
    from,
    to,
    n,
    color,
    done: Boolean(doneOf.get(to)),
  });
  const links: FlowLink[] = [
    link("insc", "md", masters, gold),
    link("insc", "preq", field, blue),
    link("preq", "bar", barrage, blue),
    link("preq", "nd", natDirect, green),
    link("preq", "cls", cls, grey),
    link("bar", "mas", barrage / 2, gold),
    link("bar", "nat", barrage / 2, green),
    link("md", "mas", masters, gold),
    link("nd", "nat", natDirect, green),
    link("cls", "clst", cls, grey),
    link("mas", "qfm", 8, gold),
    link("nat", "r16", 16, green),
    link("clst", "fcls", 2, grey),
    link("qfm", "fm", 2, gold),
    link("r16", "fn", 2, green),
  ].filter((l) => l.n > 0);
  return { nodes, links };
}

/** Identifiants reliés (amont et aval) à un nœud, pour le survol. */
export function flowPath(model: FlowModel, id: FlowNodeId): Set<FlowNodeId> {
  const keep = new Set<FlowNodeId>();
  const walk = (n: FlowNodeId, dir: "up" | "down" | "both") => {
    keep.add(n);
    for (const l of model.links) {
      if (dir !== "up" && l.from === n && !keep.has(l.to)) walk(l.to, "down");
      if (dir !== "down" && l.to === n && !keep.has(l.from)) walk(l.from, "up");
    }
  };
  walk(id, "both");
  return keep;
}

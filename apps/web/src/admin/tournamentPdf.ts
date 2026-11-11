/**
 * Récapitulatif d'un TN en PDF (A4 portrait, jsPDF + autotable, même charte que le classement
 * glissant) : en-tête du tournoi et podiums, classement final complet avec les points
 * attribués, puis les résultats phase par phase (poules du vendredi et leur classement,
 * barrages, qualifications Masters et National du samedi, tableaux finaux, consolante), les
 * primes et les forfaits. C'est le document que le responsable national envoie au secrétariat
 * avec le classement glissant. jsPDF est chargé à la demande.
 */
import type {
  BracketMatch,
  BracketRound,
  Distance,
  Match,
  PhaseRankRow,
  Poule,
  Stage,
  TournamentAward,
  TournamentPhaseRow,
  TournamentState,
} from "@pilot5q/domain";
import {
  bracketDistance,
  bracketRanking,
  matchOutcome,
  phaseRanking,
  pouleDistance,
  primesOf,
} from "@pilot5q/domain";
import type { jsPDF } from "jspdf";
import type { CellHookData, UserOptions } from "jspdf-autotable";

import { clubShort, dateRange, nice, ordinal } from "@/lib/format";

import { safeFileName } from "./attachments";
import {
  BLUE,
  BLUE_SOFT,
  GOLD_INK,
  GOLD_SOFT,
  INK,
  INK_SECONDARY,
  LINE,
  MUTED,
  OK_INK,
  OK_SOFT,
  PAGE_MARGIN,
  SURFACE_2,
  WHITE,
  drawBrand,
  drawFooters,
  generatedLine,
  lastTableY,
  type Rgb,
} from "./pdfKit";

export interface TournamentPdfInput {
  stage: Stage;
  /** Nom du club hôte. */
  clubName: string;
  /** Directeur de jeu (« NOM Prénom »), s'il est connu. */
  djName?: string;
  /** Tournoi rejoué depuis le journal du cockpit. */
  state: TournamentState;
  /** Classement final et points attribués (ceux de la clôture, corrections comprises). */
  awards: TournamentAward[];
}

/** « Recapitulatif TN 2 2026-2027 Ronchin.pdf » (nom de fichier sans accents). */
export function tournamentFileName(stage: Stage): string {
  return safeFileName(
    `Récapitulatif ${stage.name} ${stage.season}${stage.city ? ` ${stage.city}` : ""}.pdf`,
  );
}

const BRAND = "Récapitulatif du tournoi";
const ORIGIN = { M: "Masters", N: "National", CLS: "Consolante", PREQ: "Vendredi" } as const;
const ORIGIN_FILL: Record<TournamentAward["origin"], Rgb | null> = {
  M: GOLD_SOFT,
  N: BLUE_SOFT,
  CLS: OK_SOFT,
  PREQ: null,
};
const ORIGIN_INK: Record<TournamentAward["origin"], Rgb> = {
  M: GOLD_INK,
  N: BLUE,
  CLS: OK_INK,
  PREQ: INK_SECONDARY,
};
const ROUNDS: BracketRound[] = ["R64", "R32", "R16", "QF", "SF", "F"];
const ROUND_NAME: Record<BracketRound, string> = {
  R64: "32e",
  R32: "16e",
  R16: "8e",
  QF: "Quart",
  SF: "Demie",
  F: "Finale",
};

const fmt = (n: number, digits: number): string => n.toFixed(digits).replace(".", ",");
/** Montant en euros sans espace insécable (absente des polices standard du PDF). */
const money = (n: number, withCents = false): string => {
  const [int = "0", cents = "00"] = n.toFixed(2).split(".");
  const euros = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${euros}${withCents || cents !== "00" ? `,${cents}` : ""} €`;
};
const distanceText = (d: Distance): string =>
  d.setsGagnants === 1
    ? `1 set à ${d.pointsParSet}`
    : `${d.setsGagnants} sets gagnants à ${d.pointsParSet}`;

interface Score {
  /** « 100 – 76 », « 3 – 1 », « forfait » ou « non joué ». */
  text: string;
  /** Détail des sets d'un match en plusieurs sets : « 60-45  38-60  60-52 ». */
  sets: string;
  winner: string | null;
}

function scoreOf(m: Match, d: Distance): Score {
  const outcome = matchOutcome(m, d);
  if (!outcome) {
    const partial = m.sa !== null && m.sb !== null ? `${m.sa} – ${m.sb}` : "non joué";
    return { text: partial, sets: "", winner: null };
  }
  if (m.sa === null || m.sb === null) return { text: "forfait", sets: "", winner: outcome.winner };
  const sets =
    d.setsGagnants > 1 && m.setsA && m.setsB
      ? m.setsA.map((x, i) => `${x}-${m.setsB?.[i] ?? ""}`).join("  ")
      : "";
  return {
    text: `${m.sa} – ${m.sb}${m.forfait ? " (forfait)" : ""}`,
    sets,
    winner: outcome.winner,
  };
}

/** Génère le PDF récapitulatif du tournoi. */
export async function tournamentPdf(input: TournamentPdfInput): Promise<Blob> {
  const { stage, state, awards } = input;
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  // Compressé : le document compte plusieurs milliers de cellules et part en pièce jointe.
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const label = `${stage.name} ${stage.season}`;
  pdf.setProperties({
    title: `Récapitulatif du tournoi - ${label}${stage.city ? ` ${stage.city}` : ""}`,
    author: "Responsable national 5-Quilles",
    creator: "Pilot5Q",
  });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = PAGE_MARGIN;
  const TOP = 20;
  const BOTTOM = 16;
  let y = 0;

  /* ---------- Briques de mise en page ---------- */

  const newPage = (): void => {
    pdf.addPage();
    drawBrand(pdf, BRAND);
    y = 22;
  };
  /** Passe à la page suivante s'il ne reste pas `height` mm. */
  const ensure = (height: number): void => {
    if (y + height > H - BOTTOM) newPage();
  };
  const section = (title: string, sub = ""): void => {
    ensure(26);
    y += 1.5;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...BLUE);
    pdf.text(title.toUpperCase(), M, y + 3.4);
    if (sub) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.8);
      pdf.setTextColor(...MUTED);
      pdf.text(sub, W - M, y + 3.4, { align: "right" });
    }
    pdf.setDrawColor(...BLUE);
    pdf.setLineWidth(0.35);
    pdf.line(M, y + 5, W - M, y + 5);
    y += 8;
  };
  const note = (text: string): void => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    const lines = pdf.splitTextToSize(text, W - 2 * M) as string[];
    ensure(lines.length * 3.4 + 2);
    pdf.text(lines, M, y + 2.4);
    y += lines.length * 3.4 + 2.5;
  };
  const base: UserOptions = {
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 7.4,
      textColor: INK,
      cellPadding: { top: 0.95, bottom: 0.95, left: 1.1, right: 1.1 },
      lineColor: LINE,
      lineWidth: { bottom: 0.15 },
      overflow: "ellipsize",
      valign: "middle",
    },
    headStyles: {
      fillColor: BLUE,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 6.8,
      valign: "middle",
      lineWidth: 0,
      cellPadding: { top: 1, bottom: 1, left: 1.1, right: 1.1 },
    },
  };
  /** Tableau pleine largeur à la position courante ; l'en-tête de page est redessiné si besoin. */
  const table = (options: UserOptions, gap = 5): void => {
    const first = pdf.getCurrentPageInfo().pageNumber;
    autoTable(pdf, {
      ...base,
      startY: y,
      margin: { left: M, right: M, top: TOP, bottom: BOTTOM },
      didDrawPage: () => {
        if (pdf.getCurrentPageInfo().pageNumber > first) drawBrand(pdf, BRAND);
      },
      ...options,
    });
    y = lastTableY(pdf, y) + gap;
  };
  /** Texte tronqué à `width` mm avec la police courante. */
  const clip = (doc: jsPDF, text: string, width: number): string => {
    if (doc.getTextWidth(text) <= width) return text;
    let out = text;
    while (out.length > 1 && doc.getTextWidth(`${out}…`) > width) out = out.slice(0, -1);
    return `${out}…`;
  };

  /* ---------- Données ---------- */

  const club = new Map(state.players.map((p) => [p.name, p.club]));
  const byLicence = new Map(state.players.map((p) => [p.licence, p.name]));
  const preq = phaseRanking(state, "PREQ");
  const qn = phaseRanking(state, "QN");
  const qm = phaseRanking(state, "QM");
  const finals: Record<"M" | "N" | "CLS", TournamentPhaseRow[]> = {
    M: bracketRanking(state, "M"),
    N: bracketRanking(state, "N"),
    CLS: bracketRanking(state, "CLS"),
  };
  const billardsOf = (phase: "PREQ" | "QN" | "QM", poule: Poule): number[] => {
    const assigned = state.billardAssignments[phase]?.[String(poule.num)];
    return assigned && assigned.length > 0 ? assigned : poule.billards;
  };
  /** Parcours d'un joueur dans le tableau qui fixe ses points. */
  const resultOf = (a: TournamentAward): string => {
    if (a.origin === "PREQ") {
      const r = preq.find((x) => x.name === a.name);
      return r?.rang ? `${ordinal(r.rang)} de la poule ${r.poule}` : "Poules du vendredi";
    }
    const r = finals[a.origin].find((x) => x.name === a.name);
    if (r?.label) return r.label;
    return r?.rang ? `${ordinal(r.rang)} de poule` : "";
  };
  const big = state.billards.filter((b) => b.type === "3m10").length;
  const juniors = state.players.filter((p) => p.junior).length;
  const consolante = new Set(state.brackets.CLS.flatMap((m) => [m.a, m.b]).filter(Boolean));

  /* ---------- En-tête ---------- */

  drawBrand(pdf, BRAND);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13.5);
  pdf.setTextColor(...INK);
  pdf.text(`RÉCAPITULATIF DU TOURNOI · ${stage.name.toUpperCase()} · ${stage.season}`, M, 23.5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.8);
  pdf.setTextColor(...MUTED);
  pdf.text(
    [
      stage.city,
      input.clubName,
      stage.start && stage.end ? dateRange(stage.start, stage.end) : "",
      input.djName ? `directeur de jeu : ${nice(input.djName)}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    M,
    28.8,
  );
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...BLUE);
  pdf.text(
    [
      `${state.players.length} joueurs`,
      `${juniors} U21`,
      `${state.billards.length} billards (${big} de 3m10, ${state.billards.length - big} de 2m80)`,
      `${state.poules.PREQ.length} poules le vendredi`,
      consolante.size > 0 ? `consolante : ${consolante.size} joueurs` : "pas de consolante",
    ].join(" · "),
    M,
    33.6,
  );
  y = 37.5;

  // Podiums.
  const podium = (phase: "M" | "N" | "CLS"): string[] => {
    const rows = finals[phase].filter((r) => r.reached !== null);
    const at = (level: string) => rows.filter((r) => r.reached === level).map((r) => nice(r.name));
    return [at("W").join(", ") || "–", at("F").join(", ") || "–", at("SF").join(", ") || "–"];
  };
  table({
    head: [["Tableau", "Vainqueur", "Finaliste", "Demi-finalistes"]],
    body: [
      ["Masters", ...podium("M")],
      ["National", ...podium("N")],
      ...(state.brackets.CLS.length > 0 ? [["Consolante", ...podium("CLS")]] : []),
    ],
    columnStyles: {
      0: { cellWidth: 24, fontStyle: "bold" },
      1: { cellWidth: 44, fontStyle: "bold" },
      2: { cellWidth: 44 },
    },
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const origin = (["M", "N", "CLS"] as const)[data.row.index];
      if (origin) data.cell.styles.textColor = ORIGIN_INK[origin];
    },
  });

  /* ---------- Classement final et points ---------- */

  const abandons = awards.filter((a) => a.abandon).length;
  section(
    "Classement final et points attribués",
    `${awards.length} joueurs${abandons > 0 ? ` · ${abandons} abandon(s)` : ""} · barème réforme 2026-2027`,
  );
  table({
    head: [
      [
        "Pl.",
        "Nom Prénom",
        "Club",
        "Licence",
        "Tableau",
        "Résultat",
        "Barème",
        "Décimale",
        "Total",
      ],
    ],
    body: awards.map((a, i) => [
      String(i + 1),
      a.name,
      clubShort(a.club),
      a.licence,
      a.abandon ? "Abandon" : ORIGIN[a.origin],
      resultOf(a),
      String(a.abandon ? 0 : a.points),
      fmt(a.abandon ? 0 : a.decimal, 4),
      fmt(a.abandon ? 0 : a.points + a.decimal, 4),
    ]),
    columnStyles: {
      0: { halign: "right", cellWidth: 8, font: "courier", fontStyle: "bold" },
      1: { cellWidth: 40, fontStyle: "bold" },
      2: { cellWidth: 34, textColor: MUTED, fontSize: 7 },
      3: { cellWidth: 14, font: "courier", fontSize: 6.8 },
      4: { cellWidth: 17 },
      5: { cellWidth: 28, fontSize: 7 },
      6: { halign: "right", cellWidth: 12, font: "courier" },
      7: { halign: "right", cellWidth: 14, font: "courier", fontSize: 7 },
      8: { halign: "right", font: "courier", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "head") {
        if ([0, 6, 7, 8].includes(data.column.index)) data.cell.styles.halign = "right";
        return;
      }
      const a = awards[data.row.index];
      if (!a) return;
      if (a.abandon) {
        data.cell.styles.textColor = MUTED;
        return;
      }
      if (data.row.index % 2 === 1) data.cell.styles.fillColor = SURFACE_2;
      if (data.column.index === 4) {
        const fill = ORIGIN_FILL[a.origin];
        if (fill) data.cell.styles.fillColor = fill;
        data.cell.styles.textColor = ORIGIN_INK[a.origin];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  note(
    "Total = points du barème + décimale de départage (points de set / matchs joués / 100). Un abandon hors consolante ne marque aucun point. Ce total entre dans le classement glissant (4 meilleurs résultats sur les 5 derniers TN).",
  );

  /* ---------- Poules : bloc classement + matchs ---------- */

  /** Hauteur d'un bloc de poule (mm). */
  const blockHeight = (poule: Poule): number =>
    5.6 + poule.players.length * 3.75 + poule.matches.length * 3.35 + 1;
  /** Dessine une poule (classement puis matchs) et rend l'ordonnée de fin. */
  const pouleBlock = (
    phase: "PREQ" | "QN" | "QM",
    poule: Poule,
    ranking: PhaseRankRow[],
    x: number,
    width: number,
    top: number,
  ): number => {
    const d = pouleDistance(state.rules, phase);
    const rows = ranking
      .filter((r) => r.poule === poule.num)
      .sort((a, b) => (a.rang ?? 99) - (b.rang ?? 99));
    const billards = billardsOf(phase, poule);
    const title = `Poule ${poule.num}${billards.length > 0 ? ` · billard${billards.length > 1 ? "s" : ""} ${billards.join(" et ")}` : ""}`;
    const scores = poule.matches.map((m) => scoreOf(m, d));
    autoTable(pdf, {
      ...base,
      startY: top,
      margin: { left: x, right: W - x - width, top: TOP, bottom: BOTTOM },
      tableWidth: width,
      pageBreak: "avoid",
      head: [[{ content: title, colSpan: 2 }, "Pm", "Ps", "Faits", "Subis", "Moy."]],
      body: [
        ...rows.map((r) => [
          r.rang === null ? "–" : String(r.rang),
          nice(r.name),
          String(r.ptm),
          String(r.pts),
          String(r.faits),
          String(r.subis),
          fmt(r.moy, 3),
        ]),
        ...poule.matches.map(() => [
          {
            content: "",
            colSpan: 7,
            styles: {
              minCellHeight: 3.35,
              cellPadding: 0,
              lineWidth: 0,
              fillColor: SURFACE_2,
            },
          },
        ]),
      ],
      columnStyles: {
        0: { cellWidth: 5, halign: "center", font: "courier", fontStyle: "bold" },
        1: { fontStyle: "bold" },
        2: { cellWidth: 7, halign: "right", font: "courier" },
        3: { cellWidth: 7, halign: "right", font: "courier" },
        4: { cellWidth: 9.5, halign: "right", font: "courier" },
        5: { cellWidth: 9.5, halign: "right", font: "courier" },
        6: { cellWidth: 11, halign: "right", font: "courier" },
      },
      didParseCell: (data) => {
        if (data.section === "head" && data.column.index >= 2) data.cell.styles.halign = "right";
        if (data.section === "body" && data.row.index < rows.length && data.column.index <= 1) {
          // Les deux premiers d'une poule sortent du lot (qualifiés ou mieux placés).
          const r = rows[data.row.index];
          if (r?.rang !== null && r?.rang !== undefined && r.rang > 2)
            data.cell.styles.fontStyle = "normal";
        }
      },
      didDrawCell: (data: CellHookData) => {
        if (data.section !== "body" || data.row.index < rows.length) return;
        const k = data.row.index - rows.length;
        const m = poule.matches[k];
        const s = scores[k];
        if (!m || !s) return;
        const doc = data.doc as jsPDF;
        const { cell } = data;
        const withSets = s.sets !== "";
        const setsWidth = withSets ? 34 : 0;
        const cx = cell.x + (cell.width - setsWidth) / 2;
        const half = (cell.width - setsWidth) / 2 - 10;
        const baseline = cell.y + cell.height / 2 + 0.85;
        doc.setFontSize(6.6);
        doc.setTextColor(...INK_SECONDARY);
        doc.setFont("helvetica", s.winner === m.a ? "bold" : "normal");
        doc.text(clip(doc, nice(m.a), half), cx - 8.5, baseline, { align: "right" });
        doc.setFont("helvetica", s.winner === m.b ? "bold" : "normal");
        doc.text(clip(doc, nice(m.b), half), cx + 8.5, baseline);
        doc.setFont("courier", "bold");
        doc.setTextColor(...INK);
        doc.text(s.text, cx, baseline, { align: "center" });
        if (withSets) {
          doc.setFont("courier", "normal");
          doc.setFontSize(6.2);
          doc.setTextColor(...MUTED);
          doc.text(s.sets, cell.x + cell.width - 1.2, baseline, { align: "right" });
        }
      },
    });
    return lastTableY(pdf, top);
  };
  /** Poules en une ou deux colonnes, sans couper un bloc entre deux pages. */
  const pouleGrid = (
    phase: "PREQ" | "QN" | "QM",
    ranking: PhaseRankRow[],
    columns: 1 | 2,
  ): void => {
    const poules = [...state.poules[phase]].sort((a, b) => a.num - b.num);
    const gap = 5;
    const width = columns === 2 ? (W - 2 * M - gap) / 2 : W - 2 * M;
    for (let i = 0; i < poules.length; i += columns) {
      const line = poules.slice(i, i + columns);
      ensure(Math.max(...line.map(blockHeight)));
      const top = y;
      let bottom = top;
      line.forEach((p, k) => {
        bottom = Math.max(bottom, pouleBlock(phase, p, ranking, M + k * (width + gap), width, top));
      });
      y = bottom + 3.5;
    }
    y += 1.5;
  };

  /* ---------- Vendredi ---------- */

  if (state.poules.PREQ.length > 0) {
    section(
      "Vendredi · Poules de préqualification",
      `${state.poules.PREQ.length} poules · ${distanceText(pouleDistance(state.rules, "PREQ"))}`,
    );
    pouleGrid("PREQ", preq, 2);

    const size = state.rules.barrageSize;
    const nationalTo = size + state.rules.nationalSize - size / 2;
    const barrageWinners = new Set(
      state.barrages
        .map((m) => matchOutcome(m, state.rules.distances.barrage)?.winner)
        .filter((n): n is string => Boolean(n)),
    );
    const next = (r: PhaseRankRow): string => {
      if (r.place <= size)
        return barrageWinners.has(r.name)
          ? "Barrage puis Masters"
          : state.barrages.length > 0
            ? "Barrage puis National"
            : "Barrage";
      if (r.place <= nationalTo) return "National";
      return consolante.has(r.name) ? "Consolante" : "Éliminé";
    };
    section(
      "Vendredi · Classement des poules",
      `places 1 à ${size} : barrages · ${size + 1} à ${nationalTo} : National · au-delà : consolante sur volontariat`,
    );
    table({
      head: [
        ["Pl.", "Joueur", "Club", "Poule", "Rang", "Pm", "Ps", "Faits", "Subis", "Moy.", "Suite"],
      ],
      body: preq.map((r) => [
        String(r.place),
        nice(r.name),
        clubShort(club.get(r.name) ?? ""),
        String(r.poule),
        r.rang === null ? "–" : String(r.rang),
        String(r.ptm),
        String(r.pts),
        String(r.faits),
        String(r.subis),
        fmt(r.moy, 3),
        next(r),
      ]),
      columnStyles: {
        0: { halign: "right", cellWidth: 8, font: "courier", fontStyle: "bold" },
        1: { cellWidth: 40, fontStyle: "bold" },
        2: { cellWidth: 36, textColor: MUTED, fontSize: 7 },
        3: { halign: "center", cellWidth: 10, font: "courier" },
        4: { halign: "center", cellWidth: 9, font: "courier" },
        5: { halign: "right", cellWidth: 8, font: "courier" },
        6: { halign: "right", cellWidth: 8, font: "courier" },
        7: { halign: "right", cellWidth: 11, font: "courier" },
        8: { halign: "right", cellWidth: 11, font: "courier" },
        9: { halign: "right", cellWidth: 12, font: "courier" },
        10: { fontSize: 7 },
      },
      didParseCell: (data) => {
        if (data.section === "head") {
          if (data.column.index === 0 || (data.column.index >= 5 && data.column.index <= 9))
            data.cell.styles.halign = "right";
          if (data.column.index === 3 || data.column.index === 4)
            data.cell.styles.halign = "center";
          return;
        }
        const r = preq[data.row.index];
        if (!r) return;
        if (r.place <= size) data.cell.styles.fillColor = GOLD_SOFT;
        else if (r.place <= nationalTo) data.cell.styles.fillColor = BLUE_SOFT;
      },
    });
  }

  /* ---------- Matchs d'un tableau ou des barrages ---------- */

  const matchTable = (
    matches: { tour: string; m: Match; d: Distance; referees?: string }[],
    options: { sets: boolean; referees: boolean },
  ): void => {
    const scores = matches.map((x) => scoreOf(x.m, x.d));
    const head = ["Tour", "Joueur A", "Score", "Joueur B"];
    if (options.sets) head.push("Sets");
    head.push("Bill.");
    if (options.referees) head.push("Arbitres");
    table({
      head: [head],
      body: matches.map((x, i) => {
        const row = [
          x.tour,
          x.m.a ? nice(x.m.a) : "exempt",
          x.m.a && x.m.b ? (scores[i]?.text ?? "") : "",
          x.m.b ? nice(x.m.b) : "exempt",
        ];
        if (options.sets) row.push(scores[i]?.sets ?? "");
        row.push(x.m.billard ? String(x.m.billard) : "");
        if (options.referees) row.push(x.referees ?? "");
        return row;
      }),
      columnStyles: {
        0: { cellWidth: 19, textColor: MUTED, fontSize: 7 },
        1: { halign: "right" },
        2: { halign: "center", cellWidth: 20, font: "courier", fontStyle: "bold" },
        3: {},
        ...(options.sets
          ? { 4: { cellWidth: 50, font: "courier", fontSize: 6.6, textColor: MUTED } }
          : {}),
        [options.sets ? 5 : 4]: { halign: "center", cellWidth: 9, font: "courier" },
        ...(options.referees
          ? { [options.sets ? 6 : 5]: { fontSize: 6.6, textColor: MUTED } }
          : {}),
      },
      didParseCell: (data) => {
        if (data.section === "head") {
          if (data.column.index === 1) data.cell.styles.halign = "right";
          if (data.column.index === 2 || data.column.index === (options.sets ? 5 : 4))
            data.cell.styles.halign = "center";
          return;
        }
        const x = matches[data.row.index];
        const s = scores[data.row.index];
        if (!x || !s) return;
        if (data.column.index === 1 && s.winner === x.m.a) data.cell.styles.fontStyle = "bold";
        if (data.column.index === 3 && s.winner === x.m.b) data.cell.styles.fontStyle = "bold";
        if ((data.column.index === 1 && !x.m.a) || (data.column.index === 3 && !x.m.b))
          data.cell.styles.textColor = MUTED;
      },
    });
  };

  /** Matchs d'un tableau, tour par tour, dans l'ordre des rencontres. */
  const bracketRows = (
    phase: "N" | "M" | "CLS",
  ): { tour: string; m: BracketMatch; d: Distance; referees?: string }[] =>
    ROUNDS.flatMap((round) =>
      state.brackets[phase]
        .filter((m) => m.round === round && (m.a || m.b))
        .sort((a, b) => a.slot - b.slot)
        .map((m, i, all) => ({
          tour: all.length > 1 ? `${ROUND_NAME[round]} ${i + 1}` : ROUND_NAME[round],
          m,
          d: bracketDistance(state.rules, phase, round),
          referees: [m.arbitre, m.arbitre2]
            .filter((l): l is string => Boolean(l))
            .map((l) => nice(byLicence.get(l) ?? l))
            .join(", "),
        })),
    );
  const bracketSection = (phase: "N" | "M" | "CLS", title: string): void => {
    const rows = bracketRows(phase);
    if (rows.length === 0) return;
    const distances = [...new Set(rows.map((r) => distanceText(r.d)))];
    section(title, distances.join(" puis "));
    matchTable(rows, {
      sets: rows.some((r) => r.d.setsGagnants > 1),
      referees: rows.some((r) => r.referees),
    });
  };

  /* ---------- Barrages ---------- */

  if (state.barrages.length > 0) {
    const d = state.rules.distances.barrage;
    section(
      "Vendredi · Barrages",
      `${state.barrages.length} matchs · ${distanceText(d)} · vainqueurs en Masters, perdants en National`,
    );
    matchTable(
      state.barrages.map((m, i) => ({ tour: `Barrage ${i + 1}`, m, d })),
      { sets: false, referees: false },
    );
  }

  /* ---------- Samedi et dimanche ---------- */

  if (state.poules.QM.length > 0) {
    section(
      "Samedi · Qualifications Masters",
      `${state.poules.QM.length} poules · ${distanceText(pouleDistance(state.rules, "QM"))} · les deux premiers en quarts`,
    );
    pouleGrid("QM", qm, 1);
  }
  bracketSection("M", "Dimanche · Tableau final Masters");
  if (state.poules.QN.length > 0) {
    section(
      "Samedi · Qualifications National",
      `${state.poules.QN.length} poules · ${distanceText(pouleDistance(state.rules, "QN"))} · les deux premiers en huitièmes`,
    );
    pouleGrid("QN", qn, 2);
  }
  bracketSection("N", "Tableau final National");
  if (state.brackets.CLS.length > 0) bracketSection("CLS", "Consolante");
  else {
    section("Consolante");
    note("Pas de consolante sur ce tournoi.");
  }

  /* ---------- Primes ---------- */

  const primes = primesOf(state);
  section(
    "Primes",
    `cagnotte ${money(primes.total)} : ${primes.players - primes.juniors} droits × ${money(state.rules.inscriptionFee)} + ${money(primes.ffb)} FFB + ${money(primes.club)} club`,
  );
  const primeRows = [
    ...primes.masters.map((p) => ({ ...p, phase: "M" as const })),
    ...primes.national.map((p) => ({ ...p, phase: "N" as const })),
  ];
  table({
    head: [["Tableau", "Rang", "Joueur", "Club", "Part", "Montant"]],
    body: primeRows.map((p) => [
      ORIGIN[p.phase],
      p.label,
      p.name ? nice(p.name) : "–",
      clubShort(club.get(p.name) ?? ""),
      `${fmt(p.pct * 100, 0)} %`,
      money(p.amount, true),
    ]),
    columnStyles: {
      0: { cellWidth: 22, fontStyle: "bold" },
      1: { cellWidth: 34 },
      2: { cellWidth: 46, fontStyle: "bold" },
      3: { textColor: MUTED, fontSize: 7 },
      4: { halign: "right", cellWidth: 14, font: "courier" },
      5: { halign: "right", cellWidth: 22, font: "courier", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "head") {
        if (data.column.index >= 4) data.cell.styles.halign = "right";
        return;
      }
      const p = primeRows[data.row.index];
      if (p && data.column.index === 0) data.cell.styles.textColor = ORIGIN_INK[p.phase];
    },
  });
  const paid = primeRows.reduce((a, p) => a + p.amount, 0);
  note(
    `Masters 80 % de la cagnotte, National 20 % (SPEC §6). Total distribué : ${money(paid)}. ${juniors} junior(s) U21 exempté(s) du droit d'inscription.`,
  );

  /* ---------- Forfaits et abandons ---------- */

  if (state.forfaits.length > 0) {
    const phases = {
      PREQ: "Poules du vendredi",
      B: "Barrages",
      QN: "Qualifications National",
      QM: "Qualifications Masters",
      N: "Tableau National",
      M: "Tableau Masters",
      CLS: "Consolante",
    } as const;
    section("Forfaits et abandons", `${state.forfaits.length} déclaration(s)`);
    table({
      head: [["Joueur", "Club", "Phase", "Nature"]],
      body: state.forfaits.map((f) => [
        nice(f.player),
        clubShort(club.get(f.player) ?? ""),
        phases[f.phase],
        f.kind === "abandon" ? "Abandon" : "Forfait",
      ]),
      columnStyles: {
        0: { cellWidth: 50, fontStyle: "bold" },
        1: { cellWidth: 50, textColor: MUTED, fontSize: 7 },
        2: { cellWidth: 50 },
      },
    });
  }

  drawFooters(
    pdf,
    `Récapitulatif ${label}${stage.city ? ` · ${stage.city}` : ""} · ${generatedLine()}`,
  );
  return pdf.output("blob");
}

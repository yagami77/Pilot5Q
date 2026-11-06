/**
 * Classement glissant en PDF (A4 portrait, jsPDF + autotable) : titre « CLASSEMENT GLISSANT
 * 5 QUILLES · APRÈS TN 2 · 2026-2027 », fenêtre en sous-titre, en-tête de tableau sur deux
 * lignes (saison / TN, du plus ancien au plus récent), colonne du TN sorti grisée et barrée,
 * résultat non compté en italique gris avec astérisque, bandes de qualification très légères,
 * en-tête répété à chaque page, pied de page paginé, légende en fin de document. Lisible en
 * noir et blanc. jsPDF est chargé à la demande.
 */
import type { RankingRow, StageRef } from "@pilot5q/domain";
import type { jsPDF } from "jspdf";
import { leftStage, resultAt, windowStages } from "@pilot5q/domain";

import { clubShort } from "@/lib/format";

import { safeFileName } from "./attachments";
import { bandOf } from "./bands";
import {
  BLUE,
  BLUE_SOFT,
  GOLD_INK,
  GOLD_SOFT,
  INK,
  LINE,
  LINE_2,
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

const BAND_FILL: Record<"gold" | "blue" | "green", Rgb> = {
  gold: GOLD_SOFT,
  blue: BLUE_SOFT,
  green: OK_SOFT,
};
const BAND_INK: Record<"gold" | "blue" | "green", Rgb> = {
  gold: GOLD_INK,
  blue: BLUE,
  green: OK_INK,
};
/** Colonne du TN sorti : gris très clair, hachuré. */
const LEFT_FILL: Rgb = [240, 242, 247];
const LEFT_INK: Rgb = [140, 150, 172];

const fmt = (n: number, digits = 3): string => n.toFixed(digits).replace(".", ",");
const tn = (s: StageRef): string => `TN ${s.tn}`;
const shortSeason = (season: string): string => `${season.slice(0, 4)}-${season.slice(7, 9)}`;

/** « Classement glissant 5 Quilles - après TN 2 2026-2027.pdf ». */
export function rankingFileName(last: StageRef): string {
  return safeFileName(`Classement glissant 5 Quilles - après TN ${last.tn} ${last.season}.pdf`);
}

/** Hachures à 45° dans un rectangle (ce qui ne compte plus). */
function hatch(pdf: jsPDF, x0: number, y0: number, w: number, h: number, step = 1.6): void {
  pdf.setDrawColor(...LINE_2);
  pdf.setLineWidth(0.12);
  const x1 = x0 + w;
  const y1 = y0 + h;
  for (let c = -h; c < w; c += step) {
    // Droite y = y1 − (x − (x0 + c)), découpée au rectangle.
    const xa = Math.max(x0, x0 + c);
    const xb = Math.min(x1, x0 + c + h);
    if (xb <= xa) continue;
    pdf.line(xa, y1 - (xa - (x0 + c)), xb, y1 - (xb - (x0 + c)));
  }
}

/** Génère le PDF du classement glissant après `last`. */
export async function rankingPdf(rows: RankingRow[], last: StageRef): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const stages = windowStages(last.season, last.tn);
  const left = leftStage(last.season, last.tn);
  const oldest = stages[0] ?? last;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  pdf.setProperties({
    title: `Classement glissant 5 Quilles - après TN ${last.tn} ${last.season}`,
    author: "Responsable national 5-Quilles",
    creator: "Pilot5Q",
  });
  const W = pdf.internal.pageSize.getWidth();
  const M = PAGE_MARGIN;
  const five = rows.filter((r) => r.count === 5).length;
  const played = rows.filter((r) => resultAt(r.results, last) !== undefined).length;

  drawBrand(pdf, "Classement glissant 5-Quilles");
  // Titre et sous-titre.
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13.5);
  pdf.setTextColor(...INK);
  pdf.text(`CLASSEMENT GLISSANT 5 QUILLES · APRÈS TN ${last.tn} · ${last.season}`, M, 23.5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.8);
  pdf.setTextColor(...MUTED);
  pdf.text(
    `Fenêtre des 5 derniers TN : du ${tn(oldest)} ${oldest.season} au ${tn(last)} ${last.season} · le ${tn(left)} ${left.season} est sorti de la fenêtre et ne compte plus.`,
    M,
    28.8,
  );
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.8);
  pdf.setTextColor(...BLUE);
  pdf.text(
    `${rows.length} joueurs classés · ${five} avec 5 TN · ${played} au ${tn(last)} ${last.season}`,
    M,
    33.6,
  );

  const FIXED = 7; // Position, Nom, Club, Licence, Points, Moyenne, Nb
  const LEFT_COL = FIXED;
  const firstWindowCol = FIXED + 1;
  const head = [
    [
      { content: "Pos.", rowSpan: 2 },
      { content: "Nom Prénom", rowSpan: 2 },
      { content: "Club", rowSpan: 2 },
      { content: "Licence", rowSpan: 2 },
      { content: "Pts", rowSpan: 2 },
      { content: "Moyenne", rowSpan: 2 },
      { content: "Nb", rowSpan: 2 },
      { content: "Sorti", styles: { fillColor: LEFT_INK } },
      { content: "", colSpan: stages.length, styles: { fillColor: BLUE } },
    ],
    [
      { content: `${tn(left)}\n${shortSeason(left.season)}`, styles: { fillColor: LEFT_INK } },
      ...stages.map((s) => ({ content: `${tn(s)}\n${shortSeason(s.season)}` })),
    ],
  ];
  const body = rows.map((r) => {
    const leftRes = resultAt(r.results, left);
    return [
      String(r.position),
      r.name,
      clubShort(r.club),
      r.licence,
      fmt(r.pts, 4),
      fmt(r.moy, 4),
      String(r.count),
      leftRes ? fmt(leftRes.pts) : "",
      ...r.window.map((w) => (w.pts === null ? "" : fmt(w.pts))),
    ];
  });

  autoTable(pdf, {
    startY: 37,
    margin: { left: M, right: M, top: 20, bottom: 16 },
    head,
    body,
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
      halign: "center",
      valign: "middle",
      lineWidth: 0,
      cellPadding: { top: 1, bottom: 1, left: 0.8, right: 0.8 },
    },
    columnStyles: {
      0: { halign: "right", cellWidth: 9, font: "courier", fontStyle: "bold" },
      1: { cellWidth: 33, fontStyle: "bold" },
      2: { cellWidth: 27, textColor: MUTED, fontSize: 7 },
      3: { cellWidth: 13, font: "courier", fontSize: 6.8 },
      4: { halign: "right", cellWidth: 16, font: "courier", fontStyle: "bold" },
      5: { halign: "right", cellWidth: 12, font: "courier", fontSize: 7 },
      6: { halign: "center", cellWidth: 6.5, font: "courier" },
      [LEFT_COL]: {
        halign: "right",
        cellWidth: 11.6,
        font: "courier",
        fontSize: 6.8,
        textColor: LEFT_INK,
        cellPadding: { top: 0.95, bottom: 0.95, left: 0.8, right: 0.9 },
      },
      ...Object.fromEntries(
        stages.map((_, i) => [
          firstWindowCol + i,
          {
            halign: "right",
            cellWidth: 11.6,
            font: "courier",
            fontSize: 6.8,
            cellPadding: { top: 0.95, bottom: 0.95, left: 0.6, right: 1.7 },
          },
        ]),
      ),
    },
    didParseCell: (data) => {
      if (data.section === "head") {
        if (data.column.index === 0 || data.column.index === 1 || data.column.index === 2)
          data.cell.styles.halign = data.column.index === 0 ? "right" : "left";
        if (data.row.index === 0 && data.column.index >= FIXED) data.cell.styles.fontSize = 6.2;
        return;
      }
      if (data.section !== "body") return;
      const r = rows[data.row.index];
      if (!r) return;
      const band = bandOf(r.position);
      const col = data.column.index;
      if (col === LEFT_COL) {
        data.cell.styles.fillColor = LEFT_FILL;
        data.cell.styles.textColor = LEFT_INK;
        return;
      }
      if (band) {
        data.cell.styles.fillColor = BAND_FILL[band.tone];
        if (col === 0) data.cell.styles.textColor = BAND_INK[band.tone];
      } else if (data.row.index % 2 === 1) data.cell.styles.fillColor = SURFACE_2;
      if (col >= firstWindowCol) {
        const w = r.window[col - firstWindowCol];
        if (w && w.pts !== null && !w.counted) {
          data.cell.styles.fontStyle = "italic";
          data.cell.styles.textColor = MUTED;
        }
      }
    },
    didDrawCell: (data) => {
      const { cell, doc } = data;
      const d = doc as jsPDF;
      if (data.section === "head" && data.row.index === 0 && data.column.index === firstWindowCol) {
        // « plus ancien ← fenêtre des 5 derniers TN → plus récent » dessiné dans la cellule fusionnée.
        const y = cell.y + cell.height / 2;
        const x0 = cell.x + 1.5;
        const x1 = cell.x + cell.width - 1.5;
        d.setFont("helvetica", "bold");
        d.setFontSize(5.8);
        d.setTextColor(...WHITE);
        const a = "PLUS ANCIEN";
        const b = "PLUS RÉCENT";
        const wa = d.getTextWidth(a);
        const wb = d.getTextWidth(b);
        d.text(a, x0, y + 0.7);
        d.text(b, x1, y + 0.7, { align: "right" });
        const lx0 = x0 + wa + 1.5;
        const lx1 = x1 - wb - 1.5;
        d.setDrawColor(...WHITE);
        d.setLineWidth(0.25);
        d.line(lx0, y, lx1, y);
        d.line(lx1 - 1.2, y - 0.8, lx1, y);
        d.line(lx1 - 1.2, y + 0.8, lx1, y);
        return;
      }
      if (data.section !== "body") return;
      const r = rows[data.row.index];
      if (r && data.column.index >= firstWindowCol) {
        // Astérisque du résultat non compté, en exposant dans la marge droite de la cellule.
        const w = r.window[data.column.index - firstWindowCol];
        if (w && w.pts !== null && !w.counted) {
          d.setFont("helvetica", "bold");
          d.setFontSize(7);
          d.setTextColor(...MUTED);
          d.text("*", cell.x + cell.width - 1.5, cell.y + cell.height / 2 + 0.4);
        }
        return;
      }
      if (data.column.index !== LEFT_COL) return;
      hatch(d, cell.x, cell.y, cell.width, cell.height);
      const text = cell.text[0];
      if (!text) return;
      // Chiffres barrés : trait au milieu du texte.
      d.setFont("courier", "normal");
      d.setFontSize(cell.styles.fontSize);
      const tw = d.getTextWidth(text);
      const xr = cell.x + cell.width - cell.padding("right");
      const y = cell.y + cell.height / 2 + 0.2;
      d.setDrawColor(...LEFT_INK);
      d.setLineWidth(0.25);
      d.line(xr - tw, y, xr, y);
    },
    didDrawPage: () => {
      if (pdf.getCurrentPageInfo().pageNumber > 1) drawBrand(pdf, "Classement glissant 5-Quilles");
    },
  });

  // Légende en fin de document.
  const H = pdf.internal.pageSize.getHeight();
  let y = lastTableY(pdf, 40) + 6;
  if (y > H - 40) {
    pdf.addPage();
    drawBrand(pdf, "Classement glissant 5-Quilles");
    y = 24;
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...INK);
  pdf.text("Légende", M, y);
  const lines = [
    `Points = barème du TN + décimale de départage (points de set / matchs / 100). Un joueur ayant joué les 5 TN de la fenêtre compte ses 4 meilleurs résultats ; en dessous de 5, la somme simple. Départage par la moyenne (points faits / points subis sur la fenêtre).`,
    `Colonne grisée et barrée : ${tn(left)} ${left.season}, sorti de la fenêtre à la clôture du ${tn(last)} ${last.season}. Ces points restent visibles mais ne comptent plus.`,
    `* Résultat non compté : le plus faible des 5 résultats (règle des 4 meilleurs sur 5), en italique gris.`,
    `Le ${tn(oldest)} ${oldest.season} est le plus ancien TN de la fenêtre : il sortira à la prochaine clôture.`,
    `Bandes : places 1 à 8 Masters directs (or), 9 à 16 (bleu), 17 à 34 finales nationales (vert).`,
  ];
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...MUTED);
  let ly = y + 4.2;
  for (const line of lines) {
    const wrapped = pdf.splitTextToSize(line, W - 2 * M) as string[];
    pdf.text(wrapped, M, ly);
    ly += wrapped.length * 3.4 + 0.8;
  }

  drawFooters(
    pdf,
    `Classement glissant 5 Quilles · après TN ${last.tn} ${last.season} · ${generatedLine()}`,
  );
  return pdf.output("blob");
}

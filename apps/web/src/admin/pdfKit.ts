/**
 * Briques communes des PDF de l'espace du responsable (jsPDF) : couleurs de la charte, bande
 * tricolore et logo Pilot5Q vectoriel en haut de chaque page, pied de page paginé.
 */
import type { jsPDF } from "jspdf";

export type Rgb = [number, number, number];

export const BLUE: Rgb = [14, 55, 168];
export const BLUE_LIGHT: Rgb = [30, 79, 216];
export const RED: Rgb = [220, 63, 90];
export const INK: Rgb = [15, 27, 51];
export const INK_SECONDARY: Rgb = [60, 74, 102];
export const MUTED: Rgb = [107, 122, 153];
export const LINE: Rgb = [228, 233, 243];
export const LINE_2: Rgb = [212, 219, 232];
export const SURFACE_2: Rgb = [249, 250, 253];
export const BLUE_SOFT: Rgb = [233, 239, 252];
export const GOLD: Rgb = [232, 159, 31];
export const GOLD_SOFT: Rgb = [255, 244, 223];
export const GOLD_INK: Rgb = [138, 90, 8];
export const OK_SOFT: Rgb = [229, 246, 236];
export const OK_INK: Rgb = [22, 107, 69];
export const WHITE: Rgb = [255, 255, 255];

/** Marge des documents A4 (mm). */
export const PAGE_MARGIN = 12;

/** Bande tricolore fine et logo Pilot5Q en haut de la page courante. */
export function drawBrand(pdf: jsPDF, subtitle = "Tournois Nationaux 5-Quilles"): void {
  const W = pdf.internal.pageSize.getWidth();
  const M = PAGE_MARGIN;
  const third = W / 3;
  pdf.setFillColor(...BLUE);
  pdf.rect(0, 0, third, 1.4, "F");
  pdf.setFillColor(...WHITE);
  pdf.rect(third, 0, third, 1.4, "F");
  pdf.setFillColor(...RED);
  pdf.rect(2 * third, 0, third, 1.4, "F");
  // Logo : carré arrondi et pictogramme (même dessin que la barre haute).
  const x = M;
  const y = 6;
  const s = 8;
  pdf.setDrawColor(...BLUE);
  pdf.setLineWidth(0.4);
  pdf.setFillColor(...WHITE);
  pdf.roundedRect(x, y, s, s, 2.1, 2.1, "FD");
  const cx = x + s / 2;
  const cy = y + s / 2;
  pdf.setLineWidth(0.45);
  pdf.circle(cx, cy, 0.85, "S");
  const ray = (a: number) => {
    const r1 = 1.75;
    const r2 = 2.75;
    pdf.line(
      cx + r1 * Math.cos(a),
      cy + r1 * Math.sin(a),
      cx + r2 * Math.cos(a),
      cy + r2 * Math.sin(a),
    );
  };
  for (let k = 0; k < 8; k++) ray((k * Math.PI) / 4);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...INK);
  pdf.text("Pilot5Q", x + s + 2.2, y + 5.6);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  pdf.text(subtitle, W - M, y + 5.6, { align: "right" });
}

/** Pied de page sur toutes les pages : trait, texte à gauche, « page x/y » à droite. */
export function drawFooters(pdf: jsPDF, left: string): void {
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = PAGE_MARGIN;
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.2);
    pdf.line(M, H - 11, W - M, H - 11);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(left, M, H - 7);
    pdf.text(`page ${i}/${pages}`, W - M, H - 7, { align: "right" });
  }
}

/** « généré par Pilot5Q le vendredi 6 novembre 2026 à 14:56 ». */
export function generatedLine(now = new Date()): string {
  const date = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `généré par Pilot5Q le ${date} à ${time}`;
}

/** Ordonnée de fin du dernier tableau tracé par jspdf-autotable. */
export function lastTableY(pdf: jsPDF, fallback: number): number {
  const last = (pdf as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  return last?.finalY ?? fallback;
}

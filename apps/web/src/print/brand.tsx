/**
 * Identité des documents imprimés : logo Pilot5Q vectoriel (net à l'impression), bandeau
 * d'en-tête plein (bleu signature, gris foncé en noir et blanc) avec un cartouche blanc pour
 * l'information principale, pied de page, scores colorés (gagnant / perdant) et QR code.
 */
import type { Distance, Match, TournamentState } from "@pilot5q/domain";
import type { ReactNode } from "react";

import { matchWinner } from "@/lib/engine";

import { qrMatrix, qrPath } from "./qr";

/** Pictogramme de la marque (même dessin que la barre haute), en traits fins. */
export function PrintLogo({ size = 9, inverse = false }: { size?: number; inverse?: boolean }) {
  const stroke = inverse ? "#fff" : "#0e37a8";
  return (
    <svg
      viewBox="0 0 30 30"
      width={`${size}mm`}
      height={`${size}mm`}
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="1"
        y="1"
        width="28"
        height="28"
        rx="8"
        fill={inverse ? "rgba(255,255,255,0.12)" : "#fff"}
        stroke={stroke}
        strokeWidth="1.6"
      />
      <g
        transform="translate(3 3)"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
      </g>
    </svg>
  );
}

/** Fine bande tricolore (bleu, blanc, rouge), discrète en noir et blanc. */
export function Tricolore({ className }: { className?: string }) {
  return (
    <div className={`print-tricolore ${className ?? ""}`} aria-hidden="true">
      <span className="bg-[#0e37a8]" />
      <span className="bg-white" />
      <span className="bg-[#dc3f5a]" />
    </div>
  );
}

/** Ligne « TN 2 · Ronchin · vendredi 30 octobre 2026 ». */
export function tournamentLine(state: TournamentState, date?: string): string {
  const info = state.info;
  if (!info) return date ?? "";
  return [info.name, info.city, date].filter(Boolean).join(" · ");
}

/** Cellule du cartouche blanc : libellé en capitales, valeur très grande, sous-texte. */
export interface BannerCell {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Taille de la valeur : `lg` (chiffre, 30 pt), `md` (20 pt), `sm` (texte, 13 pt). */
  size?: "lg" | "md" | "sm";
}

/**
 * Bandeau d'en-tête plein : marque à gauche, titre et contexte, cartouche blanc à droite avec
 * l'information principale (poule, billard, distance, montant…), lisible de loin.
 */
export function PrintBanner({
  eyebrow,
  title,
  sub,
  cells,
  small,
}: {
  /** Ligne en capitales au-dessus du titre (« TN 2 · Ronchin · vendredi 30 octobre 2026 »). */
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  cells?: BannerCell[];
  /** Variante compacte des feuilles de match. */
  small?: boolean;
}) {
  return (
    <header className="pb">
      <div className="pb-brand">
        <PrintLogo size={small ? 9 : 10.5} inverse />
        <div className="min-w-0">
          {eyebrow ? <div className="pb-eyebrow">{eyebrow}</div> : null}
          <div className={`pb-title ${small ? "pb-title-sm" : ""}`}>{title}</div>
          {sub ? <div className="pb-sub">{sub}</div> : null}
        </div>
      </div>
      {cells?.length ? (
        <div className="pb-card">
          {cells.map((c, i) => (
            <div key={i} className="pb-cell">
              <div className="pb-cell-label">{c.label}</div>
              <div
                className={`pb-cell-value ${c.size === "md" ? "pb-cell-value-md" : c.size === "sm" ? "pb-cell-value-sm" : ""}`}
              >
                {c.value}
              </div>
              {c.sub ? <div className="pb-cell-sub">{c.sub}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
}

/** Bandeau d'un document du tournoi : eyebrow = tournoi · lieu · date, titre du document. */
export function DocBanner({
  state,
  title,
  date,
  sub,
  cells,
}: {
  state: TournamentState;
  title: ReactNode;
  /** Date longue (« vendredi 30 octobre 2026 »). */
  date?: string;
  sub?: ReactNode;
  cells?: BannerCell[];
}) {
  return (
    <PrintBanner
      eyebrow={tournamentLine(state, date)}
      title={title}
      {...(sub ? { sub } : {})}
      {...(cells ? { cells } : {})}
    />
  );
}

/** Pied de page : marque à gauche, texte à droite (mention de page éventuelle). */
export function PrintFoot({ children, page }: { children?: ReactNode; page?: string }) {
  return (
    <footer className="p-foot">
      <span className="p-foot-brand">
        <PrintLogo size={3.6} /> Pilot5Q
        {page ? <span className="ml-[2mm] font-mono font-semibold">{page}</span> : null}
      </span>
      <span className="text-right">{children}</span>
    </footer>
  );
}

/* ---------- Scores ---------- */

/** Points affichés pour un côté (sets gagnés en distance à plusieurs sets). */
function side(m: Match, s: "a" | "b"): number | null {
  return s === "a" ? m.sa : m.sb;
}

/**
 * Score d'un match joué : « 100 – 79 », gagnant en gras vert sur fond clair, perdant en maigre
 * rouge ; en noir et blanc, le gagnant reste reconnaissable au gras et au fond gris. Détail des
 * sets entre parenthèses pour les distances à plusieurs sets. Vide tant que le match n'est pas
 * joué.
 */
export function Score({ m, d }: { m: Match; d: Distance }) {
  if (m.forfait) {
    const ff = m.forfait === "a";
    return (
      <span className="score">
        <span className={ff ? "score-ff" : "score-w"}>{ff ? "forfait" : "V"}</span>
        {" – "}
        <span className={ff ? "score-w" : "score-ff"}>{ff ? "V" : "forfait"}</span>
      </span>
    );
  }
  const sa = side(m, "a");
  const sb = side(m, "b");
  if (sa === null || sb === null) return null;
  const w = matchWinner(m, d);
  const cls = (s: "a" | "b") => (w ? (w === (s === "a" ? m.a : m.b) ? "score-w" : "score-l") : "");
  const multi = d.setsGagnants > 1 && m.setsA && m.setsB;
  return (
    <span className="score">
      <span className={cls("a")}>{sa}</span>
      {" – "}
      <span className={cls("b")}>{sb}</span>
      {multi ? (
        <span className="score-sets">
          ({m.setsA!.map((x, i) => `${x}-${m.setsB?.[i] ?? ""}`).join(", ")})
        </span>
      ) : null}
    </span>
  );
}

/** Nom d'un joueur dans une ligne de résultat : gras s'il a gagné, maigre s'il a perdu. */
export function winClass(m: Match, d: Distance, name: string): string {
  const w = matchWinner(m, d);
  if (!w) return "font-semibold";
  return w === name ? "font-extrabold" : "font-normal text-[#3c4a66]";
}

/* ---------- QR code ---------- */

/** Adresse publique de l'application pour un chemin (« tournoi/vendredi?poule=3 »). */
export function publicUrl(path: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return `${origin}${base}${path.replace(/^\//, "")}`;
}

/** QR code vectoriel, modules nets à l'impression, marge de deux modules. */
export function QrSvg({ text, size = 15 }: { text: string; size?: number }) {
  let grid: boolean[][];
  try {
    grid = qrMatrix(text);
  } catch {
    return null;
  }
  const n = grid.length;
  return (
    <svg
      viewBox={`-2 -2 ${n + 4} ${n + 4}`}
      width={`${size}mm`}
      height={`${size}mm`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={text}
    >
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      <path d={qrPath(grid)} fill="#0f1b33" />
    </svg>
  );
}

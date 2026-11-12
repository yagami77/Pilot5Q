/**
 * Identité des documents imprimés : logo Pilot5Q (image fournie par le client), bandeau
 * d'en-tête plein (bleu signature, gris foncé en noir et blanc) avec un cartouche blanc pour
 * l'information principale, pied de page, scores colorés (gagnant / perdant). Plus aucun QR
 * code sur les documents ; le générateur `qr.ts` reste disponible pour la feuille de match en
 * ligne.
 */
import type { Distance, Match, TournamentState } from "@pilot5q/domain";
import type { ReactNode } from "react";

import { LOGO_RATIO, logoUrl } from "@/components/Brand";
import { matchWinner } from "@/lib/engine";

/**
 * Logo Pilot5Q des documents. `height` en millimètres ; `boxed` le pose sur un cartouche blanc
 * (pour le bandeau bleu, où le lettrage bleu du logo ne se lirait pas).
 */
export function PrintLogo({ height = 9, boxed = false }: { height?: number; boxed?: boolean }) {
  const img = (
    <img
      src={logoUrl}
      alt="Pilot5Q"
      style={{ height: `${height}mm`, width: `${height * LOGO_RATIO}mm` }}
      className="block shrink-0"
    />
  );
  return boxed ? <span className="pb-logo">{img}</span> : img;
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
        <PrintLogo height={small ? 8.5 : 10} boxed />
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
        <PrintLogo height={4.6} />
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

/**
 * Identité des documents imprimés : logo Pilot5Q vectoriel (net à l'impression, lisible en
 * noir et blanc), fine bande tricolore et en-tête (tournoi, lieu, date, journée).
 */
import type { TournamentState } from "@pilot5q/domain";
import type { ReactNode } from "react";

/** Pictogramme de la marque (même dessin que la barre haute), en traits fins. */
export function PrintLogo({ size = 9 }: { size?: number }) {
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
        fill="#fff"
        stroke="#0e37a8"
        strokeWidth="1.6"
      />
      <g
        transform="translate(3 3)"
        fill="none"
        stroke="#0e37a8"
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

/** Marque complète : pictogramme + « Pilot5Q ». */
export function PrintBrand({ size = 7 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-[1.6mm]">
      <PrintLogo size={size} />
      <span className="text-[11pt] leading-none font-extrabold tracking-[-0.02em] text-[#0f1b33]">
        Pilot5Q
      </span>
    </span>
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

/**
 * En-tête de document pleine page : marque à gauche, titre au centre-gauche, information
 * principale à droite (grande et lisible).
 */
export function PrintHeader({
  state,
  title,
  date,
  day,
  right,
  rightSub,
}: {
  state: TournamentState;
  title: ReactNode;
  /** Date longue (« vendredi 30 octobre 2026 »). */
  date?: string;
  /** Journée (« Vendredi · préqualifications »). */
  day?: string;
  right?: ReactNode;
  rightSub?: ReactNode;
}) {
  return (
    <header className="mb-[4mm]">
      <Tricolore />
      <div className="mt-[3mm] flex items-end justify-between gap-[6mm] border-b border-[#c9ced8] pb-[2.5mm]">
        <div className="flex min-w-0 items-center gap-[4mm]">
          <PrintLogo size={11} />
          <div className="min-w-0">
            <div className="text-[7.5pt] font-bold tracking-[0.12em] text-[#5b6680] uppercase">
              {[day, tournamentLine(state, date)].filter(Boolean).join(" · ")}
            </div>
            <h1 className="text-[17pt] leading-[1.1] font-extrabold tracking-[-0.02em] text-[#0f1b33]">
              {title}
            </h1>
          </div>
        </div>
        {right ? (
          <div className="shrink-0 text-right">
            <div className="font-mono text-[15pt] leading-none font-bold text-[#0f1b33]">
              {right}
            </div>
            {rightSub ? <div className="mt-[1mm] text-[8pt] text-[#5b6680]">{rightSub}</div> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** Pied de page discret : marque à gauche, texte à droite. */
export function PrintFoot({ children }: { children?: ReactNode }) {
  return (
    <footer className="mt-auto flex items-center justify-between gap-[4mm] pt-[2.5mm] text-[7pt] text-[#6b7480]">
      <span className="inline-flex items-center gap-[1.2mm] font-semibold">
        <PrintLogo size={3.4} /> Pilot5Q
      </span>
      <span className="text-right">{children}</span>
    </footer>
  );
}

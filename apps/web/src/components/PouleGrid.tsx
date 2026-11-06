/**
 * Grille de saisie des poules (vendredi, National et Masters du samedi) : cartes compressées
 * par défaut (nom + avancement), bascule globale Compact / Scores / Classement, agrandissement
 * animé (layout de motion). Le mode choisi est mémorisé dans ce navigateur (confort local).
 */
import type { Distance, Poule, TournamentState } from "@pilot5q/domain";
import { LayoutGrid, ListOrdered, Rows3 } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { useCallback, useState, type ReactNode } from "react";

import { PouleCard, type PouleView } from "./PouleCard";
import { cx } from "./ui";

export type { PouleView } from "./PouleCard";

const VIEW_KEY = "pilot5q:poule-view";
const VIEWS: { id: PouleView; label: string; icon: typeof LayoutGrid }[] = [
  { id: "compact", label: "Compact", icon: LayoutGrid },
  { id: "scores", label: "Scores", icon: Rows3 },
  { id: "classement", label: "Classement", icon: ListOrdered },
];

function readView(): PouleView {
  try {
    const v = window.localStorage.getItem(VIEW_KEY);
    return v === "scores" || v === "classement" ? v : "compact";
  } catch {
    return "compact";
  }
}

/** Mode d'affichage des cartes de poule, partagé par toutes les grilles et mémorisé localement. */
export function usePouleView(): [PouleView, (v: PouleView) => void] {
  const [view, setView] = useState<PouleView>(readView);
  const update = useCallback((v: PouleView) => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* stockage indisponible : le choix reste pour la session */
    }
  }, []);
  return [view, update];
}

/** Bascule segmentée Compact / Scores / Classement. */
export function PouleViewToggle({
  value,
  onChange,
  id = "poule-view",
}: {
  value: PouleView;
  onChange: (v: PouleView) => void;
  id?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Affichage des poules"
      className="border-line bg-surface-2 inline-flex items-center gap-0.5 rounded-[10px] border p-0.5"
    >
      {VIEWS.map((v) => {
        const on = v.id === value;
        const Icon = v.icon;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v.id)}
            className={cx(
              "relative inline-flex h-[28px] items-center gap-1.5 rounded-[8px] px-2.5 text-[12px] font-semibold transition-colors",
              on ? "text-brand-ink" : "text-ink-muted hover:text-ink-secondary",
            )}
          >
            {on ? (
              <motion.span
                layoutId={`${id}-pill`}
                className="bg-surface absolute inset-0 rounded-[8px] shadow-[0_1px_3px_rgb(15_27_51/0.12)]"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
                aria-hidden="true"
              />
            ) : null}
            <Icon className="relative size-3.5" aria-hidden="true" />
            <span className="relative">{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Classe de grille selon le mode (les cartes compactes sont plus étroites). */
export function pouleGridClass(view: PouleView): string {
  return view === "compact"
    ? "grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] items-start gap-2.5"
    : "grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] items-start gap-3";
}

export interface PouleGridProps {
  state: TournamentState;
  phase: "PREQ" | "QN" | "QM";
  poules: Poule[];
  distance: Distance;
  view: PouleView;
  open?: number | null;
  onOpen?: (num: number) => void;
  showBillard?: boolean;
  conflicts?: number[];
  className?: string;
  id?: string;
  children?: ReactNode;
}

/** Grille de cartes de poule dans le mode demandé. */
export function PouleGrid({
  state,
  phase,
  poules,
  distance,
  view,
  open,
  onOpen,
  showBillard = true,
  conflicts,
  className,
  id,
}: PouleGridProps) {
  return (
    <LayoutGroup id={`grid-${phase}`}>
      <div id={id} className={cx(pouleGridClass(view), className)}>
        {poules.map((p) => (
          <PouleCard
            key={p.num}
            state={state}
            phase={phase}
            poule={p}
            distance={distance}
            view={view}
            active={open === p.num}
            onOpen={onOpen}
            showBillard={showBillard}
            conflict={conflicts?.includes(p.num)}
          />
        ))}
      </div>
    </LayoutGroup>
  );
}

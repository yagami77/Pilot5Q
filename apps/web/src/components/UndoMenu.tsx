/**
 * Bouton « Annuler » explicite : il dit ce qu'il annule (« Annuler : score 100–64 · poule 3 »)
 * et ouvre l'historique des dernières actions (annuler jusqu'à une action donnée).
 */
import { ChevronDown, History, Undo2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { clock, plural } from "@/lib/format";
import { undoableHistory } from "@/lib/history";
import { PROTECTED, useTournament } from "@/store/tournament";

import { useToast } from "./Toast";
import { cx } from "./ui";

function lower(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

export function UndoMenu() {
  const { events, undo, undoTo, canUndo } = useTournament();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const history = useMemo(() => undoableHistory(events, PROTECTED, 12), [events]);
  const last = history[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const undoLast = () => {
    if (!last) return;
    undo();
    toast(`Annulé : ${lower(last.label)}`);
  };

  const undoUpTo = (pos: number) => {
    const target = history[pos];
    if (!target) return;
    const count = pos + 1;
    if (count > 1 && !window.confirm(`Annuler les ${count} dernières actions ?`)) return;
    undoTo(target.index);
    setOpen(false);
    toast(
      count > 1
        ? `${plural(count, "action annulée", "actions annulées")}`
        : `Annulé : ${lower(target.label)}`,
    );
  };

  return (
    <div ref={ref} className="relative flex items-stretch">
      <button
        type="button"
        onClick={undoLast}
        disabled={!canUndo || !last}
        title={last ? `Annuler : ${lower(last.label)}` : "Rien à annuler"}
        className="border-line-2 bg-surface enabled:hover:bg-brand-soft inline-flex max-w-[280px] items-center gap-1.5 rounded-l-[10px] border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-50"
      >
        <Undo2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden md:inline">Annuler</span>
        {last ? (
          <span className="text-ink-muted hidden truncate font-medium lg:inline">
            : {lower(last.label)}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={history.length === 0}
        aria-expanded={open}
        aria-label="Historique des dernières actions"
        className="border-line-2 bg-surface enabled:hover:bg-brand-soft inline-flex items-center rounded-r-[10px] border border-l-0 px-1.5 transition-colors disabled:opacity-50"
      >
        <ChevronDown
          className={cx("size-3.5 transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            aria-label="Historique"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className="bg-surface border-line shadow-raised absolute top-[calc(100%+6px)] right-0 z-50 w-[340px] origin-top-right overflow-hidden rounded-[14px] border"
            onMouseLeave={() => setHover(null)}
          >
            <div className="border-line text-ink-muted flex items-center gap-2 border-b px-3.5 py-2.5 text-[11px] font-bold tracking-[0.06em] uppercase">
              <History className="size-3.5" aria-hidden="true" />
              Dernières actions
            </div>
            <ul className="max-h-[360px] overflow-auto py-1">
              {history.map((h, i) => {
                const marked = hover !== null && i <= hover;
                return (
                  <li key={h.index}>
                    <button
                      type="button"
                      role="menuitem"
                      onMouseEnter={() => setHover(i)}
                      onFocus={() => setHover(i)}
                      onClick={() => undoUpTo(i)}
                      className={cx(
                        "flex w-full items-center gap-2.5 px-3.5 py-[7px] text-left text-[12.5px] transition-colors",
                        marked ? "bg-alert-soft text-alert-ink" : "hover:bg-surface-2",
                      )}
                    >
                      <span className="text-ink-muted w-10 shrink-0 font-mono text-[11px]">
                        {clock(new Date(h.at))}
                      </span>
                      <span className={cx("min-w-0 flex-1 truncate", marked && "line-through")}>
                        {h.label}
                      </span>
                      {hover === i ? (
                        <span className="shrink-0 text-[10.5px] font-bold">
                          {i === 0 ? "annuler" : `annuler ces ${i + 1}`}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

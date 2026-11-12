/**
 * Annulation sans risque : « Annuler » n'efface rien d'un clic. Il ouvre l'historique, où l'on
 * choisit jusqu'où revenir ; l'application dit ce qui sera annulé (décompte, actions lourdes de
 * conséquences) et demande confirmation. Les actions annulées ne sont pas perdues : « Rétablir »
 * les remet telles quelles, tant qu'aucune nouvelle action n'a été saisie.
 */
import {
  Flag,
  GitFork,
  History,
  LayoutGrid,
  ListOrdered,
  Lock,
  PencilLine,
  Redo2,
  Shuffle,
  TriangleAlert,
  Undo2,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { clock, plural } from "@/lib/format";
import { summarizeUndo, undoableHistory, type EventKind } from "@/lib/history";
import { PROTECTED, useTournament } from "@/store/tournament";

import { useToast } from "./Toast";
import { Button, cx } from "./ui";

const KIND_ICON: Record<EventKind, LucideIcon> = {
  score: PencilLine,
  classement: ListOrdered,
  tirage: Shuffle,
  billards: LayoutGrid,
  forfait: UserX,
  consolante: GitFork,
  arbitre: Flag,
  cloture: Lock,
  autre: History,
};

function lower(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

export function UndoMenu() {
  const {
    events,
    undo,
    undoTo,
    canUndo,
    redo,
    canRedo,
    redoStack,
    readOnly,
    closure,
    reopening,
    canReopen,
  } = useTournament();
  // Tournoi rouvert pour correction : seul le responsable annule.
  const reserved = Boolean(reopening) && !canReopen;
  // Consultation seule, tournoi clôturé ou réservé au responsable : rien ne s'annule.
  const frozen = readOnly || Boolean(closure) || reserved;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  /** Position choisie dans l'historique (0 = dernière action) : tout jusqu'à elle sera annulé. */
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const history = useMemo(() => undoableHistory(events, PROTECTED), [events]);
  const last = history[0];
  const redoCount = redoStack.reduce((n, g) => n + g.length, 0);
  const lastGroup = redoStack[redoStack.length - 1];

  const close = () => {
    setOpen(false);
    setSelected(null);
    setHover(null);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSelected(null);
        setHover(null);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((cur) => {
          const max = history.length - 1;
          if (max < 0) return null;
          if (cur === null) return 0;
          return Math.min(max, Math.max(0, cur + (e.key === "ArrowDown" ? 1 : -1)));
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, history.length]);

  // La ligne choisie au clavier reste visible
  useEffect(() => {
    if (!open || selected === null) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-pos="${selected}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [open, selected]);

  const chosen = useMemo(
    () => (selected !== null ? history.slice(0, selected + 1) : []),
    [history, selected],
  );
  const summary = useMemo(() => summarizeUndo(chosen), [chosen]);

  const confirm = () => {
    if (selected === null) return;
    const target = history[selected];
    if (!target) return;
    const count = selected + 1;
    if (count === 1) undo();
    else undoTo(target.index);
    close();
    toast(
      count > 1
        ? `${plural(count, "action annulée", "actions annulées")} · « Rétablir » pour revenir`
        : `Annulé : ${lower(target.label)} · « Rétablir » pour revenir`,
    );
  };

  const restore = (all: boolean) => {
    const n = all ? redoCount : (lastGroup?.length ?? 0);
    redo(all);
    toast(n > 1 ? `${plural(n, "action rétablie", "actions rétablies")}` : "Action rétablie");
  };

  const marked = (i: number) => selected !== null && i <= selected;
  const previewed = (i: number) => selected === null && hover !== null && i <= hover;

  return (
    <div className="flex items-stretch">
      <button
        type="button"
        onClick={() => {
          setSelected(0);
          setOpen(true);
        }}
        disabled={!canUndo || !last}
        aria-haspopup="dialog"
        title={
          closure
            ? "Tournoi clôturé : plus d'annulation"
            : reserved
              ? "Tournoi rouvert par le responsable : lui seul peut annuler"
              : last
                ? `Annuler : ${lower(last.label)} (une confirmation est demandée)`
                : "Rien à annuler"
        }
        className={cx(
          "border-line-2 bg-surface enabled:hover:bg-brand-soft inline-flex max-w-[280px] items-center gap-1.5 border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-50",
          redoStack.length > 0 ? "rounded-l-[10px]" : "rounded-[10px]",
        )}
      >
        <Undo2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden md:inline">Annuler</span>
        {last ? (
          <span className="text-ink-muted hidden truncate font-medium lg:inline">
            : {lower(last.label)}
          </span>
        ) : null}
      </button>
      {redoStack.length > 0 ? (
        <button
          type="button"
          onClick={() => restore(false)}
          disabled={!canRedo}
          title={`Rétablir ${plural(lastGroup?.length ?? 0, "action annulée", "actions annulées")}`}
          className="border-line-2 bg-ok-soft text-ok-ink enabled:hover:brightness-95 inline-flex items-center gap-1.5 rounded-r-[10px] border border-l-0 px-2.5 py-1.5 text-[12.5px] font-semibold transition disabled:opacity-50"
        >
          <Redo2 className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden md:inline">Rétablir</span>
        </button>
      ) : null}

      {createPortal(
        <AnimatePresence>
          {open ? (
            <div className="no-print fixed inset-0 z-[70]">
              <motion.div
                className="bg-ink/25 absolute inset-0 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={close}
                aria-hidden="true"
              />
              <motion.aside
                role="dialog"
                aria-modal="true"
                aria-label="Historique des actions"
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 40, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                className="bg-surface border-line shadow-raised absolute inset-y-0 right-0 flex w-[440px] max-w-full flex-col border-l"
              >
                <header className="border-line flex items-start gap-3 border-b px-5 py-4">
                  <span className="bg-brand-soft text-brand grid size-9 shrink-0 place-items-center rounded-[10px]">
                    <History className="size-[18px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[16px] leading-tight">Historique</h2>
                    <p className="text-ink-muted mt-0.5 text-[12.5px] leading-snug">
                      Choisissez jusqu'où revenir. Rien n'est perdu : une annulation se rétablit
                      tant que vous n'avez rien saisi d'autre.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Fermer l'historique"
                    className="text-ink-muted hover:bg-surface-2 -mr-1.5 grid size-8 shrink-0 place-items-center rounded-[8px] transition-colors"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </header>

                {redoStack.length > 0 ? (
                  <div className="bg-ok-soft text-ok-ink border-line flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-3 text-[12.5px]">
                    <Redo2 className="size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 font-semibold">
                      {plural(redoCount, "action annulée", "actions annulées")}, encore
                      récupérable{redoCount > 1 ? "s" : ""}
                    </span>
                    <Button size="sm" onClick={() => restore(false)} disabled={!canRedo}>
                      Rétablir{" "}
                      {redoStack.length > 1 ? `la dernière (${lastGroup?.length ?? 0})` : ""}
                    </Button>
                    {redoStack.length > 1 ? (
                      <Button size="sm" onClick={() => restore(true)} disabled={!canRedo}>
                        Tout rétablir
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {history.length === 0 ? (
                  <p className="text-ink-muted flex-1 px-5 py-8 text-center text-[13px]">
                    {frozen
                      ? "Le tournoi est verrouillé : rien ne peut être annulé."
                      : "Aucune action à annuler pour l'instant."}
                  </p>
                ) : (
                  <ul
                    ref={listRef}
                    className="flex-1 overflow-auto py-2"
                    onMouseLeave={() => setHover(null)}
                  >
                    {history.map((h, i) => {
                      const Icon = KIND_ICON[h.kind];
                      const on = marked(i);
                      const soft = previewed(i);
                      const newDay = i === 0 || history[i - 1]?.day !== h.day;
                      return (
                        <li key={h.index}>
                          {newDay ? (
                            <div className="text-ink-muted px-5 pt-3 pb-1 text-[10.5px] font-bold tracking-[0.1em] uppercase">
                              {h.day}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            data-pos={i}
                            aria-pressed={selected === i}
                            disabled={frozen}
                            onMouseEnter={() => setHover(i)}
                            onFocus={() => setHover(i)}
                            onClick={() => setSelected(selected === i ? null : i)}
                            className={cx(
                              "group relative flex w-full items-center gap-3 px-5 py-[7px] text-left text-[13px] transition-colors",
                              on
                                ? "bg-alert-soft text-alert-ink"
                                : soft
                                  ? "bg-alert-soft/45"
                                  : "hover:bg-surface-2",
                            )}
                          >
                            <span
                              className={cx(
                                "grid size-7 shrink-0 place-items-center rounded-full border transition-colors",
                                on
                                  ? "border-alert bg-surface text-alert"
                                  : "border-line-2 bg-surface text-ink-muted",
                              )}
                            >
                              <Icon className="size-3.5" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={cx(
                                  "block truncate font-medium",
                                  (on || soft) && "line-through decoration-1",
                                )}
                              >
                                {h.label}
                              </span>
                            </span>
                            {selected === i ? (
                              <span className="shrink-0 text-[10.5px] font-bold tracking-[0.04em] uppercase">
                                revenir ici
                              </span>
                            ) : (
                              <span className="text-ink-muted shrink-0 font-mono text-[11px]">
                                {clock(new Date(h.at))}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                    <li className="text-ink-muted flex items-center gap-3 px-5 pt-3 pb-2 text-[12px]">
                      <span className="border-line-2 grid size-7 shrink-0 place-items-center rounded-full border border-dashed">
                        <Lock className="size-3" aria-hidden="true" />
                      </span>
                      {closure || reopening
                        ? "Avant la clôture du tournoi : ne s'annule pas"
                        : "Création du tournoi et import des inscrits : ne s'annulent pas"}
                    </li>
                  </ul>
                )}

                <footer className="border-line bg-surface-2 border-t px-5 py-4">
                  {selected === null ? (
                    <p className="text-ink-muted text-[12.5px]">
                      Cliquez sur une action : elle et toutes celles qui la suivent seront
                      annulées, après confirmation.
                    </p>
                  ) : (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <p className="text-[13.5px] font-bold">
                        {chosen.length === 1
                          ? `Annuler « ${chosen[0]?.label ?? ""} » ?`
                          : `Annuler les ${chosen.length} dernières actions ?`}
                      </p>
                      {chosen.length > 1 ? (
                        <p className="text-ink-secondary mt-1 text-[12.5px]">
                          {summary.parts.join(" · ")}
                        </p>
                      ) : null}
                      {summary.heavy.length > 0 ? (
                        <div className="bg-gold-soft text-gold-ink mt-2.5 flex items-start gap-2 rounded-[10px] px-3 py-2 text-[12px] leading-snug">
                          <TriangleAlert
                            className="mt-[1px] size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            Dont : {summary.heavy.slice(0, 4).map(lower).join(", ")}
                            {summary.heavy.length > 4
                              ? ` et ${summary.heavy.length - 4} de plus`
                              : ""}
                            .
                          </span>
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                        <Button onClick={() => setSelected(null)}>Ne rien annuler</Button>
                        <button
                          type="button"
                          onClick={confirm}
                          className="bg-alert hover:bg-alert-ink inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[13px] font-bold text-white shadow-[0_8px_16px_-8px_rgb(220_63_90/0.7)] transition-colors"
                        >
                          <Undo2 className="size-4" aria-hidden="true" />
                          {chosen.length === 1
                            ? "Confirmer l'annulation"
                            : `Annuler ces ${chosen.length} actions`}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </footer>
              </motion.aside>
            </div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

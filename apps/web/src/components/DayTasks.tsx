/**
 * Tâches du jour, en tête de chaque journée : état de chaque tâche (à faire, en cours avec
 * compteur, faite), clic = défilement vers sa zone, « Modifier » quand elle est faite, et
 * « Passer au jour suivant » quand tout est fait.
 */
import { ArrowRight, Flag, Pencil } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { useNavigate } from "react-router";

import { dayTasks, NEXT_DAY, type DayTask } from "@/lib/dayTasks";
import { useDjMeta } from "@/lib/djMeta";
import type { Day } from "@/lib/tournament";
import { useTournament } from "@/store/tournament";

import { RollingNumber } from "./RollingNumber";
import { Button, cx } from "./ui";

const DAY_LABEL: Record<Day, string> = {
  jeudi: "jeudi",
  vendredi: "vendredi",
  samedi: "samedi",
  dimanche: "dimanche",
};

/** Fait défiler jusqu'à une zone et la met brièvement en évidence. */
export function focusZone(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.remove("zone-flash");
  // Relance l'animation
  void el.offsetWidth;
  el.classList.add("zone-flash");
  window.setTimeout(() => el.classList.remove("zone-flash"), 1600);
  return true;
}

function TaskIcon({ task }: { task: DayTask }) {
  const pct = task.count && task.count.total ? task.count.done / task.count.total : 0;
  if (task.status === "done") {
    return (
      <span className="bg-ok grid size-[22px] shrink-0 place-items-center rounded-full text-white">
        <svg viewBox="0 0 24 24" className="size-[14px]" fill="none" aria-hidden="true">
          <motion.path
            d="M5 12.5l4.2 4.2L19 7"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1], delay: 0.05 }}
          />
        </svg>
      </span>
    );
  }
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 22 22" className="size-[22px] shrink-0 -rotate-90" aria-hidden="true">
      <circle
        cx="11"
        cy="11"
        r={r}
        fill="none"
        stroke="var(--color-line-2)"
        strokeWidth="2.4"
        strokeDasharray={task.status === "todo" ? "3 3" : undefined}
      />
      {task.status === "doing" ? (
        <motion.circle
          cx="11"
          cy="11"
          r={r}
          fill="none"
          stroke="var(--color-brand-light)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - Math.max(0.08, pct)) }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        />
      ) : null}
    </svg>
  );
}

export function DayTasks({
  day,
  actions = {},
}: {
  day: Day;
  /** Actions spécifiques par tâche (ouvrir l'impression, la page des primes…). */
  actions?: Record<string, () => void>;
}) {
  const { state, id } = useTournament();
  const [meta] = useDjMeta(id);
  const navigate = useNavigate();
  const tasks = useMemo(() => dayTasks(state, day, meta), [state, day, meta]);
  const done = tasks.filter((t) => t.status === "done").length;
  const all = done === tasks.length;
  const next = NEXT_DAY[day];
  const pct = tasks.length ? done / tasks.length : 0;

  const open = (t: DayTask) => {
    const action = actions[t.id];
    if (action) action();
    else if (!focusZone(t.target)) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section
      aria-label={`Tâches du ${DAY_LABEL[day]}`}
      className="card no-print mt-1 mb-1 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <div className="relative size-[42px]">
          <svg viewBox="0 0 42 42" className="size-[42px] -rotate-90" aria-hidden="true">
            <circle cx="21" cy="21" r="17" fill="none" stroke="var(--color-line)" strokeWidth="4" />
            <motion.circle
              cx="21"
              cy="21"
              r="17"
              fill="none"
              stroke={all ? "var(--color-ok)" : "var(--color-brand-light)"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 17}
              initial={false}
              animate={{ strokeDashoffset: 2 * Math.PI * 17 * (1 - pct) }}
              transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center font-mono text-[12px] font-bold tabular-nums">
            <span>
              <RollingNumber value={done} />/{tasks.length}
            </span>
          </span>
        </div>
        <div className="leading-tight">
          <div className="eyebrow">Tâches du jour</div>
          <div className="text-[13.5px] font-bold">
            {all ? "Tout est fait" : `${tasks.length - done} à faire`}
          </div>
        </div>
      </div>

      <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {tasks.map((t) => (
          <li key={t.id} className="group relative">
            <button
              type="button"
              onClick={() => open(t)}
              title={t.hint}
              className={cx(
                "flex items-center gap-2 rounded-[11px] border py-[6px] pr-3 pl-[7px] text-left text-[12.5px] font-semibold transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px",
                t.status === "done" && "border-[#bfe6d2] bg-ok-soft/60 text-ok-ink",
                t.status === "doing" && "border-brand-light/40 bg-brand-soft text-brand-ink",
                t.status === "todo" && "border-line-2 bg-surface text-ink-secondary",
              )}
            >
              <TaskIcon task={t} />
              <span>{t.label}</span>
              {t.count && t.status !== "todo" && t.status !== "done" ? (
                <span className="font-mono text-[11.5px] tabular-nums">
                  <RollingNumber value={t.count.done} />/{t.count.total}
                </span>
              ) : null}
              {t.status === "done" ? (
                <span
                  className="text-ok-ink inline-flex max-w-0 items-center gap-1 overflow-hidden text-[11px] font-bold whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-200 group-focus-within:ml-0.5 group-focus-within:max-w-[90px] group-focus-within:opacity-100 group-hover:ml-0.5 group-hover:max-w-[90px] group-hover:opacity-100"
                  aria-label={`Modifier : ${t.label}`}
                >
                  <Pencil className="size-3" aria-hidden="true" />
                  Modifier
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ol>

      <AnimatePresence>
        {all ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            className="ml-auto"
          >
            {next ? (
              <Button
                variant="primary"
                iconRight={ArrowRight}
                onClick={() => {
                  void navigate(`/tournoi/${next}`);
                  window.scrollTo({ top: 0 });
                }}
              >
                Passer au {DAY_LABEL[next]}
              </Button>
            ) : (
              <span className="bg-gold-soft text-gold-ink inline-flex items-center gap-2 rounded-[12px] px-3.5 py-2 text-[13px] font-bold">
                <Flag className="size-4" aria-hidden="true" />
                Tournoi clôturé
              </span>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

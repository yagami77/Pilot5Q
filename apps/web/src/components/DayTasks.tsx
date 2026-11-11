/**
 * Tâches du jour, en tête de chaque journée : état de chaque tâche (à faire, en cours avec
 * compteur, faite, à traiter en rouge, sans objet), clic = défilement vers sa zone, « Modifier »
 * quand elle est faite, et « Passer au jour suivant » toujours au même endroit.
 *
 * Retours du 11 novembre : « Passer au samedi » et « Passer au dimanche » sont actifs dès que la
 * journée suivante est débloquée (sans attendre les impressions ni la consolante) ; le dimanche,
 * le même emplacement porte l'unique bouton « Clôturer le tournoi », avec confirmation.
 */
import { ArrowRight, Flag, Minus, Pencil, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { useSessionName } from "@/auth/context";
import { closureBlockers } from "@/lib/closure";
import { dayTasks, NEXT_DAY, type DayTask } from "@/lib/dayTasks";
import { useDjMeta } from "@/lib/djMeta";
import { nice } from "@/lib/format";
import { bracketWinner, dayStatuses, type Day } from "@/lib/tournament";
import { useEditLock, useTournament } from "@/store/tournament";

import { ConfirmDialog } from "./ConfirmDialog";
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
  if (task.status === "alert") {
    return (
      <span className="bg-alert grid size-[22px] shrink-0 place-items-center rounded-full text-white">
        <TriangleAlert className="size-[13px]" strokeWidth={2.6} aria-hidden="true" />
      </span>
    );
  }
  if (task.status === "na") {
    return (
      <span className="border-line-2 text-ink-muted grid size-[22px] shrink-0 place-items-center rounded-full border-[1.5px]">
        <Minus className="size-3" aria-hidden="true" />
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
  const { state, id, closeTournament } = useTournament();
  const [meta] = useDjMeta(id);
  const navigate = useNavigate();
  const locked = useEditLock();
  const by = useSessionName();
  const tasks = useMemo(() => dayTasks(state, day, meta), [state, day, meta]);
  // Les tâches sans objet ne comptent ni comme faites ni comme à faire
  const counted = tasks.filter((t) => t.status !== "na");
  const done = counted.filter((t) => t.status === "done").length;
  const all = done === counted.length;
  const pct = counted.length ? done / counted.length : 0;

  // Clôture du tournoi (dimanche) : possible quand tout est joué, toujours avec confirmation
  const blockers = useMemo(() => closureBlockers(state), [state]);
  const closed = Boolean(state.closure);
  const canClose = !closed && !locked && blockers.length === 0;
  const [confirm, setConfirm] = useState(false);
  const closureReason = closed
    ? undefined
    : blockers.length > 0
      ? `Reste à jouer : ${blockers.join(", ")}`
      : locked
        ? "Tournoi en consultation seule"
        : undefined;

  const open = (t: DayTask) => {
    const action = actions[t.id];
    if (action) action();
    else if (t.id === "cloture") {
      if (canClose) setConfirm(true);
    } else if (t.targetDay && t.targetDay !== day) {
      void navigate(`/tournoi/${t.targetDay}`);
      window.setTimeout(() => focusZone(t.target), 450);
    } else if (!focusZone(t.target)) window.scrollTo({ top: 0, behavior: "smooth" });
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
              <RollingNumber value={done} />/{counted.length}
            </span>
          </span>
        </div>
        <div className="leading-tight">
          <div className="eyebrow">Tâches du jour</div>
          <div className="text-[13.5px] font-bold">
            {all ? "Tout est fait" : `${counted.length - done} à faire`}
          </div>
        </div>
      </div>

      <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {tasks.map((t) => (
          <li key={t.id} className="group relative">
            <button
              type="button"
              onClick={() => open(t)}
              title={t.id === "cloture" ? (closureReason ?? t.hint) : t.hint}
              data-status={t.status}
              className={cx(
                "flex items-center gap-2 rounded-[11px] border py-[6px] pr-3 pl-[7px] text-left text-[12.5px] font-semibold transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px",
                t.status === "done" && "border-[#bfe6d2] bg-ok-soft/60 text-ok-ink",
                t.status === "doing" && "border-brand-light/40 bg-brand-soft text-brand-ink",
                t.status === "todo" && "border-line-2 bg-surface text-ink-secondary",
                t.status === "alert" && "border-alert/60 bg-alert-soft text-alert-ink",
                t.status === "na" && "border-line bg-surface-2 text-ink-muted border-dashed",
              )}
            >
              <TaskIcon task={t} />
              <span>{t.label}</span>
              {t.status === "alert" && t.cta ? (
                <span className="bg-alert rounded-[7px] px-1.5 py-[1px] text-[11px] font-bold text-white">
                  {t.cta}
                </span>
              ) : null}
              {t.count && t.status === "doing" ? (
                <span className="font-mono text-[11.5px] tabular-nums">
                  <RollingNumber value={t.count.done} />/{t.count.total}
                </span>
              ) : null}
              {t.status === "done" && !locked ? (
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

      <NextDay
        day={day}
        tasks={counted}
        closure={{ closed, canClose, reason: closureReason, ask: () => setConfirm(true) }}
      />
      <ConfirmDialog
        open={confirm && canClose}
        title="Clôturer le tournoi ?"
        icon={Flag}
        tone="gold"
        confirmLabel="Clôturer le tournoi"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          closeTournament(by || undefined);
        }}
      >
        <ul className="mb-2 flex flex-col gap-0.5">
          {(["M", "N", "CLS"] as const).map((phase) => {
            const w = bracketWinner(state, phase);
            if (!w) return null;
            return (
              <li key={phase}>
                {phase === "M" ? "Masters" : phase === "N" ? "National" : "Consolante"} :{" "}
                <b className="text-ink">{nice(w)}</b>
              </li>
            );
          })}
        </ul>
        Les tableaux sont classés et le tournoi est clôturé. Après la clôture, plus rien ne peut
        être modifié depuis le cockpit du directeur de jeu (ni score, ni annulation) : seul le
        responsable national peut rouvrir le tournoi pour corriger.
      </ConfirmDialog>
    </section>
  );
}

/**
 * Bouton « Passer au jour suivant », toujours au même endroit (à droite de la barre des tâches)
 * pour les quatre journées. Jeudi : actif quand toutes les tâches sont faites. Vendredi et
 * samedi : actif dès que la journée suivante est débloquée (barrages classés ; Masters classés
 * et huitièmes joués), sans attendre les impressions ni la consolante. Dimanche : « Clôturer le
 * tournoi », actif quand tout est joué, puis « Tournoi clôturé ».
 */
function NextDay({
  day,
  tasks,
  closure,
}: {
  day: Day;
  tasks: DayTask[];
  closure: { closed: boolean; canClose: boolean; reason: string | undefined; ask: () => void };
}) {
  const navigate = useNavigate();
  const { state } = useTournament();
  const next = NEXT_DAY[day];
  const remaining = tasks.filter((t) => t.status !== "done");
  const nextStatus = next ? dayStatuses(state)[next] : null;
  const ready = !next
    ? closure.canClose
    : day === "jeudi"
      ? remaining.length === 0
      : Boolean(nextStatus?.unlocked);
  const reason = ready
    ? undefined
    : !next
      ? closure.reason
      : day === "jeudi"
        ? `Reste à faire : ${remaining.map((t) => t.label).join(" · ")}`
        : (nextStatus?.reason ?? "Journée suivante verrouillée");
  const reasonId = `next-day-reason-${day}`;

  if (!next && closure.closed) {
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        className="bg-gold-soft text-gold-ink ml-auto inline-flex items-center gap-2 rounded-[12px] px-3.5 py-2 text-[13px] font-bold"
      >
        <Flag className="size-4" aria-hidden="true" />
        Tournoi clôturé
      </motion.span>
    );
  }

  return (
    <span className="ml-auto inline-flex" title={reason}>
      <motion.span
        key={ready ? "ready" : "wait"}
        initial={ready ? { scale: 0.92, opacity: 0.6 } : false}
        animate={
          ready
            ? {
                scale: 1,
                opacity: 1,
                // Halo bref quand le bouton devient actif
                boxShadow: ["0 0 0 0 rgb(30 79 216 / 0.45)", "0 0 0 12px rgb(30 79 216 / 0)"],
              }
            : { scale: 1, opacity: 1 }
        }
        transition={{
          type: "spring",
          stiffness: 420,
          damping: 22,
          boxShadow: { duration: 1.1, ease: "easeOut" },
        }}
        className="inline-flex rounded-[12px]"
      >
        <Button
          variant={ready ? "primary" : "default"}
          iconRight={next ? ArrowRight : Flag}
          disabled={!ready}
          aria-describedby={reason ? reasonId : undefined}
          onClick={() => {
            if (next) {
              void navigate(`/tournoi/${next}`);
              window.scrollTo({ top: 0 });
            } else closure.ask();
          }}
        >
          {next ? `Passer au ${DAY_LABEL[next]}` : "Clôturer le tournoi"}
        </Button>
      </motion.span>
      {reason ? (
        <span id={reasonId} className="sr-only">
          {reason}
        </span>
      ) : null}
    </span>
  );
}

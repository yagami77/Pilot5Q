/** Rail des quatre journées, avec état (à venir, en cours, terminée, verrouillée). */
import { Check, Lock } from "lucide-react";
import { useNavigate } from "react-router";

import { DAYS, dayStatuses, type Day } from "@/lib/tournament";
import { useTournament } from "@/store/tournament";

import { useToast } from "./Toast";
import { cx } from "./ui";

const LABELS: Record<Day, string> = {
  jeudi: "Jeudi",
  vendredi: "Vendredi",
  samedi: "Samedi",
  dimanche: "Dimanche",
};

export function PhaseRail({ current }: { current: Day }) {
  const { state } = useTournament();
  const navigate = useNavigate();
  const toast = useToast();
  const statuses = dayStatuses(state);
  return (
    <nav className="no-print mx-auto max-w-[1440px] px-4 pt-[18px] pb-1.5" aria-label="Journées">
      <ol className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {DAYS.map((day, i) => {
          const s = statuses[day];
          const active = day === current;
          return (
            <li key={day} className="min-w-0">
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                aria-disabled={!s.unlocked}
                onClick={() => {
                  if (!s.unlocked) {
                    toast(`${LABELS[day]} s'ouvrira ${s.reason.toLowerCase()}.`);
                    return;
                  }
                  void navigate(`/tournoi/${day}`);
                }}
                className={cx(
                  "bg-surface border-line rounded-card relative block w-full min-w-0 border py-3 pr-3.5 pl-[50px] text-left transition-[transform,box-shadow,border-color] duration-250 hover:-translate-y-px hover:shadow-[var(--shadow-card)]",
                  active &&
                    "border-brand shadow-[0_0_0_3px_var(--color-brand-soft),var(--shadow-card)]",
                  !s.unlocked && "opacity-[0.62]",
                )}
              >
                <span
                  className={cx(
                    "absolute top-1/2 left-3.5 grid size-[26px] -translate-y-1/2 place-items-center rounded-full border-[1.5px] text-[11.5px] font-bold transition-colors duration-300",
                    s.done
                      ? "bg-ok border-ok text-white"
                      : active
                        ? "bg-brand border-brand text-white"
                        : "bg-surface-2 border-line-2 text-ink-muted",
                  )}
                >
                  {s.done ? (
                    <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                  ) : !s.unlocked ? (
                    <Lock className="size-3" aria-hidden="true" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="block text-[13.5px] font-bold">{LABELS[day]}</span>
                <span className="text-ink-muted block truncate text-[12px]">
                  {s.unlocked ? s.sub : `Verrouillé · ${s.reason.toLowerCase()}`}
                </span>
                <span
                  className={cx(
                    "bg-brand absolute right-3.5 bottom-0 left-3.5 h-[3px] origin-left rounded-t-[3px] transition-transform duration-500",
                    active ? "scale-x-100" : "scale-x-0",
                  )}
                  aria-hidden="true"
                />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

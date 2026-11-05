/** Cockpit : barre haute, rail des journées, vue de la journée. */
import { AnimatePresence, motion } from "motion/react";
import { Navigate, useParams } from "react-router";

import { PhaseRail } from "@/components/PhaseRail";
import { TopBar } from "@/components/TopBar";
import { DAYS, dayStatuses, type Day } from "@/lib/tournament";
import { useTournament } from "@/store/tournament";

import { Dimanche } from "./Dimanche";
import { Jeudi } from "./Jeudi";
import { Samedi } from "./Samedi";
import { Vendredi } from "./Vendredi";

function isDay(v: string | undefined): v is Day {
  return DAYS.includes(v as Day);
}

/** Dernière journée ouverte (celle sur laquelle le DJ doit travailler). */
export function currentDay(statuses: ReturnType<typeof dayStatuses>): Day {
  let last: Day = "jeudi";
  for (const d of DAYS) if (statuses[d].unlocked) last = d;
  return last;
}

export function Cockpit() {
  const { ready, id, state } = useTournament();
  const { day } = useParams();
  if (!ready) {
    return (
      <div className="text-ink-muted grid min-h-[60vh] place-items-center text-sm">
        Chargement du tournoi…
      </div>
    );
  }
  if (!id || !state.info) return <Navigate to="/" replace />;
  const statuses = dayStatuses(state);
  if (!isDay(day) || !statuses[day].unlocked) {
    return <Navigate to={`/tournoi/${currentDay(statuses)}`} replace />;
  }
  return (
    <>
      <TopBar />
      <PhaseRail current={day} />
      <main className="mx-auto max-w-[1440px] px-4 pt-3 pb-20">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={day}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {day === "jeudi" ? (
              <Jeudi />
            ) : day === "vendredi" ? (
              <Vendredi />
            ) : day === "samedi" ? (
              <Samedi />
            ) : (
              <Dimanche />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  );
}

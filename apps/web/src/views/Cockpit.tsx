/** Cockpit : barre haute, rail des journées, vue de la journée. */
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { Navigate, useParams } from "react-router";

import { useReadOnly } from "@/auth/context";
import { NotificationBanner } from "@/components/NotificationBell";
import { PhaseRail } from "@/components/PhaseRail";
import { TopBar } from "@/components/TopBar";
import { Informations } from "@/dj/Informations";
import { Primes } from "@/dj/Primes";
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

/** Pages du cockpit hors journées (liens de la barre haute). */
const PAGES = ["informations", "primes"] as const;
type Page = (typeof PAGES)[number];

function isPage(v: string | undefined): v is Page {
  return PAGES.includes(v as Page);
}

export function Cockpit() {
  const { ready, id, state, setReadOnly } = useTournament();
  const { day } = useParams();
  const readOnly = useReadOnly();
  // Consultation seule (DJ après la clôture) : la saisie est verrouillée dans le store,
  // la navigation, l'impression, le schéma et les primes restent consultables.
  useEffect(() => {
    setReadOnly(readOnly);
    return () => setReadOnly(false);
  }, [readOnly, setReadOnly]);
  if (!ready) {
    return (
      <div className="text-ink-muted grid min-h-[60vh] place-items-center text-sm">
        Chargement du tournoi…
      </div>
    );
  }
  if (!id || !state.info) return <Navigate to="/" replace />;
  const statuses = dayStatuses(state);
  if (isPage(day)) {
    // Primes : ouvertes dès le samedi (après le classement des barrages)
    if (day === "primes" && !statuses.samedi.unlocked)
      return <Navigate to={`/tournoi/${currentDay(statuses)}`} replace />;
    return (
      <>
        <TopBar />
        <PhaseRail current={null} />
        <main className="mx-auto max-w-[1440px] px-4 pt-3 pb-20">
          <motion.div
            key={day}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {day === "informations" ? (
              <Informations readOnly={readOnly} />
            ) : (
              <Primes readOnly={readOnly} />
            )}
          </motion.div>
        </main>
      </>
    );
  }
  if (!isDay(day) || !statuses[day].unlocked) {
    return <Navigate to={`/tournoi/${currentDay(statuses)}`} replace />;
  }
  return (
    <>
      <TopBar />
      <PhaseRail current={day} />
      <main className="mx-auto max-w-[1440px] px-4 pt-3 pb-20">
        {day === currentDay(statuses) ? <NotificationBanner /> : null}
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

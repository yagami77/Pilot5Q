/** Gabarit de l'espace du responsable : barre haute, navigation des sections, contenu. */
import { CalendarDays, LayoutDashboard, MapPin, Settings, Trophy, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { cx } from "@/components/ui";

import { AdminTopBar } from "./AdminTopBar";
import { setRole } from "./role";
import { SeasonProvider, useSeason } from "./store";
import { Welcome } from "./Welcome";

const SECTIONS = [
  { to: "/responsable", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/responsable/calendrier", label: "Calendrier", icon: CalendarDays },
  { to: "/responsable/clubs", label: "Clubs hôtes", icon: MapPin },
  { to: "/responsable/joueurs", label: "Base joueurs", icon: Users },
  { to: "/responsable/classement", label: "Classement glissant", icon: Trophy },
  { to: "/responsable/parametres", label: "Paramètres", icon: Settings },
];

function AdminNav() {
  return (
    <nav className="no-print mx-auto max-w-[1440px] px-4 pt-4 pb-1" aria-label="Sections">
      <ul className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <li key={s.to}>
            <NavLink
              to={s.to}
              end={s.end}
              className={({ isActive }) =>
                cx(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  isActive
                    ? "bg-brand border-brand text-white shadow-[0_6px_14px_-8px_rgb(14_55_168/0.7)]"
                    : "bg-surface border-line-2 text-ink-secondary hover:bg-brand-soft hover:text-brand-ink",
                )
              }
            >
              <s.icon className="size-3.5" aria-hidden="true" />
              {s.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Shell() {
  const { ready, doc } = useSeason();
  const location = useLocation();
  if (!ready) {
    return (
      <div className="text-ink-muted grid min-h-[60vh] place-items-center text-sm">
        Chargement de la saison…
      </div>
    );
  }
  return (
    <>
      <AdminTopBar />
      {doc ? <AdminNav /> : null}
      <main className="mx-auto max-w-[1440px] px-4 pt-3 pb-20">
        {doc ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        ) : (
          <Welcome />
        )}
      </main>
    </>
  );
}

export function AdminLayout() {
  // Entrer dans l'espace vaut choix du rôle (sans mot de passe tant qu'il n'y a pas de serveur).
  useEffect(() => setRole("responsable"), []);
  return (
    <SeasonProvider>
      <Shell />
    </SeasonProvider>
  );
}

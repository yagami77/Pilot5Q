/** Barre haute : marque, tournoi, état d'enregistrement, annulation, utilisateur. */
import { Coins, Home, Info, Waypoints } from "lucide-react";
import { Link, useLocation } from "react-router";

import { ROLE_LABELS, useRole } from "@/admin/role";
import { clock, dateRange, initials, plural } from "@/lib/format";
import { dayStatuses } from "@/lib/tournament";
import { useTournament } from "@/store/tournament";

import { NotificationBell } from "./NotificationBell";

import { Avatar, cx } from "./ui";
import { UndoMenu } from "./UndoMenu";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "grid size-[30px] place-items-center rounded-[9px] bg-[linear-gradient(135deg,#0e37a8,#1e4fd8)] text-white shadow-[0_6px_14px_-6px_rgb(14_55_168/0.6)]",
        className,
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[18px]"
      >
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
      </svg>
    </span>
  );
}

export function TopBar() {
  const { state, savedAt, saving, events } = useTournament();
  const [role] = useRole();
  const location = useLocation();
  const satOpen = dayStatuses(state).samedi.unlocked;
  const links = [
    { to: "/tournoi/informations", label: "Informations", icon: Info },
    ...(satOpen ? [{ to: "/tournoi/primes", label: "Primes", icon: Coins }] : []),
    { to: "/tournoi/schema", label: "Schéma", icon: Waypoints },
  ];
  const info = state.info;
  const lastEvent = events[events.length - 1];
  // Après rechargement, l'heure affichée est celle du dernier événement enregistré.
  const savedLabel = savedAt
    ? `Enregistré · ${clock(savedAt)}`
    : lastEvent
      ? `Enregistré · ${clock(new Date(lastEvent.at))}`
      : "Prêt";
  return (
    <header className="no-print bg-surface/85 border-line sticky top-0 z-30 border-b backdrop-blur-[14px] backdrop-saturate-[1.4]">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-[18px] gap-y-2 px-4 py-2.5">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-[17px] font-extrabold tracking-[-0.02em]"
          aria-label="Pilot5Q, accueil"
        >
          <BrandMark />
          <span className="hidden sm:inline">Pilot5Q</span>
        </Link>
        {info ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="border-line-2 text-brand grid size-[38px] shrink-0 place-items-center rounded-[10px] border bg-[linear-gradient(135deg,#fff,#eef2fb)] text-[12px] font-extrabold tracking-[0.02em]">
              {initials(info.club).slice(0, 3) || "TN"}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-bold tracking-normal">
                {info.name} · {info.city}
              </h1>
              <div className="text-ink-muted hidden flex-wrap gap-2 text-[12.5px] sm:flex">
                <b className="text-ink-secondary font-semibold">{info.club}</b>
                <span>{dateRange(info.dates[0], info.dates[1])}</span>
                <span>
                  {plural(state.billards.length, "billard")} ·{" "}
                  {plural(state.players.length, "inscrit")}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="ml-auto flex items-center gap-2.5">
          {info ? (
            <nav className="flex items-center gap-1.5" aria-label="Pages du tournoi">
              {links.map((l) => {
                const current = location.pathname.endsWith(l.to);
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    aria-current={current ? "page" : undefined}
                    title={l.label}
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                      current
                        ? "bg-brand-soft text-brand-ink border-transparent"
                        : "border-line-2 bg-surface hover:bg-brand-soft hover:text-brand-ink",
                    )}
                  >
                    <l.icon className="size-3.5" aria-hidden="true" />
                    <span className="hidden xl:inline">{l.label}</span>
                  </Link>
                );
              })}
              <NotificationBell />
            </nav>
          ) : null}
          <span
            className="bg-surface-2 border-line text-ink-muted flex items-center gap-[7px] rounded-full border px-2.5 py-1.5 text-[12px]"
            title={saving ? "Enregistrement…" : savedLabel}
          >
            <i
              className={cx(
                "size-[7px] rounded-full",
                saving ? "bg-gold" : "bg-ok animate-pulse-dot",
              )}
              aria-hidden="true"
            />
            <span className="hidden 2xl:inline">{saving ? "Enregistrement…" : savedLabel}</span>
          </span>
          <UndoMenu />
          <Link
            to="/"
            className="border-line-2 bg-surface hover:shadow-card inline-flex size-8 items-center justify-center rounded-[10px] border md:hidden"
            aria-label="Accueil"
          >
            <Home className="size-4" aria-hidden="true" />
          </Link>
          <div className="hidden items-center gap-[9px] text-[12.5px] md:flex">
            <div className="flex flex-col text-right leading-[1.15]">
              <b className="font-semibold">{ROLE_LABELS[role]}</b>
              <span className="text-ink-muted text-[11.5px]">
                {role === "responsable" ? "FFB · 5-Quilles" : (info?.club ?? "Club hôte")}
              </span>
            </div>
            <Avatar
              name={
                role === "responsable" ? "Responsable National" : (info?.club ?? "Directeur Jeu")
              }
              size="md"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

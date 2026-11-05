/** Barre haute : marque, tournoi, état d'enregistrement, annulation, utilisateur. */
import { Home, Undo2, Waypoints } from "lucide-react";
import { Link, useLocation } from "react-router";

import { clock, dateRange, initials, plural } from "@/lib/format";
import { useTournament } from "@/store/tournament";

import { Avatar, Button, cx } from "./ui";

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
  const { state, savedAt, saving, undo, canUndo, events } = useTournament();
  const location = useLocation();
  const onSchema = location.pathname.endsWith("/tournoi/schema");
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
            <Link
              to="/tournoi/schema"
              aria-current={onSchema ? "page" : undefined}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                onSchema
                  ? "bg-brand-soft text-brand-ink border-transparent"
                  : "border-line-2 bg-surface hover:bg-brand-soft hover:text-brand-ink",
              )}
            >
              <Waypoints className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Schéma</span>
            </Link>
          ) : null}
          <span
            className="bg-surface-2 border-line text-ink-muted flex items-center gap-[7px] rounded-full border px-2.5 py-1.5 text-[12px]"
            title={lastEvent ? `Dernier événement : ${lastEvent.type}` : undefined}
          >
            <i
              className={cx(
                "size-[7px] rounded-full",
                saving ? "bg-gold" : "bg-ok animate-pulse-dot",
              )}
              aria-hidden="true"
            />
            {saving ? "Enregistrement…" : savedLabel}
          </span>
          <Button
            size="sm"
            icon={Undo2}
            onClick={undo}
            disabled={!canUndo}
            title="Annuler la dernière action"
          >
            <span className="hidden md:inline">Annuler</span>
          </Button>
          <Link
            to="/"
            className="border-line-2 bg-surface hover:shadow-card inline-flex size-8 items-center justify-center rounded-[10px] border md:hidden"
            aria-label="Accueil"
          >
            <Home className="size-4" aria-hidden="true" />
          </Link>
          <div className="hidden items-center gap-[9px] text-[12.5px] md:flex">
            <div className="flex flex-col text-right leading-[1.15]">
              <b className="font-semibold">Directeur de jeu</b>
              <span className="text-ink-muted text-[11.5px]">{info?.club ?? "Club hôte"}</span>
            </div>
            <Avatar name={info?.club ?? "Directeur Jeu"} size="md" />
          </div>
        </div>
      </div>
    </header>
  );
}

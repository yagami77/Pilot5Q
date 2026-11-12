/** Barre haute de l'espace du responsable : marque, saison, enregistrement, rôle. */
import { Home, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { useAuth } from "@/auth/context";

import { BrandLogo, BrandMark } from "@/components/Brand";
import { Avatar, cx } from "@/components/ui";
import { clock } from "@/lib/format";

import { ROLE_LABELS } from "./role";
import { useSeason } from "./store";

export function AdminTopBar() {
  const { doc, saving, savedAt } = useSeason();
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const who = session?.role === "responsable" ? session.displayName : ROLE_LABELS.responsable;
  return (
    <header className="no-print bg-surface/85 border-line sticky top-0 z-30 border-b backdrop-blur-[14px] backdrop-saturate-[1.4]">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-[18px] gap-y-2 px-4 py-2.5">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-[17px] font-extrabold tracking-[-0.02em]"
          aria-label="Pilot5Q, accueil"
        >
          <BrandMark className="sm:hidden" />
          <BrandLogo className="hidden h-[40px] sm:block" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-bold tracking-normal">
            Espace du responsable national
          </h1>
          <div className="text-ink-muted hidden text-[12.5px] sm:block">
            {doc
              ? `Saison ${doc.id} · ${doc.stages.length} étapes · ${doc.clubs.length} clubs`
              : "Aucune saison ouverte"}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          {doc ? (
            <span className="bg-surface-2 border-line text-ink-muted flex items-center gap-[7px] rounded-full border px-2.5 py-1.5 text-[12px]">
              <i
                className={cx(
                  "size-[7px] rounded-full",
                  saving ? "bg-gold" : "bg-ok animate-pulse-dot",
                )}
                aria-hidden="true"
              />
              {saving ? "Enregistrement…" : savedAt ? `Enregistré · ${clock(savedAt)}` : "Prêt"}
            </span>
          ) : null}
          <Link
            to="/"
            className="border-line-2 bg-surface hover:shadow-card inline-flex size-8 items-center justify-center rounded-[10px] border"
            aria-label="Accueil"
          >
            <Home className="size-4" aria-hidden="true" />
          </Link>
          <div className="hidden items-center gap-[9px] text-[12.5px] md:flex">
            <div className="flex flex-col text-right leading-[1.15]">
              <b className="font-semibold">{who}</b>
              <span className="text-ink-muted text-[11.5px]">
                {session?.role === "responsable" ? `@${session.username}` : "FFB · 5-Quilles"}
              </span>
            </div>
            <Avatar name={who} size="md" />
          </div>
          <button
            type="button"
            onClick={() => void logout().then(() => navigate("/", { replace: true }))}
            className="border-line-2 bg-surface hover:bg-alert-soft hover:text-alert-ink inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Se déconnecter</span>
          </button>
        </div>
      </div>
    </header>
  );
}

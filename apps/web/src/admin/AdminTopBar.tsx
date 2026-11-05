/** Barre haute de l'espace du responsable : marque, saison, enregistrement, rôle. */
import { Home } from "lucide-react";
import { Link } from "react-router";

import { BrandMark } from "@/components/TopBar";
import { Avatar, cx } from "@/components/ui";
import { clock } from "@/lib/format";

import { ROLE_LABELS } from "./role";
import { useSeason } from "./store";

export function AdminTopBar() {
  const { doc, saving, savedAt } = useSeason();
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
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-bold tracking-normal">
            Espace du responsable national
          </h1>
          <div className="text-ink-muted hidden text-[12.5px] sm:block">
            {doc
              ? `Saison ${doc.id} · ${doc.stages.length} étapes · ${doc.clubs.length} clubs hôtes`
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
              <b className="font-semibold">{ROLE_LABELS.responsable}</b>
              <span className="text-ink-muted text-[11.5px]">FFB · 5-Quilles</span>
            </div>
            <Avatar name="Responsable National" size="md" />
          </div>
        </div>
      </div>
    </header>
  );
}

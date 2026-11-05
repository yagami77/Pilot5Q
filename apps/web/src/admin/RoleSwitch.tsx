/** Sélecteur de rôle de l'accueil (sans mot de passe : l'authentification viendra avec le serveur). */
import { ArrowRight, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "react-router";

import { Button, cx } from "@/components/ui";

import { ROLE_LABELS, useRole, type Role } from "./role";

export function RoleSwitch() {
  const [role, setRole] = useRole();
  const options: { value: Role; icon: typeof UserRound }[] = [
    { value: "dj", icon: UserRound },
    { value: "responsable", icon: ShieldCheck },
  ];
  return (
    <div className="animate-fade-up mt-7 flex flex-col items-center gap-3">
      <div
        role="radiogroup"
        aria-label="Rôle"
        className="bg-surface border-line-2 inline-flex rounded-full border p-1 shadow-[var(--shadow-card)]"
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={role === o.value}
            onClick={() => setRole(o.value)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors",
              role === o.value ? "bg-brand text-white" : "text-ink-secondary hover:bg-brand-soft",
            )}
          >
            <o.icon className="size-4" aria-hidden="true" />
            {ROLE_LABELS[o.value]}
          </button>
        ))}
      </div>
      {role === "responsable" ? (
        <div className="bg-brand-soft text-brand-ink animate-pop flex flex-wrap items-center justify-center gap-3 rounded-[14px] px-4 py-3 text-[13px] font-semibold">
          Calendrier, clubs hôtes, base joueurs, inscriptions, classement glissant.
          <Link to="/responsable">
            <Button variant="primary" size="sm" iconRight={ArrowRight}>
              Ouvrir l'espace du responsable
            </Button>
          </Link>
        </div>
      ) : (
        <p className="text-ink-muted text-[12.5px]">
          Sans mot de passe pour l'instant : l'authentification arrivera avec le serveur partagé.
        </p>
      )}
    </div>
  );
}

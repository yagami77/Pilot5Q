/**
 * Gardes des routes : l'espace du responsable exige une session de responsable ; le cockpit
 * accepte le responsable, la démonstration et le directeur de jeu, ce dernier uniquement sur SON
 * tournoi et en lecture seule après la clôture.
 */
import { LockKeyhole, LogOut, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";

import { Banner, Button, cx } from "@/components/ui";
import { DAYS, dayStatuses } from "@/lib/tournament";
import { useTournament } from "@/store/tournament";

import { useAuth } from "./context";
import { enterDjTournament } from "./LoginDialog";
import { SessionDock } from "./SessionDock";

function Loading({ label }: { label: string }) {
  return <div className="text-ink-muted grid min-h-[60vh] place-items-center text-sm">{label}</div>;
}

export function RequireResponsable({ children }: { children: ReactNode }) {
  const { ready, session } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading label="Vérification de la session…" />;
  if (session?.role !== "responsable") {
    if (session?.role === "dj") return <Navigate to="/tournoi" replace />;
    const back = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/?acces=responsable&retour=${back}`} replace />;
  }
  return <>{children}</>;
}

export function RequireCockpit({ children }: { children: ReactNode }) {
  const { ready, session, logout } = useAuth();
  const cockpit = useTournament();
  const navigate = useNavigate();
  const location = useLocation();
  const [problem, setProblem] = useState("");
  if (!ready || !cockpit.ready) return <Loading label="Chargement du tournoi…" />;
  if (!session) return <Navigate to="/?acces=dj" replace />;
  if (session.role !== "dj") {
    return (
      <>
        {children}
        <SessionDock />
      </>
    );
  }
  if (cockpit.id !== session.tournamentId) {
    return (
      <main className="mx-auto grid min-h-[70vh] max-w-[560px] place-items-center px-4">
        <div className="card animate-fade-up w-full p-6 text-center">
          <div className="eyebrow">Directeur de jeu</div>
          <h2 className="mt-1 text-[20px] font-extrabold">{session.stageName}</h2>
          <p className="text-ink-muted mt-2 text-[13px]">
            Ce navigateur affichait un autre tournoi. Votre accès ne vaut que pour le vôtre.
          </p>
          {problem ? (
            <Banner icon={LockKeyhole} tone="red">
              {problem}
            </Banner>
          ) : null}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button
              variant="primary"
              icon={RefreshCw}
              onClick={() =>
                void enterDjTournament(session, cockpit, (p) => void navigate(p)).then((m) =>
                  setProblem(m ?? ""),
                )
              }
            >
              Charger mon tournoi
            </Button>
            <Button
              icon={LogOut}
              onClick={() => void logout().then(() => navigate("/", { replace: true }))}
            >
              Se déconnecter
            </Button>
          </div>
        </div>
      </main>
    );
  }
  // Impression : consultation pure, laissée active même après la clôture.
  if (session.readOnly && !location.pathname.startsWith("/tournoi/imprimer")) {
    return (
      <>
        {/* Tournoi clôturé : toutes les commandes du cockpit sont désactivées. */}
        <fieldset disabled className="contents" aria-label="Tournoi clôturé, consultation seule">
          {children}
        </fieldset>
        <ReadOnlyBar />
        <SessionDock />
      </>
    );
  }
  return (
    <>
      {children}
      <SessionDock />
    </>
  );
}

/**
 * Bandeau de consultation seule : le cockpit est désactivé (fieldset), on garde ici la
 * navigation entre les journées ouvertes et le schéma.
 */
function ReadOnlyBar() {
  const { state } = useTournament();
  const location = useLocation();
  const statuses = dayStatuses(state);
  const links = [
    ...DAYS.filter((d) => statuses[d].unlocked).map((d) => ({
      to: `/tournoi/${d}`,
      label: d.charAt(0).toUpperCase() + d.slice(1),
    })),
    { to: "/tournoi/schema", label: "Schéma" },
  ];
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="bg-surface/95 border-line animate-pop pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border py-1.5 pr-1.5 pl-4 text-[12.5px] font-semibold shadow-[var(--shadow-raised)] backdrop-blur-[10px]">
        <span className="text-gold-ink flex items-center gap-1.5">
          <LockKeyhole className="size-4" aria-hidden="true" />
          Tournoi clôturé : consultation seule
        </span>
        <nav aria-label="Journées" className="bg-surface-2 flex gap-0.5 rounded-full p-0.5">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              aria-current={location.pathname === l.to ? "page" : undefined}
              className={cx(
                "rounded-full px-2.5 py-1 transition-colors",
                location.pathname === l.to
                  ? "bg-brand text-white"
                  : "text-ink-secondary hover:bg-brand-soft",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

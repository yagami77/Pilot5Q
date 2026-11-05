/**
 * Gardes des routes : l'espace du responsable exige une session de responsable ; le cockpit
 * accepte le responsable, la démonstration et le directeur de jeu, ce dernier uniquement sur SON
 * tournoi et en lecture seule après la clôture.
 */
import { LockKeyhole, LogOut, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

import { Banner, Button } from "@/components/ui";
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
                void enterDjTournament(session, cockpit.id, (p) => void navigate(p)).then((m) =>
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
  if (session.readOnly) {
    return (
      <>
        {/* Tournoi clôturé : toutes les commandes du cockpit sont désactivées. */}
        <fieldset disabled className="contents" aria-label="Tournoi clôturé, consultation seule">
          {children}
        </fieldset>
        <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="bg-gold-soft text-gold-ink animate-pop pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold shadow-[var(--shadow-raised)]">
            <LockKeyhole className="size-4" aria-hidden="true" />
            Tournoi clôturé par le responsable national : consultation seule.
          </div>
        </div>
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

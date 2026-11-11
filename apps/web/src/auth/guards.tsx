/**
 * Gardes des routes : l'espace du responsable exige une session de responsable ; le cockpit
 * accepte le responsable, la démonstration et le directeur de jeu, ce dernier uniquement sur SON
 * tournoi et en lecture seule après la clôture.
 *
 * Deux clôtures verrouillent la saisie : celle du directeur de jeu (dans le journal du tournoi,
 * elle vaut pour tous jusqu'à la réouverture par le responsable, et pour le directeur de jeu
 * définitivement : pendant une réouverture, seul le responsable corrige) et celle du responsable
 * (points attribués : l'accès du directeur de jeu passe en lecture seule).
 */
import { LockKeyhole, LockKeyholeOpen, LogOut, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Banner, Button, cx } from "@/components/ui";
import { closureWhen } from "@/lib/closure";
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
  if (session.role === "dj" && cockpit.id !== session.tournamentId) {
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
  // Tournoi clôturé (par le directeur de jeu dans le cockpit, ou par le responsable pour l'accès
  // du DJ) ou rouvert par le responsable pour correction : la saisie est verrouillée par le
  // cockpit (store figé, commandes de saisie masquées ou désactivées) ; navigation, impression,
  // schéma et primes restent consultables. Impression : consultation pure, sans bandeau.
  const closed =
    Boolean(cockpit.closure) ||
    Boolean(cockpit.reopening) ||
    (session.role === "dj" && session.readOnly);
  return (
    <>
      {children}
      {closed && !location.pathname.startsWith("/tournoi/imprimer") ? <ReadOnlyBar /> : null}
      <SessionDock />
    </>
  );
}

/**
 * Bandeau de clôture : rappelle que le tournoi est clôturé, ou rouvert par le responsable pour
 * correction, avec un accès direct aux journées ouvertes et au schéma. Le responsable connecté y
 * trouve « Rouvrir le tournoi » ; le directeur de jeu, lui, ne peut plus rien modifier, même
 * pendant une réouverture.
 */
function ReadOnlyBar() {
  const { state, closure, reopening, canReopen, reopenTournament } = useTournament();
  const { session } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [confirm, setConfirm] = useState(false);
  const reopenable = Boolean(closure) && canReopen;
  // Réouverture en cours, vue par le responsable : lui seul corrige
  const correcting = !closure && Boolean(reopening) && canReopen;
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
        <span
          className={cx(
            "flex items-center gap-1.5",
            correcting ? "text-brand-ink" : "text-gold-ink",
          )}
        >
          {correcting ? (
            <LockKeyholeOpen className="size-4" aria-hidden="true" />
          ) : (
            <LockKeyhole className="size-4" aria-hidden="true" />
          )}
          {reopenable && closure
            ? `Tournoi clôturé le ${closureWhen(closure.at)}${closure.by ? ` par ${closure.by}` : ""}`
            : closure
              ? "Tournoi clôturé : consultation seule, seul le responsable peut le rouvrir"
              : correcting
                ? "Tournoi rouvert pour correction : vous seul pouvez modifier, puis clôturez de nouveau"
                : reopening
                  ? "Tournoi rouvert par le responsable pour correction : consultation seule"
                  : "Tournoi clôturé : consultation seule"}
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
        {reopenable ? (
          <Button
            size="sm"
            variant="primary"
            icon={LockKeyholeOpen}
            className="rounded-full"
            onClick={() => setConfirm(true)}
          >
            Rouvrir le tournoi
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Rouvrir le tournoi ?"
        icon={LockKeyholeOpen}
        confirmLabel="Rouvrir le tournoi"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          reopenTournament(session?.displayName);
          toast("Tournoi rouvert pour correction : vous seul pouvez modifier");
        }}
      >
        La saisie redevient possible pour vous seul : le directeur de jeu reste en consultation.
        Corrigez ce qui doit l'être, puis clôturez de nouveau le tournoi.
      </ConfirmDialog>
    </div>
  );
}

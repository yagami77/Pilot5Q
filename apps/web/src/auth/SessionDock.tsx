/**
 * Pastille de session en bas à gauche du cockpit : qui est connecté, sur quel tournoi, et
 * « Se déconnecter ». Repliée par défaut pour ne pas gêner la saisie.
 */
import { ChevronUp, LogOut, ShieldCheck, Sparkles, Whistle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { Avatar, Button, cx } from "@/components/ui";
import { nice } from "@/lib/format";
import { useTournament } from "@/store/tournament";

import { useAuth } from "./context";

export function SessionDock() {
  const { session, logout } = useAuth();
  const { closure } = useTournament();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!session) return null;
  const Icon =
    session.role === "responsable" ? ShieldCheck : session.role === "dj" ? Whistle : Sparkles;
  const role =
    session.role === "responsable"
      ? "Responsable national"
      : session.role === "dj"
        ? "Directeur de jeu"
        : "Démonstration";
  const name = session.role === "dj" ? nice(session.displayName) : session.displayName;

  return (
    <div ref={root} className="no-print fixed bottom-4 left-4 z-40">
      <AnimatePresence>
        {open ? (
          <motion.div
            className="bg-surface border-line absolute bottom-[calc(100%+8px)] left-0 w-[280px] rounded-[16px] border p-4 shadow-[var(--shadow-raised)]"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            role="dialog"
            aria-label="Session"
          >
            <div className="eyebrow flex items-center gap-1.5">
              <Icon className="size-3.5" aria-hidden="true" />
              {role}
            </div>
            <div className="mt-1 text-[15px] font-bold">{name}</div>
            {session.role === "dj" ? (
              <div className="text-ink-muted text-[12.5px]">
                {session.email}
                <br />
                {session.stageName}
                {session.readOnly || closure
                  ? " · clôturé, consultation seule"
                  : " · droits actifs"}
              </div>
            ) : session.role === "responsable" ? (
              <Link
                to="/responsable"
                className="text-brand mt-1 inline-block text-[12.5px] font-semibold underline-offset-2 hover:underline"
              >
                Retour à l'espace du responsable
              </Link>
            ) : (
              <div className="text-ink-muted text-[12.5px]">Tournoi d'exemple, sans compte.</div>
            )}
            <Button
              className="mt-3 w-full"
              icon={LogOut}
              onClick={() =>
                void logout().then(() => {
                  setOpen(false);
                  void navigate("/", { replace: true });
                })
              }
            >
              {session.role === "demo" ? "Quitter la démonstration" : "Se déconnecter"}
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cx(
          "bg-surface/90 border-line-2 flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-[12.5px] font-semibold shadow-[var(--shadow-card)] backdrop-blur-[10px] transition-transform hover:-translate-y-px",
        )}
      >
        <Avatar name={name} size="sm" />
        <span className="max-w-[160px] truncate">{name}</span>
        <ChevronUp
          className={cx("text-ink-muted size-3.5 transition-transform", !open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

/**
 * Fenêtre de connexion : responsable (identifiant + mot de passe) ou directeur de jeu (email +
 * code à 6 chiffres). Ouverture animée, focus piégé dans la fenêtre, Échap pour fermer, erreurs
 * annoncées aux lecteurs d'écran.
 */
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Whistle,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { TournamentState } from "@pilot5q/domain";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";

import { Button, cx } from "@/components/ui";
import { nice } from "@/lib/format";
import { replay } from "@/lib/engine";
import { dayStatuses } from "@/lib/tournament";
import { saveCurrentId, loadEvents } from "@/store/persistence";
import { useTournament } from "@/store/tournament";
import { currentDay } from "@/views/Cockpit";

import { useAuth } from "./context";
import { DEMO_ACCOUNT, type DjAccess, type DjSession } from "./provider";

export type LoginKind = "responsable" | "dj";

/** Journée sur laquelle le DJ doit travailler (dernière journée ouverte). */
function dayPath(state: TournamentState): string {
  return `tournoi/${currentDay(dayStatuses(state))}`;
}

/**
 * Après connexion, ouvre le tournoi du DJ dans le cockpit, sur la journée en cours (rechargement
 * de la page si le cockpit affichait un autre tournoi). Rend un message si c'est impossible.
 */
export async function enterDjTournament(
  session: DjSession,
  cockpit: { id: string | null; state: TournamentState },
  go: (path: string) => void,
): Promise<string | null> {
  if (cockpit.id === session.tournamentId) {
    go(`/${dayPath(cockpit.state)}`);
    return null;
  }
  const events = await loadEvents(session.tournamentId);
  if (events.length === 0) {
    return "Votre tournoi n'est pas enregistré dans ce navigateur : il a été ouvert sur un autre ordinateur. Le partage entre ordinateurs arrivera avec le serveur.";
  }
  await saveCurrentId(session.tournamentId);
  window.location.assign(`${import.meta.env.BASE_URL}${dayPath(replay(events))}`);
  return null;
}

export function LoginDialog({
  kind,
  onClose,
  initialEmail = "",
  redirectTo = "/responsable",
}: {
  kind: LoginKind | null;
  onClose: () => void;
  initialEmail?: string;
  /** Page du responsable à ouvrir après connexion. */
  redirectTo?: string;
}) {
  return (
    <AnimatePresence>
      {kind ? (
        <Dialog
          key={kind}
          kind={kind}
          onClose={onClose}
          initialEmail={initialEmail}
          redirectTo={redirectTo}
        />
      ) : null}
    </AnimatePresence>
  );
}

function Dialog({
  kind,
  onClose,
  initialEmail,
  redirectTo,
}: {
  kind: LoginKind;
  onClose: () => void;
  initialEmail: string;
  redirectTo: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const restore = useRef<Element | null>(null);

  useEffect(() => {
    restore.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      if (restore.current instanceof HTMLElement) restore.current.focus();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const items = Array.from(
      panel.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const responsable = kind === "responsable";
  const Icon = responsable ? ShieldCheck : Whistle;

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="absolute inset-0 bg-[#0f1b33]/45 backdrop-blur-[6px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="bg-surface relative w-full max-w-[440px] overflow-hidden rounded-[20px] shadow-[0_30px_80px_-20px_rgb(14_55_168/0.45),0_2px_6px_rgb(15_27_51/0.08)]"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      >
        <div className="tricolore" aria-hidden="true" />
        <div className="relative px-6 pt-5 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:bg-surface-2 absolute top-3 right-3 grid size-8 place-items-center rounded-[10px]"
            aria-label="Fermer"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          <motion.span
            className={cx(
              "grid size-12 place-items-center rounded-[14px]",
              responsable
                ? "bg-[linear-gradient(135deg,#0e37a8,#1e4fd8)] text-white shadow-[0_10px_24px_-10px_rgb(14_55_168/0.7)]"
                : "bg-gold-soft text-gold-ink",
            )}
            initial={{ rotate: -12, scale: 0.6 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.05 }}
          >
            <Icon className="size-6" aria-hidden="true" />
          </motion.span>
          <div className="eyebrow mt-3">
            {responsable ? "Accès Responsable" : "Accès Directeur de jeu"}
          </div>
          <h2 id={titleId} className="mt-0.5 text-[22px] font-extrabold tracking-[-0.02em]">
            {responsable ? "Espace du responsable national" : "Mon tournoi"}
          </h2>
          <p className="text-ink-muted mt-1 text-[13px]">
            {responsable
              ? "Saison, calendrier, clubs, base joueurs, inscriptions, ouverture des TN et clôture."
              : "Saisissez l'email et le code à 6 chiffres reçus dans l'email d'activation du responsable national."}
          </p>
          {responsable ? (
            <ResponsableForm onDone={onClose} redirectTo={redirectTo} />
          ) : (
            <DjForm onDone={onClose} initialEmail={initialEmail} />
          )}
          <p className="text-ink-muted mt-4 flex items-start gap-1.5 text-[11.5px] leading-[1.45]">
            <Lock className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            Connexion locale à ce navigateur, pour le prototype : la sécurité réelle (comptes, envoi
            des codes, sessions) arrivera avec le serveur.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------- Champs ---------- */

function TextField({
  label,
  icon: Icon,
  error,
  trailing,
  inputRef,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: typeof Mail;
  error?: boolean;
  trailing?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-ink-muted text-[11px] font-bold tracking-[0.06em] uppercase">
        {label}
      </span>
      <span
        className={cx(
          "bg-surface flex items-center gap-2 rounded-[12px] border px-3 transition-[border-color,box-shadow] focus-within:shadow-[0_0_0_4px_rgb(30_79_216/0.12)]",
          error
            ? "border-alert focus-within:border-alert"
            : "border-line-2 focus-within:border-brand",
        )}
      >
        <Icon className="text-ink-muted size-4 shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          {...props}
          aria-invalid={error || undefined}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] outline-none"
        />
        {trailing}
      </span>
    </label>
  );
}

function ErrorLine({ message, nonce }: { message: string; nonce: number }) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          key={nonce}
          role="alert"
          className="bg-alert-soft text-alert-ink animate-shake flex items-start gap-2 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      disabled={pending}
      iconRight={pending ? undefined : ArrowRight}
      className="mt-1 w-full"
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}

/* ---------- Responsable ---------- */

function ResponsableForm({ onDone, redirectTo }: { onDone: () => void; redirectTo: string }) {
  const { loginResponsable, provider } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [pending, setPending] = useState(false);
  const [demo, setDemo] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    void provider.listAccounts().then((list) => setDemo(list.some((a) => a.demo)));
  }, [provider]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    const r = await loginResponsable(username, password);
    setPending(false);
    if (!r.ok) {
      setError(r.message);
      setNonce((n) => n + 1);
      return;
    }
    onDone();
    void navigate(redirectTo.startsWith("/responsable") ? redirectTo : "/responsable");
  };

  return (
    <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => void submit(e)} noValidate>
      {demo ? (
        <div className="bg-gold-soft text-gold-ink flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] px-3 py-2.5 text-[12.5px]">
          <Sparkles className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <b>Compte de démonstration</b> · identifiant{" "}
            <code className="font-mono font-bold">{DEMO_ACCOUNT.username}</code> · mot de passe{" "}
            <code className="font-mono font-bold">{DEMO_ACCOUNT.password}</code>
          </span>
          <button
            type="button"
            className="font-bold underline underline-offset-2"
            onClick={() => {
              setUsername(DEMO_ACCOUNT.username);
              setPassword(DEMO_ACCOUNT.password);
              setError("");
            }}
          >
            Remplir
          </button>
        </div>
      ) : null}
      <TextField
        label="Identifiant"
        icon={ShieldCheck}
        inputRef={first}
        autoComplete="username"
        value={username}
        error={Boolean(error)}
        onChange={(e) => setUsername(e.target.value)}
      />
      <TextField
        label="Mot de passe"
        icon={KeyRound}
        type={show ? "text" : "password"}
        autoComplete="current-password"
        value={password}
        error={Boolean(error)}
        onChange={(e) => setPassword(e.target.value)}
        trailing={
          <button
            type="button"
            className="text-ink-muted hover:text-brand"
            onClick={() => setShow(!show)}
            aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        }
      />
      <ErrorLine message={error} nonce={nonce} />
      <Submit pending={pending}>Se connecter</Submit>
    </form>
  );
}

/* ---------- Directeur de jeu ---------- */

/** Code à 6 chiffres : un champ unique (collage, saisie auto « one-time-code ») dessiné en 6 cases. */
function CodeInput({
  value,
  onChange,
  error,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  error: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [focused, setFocused] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-ink-muted text-[11px] font-bold tracking-[0.06em] uppercase"
      >
        Code à 6 chiffres
      </label>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={7}
          value={value}
          aria-invalid={error || undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="absolute inset-0 z-10 w-full cursor-text opacity-0"
        />
        <div className="flex gap-2" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => {
            const ch = value[i] ?? "";
            const active = focused && (i === value.length || (i === 5 && value.length === 6));
            return (
              <div
                key={i}
                className={cx(
                  "bg-surface grid h-[52px] flex-1 place-items-center rounded-[12px] border font-mono text-[22px] font-bold tabular-nums transition-[border-color,box-shadow,transform]",
                  error
                    ? "border-alert"
                    : active
                      ? "border-brand shadow-[0_0_0_4px_rgb(30_79_216/0.12)]"
                      : ch
                        ? "border-brand/40"
                        : "border-line-2",
                  i === 3 && "ml-2",
                )}
              >
                <AnimatePresence mode="popLayout">
                  {ch ? (
                    <motion.span
                      key={`${i}-${ch}`}
                      initial={{ y: 8, opacity: 0, scale: 0.8 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 28 }}
                    >
                      {ch}
                    </motion.span>
                  ) : active ? (
                    <span className="bg-brand animate-pulse-dot h-6 w-[2px] rounded" />
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DjForm({ onDone, initialEmail }: { onDone: () => void; initialEmail: string }) {
  const { loginDj, logout, provider } = useAuth();
  const cockpit = useTournament();
  const navigate = useNavigate();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [pending, setPending] = useState(false);
  const [demoAccess, setDemoAccess] = useState<DjAccess[]>([]);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (initialEmail ? codeRef : emailRef).current?.focus();
    void provider.listDjAccess().then(setDemoAccess);
  }, [provider, initialEmail]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    const r = await loginDj(email, code);
    if (!r.ok) {
      setPending(false);
      setError(r.message);
      setNonce((n) => n + 1);
      if (r.error === "code") setCode("");
      return;
    }
    const problem = await enterDjTournament(r.session, cockpit, (p) => {
      onDone();
      void navigate(p);
    });
    if (problem) {
      await logout();
      setPending(false);
      setError(problem);
      setNonce((n) => n + 1);
    }
  };

  return (
    <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => void submit(e)} noValidate>
      <TextField
        label="Email"
        icon={Mail}
        type="email"
        inputRef={emailRef}
        autoComplete="email"
        value={email}
        error={Boolean(error) && !email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="prenom.nom@exemple.fr"
      />
      <CodeInput value={code} onChange={setCode} error={Boolean(error)} inputRef={codeRef} />
      <ErrorLine message={error} nonce={nonce} />
      <Submit pending={pending}>Accéder à mon tournoi</Submit>
      {demoAccess.length > 0 ? (
        <div className="bg-gold-soft text-gold-ink rounded-[12px] px-3 py-2.5 text-[12.5px]">
          <div className="flex items-center gap-1.5 font-bold">
            <Sparkles className="size-4" aria-hidden="true" />
            Démonstration : accès ouverts depuis l'espace responsable de ce navigateur
          </div>
          <ul className="mt-1.5 flex flex-col gap-1">
            {demoAccess.map((a) => (
              <li key={a.stageId} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {a.stageName} · {a.city} · {nice(a.dj.name) || a.dj.email}
                  {a.closedAt ? " · clôturé" : ""}
                </span>
                <button
                  type="button"
                  className="font-bold underline underline-offset-2"
                  onClick={() => {
                    setEmail(a.dj.email);
                    setCode(a.code);
                    setError("");
                  }}
                >
                  Remplir
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-ink-muted text-[12px]">
          Pas encore de code ? Il est généré par le responsable national à l'ouverture du TN (bouton
          « Ouvrir le TN au DJ »).
        </p>
      )}
    </form>
  );
}

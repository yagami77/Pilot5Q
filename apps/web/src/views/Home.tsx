/**
 * Accueil : deux entrées, « Accès Responsable » et « Accès Directeur de jeu », chacune ouvrant sa
 * fenêtre de connexion ; un lien discret « Démonstration » ouvre le tournoi d'exemple.
 *
 * Paramètres d'adresse : `?acces=responsable|dj` ouvre la fenêtre correspondante (lien de l'email
 * d'activation du DJ), `email=` pré-remplit l'email du DJ, `retour=` est la page du responsable à
 * rouvrir après connexion.
 */
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  LogOut,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Whistle,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { Navigate, useNavigate, useSearchParams } from "react-router";

import { useAuth } from "@/auth/context";
import { LoginDialog, type LoginKind } from "@/auth/LoginDialog";
import { useToast } from "@/components/Toast";
import { BrandLogo } from "@/components/Brand";
import { Avatar, Button, cx } from "@/components/ui";
import { demoEvents } from "@/lib/demo";
import { useTournament } from "@/store/tournament";

export function Home() {
  const { ready, session, logout, startDemo } = useAuth();
  const { open } = useTournament();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const acces = params.get("acces");
  const dialog: LoginKind | null = acces === "responsable" || acces === "dj" ? acces : null;

  const show = (kind: LoginKind | null) => {
    const next = new URLSearchParams(params);
    if (kind) next.set("acces", kind);
    else {
      next.delete("acces");
      next.delete("email");
      next.delete("retour");
    }
    setParams(next, { replace: true });
  };

  // Un directeur de jeu connecté ne voit que son tournoi.
  if (ready && session?.role === "dj" && !dialog) return <Navigate to="/tournoi" replace />;

  const openDemo = async () => {
    await startDemo();
    open(`demo-${Date.now().toString(36)}`, demoEvents());
    toast("Tournoi d'exemple ouvert");
    void navigate("/tournoi/jeudi");
  };

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-3px)] max-w-[1100px] flex-col px-4 pt-12 pb-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(30_79_216/0.10),transparent_70%)]"
      />
      <header className="flex flex-col items-center gap-3 text-center">
        <motion.h1
          initial={{ scale: 0.82, y: 14, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
        >
          <BrandLogo className="h-[96px] drop-shadow-[0_18px_22px_rgb(14_55_168/0.18)] md:h-[132px]" />
        </motion.h1>
        <p className="text-ink-muted animate-fade-up text-xs font-semibold tracking-[0.2em] uppercase">
          Billard 5-Quilles · FFB
        </p>
        <p className="text-ink-secondary animate-fade-up max-w-xl text-base font-medium [animation-delay:120ms]">
          Les Tournois Nationaux, de l'inscription au podium : le responsable national prépare la
          saison, le directeur de jeu pilote son tournoi.
        </p>
      </header>

      {ready && session && session.role !== "dj" ? (
        <motion.div
          className="card mx-auto mt-8 flex w-full max-w-[640px] flex-wrap items-center gap-3 px-4 py-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Avatar name={session.displayName} size="md" />
          <div className="min-w-0 flex-1">
            <div className="eyebrow">
              {session.role === "responsable" ? "Connecté · Responsable" : "Démonstration en cours"}
            </div>
            <div className="truncate text-[14px] font-bold">{session.displayName}</div>
          </div>
          <Button size="sm" icon={LogOut} onClick={() => void logout()}>
            {session.role === "demo" ? "Quitter" : "Se déconnecter"}
          </Button>
          <Button
            size="sm"
            variant="primary"
            iconRight={ArrowRight}
            onClick={() => navigate(session.role === "responsable" ? "/responsable" : "/tournoi")}
          >
            Continuer
          </Button>
        </motion.div>
      ) : null}

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <Entry
          delay={0.15}
          icon={ShieldCheck}
          tone="brand"
          eyebrow="Fédération"
          title="Accès Responsable"
          text="Saison, calendrier des 5 TN, clubs hôtes, base joueurs, inscriptions et liste d'attente, convocations, ouverture des tournois aux directeurs de jeu, clôture et classement glissant."
          features={[
            { icon: CalendarDays, label: "Calendrier et clubs" },
            { icon: Users, label: "Inscrits et convocations" },
            { icon: Trophy, label: "Classement glissant" },
          ]}
          cta="Se connecter"
          onClick={() => show("responsable")}
        />
        <Entry
          delay={0.22}
          icon={Whistle}
          tone="gold"
          eyebrow="Club hôte"
          title="Accès Directeur de jeu"
          text="Votre tournoi, et seulement le vôtre : billards et tirage du jeudi, poules et barrages du vendredi, National et Masters du samedi, tableaux et primes du dimanche."
          features={[
            { icon: ClipboardList, label: "Tâches du jour" },
            { icon: Trophy, label: "Tableaux et primes" },
            { icon: ShieldCheck, label: "Email + code à 6 chiffres" },
          ]}
          cta="Accéder à mon tournoi"
          onClick={() => show("dj")}
        />
      </div>

      <footer className="text-ink-muted mt-auto flex flex-col items-center gap-2 pt-12 text-center text-[12.5px]">
        <button
          type="button"
          onClick={() => void openDemo()}
          className="hover:text-brand inline-flex items-center gap-1.5 font-semibold underline-offset-4 transition-colors hover:underline"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          Démonstration
        </button>
        <span>
          Prototype : tout reste dans ce navigateur, aucune donnée n'est envoyée à un serveur.
        </span>
      </footer>

      <LoginDialog
        kind={dialog}
        onClose={() => show(null)}
        initialEmail={params.get("email") ?? ""}
        redirectTo={params.get("retour") ?? "/responsable"}
      />
    </main>
  );
}

function Entry({
  delay,
  icon: Icon,
  tone,
  eyebrow,
  title,
  text,
  features,
  cta,
  onClick,
}: {
  delay: number;
  icon: LucideIcon;
  tone: "brand" | "gold";
  eyebrow: string;
  title: string;
  text: string;
  features: { icon: LucideIcon; label: string }[];
  cta: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 320, damping: 26, delay }}
      className="card group relative flex flex-col gap-4 overflow-hidden p-7 text-left transition-shadow hover:shadow-[var(--shadow-raised)] focus-visible:shadow-[0_0_0_4px_rgb(30_79_216/0.18)] focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute -top-16 -right-16 size-48 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-100",
          tone === "brand" ? "bg-brand-soft" : "bg-gold-soft",
        )}
      />
      <span
        className={cx(
          "relative grid size-14 place-items-center rounded-[16px] transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3",
          tone === "brand"
            ? "bg-[linear-gradient(135deg,#0e37a8,#1e4fd8)] text-white shadow-[0_12px_26px_-10px_rgb(14_55_168/0.7)]"
            : "bg-gold-soft text-gold-ink",
        )}
      >
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <span className="relative">
        <span className="eyebrow block">{eyebrow}</span>
        <span className="mt-0.5 block text-[24px] font-extrabold tracking-[-0.02em]">{title}</span>
        <span className="text-ink-muted mt-1.5 block text-[13.5px] leading-[1.5]">{text}</span>
      </span>
      <span className="relative flex flex-wrap gap-2">
        {features.map((f) => (
          <span
            key={f.label}
            className="bg-surface-2 border-line text-ink-secondary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold"
          >
            <f.icon className="size-3.5" aria-hidden="true" />
            {f.label}
          </span>
        ))}
      </span>
      <span
        className={cx(
          "relative mt-auto inline-flex items-center gap-2 self-start rounded-[12px] px-4 py-2.5 text-[14px] font-semibold transition-[gap]",
          tone === "brand"
            ? "bg-[linear-gradient(180deg,#1e4fd8,#0e37a8)] text-white"
            : "bg-ink text-white",
          "group-hover:gap-3",
        )}
      >
        {cta}
        <ArrowRight className="size-4" aria-hidden="true" />
      </span>
    </motion.button>
  );
}

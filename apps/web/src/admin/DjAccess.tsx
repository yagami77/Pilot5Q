/**
 * Directeur de jeu d'une étape : coordonnées (nom, email, licence, téléphone), ouverture du TN
 * au DJ avec génération du code à 6 chiffres, email d'activation prêt à copier, statut (non
 * ouvert / ouvert / clôturé) et régénération du code.
 */
import type { DjContact, Player, Stage } from "@pilot5q/domain";
import { normalizeLicence } from "@pilot5q/domain";
import {
  ArrowRight,
  Check,
  Copy,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Undo2,
  Whistle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "@/auth/context";
import type { DjAccess } from "@/auth/provider";
import { useToast } from "@/components/Toast";
import { Banner, Button, Chip, cx } from "@/components/ui";
import { clubShort, nice } from "@/lib/format";
import { useTournament } from "@/store/tournament";

import { djActivationMail, djLoginLink, formatCode } from "./convocations";
import { openingEvents, withStageDerived } from "./stage";
import { useSeason, useSeasonDoc } from "./store";
import { Field, Input, copyText, frDateTime } from "./ui";

const EMPTY: DjContact = { name: "", email: "", licence: "", phone: "" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DjStatus = "non-ouvert" | "ouvert" | "cloture";

export function djStatus(stage: Stage): DjStatus {
  if (stage.closedAt) return "cloture";
  return stage.openedAt ? "ouvert" : "non-ouvert";
}

export function DjStatusChip({ stage }: { stage: Stage }) {
  const s = djStatus(stage);
  return s === "cloture" ? (
    <Chip tone="green" icon={Lock}>
      Clôturé · lecture seule
    </Chip>
  ) : s === "ouvert" ? (
    <Chip tone="red" icon={Rocket}>
      Ouvert au DJ
    </Chip>
  ) : (
    <Chip tone="grey">Non ouvert</Chip>
  );
}

/** Accès du DJ enregistré pour l'étape (relu après chaque action). */
function useDjAccess(stageId: string): [DjAccess | null, () => Promise<void>] {
  const { provider } = useAuth();
  const [access, setAccess] = useState<DjAccess | null>(null);
  const reload = useCallback(
    async () => setAccess(await provider.getDjAccess(stageId)),
    [provider, stageId],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  return [access, reload];
}

export function DjSection({ stage, accepted }: { stage: Stage; accepted: Player[] }) {
  const doc = useSeasonDoc();
  const { update } = useSeason();
  const { provider } = useAuth();
  const cockpit = useTournament();
  const toast = useToast();
  const navigate = useNavigate();
  const [access, reload] = useDjAccess(stage.id);
  const dj: DjContact = stage.dj ?? {
    ...EMPTY,
    licence: stage.djLicence ?? "",
    name: doc.players.find((p) => p.licence === stage.djLicence)?.name ?? "",
  };
  const [busy, setBusy] = useState(false);
  const status = djStatus(stage);
  const locked = status !== "non-ouvert";

  const setDj = (patch: Partial<DjContact>) =>
    update((d) => ({
      ...d,
      stages: d.stages.map((s) =>
        s.id === stage.id
          ? {
              ...s,
              dj: { ...dj, ...patch },
              djLicence: normalizeLicence(patch.licence ?? dj.licence) || null,
            }
          : s,
      ),
    }));

  const known = dj.licence.trim()
    ? doc.players.find((p) => p.licence === normalizeLicence(dj.licence))
    : undefined;
  const emailOk = EMAIL.test(dj.email.trim());
  const missing = [
    !dj.name.trim() && "nom et prénom",
    !emailOk && "email valide",
    accepted.length < 16 && "au moins 16 joueurs acceptés",
    (stage.big + stage.small < doc.settings.minTables || !stage.start) &&
      "billards et dates de l'étape (calendrier)",
  ].filter(Boolean) as string[];

  const issue = async (tournamentId: string) =>
    provider.issueDjAccess({
      stageId: stage.id,
      stageName: `${stage.name} ${stage.season}`,
      city: stage.city,
      seasonId: doc.id,
      tournamentId,
      dj: { ...dj, name: dj.name.trim().toUpperCase(), email: dj.email.trim() },
    });

  const open = async () => {
    if (missing.length > 0) {
      toast(`À compléter : ${missing.join(", ")}`);
      return;
    }
    setBusy(true);
    const id = `${stage.id}-${Date.now().toString(36)}`;
    cockpit.open(id, openingEvents(doc, stage, accepted));
    await issue(id);
    const now = new Date().toISOString();
    update((d) =>
      withStageDerived(
        {
          ...d,
          stages: d.stages.map((s) =>
            s.id === stage.id
              ? {
                  ...s,
                  dj: { ...dj, email: dj.email.trim() },
                  djLicence: normalizeLicence(dj.licence) || null,
                  tournamentId: id,
                  openedAt: now,
                }
              : s,
          ),
        },
        stage.id,
      ),
    );
    await reload();
    setBusy(false);
    toast("TN ouvert au directeur de jeu : code généré");
  };

  const regenerate = async () => {
    if (
      !window.confirm(
        "Générer un nouveau code ? L'ancien cessera de fonctionner (une session déjà ouverte reste valide).",
      )
    )
      return;
    if (access) await provider.regenerateDjCode(stage.id);
    else if (stage.tournamentId) await issue(stage.tournamentId);
    await reload();
    toast("Nouveau code généré : renvoyez l'email d'activation");
  };

  const unopen = async () => {
    if (
      !window.confirm(
        "Retirer l'ouverture ? Le code du DJ cesse de fonctionner et l'étape revient à la préparation. Le tournoi reste enregistré dans ce navigateur.",
      )
    )
      return;
    await provider.revokeDjAccess(stage.id);
    update((d) => ({
      ...d,
      stages: d.stages.map((s) =>
        s.id === stage.id ? { ...s, tournamentId: null, openedAt: null } : s,
      ),
    }));
    await reload();
    toast("Ouverture retirée");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex flex-col gap-3">
        {stage.openedAt ? (
          <div className="text-ink-muted text-[12px]">
            Ouvert au DJ le {frDateTime(stage.openedAt)}
            {stage.closedAt ? ` · clôturé le ${frDateTime(stage.closedAt)}` : ""}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom et prénom" className="col-span-2">
            <Input
              value={dj.name}
              disabled={locked}
              onChange={(e) => setDj({ name: e.target.value })}
              placeholder="DUPONT Jean"
            />
          </Field>
          <Field
            label="Email"
            className="col-span-2"
            hint={
              dj.email && !emailOk ? (
                <span className="text-alert-ink">Adresse email incomplète</span>
              ) : (
                "Identifiant de connexion du DJ"
              )
            }
          >
            <Input
              type="email"
              value={dj.email}
              disabled={locked}
              onChange={(e) => setDj({ email: e.target.value })}
              placeholder="prenom.nom@exemple.fr"
            />
          </Field>
          <Field
            label="Licence"
            hint={
              known
                ? `${nice(known.name)} · ${clubShort(known.club)}`
                : dj.licence
                  ? "Inconnue de la base joueurs (le DJ peut ne pas être joueur)"
                  : "Facultative"
            }
          >
            <Input
              value={dj.licence}
              disabled={locked}
              onChange={(e) => {
                const licence = e.target.value;
                const found = licence.trim()
                  ? doc.players.find((p) => p.licence === normalizeLicence(licence))
                  : undefined;
                setDj(found && !dj.name ? { licence, name: found.name } : { licence });
              }}
              placeholder="123456A"
            />
          </Field>
          <Field label="Téléphone">
            <Input
              type="tel"
              value={dj.phone}
              disabled={locked}
              onChange={(e) => setDj({ phone: e.target.value })}
              placeholder="06 00 00 00 00"
            />
          </Field>
        </div>
        {status === "non-ouvert" ? (
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              icon={Rocket}
              disabled={busy}
              onClick={() => void open()}
              className="self-start"
            >
              Ouvrir le TN au DJ ({accepted.length} joueurs)
            </Button>
            <p className="text-ink-muted text-[12px]">
              {missing.length > 0
                ? `À compléter : ${missing.join(", ")}.`
                : "Crée le tournoi dans le cockpit (billards, paramètres, liste ordonnée) et génère le code à 6 chiffres du DJ."}
              {cockpit.id && cockpit.state.info
                ? ` Le cockpit de ce navigateur affiche « ${cockpit.state.info.name} · ${cockpit.state.info.city} » : il restera enregistré.`
                : ""}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {cockpit.id === stage.tournamentId ? (
              <Button iconRight={ArrowRight} onClick={() => navigate("/tournoi")}>
                Voir le cockpit
              </Button>
            ) : null}
            {status === "ouvert" ? (
              <Button variant="ghost" icon={Undo2} onClick={() => void unopen()}>
                Retirer l'ouverture
              </Button>
            ) : null}
          </div>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {status === "non-ouvert" ? (
          <motion.div
            key="pending"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-line-2 bg-surface-2 text-ink-muted flex flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed p-6 text-center text-[13px]"
          >
            <Whistle className="size-6" aria-hidden="true" />
            <span className="max-w-[44ch]">
              À l'ouverture, un code à 6 chiffres est généré et l'email d'activation (lien, email,
              code) est prêt à copier. Le DJ arrive directement sur son tournoi ; ses droits passent
              en lecture seule à la clôture.
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="access"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <AccessPanel
              stage={stage}
              access={access}
              accepted={accepted.length}
              onRegenerate={() => void regenerate()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AccessPanel({
  stage,
  access,
  accepted,
  onRegenerate,
}: {
  stage: Stage;
  access: DjAccess | null;
  accepted: number;
  onRegenerate: () => void;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const closed = Boolean(stage.closedAt);
  if (!access) {
    return (
      <Banner
        icon={KeyRound}
        tone="gold"
        className="mt-0"
        actions={
          closed ? null : (
            <Button size="sm" icon={KeyRound} onClick={onRegenerate}>
              Générer le code
            </Button>
          )
        }
      >
        Aucun code de connexion enregistré dans ce navigateur pour ce tournoi.
      </Banner>
    );
  }
  const link = djLoginLink(window.location.origin, import.meta.env.BASE_URL, access.dj.email);
  const mail = djActivationMail(stage, access.dj, link, access.code, accepted);
  const copy = async (text: string, what: string) => {
    const ok = await copyText(text);
    toast(ok ? `${what} copié` : "Copie impossible dans ce navigateur");
    if (ok) {
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1600);
    }
  };
  const mailto = `mailto:${access.dj.email}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`;
  return (
    <div className="border-line flex flex-col gap-3 rounded-[14px] border p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <div className="eyebrow flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Code du directeur de jeu
          </div>
          <div className="mt-1 flex items-center gap-1.5" aria-label={`Code ${access.code}`}>
            {access.code.split("").map((d, i) => (
              <motion.span
                key={`${access.code}-${i}`}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 500, damping: 26 }}
                className={cx(
                  "grid h-11 w-9 place-items-center rounded-[10px] font-mono text-[22px] font-extrabold tabular-nums",
                  closed ? "bg-surface-2 text-ink-muted" : "bg-brand-soft text-brand-ink",
                  i === 3 && "ml-2",
                )}
              >
                {d}
              </motion.span>
            ))}
          </div>
          <div className="text-ink-muted mt-1 text-[11.5px]">
            généré le {frDateTime(access.issuedAt)} · {access.dj.email}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            size="sm"
            icon={copied === "Code" ? Check : Copy}
            onClick={() => void copy(formatCode(access.code), "Code")}
          >
            Copier le code
          </Button>
          {closed ? null : (
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={onRegenerate}>
              Régénérer
            </Button>
          )}
        </div>
      </div>
      {closed ? (
        <Banner icon={Lock} tone="green" className="mt-0">
          Tournoi clôturé : le DJ peut encore se connecter, en lecture seule.
        </Banner>
      ) : null}
      <div>
        <div className="eyebrow mb-1">Email d'activation</div>
        <div className="text-[12.5px]">
          <b>À :</b> {mail.to} · <b>Objet :</b> {mail.subject}
        </div>
        <pre className="bg-surface-2 border-line mt-1.5 max-h-[260px] overflow-auto rounded-[10px] border px-3 py-2 font-sans text-[12.5px] whitespace-pre-wrap">
          {mail.body}
        </pre>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            icon={copied === "Email" ? Check : Copy}
            onClick={() => void copy(mail.body, "Email")}
          >
            Copier l'email
          </Button>
          <Button
            size="sm"
            icon={copied === "Lien" ? Check : Copy}
            onClick={() => void copy(link, "Lien")}
          >
            Copier le lien
          </Button>
          <Button size="sm" icon={Mail} onClick={() => window.location.assign(mailto)}>
            Ouvrir dans la messagerie
          </Button>
        </div>
        <p className="text-ink-muted mt-2 text-[11.5px]">
          Envoi automatique de l'email et lien de connexion sans code : à venir avec le serveur.
        </p>
      </div>
    </div>
  );
}

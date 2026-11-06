/**
 * Page d'une étape, dans l'ordre du travail du responsable : inscriptions (CSV), liste ordonnée
 * avec U21 et forfaits, liste d'attente, convocations, ouverture pour le directeur de jeu.
 */
import {
  WAIT_STATUS_LABELS,
  acceptedListCsv,
  consolanteCheck,
  parseInscritsCsv,
  recipients,
  type Acceptance,
  type Player,
  type Registration,
  type Stage,
  type WaitStatus,
} from "@pilot5q/domain";
import {
  Check,
  Copy,
  Crown,
  Download,
  FileDown,
  FileText,
  Mail,
  Printer,
  RotateCcw,
  BellRing,
  Lock,
  Radio,
  Sparkles,
  Undo2,
  Upload,
  UserPlus,
  UserX,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router";

import { useToast } from "@/components/Toast";
import { Avatar, Banner, Button, Card, Chip, PageHead, Tile, cx } from "@/components/ui";
import { clubShort, dateRange, nice, plural } from "@/lib/format";
import { useNotifications } from "@/lib/notifications";

import { AttachmentsBar } from "./Attachments";
import { ClosureSection } from "./Closure";
import {
  clubConvocation,
  convocationsCsv,
  djConvocation,
  djLoginLink,
  placementOf,
  playerConvocations,
  recipientList,
  type Convocation,
  type Placement,
} from "./convocations";
import { StageStatusChip } from "./Dashboard";
import { StageSettingsSection } from "./StageSettings";
import { DjSection, DjStatusChip } from "./DjAccess";
import { useSeason, useSeasonDoc } from "./store";
import type { SeasonDocument } from "./persistence";
import { deadlineLabel, preqDrawn, syncRoster, wednesdayBefore } from "./roster";
import { stageAcceptance, stageCapacity, withStageDerived } from "./stage";
import { useStageTournament } from "./stageTournament";
import {
  Empty,
  Field,
  Input,
  MailBody,
  Num,
  Row,
  Table,
  copyMail,
  copyText,
  downloadText,
  frDateTime,
} from "./ui";

/** Numéro d'étape et titre d'une section. */
function Step({
  n,
  title,
  done,
  help,
  aside,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  help?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card
      className="animate-fade-up"
      title={
        <span className="flex items-center gap-2.5">
          <span
            className={cx(
              "grid size-7 place-items-center rounded-full font-mono text-[12px] font-bold text-white",
              done ? "bg-ok" : "bg-brand",
            )}
          >
            {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : n}
          </span>
          {title}
        </span>
      }
      aside={aside}
      bodyClassName="px-4 pb-4"
    >
      {help ? <p className="text-ink-muted -mt-1 mb-3 max-w-[80ch] text-[12.5px]">{help}</p> : null}
      {children}
    </Card>
  );
}

/** Fichier CSV au format du site fédéral, à partir d'inscrits (pour tester l'import). */
function federalCsv(stage: Stage, regs: Registration[]): string {
  const head =
    "id;date;licence;email;id_evenement;forfait;cle;paye;actif;prenom_licencie;nom_licencie;nom_club;num_club;nom_ligue;date_debut_evenement;date_fin_evenement;saison;etat";
  const fr = (iso: string) => {
    if (!iso) return "";
    const [d, t = "00:00"] = iso.split("T");
    const [y, m, j] = (d ?? "").split("-");
    return `${j}/${m}/${y} ${t.slice(0, 5)}`;
  };
  const lines = [...regs]
    .sort((a, b) => a.order - b.order)
    .map((r, i) => {
      const [nom = "", ...prenom] = r.name.split(" ");
      return [
        String(1000 + i),
        fr(r.registeredAt),
        r.licence,
        r.email,
        stage.id,
        r.forfait ? "1" : "",
        "",
        "1",
        "1",
        prenom.join(" "),
        nom,
        r.club,
        "",
        "",
        stage.start,
        stage.end,
        stage.season,
        "Enregistrée",
      ].join(";");
    });
  return [head, ...lines].join("\n");
}

export function StagePage() {
  const doc = useSeasonDoc();
  const { update } = useSeason();
  const { stageId } = useParams();
  const stage = doc.stages.find((s) => s.id === stageId);
  if (!stage) return <Navigate to="/responsable" replace />;
  return <StageView key={stage.id} stage={stage} update={update} />;
}

function StageView({
  stage,
  update,
}: {
  stage: Stage;
  update: ReturnType<typeof useSeason>["update"];
}) {
  const doc = useSeasonDoc();
  const club = doc.clubs.find((c) => c.id === stage.clubId);
  const now = new Date().toISOString();
  const regsDoc = doc.registrations[stage.id];
  const regs = regsDoc?.registrations ?? [];
  const juniors = useMemo(() => new Set(doc.juniors), [doc.juniors]);
  const acceptance = useMemo(() => stageAcceptance(doc, stage), [doc, stage]);
  const capacity = stageCapacity(doc, stage);
  const opened = Boolean(stage.openedAt);

  const closed = Boolean(stage.closedAt);
  const toast = useToast();
  const linked = useStageTournament(stage);
  const drawn = linked.state ? preqDrawn(linked.state) : false;
  const placement = useMemo(() => placementOf(linked.state), [linked.state]);
  // Inscrits modifiables : avant l'ouverture, puis jusqu'au tirage des poules du vendredi.
  const lock: string | null = !opened
    ? null
    : closed
      ? "Tournoi clôturé : les inscrits ne se modifient plus."
      : !linked.known
        ? "Le tournoi du DJ n'est pas enregistré dans ce navigateur : les modifications ne pourraient pas lui être répercutées (synchronisation avec le serveur)."
        : drawn
          ? "Poules du vendredi tirées par le DJ : les forfaits de dernière minute se gèrent désormais dans son cockpit (SPEC §4)."
          : null;

  /** Applique une modification des inscrits ; après ouverture, la répercute chez le DJ. */
  const change = (fn: (d: SeasonDocument) => SeasonDocument, reinstated: string[] = []) => {
    if (lock) {
      toast(lock);
      return;
    }
    const next = withStageDerived(fn(doc), stage.id);
    update((d) => withStageDerived(fn(d), stage.id));
    if (!opened || !stage.tournamentId || !linked.io) return;
    const nextStage = next.stages.find((s) => s.id === stage.id) ?? stage;
    const accepted = stageAcceptance(next, nextStage).accepted;
    const forfaits = new Set(
      (next.registrations[stage.id]?.registrations ?? [])
        .filter((r) => r.forfait)
        .map((r) => r.licence),
    );
    void syncRoster(stage.tournamentId, accepted, linked.io, forfaits, new Set(reinstated)).then(
      (res) => {
        linked.reload();
        if (res.status === "synced") toast("Répercuté dans le tournoi du DJ et notifié");
        else if (res.status === "drawn") toast("Poules déjà tirées : modification non répercutée");
        else if (res.status === "missing") toast("Tournoi du DJ introuvable dans ce navigateur");
      },
    );
  };

  const setRegs = (fn: (r: Registration[]) => Registration[], reinstated: string[] = []) =>
    change((d) => {
      const cur = d.registrations[stage.id] ?? {
        stageId: stage.id,
        importedAt: null,
        fileName: "",
        registrations: [],
      };
      return {
        ...d,
        registrations: {
          ...d.registrations,
          [stage.id]: { ...cur, manualWaitlist: true, registrations: fn(cur.registrations) },
        },
      };
    }, reinstated);
  const toggleJunior = (licence: string) =>
    change((d) => ({
      ...d,
      juniors: d.juniors.includes(licence)
        ? d.juniors.filter((l) => l !== licence)
        : [...d.juniors, licence],
    }));
  const nameOf = (licence: string) => nice(regs.find((r) => r.licence === licence)?.name ?? "");
  /** Forfait : le joueur sort aussitôt, sans confirmation ; sa place reste libre. */
  const setForfait = (licence: string, forfait: boolean) => {
    if (lock) {
      toast(lock);
      return;
    }
    setRegs(
      (rs) => rs.map((r) => (r.licence === licence ? { ...r, forfait } : r)),
      forfait ? [] : [licence],
    );
    toast(
      forfait
        ? `${nameOf(licence)} forfait : place libérée, à attribuer depuis la liste d'attente`
        : `Forfait de ${nameOf(licence)} annulé`,
    );
  };
  /** Intégration choisie par le responsable depuis la liste d'attente (ou retour en attente). */
  const setIntegrated = (licence: string, integrated: boolean) => {
    if (lock) {
      toast(lock);
      return;
    }
    setRegs((rs) =>
      rs.map((r) =>
        r.licence === licence
          ? { ...r, integrated, waitStatus: integrated ? "confirme" : r.waitStatus }
          : r,
      ),
    );
    toast(
      integrated
        ? `${nameOf(licence)} intégré à la liste des participants`
        : `${nameOf(licence)} remis en liste d'attente`,
    );
  };
  /** Suivi des appels : enregistré sans répercussion (la liste des acceptés ne change pas). */
  const setWaitStatus = (licence: string, waitStatus: WaitStatus) =>
    update((d) => {
      const cur = d.registrations[stage.id];
      if (!cur) return d;
      return {
        ...d,
        registrations: {
          ...d.registrations,
          [stage.id]: {
            ...cur,
            manualWaitlist: true,
            registrations: cur.registrations.map((r) =>
              r.licence === licence ? { ...r, waitStatus } : r,
            ),
          },
        },
      };
    });

  return (
    <>
      <PageHead
        eyebrow={`Saison ${doc.id} · ${stage.name}`}
        title={`${stage.name} · ${stage.city || "ville à définir"}`}
        help={
          <>
            {club ? club.name : "Club hôte à désigner dans le calendrier"}
            {stage.start ? ` · ${dateRange(stage.start, stage.end)}` : ""} · inscriptions{" "}
            {frDateTime(stage.registrationOpen)} → {frDateTime(stage.registrationClose)}
          </>
        }
      >
        <StageStatusChip stage={stage} now={now} />
        <Link to="/responsable/calendrier">
          <Button size="sm">Modifier l'étape</Button>
        </Link>
      </PageHead>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Tile
          label="Inscrits"
          value={regs.filter((r) => !r.forfait).length}
          detail={regsDoc?.fileName || "aucun import"}
        />
        <Tile
          label="Capacité"
          value={capacity}
          detail={`${stage.big + stage.small} billards × ${doc.settings.playersPerTable} + ${doc.settings.extraPlayers}`}
        />
        <Tile
          label="Acceptés"
          value={acceptance.accepted.length}
          tone="blue"
          detail="8 Masters + serpentin"
        />
        <Tile
          label="Places libres"
          value={Math.max(0, acceptance.free)}
          tone={acceptance.free > 0 ? "blue" : undefined}
          detail={
            acceptance.free < 0
              ? `capacité dépassée de ${-acceptance.free}`
              : acceptance.free > 0
                ? acceptance.waiting.length > 0
                  ? "à attribuer depuis l'attente"
                  : "inscriptions encore possibles"
                : "liste complète"
          }
        />
        <Tile
          label="En attente"
          value={acceptance.waiting.length}
          detail={`priorité aux ${doc.settings.waitlistPriority} premiers`}
        />
        <Tile
          label="U21"
          value={acceptance.accepted.filter((p) => p.junior).length}
          tone="gold"
          detail="exemptés du droit"
        />
      </div>
      <div className="grid gap-4">
        <ImportStep
          stage={stage}
          regs={regs}
          fileName={regsDoc?.fileName ?? ""}
          lock={lock}
          opened={opened}
          apply={change}
        />
        <OrderedStep
          stage={stage}
          acceptance={acceptance}
          regs={regs}
          priority={doc.settings.waitlistPriority}
          juniors={juniors}
          lock={lock}
          opened={opened}
          onJunior={toggleJunior}
          onForfait={setForfait}
          onIntegrate={setIntegrated}
          onWaitStatus={setWaitStatus}
        />
        <ConvocationsStep
          stage={stage}
          accepted={acceptance.accepted}
          waiting={acceptance.waiting}
          placement={placement}
        />
        <Step
          n={4}
          title="Paramètres du TN : consolante, U21, horaires"
          done={acceptance.accepted.length > 0}
          help="Vérification de la consolante d'après les billards de l'étape, nombre d'U21 enregistré avec le TN, horaires de convocation et canevas du mail propres à ce TN (sinon ceux de la saison)."
          aside={
            <Chip tone={consolanteCheck(stage, doc.settings).possible ? "green" : "red"}>
              {consolanteCheck(stage, doc.settings).possible
                ? "Consolante possible"
                : "Pas de consolante"}
            </Chip>
          }
        >
          <StageSettingsSection stage={stage} accepted={acceptance.accepted} />
        </Step>
        <Step
          n={5}
          title="Directeur de jeu et ouverture du TN"
          done={opened}
          help="Le responsable saisit le directeur de jeu, puis ouvre le TN : le tournoi est créé dans le cockpit (billards du club, paramètres de la saison, liste ordonnée) et un code à 6 chiffres est généré. Le DJ se connecte avec son email et ce code, arrive directement sur son tournoi et n'a accès à rien d'autre ; ses droits passent en lecture seule à la clôture."
          aside={<DjStatusChip stage={stage} />}
        >
          <DjSection stage={stage} accepted={acceptance.accepted} />
        </Step>
        <ClosureSection stage={stage} />
      </div>
    </>
  );
}

function ImportStep({
  stage,
  regs,
  fileName,
  lock,
  opened,
  apply,
}: {
  stage: Stage;
  regs: Registration[];
  fileName: string;
  lock: string | null;
  opened: boolean;
  apply: (fn: (d: SeasonDocument) => SeasonDocument) => void;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const read = async (file: File) => {
    try {
      const players = parseInscritsCsv(await file.text());
      if (players.length === 0) {
        toast("Aucun inscrit trouvé dans ce fichier");
        return;
      }
      apply((d) => {
        const previous = new Map(
          (d.registrations[stage.id]?.registrations ?? []).map((r) => [r.licence, r]),
        );
        const registrations: Registration[] = players.map((p) => {
          const prev = previous.get(p.licence);
          const r: Registration = {
            licence: p.licence,
            name: p.name,
            club: p.club,
            email: p.email ?? "",
            order: p.seed,
            registeredAt: prev?.registeredAt ?? "",
            junior: prev?.junior ?? false,
            forfait: prev?.forfait ?? false,
          };
          if (prev?.integrated) r.integrated = true;
          if (prev?.waitStatus) r.waitStatus = prev.waitStatus;
          return r;
        });
        // Un accepté absent du nouveau fichier (désinscrit sur le site) devient forfait : sa place
        // reste libre, personne n'est intégré sans l'accord du responsable.
        const kept = new Set(registrations.map((r) => r.licence));
        const wasAccepted = new Set(stageAcceptance(d, stage).accepted.map((p) => p.licence));
        for (const r of previous.values()) {
          if (!kept.has(r.licence) && wasAccepted.has(r.licence)) {
            registrations.push({ ...r, forfait: true });
          }
        }
        return {
          ...d,
          registrations: {
            ...d.registrations,
            [stage.id]: {
              stageId: stage.id,
              importedAt: new Date().toISOString(),
              fileName: file.name,
              registrations,
              manualWaitlist: true,
            },
          },
        };
      });
      toast(`${plural(players.length, "inscrit")} importés`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Fichier illisible");
    }
  };
  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) void read(f);
  };
  return (
    <Step
      n={1}
      title="Inscrits (CSV du site fédéral)"
      done={regs.length > 0}
      help="Séparateur « ; », colonnes du site fédéral. Les inscriptions annulées ou forfait sur le site sont ignorées ; l'ordre d'inscription vient de l'horodatage. Un nouvel import conserve les drapeaux U21, les forfaits et les intégrations saisis ici ; un accepté absent du nouveau fichier est compté forfait."
      aside={
        regs.length > 0 ? (
          <Button
            size="sm"
            icon={Download}
            onClick={() => downloadText(`inscrits-${stage.id}.csv`, federalCsv(stage, regs))}
          >
            CSV au format fédéral
          </Button>
        ) : null
      }
    >
      {lock ? (
        <Banner icon={Lock} tone="blue" className="mt-0">
          {plural(regs.length, "inscrit")} ({fileName}). {lock}
        </Banner>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cx(
            "flex w-full flex-col items-center justify-center gap-1.5 rounded-[12px] border-2 border-dashed p-5 text-center transition-colors",
            dragging
              ? "border-brand bg-brand-soft"
              : "border-line-2 bg-surface-2 hover:border-brand",
          )}
        >
          {opened ? (
            <span className="text-brand-ink text-[12px] font-semibold">
              TN ouvert au DJ : un nouvel import est répercuté dans son tournoi et lui est notifié.
            </span>
          ) : null}
          {regs.length > 0 ? (
            <FileText className="text-ok size-6" aria-hidden="true" />
          ) : (
            <Upload className="text-brand size-6" aria-hidden="true" />
          )}
          <span className="font-semibold">
            {regs.length > 0
              ? `${fileName} · ${plural(regs.length, "inscrit")} — déposer un nouveau fichier pour remplacer`
              : "Déposer le CSV des inscrits ici"}
          </span>
          <span className="text-ink-muted text-[12.5px]">ou cliquer pour le choisir</span>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Fichier CSV des inscrits"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void read(f);
              e.target.value = "";
            }}
          />
        </button>
      )}
    </Step>
  );
}

function OrderedStep({
  stage,
  acceptance,
  regs,
  priority,
  juniors,
  lock,
  opened,
  onJunior,
  onForfait,
  onIntegrate,
  onWaitStatus,
}: {
  stage: Stage;
  acceptance: Acceptance;
  regs: Registration[];
  priority: number;
  juniors: Set<string>;
  lock: string | null;
  opened: boolean;
  onJunior: (licence: string) => void;
  onForfait: (licence: string, forfait: boolean) => void;
  onIntegrate: (licence: string, integrated: boolean) => void;
  onWaitStatus: (licence: string, status: WaitStatus) => void;
}) {
  const { accepted, forfaits } = acceptance;
  const locked = Boolean(lock);
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? accepted : accepted.slice(0, 24);
  const integrated = new Set(acceptance.integrated);
  return (
    <Step
      n={2}
      title="Liste ordonnée des acceptés"
      done={accepted.length > 0}
      help="Place au classement glissant en cours ; sinon dernier classement connu (9 si ≤ 8, sinon P + 0,5) ; sinon nouveau joueur, dans l'ordre d'inscription (SPEC §2). Les 8 premiers sont préqualifiés Masters. Cocher U21 pour les juniors (le CSV ne le donne pas). Un forfait sort le joueur aussitôt et libère sa place : vous choisissez qui intégrer depuis la liste d'attente."
      aside={
        accepted.length > 0 ? (
          <>
            <Button
              size="sm"
              icon={Download}
              onClick={() =>
                downloadText(`liste-ordonnee-${stage.id}.csv`, acceptedListCsv(accepted, 8))
              }
            >
              CSV
            </Button>
            <Link to={`/responsable/imprimer/liste/${stage.id}?pdf=1`}>
              <Button size="sm" icon={FileDown}>
                PDF
              </Button>
            </Link>
            <Link to={`/responsable/imprimer/liste/${stage.id}`}>
              <Button size="sm" variant="primary" icon={Printer}>
                Imprimer
              </Button>
            </Link>
          </>
        ) : null
      }
    >
      {accepted.length === 0 && acceptance.waiting.length === 0 ? (
        <Empty icon={FileText}>Importez le CSV des inscrits pour obtenir la liste ordonnée.</Empty>
      ) : (
        <>
          {opened ? <AfterOpeningBanner stage={stage} lock={lock} /> : null}
          <Table head={["Rang", "Joueur", "Club", "Licence", "Place", "", "U21", ""]} dense>
            {list.map((p) => (
              <PlayerRow
                key={p.licence}
                p={p}
                junior={juniors.has(p.licence) || Boolean(p.junior)}
                integrated={integrated.has(p.licence)}
                locked={locked}
                onJunior={() => onJunior(p.licence)}
                action={
                  locked ? null : (
                    <span className="flex items-center justify-end gap-1">
                      {integrated.has(p.licence) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Undo2}
                          title="Remettre en liste d'attente"
                          aria-label={`Remettre ${nice(p.name)} en liste d'attente`}
                          onClick={() => onIntegrate(p.licence, false)}
                        />
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={UserX}
                        aria-label={`Forfait de ${nice(p.name)}`}
                        onClick={() => onForfait(p.licence, true)}
                      >
                        Forfait
                      </Button>
                    </span>
                  )
                }
              />
            ))}
          </Table>
          {accepted.length > 24 ? (
            <div className="mt-2 text-center">
              <Button size="sm" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Réduire" : `Afficher les ${accepted.length} acceptés`}
              </Button>
            </div>
          ) : null}
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <WaitingList
              acceptance={acceptance}
              regs={regs}
              priority={priority}
              locked={locked}
              onIntegrate={(l) => onIntegrate(l, true)}
              onWaitStatus={onWaitStatus}
            />
            <div>
              <div className="eyebrow mb-1.5">Forfaits avant tirage · {forfaits.length}</div>
              {forfaits.length === 0 ? (
                <p className="text-ink-muted text-[12.5px]">Aucun forfait déclaré.</p>
              ) : (
                <Table head={["Joueur", "Club", ""]} dense>
                  <AnimatePresence initial={false}>
                    {forfaits.map((p) => (
                      <motion.tr
                        key={p.licence}
                        layout
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="border-line text-ink-muted border-b last:border-b-0 [&>td]:px-3 [&>td]:py-1.5 [&>td:first-child]:pl-3.5"
                      >
                        <td className="font-semibold line-through">{nice(p.name)}</td>
                        <td>{clubShort(p.club)}</td>
                        <td className="text-right">
                          {locked ? null : (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={RotateCcw}
                              onClick={() => onForfait(p.licence, false)}
                            >
                              Annuler
                            </Button>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </Table>
              )}
            </div>
          </div>
          {opened && stage.tournamentId ? <RosterLog tournamentId={stage.tournamentId} /> : null}
        </>
      )}
    </Step>
  );
}

const WAIT_TONES: Record<WaitStatus, string> = {
  "a-contacter": "border-line bg-surface text-ink-secondary",
  confirme: "border-transparent bg-ok-soft text-ok-ink",
  indisponible: "border-transparent bg-alert-soft text-alert-ink",
};

/**
 * Liste d'attente : un bouton « Intégrer » par joueur, le prioritaire (SPEC §2 : 34 premiers du
 * classement, puis ordre d'inscription) signalé comme suggestion, suivi des appels par joueur.
 */
function WaitingList({
  acceptance,
  regs,
  priority,
  locked,
  onIntegrate,
  onWaitStatus,
}: {
  acceptance: Acceptance;
  regs: Registration[];
  priority: number;
  locked: boolean;
  onIntegrate: (licence: string) => void;
  onWaitStatus: (licence: string, status: WaitStatus) => void;
}) {
  const { waiting, free, suggested } = acceptance;
  const byLicence = new Map(regs.map((r) => [r.licence, r]));
  const top = new Set(acceptance.topRanked);
  const suggestedName = waiting.find((p) => p.licence === suggested)?.name;
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="eyebrow">Liste d'attente · {waiting.length}</span>
        <Chip tone={free > 0 && waiting.length > 0 ? "blue" : free < 0 ? "red" : "grey"}>
          {free < 0
            ? `Capacité dépassée de ${-free}`
            : free === 0
              ? "Aucune place libre"
              : `${free} place${free > 1 ? "s" : ""} ${waiting.length > 0 ? "libre" : "encore disponible"}${free > 1 ? "s" : ""}`}
        </Chip>
      </div>
      {free > 0 && waiting.length > 0 && !locked ? (
        <Banner icon={Sparkles} tone="blue" className="mt-0 mb-2">
          {free > 1 ? `${free} places libérées` : "Une place libérée"} : intégrez le joueur de votre
          choix.
          {suggestedName
            ? ` Suggestion selon la priorité (${priority} premiers du classement, puis ordre d'inscription) : ${nice(suggestedName)}.`
            : ""}
        </Banner>
      ) : null}
      {free < 0 && !locked ? (
        <Banner icon={UserX} tone="gold" className="mt-0 mb-2">
          Plus d'acceptés que de places : remettez en attente un joueur intégré (bouton{" "}
          <Undo2 className="inline size-3.5" aria-label="remettre en attente" />) ou déclarez un
          forfait.
        </Banner>
      ) : null}
      {waiting.length === 0 ? (
        <p className="text-ink-muted text-[12.5px]">Tous les inscrits sont acceptés.</p>
      ) : (
        <Table head={["#", "Joueur", "Club", "Priorité", "Suivi", ""]} dense>
          <AnimatePresence initial={false}>
            {waiting.map((p, i) => {
              const status = byLicence.get(p.licence)?.waitStatus ?? "a-contacter";
              const isSuggested = p.licence === suggested;
              return (
                <motion.tr
                  key={p.licence}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cx(
                    "border-line border-b last:border-b-0 [&>td]:px-3 [&>td]:py-1.5 [&>td]:align-middle [&>td:first-child]:pl-3.5",
                    isSuggested && free > 0 && "bg-brand-soft/60",
                    status === "indisponible" && "text-ink-muted",
                  )}
                >
                  <td>
                    <Num>{i + 1}</Num>
                  </td>
                  <td className="font-semibold">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {nice(p.name)}
                      {isSuggested ? (
                        <Chip tone="blue" icon={Sparkles} className="px-2 py-[2px] text-[11px]">
                          suggéré
                        </Chip>
                      ) : null}
                    </span>
                  </td>
                  <td className="text-ink-muted">{clubShort(p.club)}</td>
                  <td className="text-ink-muted whitespace-nowrap">
                    {top.has(p.licence) ? (
                      <span className="text-gold-ink font-semibold">
                        top {priority} · place <Num>{p.place}</Num>
                      </span>
                    ) : (
                      <>
                        inscription n° <Num>{byLicence.get(p.licence)?.order ?? "–"}</Num>
                      </>
                    )}
                  </td>
                  <td>
                    <select
                      value={status}
                      onChange={(e) => onWaitStatus(p.licence, e.target.value as WaitStatus)}
                      aria-label={`Suivi de ${nice(p.name)}`}
                      className={cx(
                        "rounded-full border px-2 py-[3px] text-[11.5px] font-semibold",
                        WAIT_TONES[status],
                      )}
                    >
                      {(Object.keys(WAIT_STATUS_LABELS) as WaitStatus[]).map((k) => (
                        <option key={k} value={k}>
                          {WAIT_STATUS_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="text-right">
                    {locked ? null : (
                      <Button
                        size="sm"
                        variant={isSuggested && free > 0 ? "primary" : "default"}
                        icon={UserPlus}
                        disabled={free <= 0}
                        title={
                          free <= 0 ? "Aucune place libre : déclarez d'abord un forfait" : undefined
                        }
                        aria-label={`Intégrer ${nice(p.name)}`}
                        onClick={() => onIntegrate(p.licence)}
                      >
                        Intégrer
                      </Button>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </Table>
      )}
    </div>
  );
}

/** Rappel des règles après l'ouverture au DJ : date limite, tirage, répercussion. */
function AfterOpeningBanner({ stage, lock }: { stage: Stage; lock: string | null }) {
  if (lock) {
    return (
      <Banner icon={Lock} tone="gold" className="mt-0 mb-3">
        {lock}
      </Banner>
    );
  }
  const wednesday = stage.start ? wednesdayBefore(stage.start) : null;
  const late = wednesday !== null && new Date().toISOString().slice(0, 10) > wednesday;
  return (
    <Banner icon={Radio} tone={late ? "gold" : "blue"} className="mt-0 mb-3">
      TN ouvert au DJ : chaque forfait, intégration depuis la liste d'attente ou drapeau U21 est
      répercuté dans son tournoi et lui est notifié.{" "}
      {stage.start
        ? late
          ? `Mercredi (${deadlineLabel(stage.start)}) passé : encore possible jusqu'au tirage des poules du vendredi.`
          : `Jusqu'au ${deadlineLabel(stage.start)}, et en pratique jusqu'au tirage des poules.`
        : ""}
    </Banner>
  );
}

/** Journal des modifications notifiées au DJ (lues ou non), et mention de l'app 5 Quilles. */
function RosterLog({ tournamentId }: { tournamentId: string }) {
  const { notifications } = useNotifications(tournamentId);
  const list = notifications.filter((n) => n.kind === "forfait" || n.kind === "inscription");
  return (
    <div className="mt-4">
      <div className="eyebrow mb-1.5 flex items-center gap-1.5">
        <BellRing className="size-3.5" aria-hidden="true" />
        Modifications notifiées au directeur de jeu · {list.length}
      </div>
      {list.length === 0 ? (
        <p className="text-ink-muted text-[12.5px]">
          Aucune modification depuis l'ouverture. Chaque changement apparaîtra ici, avec son impact
          et son état de lecture par le DJ.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {list.map((n) => (
              <motion.li
                key={n.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-line flex flex-wrap items-start gap-3 rounded-[12px] border px-3 py-2.5"
              >
                <span
                  className={cx(
                    "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
                    n.kind === "forfait"
                      ? "bg-alert-soft text-alert-ink"
                      : "bg-ok-soft text-ok-ink",
                  )}
                >
                  {n.kind === "forfait" ? (
                    <UserX className="size-3.5" aria-hidden="true" />
                  ) : (
                    <UserPlus className="size-3.5" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold">{n.title}</div>
                  {n.impact ? <div className="text-[12.5px]">{n.impact}</div> : null}
                  <div className="text-ink-muted mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px]">
                    <span>{frDateTime(n.at)}</span>
                    <span className={n.read ? "text-ok-ink font-semibold" : ""}>
                      {n.read ? "Lue par le DJ" : "Notifiée au DJ · non lue"}
                    </span>
                    <span>Application 5 Quilles : à venir avec le serveur</span>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
}

function PlayerRow({
  p,
  junior,
  integrated,
  locked,
  onJunior,
  action,
}: {
  p: Player;
  junior: boolean;
  integrated: boolean;
  locked: boolean;
  onJunior: () => void;
  action: ReactNode;
}) {
  const master = p.seed <= 8;
  return (
    <Row className={master ? "bg-gold-soft/50" : undefined}>
      <td>
        <Num className={cx("font-bold", master && "text-gold-ink")}>{p.seed}</Num>
      </td>
      <td>
        <span className="flex items-center gap-2">
          <Avatar name={p.name} size="xs" crown={master} />
          <span className="font-semibold">{nice(p.name)}</span>
        </span>
      </td>
      <td className="text-ink-muted">{clubShort(p.club)}</td>
      <td>
        <Num>{p.licence}</Num>
      </td>
      <td>
        <Num>{p.place === null ? "nouveau" : String(p.place).replace(".", ",")}</Num>
      </td>
      <td>
        <span className="flex flex-wrap gap-1">
          {master ? (
            <Chip tone="gold" icon={Crown}>
              Masters
            </Chip>
          ) : null}
          {integrated ? (
            <Chip tone="blue" icon={UserPlus}>
              intégré
            </Chip>
          ) : null}
        </span>
      </td>
      <td>
        <input
          type="checkbox"
          checked={junior}
          disabled={locked}
          onChange={onJunior}
          aria-label={`${nice(p.name)} junior U21`}
        />
      </td>
      <td>{action}</td>
    </Row>
  );
}

function ConvocationsStep({
  stage,
  accepted,
  waiting,
  placement,
}: {
  stage: Stage;
  accepted: Player[];
  waiting: Player[];
  placement: Placement;
}) {
  const doc = useSeasonDoc();
  const toast = useToast();
  const [tab, setTab] = useState<"joueurs" | "club" | "dj">("joueurs");
  const [index, setIndex] = useState(0);
  const djRecord = doc.players.find((p) => p.licence === stage.djLicence);
  const djName = stage.dj?.name || djRecord?.name || "";
  const djEmail = stage.dj?.email || djRecord?.email || "";
  const players = useMemo(
    () => playerConvocations(doc, stage, accepted, placement),
    [doc, stage, accepted, placement],
  );
  const club = clubConvocation(doc, stage, accepted, djName ? nice(djName) : "");
  const appUrl = djLoginLink(window.location.origin, import.meta.env.BASE_URL, djEmail);
  const dj = djConvocation(
    stage,
    { name: djName || "DIRECTEUR DE JEU", email: djEmail },
    appUrl,
    accepted.length,
  );
  // Les convocations des joueurs partent avec le club hôte et le DJ en copie.
  const cc = recipients([club.to, djEmail]);
  const current: Convocation | undefined =
    tab === "joueurs" ? players[index] : tab === "club" ? club : dj;
  const copy = async (text: string, what: string) =>
    toast((await copyText(text)) ? `${what} copié` : "Copie impossible dans ce navigateur");
  const copyBody = async (text: string) => {
    const done = await copyMail(text);
    toast(
      done === "html"
        ? "Email copié (mise en forme conservée au collage)"
        : done === "text"
          ? "Texte copié (texte brut)"
          : "Copie impossible dans ce navigateur",
    );
  };
  return (
    <Step
      n={3}
      title="Convocations"
      done={false}
      help="Les mails sont prêts à copier (mise en forme conservée) ou à exporter, avec leurs pièces jointes à télécharger : l'envoi direct arrivera avec le serveur. Horaires et canevas : ceux de la saison (Paramètres), ou ceux propres à ce TN (étape 4)."
      aside={
        <>
          {(["joueurs", "club", "dj"] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? "primary" : "default"}
              onClick={() => setTab(t)}
            >
              {t === "joueurs"
                ? `Joueurs (${players.length})`
                : t === "club"
                  ? "Club hôte"
                  : "Directeur de jeu"}
            </Button>
          ))}
        </>
      }
    >
      {accepted.length === 0 ? (
        <Empty icon={Mail}>Les convocations apparaîtront avec la liste ordonnée.</Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
          {tab === "joueurs" ? (
            <div className="border-line max-h-[360px] overflow-auto rounded-[12px] border">
              {players.map((c, i) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={cx(
                    "border-line flex w-full items-center gap-2 border-b px-3 py-1.5 text-left text-[12.5px] last:border-b-0",
                    i === index ? "bg-brand-soft" : "hover:bg-surface-2",
                  )}
                >
                  <Avatar name={c.name} size="xs" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{nice(c.name)}</span>
                  {c.to ? (
                    <Mail className="text-ok size-3.5" aria-label="email connu" />
                  ) : (
                    <span className="text-ink-muted text-[11px]">sans email</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-ink-muted text-[12.5px]">
              <Field label="Destinataire">
                <Input value={current?.to || "email à compléter"} readOnly />
              </Field>
            </div>
          )}
          {current ? (
            <div className="min-w-0">
              <div className="text-[13px]">
                <b>À :</b> {current.to || <span className="text-alert-ink">email inconnu</span>} ·{" "}
                <b>Objet :</b> {current.subject}
              </div>
              {tab === "joueurs" ? (
                <div className="text-ink-muted mt-0.5 text-[12.5px]">
                  <b className="text-ink">Copie :</b>{" "}
                  {cc.length > 0 ? cc.join(", ") : "club hôte et DJ (emails à compléter)"}
                </div>
              ) : null}
              <MailBody text={current.body} className="mt-2 max-h-[300px] overflow-auto" />
              <AttachmentsBar doc={doc} stage={stage} accepted={accepted} waiting={waiting} />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  icon={Copy}
                  onClick={() => void copyBody(current.body)}
                >
                  Copier l'email
                </Button>
                {tab === "joueurs" ? (
                  <>
                    <Button
                      size="sm"
                      icon={Copy}
                      onClick={() => void copy(recipientList(players), "Destinataires")}
                    >
                      Copier les destinataires ({players.filter((p) => p.to).length})
                    </Button>
                    <Button
                      size="sm"
                      icon={Copy}
                      disabled={cc.length === 0}
                      onClick={() => void copy(cc.join("; "), "Copie club et DJ")}
                    >
                      Copier la copie (club + DJ)
                    </Button>
                    <Button
                      size="sm"
                      icon={Download}
                      onClick={() =>
                        downloadText(`convocations-${stage.id}.csv`, convocationsCsv(players))
                      }
                    >
                      Export CSV
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Step>
  );
}

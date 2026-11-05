/**
 * Page d'une étape, dans l'ordre du travail du responsable : inscriptions (CSV), liste ordonnée
 * avec U21 et forfaits, liste d'attente, convocations, ouverture pour le directeur de jeu.
 */
import {
  acceptedListCsv,
  parseInscritsCsv,
  type Player,
  type Registration,
  type Stage,
} from "@pilot5q/domain";
import {
  ArrowRight,
  Check,
  Copy,
  Crown,
  Download,
  FileText,
  Mail,
  Printer,
  RotateCcw,
  Rocket,
  Upload,
  UserX,
} from "lucide-react";
import { useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";

import { useToast } from "@/components/Toast";
import { Avatar, Banner, Button, Card, Chip, PageHead, Tile, cx } from "@/components/ui";
import { clubShort, dateRange, nice, plural } from "@/lib/format";
import { useTournament } from "@/store/tournament";

import { ClosureSection } from "./Closure";
import {
  clubConvocation,
  convocationsCsv,
  djConvocation,
  playerConvocations,
  recipientList,
  type Convocation,
} from "./convocations";
import { StageStatusChip } from "./Dashboard";
import { useSeason, useSeasonDoc } from "./store";
import { openingEvents, stageAcceptance, stageCapacity } from "./stage";
import { Empty, Field, Input, Num, Row, Table, copyText, downloadText, frDateTime } from "./ui";

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
  const toast = useToast();
  const navigate = useNavigate();
  const cockpit = useTournament();
  const club = doc.clubs.find((c) => c.id === stage.clubId);
  const now = new Date().toISOString();
  const regsDoc = doc.registrations[stage.id];
  const regs = regsDoc?.registrations ?? [];
  const juniors = useMemo(() => new Set(doc.juniors), [doc.juniors]);
  const acceptance = useMemo(() => stageAcceptance(doc, stage), [doc, stage]);
  const capacity = stageCapacity(doc, stage);
  const opened = Boolean(stage.openedAt);
  const closed = Boolean(stage.closedAt);

  const setRegs = (fn: (r: Registration[]) => Registration[]) =>
    update((d) => {
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
          [stage.id]: { ...cur, registrations: fn(cur.registrations) },
        },
      };
    });
  const toggleJunior = (licence: string) =>
    update((d) => ({
      ...d,
      juniors: d.juniors.includes(licence)
        ? d.juniors.filter((l) => l !== licence)
        : [...d.juniors, licence],
    }));
  const setForfait = (licence: string, forfait: boolean) =>
    setRegs((rs) => rs.map((r) => (r.licence === licence ? { ...r, forfait } : r)));

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
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
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
        <ImportStep stage={stage} regs={regs} fileName={regsDoc?.fileName ?? ""} locked={opened} />
        <OrderedStep
          stage={stage}
          accepted={acceptance.accepted}
          waiting={acceptance.waiting}
          forfaits={acceptance.forfaits}
          juniors={juniors}
          locked={opened}
          onJunior={toggleJunior}
          onForfait={setForfait}
        />
        <ConvocationsStep stage={stage} accepted={acceptance.accepted} />
        <Step
          n={5}
          title="Ouverture du tournoi pour le club hôte"
          done={opened}
          help="Désigne le directeur de jeu (licence) et crée le tournoi dans le cockpit avec les billards du club, les paramètres de la saison et la liste ordonnée. Les droits du DJ valent jusqu'à la clôture."
        >
          <OpenForDj
            stage={stage}
            accepted={acceptance.accepted}
            onOpen={(dj) => {
              if (acceptance.accepted.length < 16) {
                toast("Il faut au moins 16 joueurs acceptés");
                return;
              }
              if (stage.big + stage.small < doc.settings.minTables || !stage.start) {
                toast("Billards et dates de l'étape à compléter dans le calendrier");
                return;
              }
              const id = `${stage.id}-${Date.now().toString(36)}`;
              cockpit.open(id, openingEvents(doc, stage, acceptance.accepted));
              update((d) => ({
                ...d,
                stages: d.stages.map((s) =>
                  s.id === stage.id
                    ? { ...s, djLicence: dj, tournamentId: id, openedAt: new Date().toISOString() }
                    : s,
                ),
              }));
              toast("Tournoi ouvert pour le directeur de jeu");
            }}
            onGoto={() => navigate("/tournoi")}
            onReset={() => {
              if (
                !window.confirm(
                  "Retirer l'ouverture ? Le tournoi reste dans le cockpit, mais l'étape revient à la préparation.",
                )
              )
                return;
              update((d) => ({
                ...d,
                stages: d.stages.map((s) =>
                  s.id === stage.id ? { ...s, tournamentId: null, openedAt: null } : s,
                ),
              }));
            }}
            closed={closed}
          />
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
  locked,
}: {
  stage: Stage;
  regs: Registration[];
  fileName: string;
  locked: boolean;
}) {
  const { update } = useSeason();
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
      update((d) => {
        const previous = new Map(
          (d.registrations[stage.id]?.registrations ?? []).map((r) => [r.licence, r]),
        );
        const registrations: Registration[] = players.map((p) => ({
          licence: p.licence,
          name: p.name,
          club: p.club,
          email: p.email ?? "",
          order: p.seed,
          registeredAt: previous.get(p.licence)?.registeredAt ?? "",
          junior: previous.get(p.licence)?.junior ?? false,
          forfait: previous.get(p.licence)?.forfait ?? false,
        }));
        return {
          ...d,
          registrations: {
            ...d.registrations,
            [stage.id]: {
              stageId: stage.id,
              importedAt: new Date().toISOString(),
              fileName: file.name,
              registrations,
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
      help="Séparateur « ; », colonnes du site fédéral. Les inscriptions annulées ou forfait sur le site sont ignorées ; l'ordre d'inscription vient de l'horodatage. Un nouvel import conserve les drapeaux U21 et les forfaits saisis ici."
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
      {locked ? (
        <Banner icon={Check} tone="blue" className="mt-0">
          Tournoi ouvert : {plural(regs.length, "inscrit")} ({fileName}). Les changements passent
          désormais par le directeur de jeu.
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
  accepted,
  waiting,
  forfaits,
  juniors,
  locked,
  onJunior,
  onForfait,
}: {
  stage: Stage;
  accepted: Player[];
  waiting: Player[];
  forfaits: Player[];
  juniors: Set<string>;
  locked: boolean;
  onJunior: (licence: string) => void;
  onForfait: (licence: string, forfait: boolean) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? accepted : accepted.slice(0, 24);
  return (
    <Step
      n={2}
      title="Liste ordonnée des acceptés"
      done={accepted.length > 0}
      help="Place au classement glissant en cours ; sinon dernier classement connu (9 si ≤ 8, sinon P + 0,5) ; sinon nouveau joueur, dans l'ordre d'inscription (SPEC §2). Les 8 premiers sont préqualifiés Masters. Cocher U21 pour les juniors (le CSV ne le donne pas). Un forfait avant le tirage fait entrer le premier de la liste d'attente."
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
            <Link to={`/responsable/imprimer/liste/${stage.id}`}>
              <Button size="sm" variant="primary" icon={Printer}>
                Imprimer
              </Button>
            </Link>
          </>
        ) : null
      }
    >
      {accepted.length === 0 ? (
        <Empty icon={FileText}>Importez le CSV des inscrits pour obtenir la liste ordonnée.</Empty>
      ) : (
        <>
          <Table head={["Rang", "Joueur", "Club", "Licence", "Place", "", "U21", ""]} dense>
            {list.map((p) => (
              <PlayerRow
                key={p.licence}
                p={p}
                junior={juniors.has(p.licence) || Boolean(p.junior)}
                locked={locked}
                onJunior={() => onJunior(p.licence)}
                action={
                  locked ? null : (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={UserX}
                      onClick={() => onForfait(p.licence, true)}
                    >
                      Forfait
                    </Button>
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
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="eyebrow mb-1.5">Liste d'attente · {waiting.length}</div>
              {waiting.length === 0 ? (
                <p className="text-ink-muted text-[12.5px]">Tous les inscrits sont acceptés.</p>
              ) : (
                <Table head={["#", "Joueur", "Club", "Place"]} dense>
                  {waiting.map((p, i) => (
                    <Row key={p.licence}>
                      <td>
                        <Num>{i + 1}</Num>
                      </td>
                      <td className="font-semibold">{nice(p.name)}</td>
                      <td className="text-ink-muted">{clubShort(p.club)}</td>
                      <td>
                        <Num>{p.place ?? "nouveau"}</Num>
                      </td>
                    </Row>
                  ))}
                </Table>
              )}
            </div>
            <div>
              <div className="eyebrow mb-1.5">Forfaits avant tirage · {forfaits.length}</div>
              {forfaits.length === 0 ? (
                <p className="text-ink-muted text-[12.5px]">Aucun forfait déclaré.</p>
              ) : (
                <Table head={["Joueur", "Club", ""]} dense>
                  {forfaits.map((p) => (
                    <Row key={p.licence} muted>
                      <td className="font-semibold line-through">{nice(p.name)}</td>
                      <td>{clubShort(p.club)}</td>
                      <td>
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
                    </Row>
                  ))}
                </Table>
              )}
            </div>
          </div>
        </>
      )}
    </Step>
  );
}

function PlayerRow({
  p,
  junior,
  locked,
  onJunior,
  action,
}: {
  p: Player;
  junior: boolean;
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
        {master ? (
          <Chip tone="gold" icon={Crown}>
            Masters
          </Chip>
        ) : null}
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

function ConvocationsStep({ stage, accepted }: { stage: Stage; accepted: Player[] }) {
  const doc = useSeasonDoc();
  const toast = useToast();
  const [tab, setTab] = useState<"joueurs" | "club" | "dj">("joueurs");
  const [index, setIndex] = useState(0);
  const djRecord = doc.players.find((p) => p.licence === stage.djLicence);
  const players = useMemo(() => playerConvocations(doc, stage, accepted), [doc, stage, accepted]);
  const club = clubConvocation(doc, stage, accepted, djRecord ? nice(djRecord.name) : "");
  const appUrl = `${window.location.origin}${import.meta.env.BASE_URL}tournoi`;
  const dj = djConvocation(
    stage,
    { name: djRecord?.name ?? "DIRECTEUR DE JEU", email: djRecord?.email ?? "" },
    appUrl,
    accepted.length,
  );
  const current: Convocation | undefined =
    tab === "joueurs" ? players[index] : tab === "club" ? club : dj;
  const copy = async (text: string, what: string) =>
    toast((await copyText(text)) ? `${what} copié` : "Copie impossible dans ce navigateur");
  return (
    <Step
      n={3}
      title="Convocations"
      done={false}
      help="Les mails sont prêts à copier ou à exporter : l'envoi direct arrivera avec le serveur. Le canevas et les horaires se règlent dans Paramètres."
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
              <pre className="bg-surface-2 border-line mt-2 max-h-[300px] overflow-auto rounded-[10px] border px-3 py-2 font-sans text-[12.5px] whitespace-pre-wrap">
                {current.body}
              </pre>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  icon={Copy}
                  onClick={() => void copy(current.body, "Texte")}
                >
                  Copier le texte
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

function OpenForDj({
  stage,
  accepted,
  onOpen,
  onGoto,
  onReset,
  closed,
}: {
  stage: Stage;
  accepted: Player[];
  onOpen: (dj: string) => void;
  onGoto: () => void;
  onReset: () => void;
  closed: boolean;
}) {
  const doc = useSeasonDoc();
  const cockpit = useTournament();
  const [licence, setLicence] = useState(stage.djLicence ?? "");
  const found = doc.players.find((p) => p.licence === licence.trim().toUpperCase());
  if (stage.openedAt) {
    const current = cockpit.id === stage.tournamentId;
    return (
      <Banner
        icon={Rocket}
        tone={closed ? "green" : "blue"}
        className="mt-0"
        actions={
          closed ? null : (
            <>
              {current ? (
                <Button variant="primary" iconRight={ArrowRight} onClick={onGoto}>
                  Ouvrir le cockpit
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={onReset}>
                Retirer l'ouverture
              </Button>
            </>
          )
        }
      >
        Ouvert le {frDateTime(stage.openedAt)} · directeur de jeu{" "}
        {found ? nice(found.name) : stage.djLicence || "non désigné"} ·{" "}
        {closed ? "droits expirés (tournoi clôturé)" : "droits actifs jusqu'à la clôture"}
        {!current && !closed ? " · le cockpit de ce navigateur affiche un autre tournoi" : ""}
      </Banner>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field
        label="Licence du directeur de jeu"
        hint={
          found
            ? `${nice(found.name)} · ${clubShort(found.club)}`
            : licence
              ? "Licence inconnue de la base joueurs"
              : "Le DJ peut ne pas être joueur"
        }
        className="w-[260px]"
      >
        <Input value={licence} onChange={(e) => setLicence(e.target.value)} placeholder="123456A" />
      </Field>
      <Button
        variant="primary"
        size="lg"
        icon={Rocket}
        disabled={accepted.length === 0}
        onClick={() => onOpen(licence.trim().toUpperCase())}
      >
        Ouvrir le tournoi ({accepted.length} joueurs)
      </Button>
      {cockpit.id && cockpit.state.info ? (
        <p className="text-ink-muted text-[12px]">
          Le cockpit de ce navigateur affiche « {cockpit.state.info.name} ·{" "}
          {cockpit.state.info.city} » : il restera enregistré, le nouveau tournoi devient le tournoi
          courant.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Clôture d'une étape : lecture du tournoi joué dans le cockpit, points du barème (corrigeables),
 * intégration au classement glissant, mise à jour de la base joueurs, documents et mail au
 * secrétariat. La clôture peut être annulée pour corriger.
 */
import {
  rankingRows,
  replay,
  type Stage,
  type TournamentAward,
  type TournamentEvent,
} from "@pilot5q/domain";
import {
  Check,
  Copy,
  FileText,
  Lock,
  Play,
  Printer,
  RotateCcw,
  Trophy,
  Waypoints,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAuth } from "@/auth/context";
import { useToast } from "@/components/Toast";
import { Avatar, Banner, Button, Card, Chip, cx } from "@/components/ui";
import { clubShort, dateRange, nice } from "@/lib/format";
import { addNotification } from "@/lib/notifications";
import { loadEvents } from "@/store/persistence";
import { useTournament } from "@/store/tournament";

import { isAfterReference } from "./reference";
import { isExampleTournament, realWeekendEvents } from "./realWeekend";
import { useSeason, useSeasonDoc } from "./store";
import { closeStage, reopenStage, tournamentAwards, tournamentFinished } from "./stage";
import { Empty, Num, Row, Table, copyText, dec, frDateTime } from "./ui";

const ORIGIN = { M: "Masters", N: "National", CLS: "Consolante", PREQ: "Vendredi" } as const;

/** Journal du tournoi de l'étape : celui du cockpit s'il est ouvert, sinon celui enregistré. */
export function useStageEvents(stage: Stage): {
  events: TournamentEvent[] | null;
  current: boolean;
} {
  const cockpit = useTournament();
  const current = Boolean(stage.tournamentId) && cockpit.id === stage.tournamentId;
  const [stored, setStored] = useState<TournamentEvent[] | null>(null);
  useEffect(() => {
    if (current || !stage.tournamentId) return;
    let cancelled = false;
    void loadEvents(stage.tournamentId).then((evs) => {
      if (!cancelled) setStored(evs.length > 0 ? evs : null);
    });
    return () => {
      cancelled = true;
    };
  }, [current, stage.tournamentId]);
  return { events: current ? cockpit.events : stored, current };
}

export function ClosureSection({ stage }: { stage: Stage }) {
  const doc = useSeasonDoc();
  const { update } = useSeason();
  const cockpit = useTournament();
  const { provider } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { events, current } = useStageEvents(stage);
  const state = useMemo(() => (events ? replay(events) : null), [events]);
  const finished = state ? tournamentFinished(state) : false;
  const computed = useMemo(
    () => (state && finished ? tournamentAwards(state) : []),
    [state, finished],
  );
  const [edits, setEdits] = useState<Record<string, { points?: number; decimal?: number }>>({});
  const closure = doc.closures[stage.id];
  const awards: TournamentAward[] = closure
    ? closure.awards
    : computed.map((a) => ({ ...a, ...edits[a.name] }));
  const corrected = Object.keys(edits).length;
  const opened = Boolean(stage.openedAt);
  const closed = Boolean(closure);

  const playReal = () => {
    if (!events || !state) return;
    try {
      const more = realWeekendEvents(events);
      if (!current && stage.tournamentId) {
        cockpit.open(
          stage.tournamentId,
          events.map(({ at: _at, ...e }) => e as never),
        );
      }
      cockpit.dispatchMany(more);
      toast(`${more.length} scores et clôtures de phase saisis dans le cockpit`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Rejeu impossible");
    }
  };

  const validate = () => {
    if (
      !window.confirm(
        `Clôturer ${stage.name} et intégrer les points de ${awards.length} joueurs au classement glissant ?`,
      )
    )
      return;
    const now = new Date().toISOString();
    update((d) => closeStage(d, stage, awards, d.juniors, now));
    // Les droits du directeur de jeu passent en lecture seule.
    void provider.setStageClosed(stage.id, now);
    if (stage.tournamentId) {
      void addNotification({
        tournamentId: stage.tournamentId,
        kind: "info",
        title: "Tournoi clôturé par le responsable national",
        body: "Points attribués et classement glissant à jour. Le tournoi reste consultable en lecture seule.",
      });
    }
    setEdits({});
    toast("Tournoi clôturé : classement glissant et base joueurs à jour");
  };

  const reopen = () => {
    if (
      !window.confirm(
        "Annuler la clôture ? Le classement glissant et la base joueurs reviennent à leur état d'avant ce TN.",
      )
    )
      return;
    update((d) => reopenStage(d, stage));
    void provider.setStageClosed(stage.id, null);
    toast("Clôture annulée : corrigez puis clôturez de nouveau");
  };

  const rows = useMemo(() => rankingRows(doc.ranking), [doc.ranking]);
  const reference = closed && isAfterReference(rows);
  const mail = secretariatMail(doc.id, stage, awards, rows.length);

  return (
    <Card
      className="animate-fade-up"
      title={
        <span className="flex items-center gap-2.5">
          <span
            className={cx(
              "grid size-7 place-items-center rounded-full font-mono text-[12px] font-bold text-white",
              closed ? "bg-ok" : "bg-brand",
            )}
          >
            {closed ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : 6}
          </span>
          Clôture, points et classement glissant
        </span>
      }
      aside={
        closed ? (
          <Chip tone="green" icon={Lock}>
            Clôturé le {frDateTime(closure?.closedAt)}
          </Chip>
        ) : null
      }
      bodyClassName="px-4 pb-4"
    >
      <p className="text-ink-muted -mt-1 mb-3 max-w-[80ch] text-[12.5px]">
        Les points viennent du classement final du tournoi joué dans le cockpit (barème réforme
        2026-2027 et décimale points de set / matchs / 100). Ils peuvent être corrigés avant
        validation ; la clôture met à jour le classement glissant (4 meilleurs sur 5 TN) et la base
        joueurs, et peut être annulée.
      </p>
      {!opened ? (
        <Empty icon={Lock}>
          La clôture sera possible une fois le tournoi ouvert au directeur de jeu et joué.
        </Empty>
      ) : !state && !closed ? (
        <Empty icon={FileText}>Journal du tournoi introuvable dans ce navigateur.</Empty>
      ) : !finished && !closed ? (
        <Banner
          icon={Play}
          tone="blue"
          className="mt-0"
          actions={
            state && isExampleTournament(state) ? (
              <Button variant="primary" icon={Play} onClick={playReal}>
                Jouer le week-end avec les scores réels
              </Button>
            ) : current ? (
              <Button variant="primary" onClick={() => navigate("/tournoi")}>
                Ouvrir le cockpit
              </Button>
            ) : null
          }
        >
          Tournoi en cours chez le directeur de jeu : la clôture sera possible après les finales
          Masters et National.
          {state && isExampleTournament(state)
            ? " Démonstration : les scores réels du TN 2 peuvent être saisis d'un coup."
            : ""}
        </Banner>
      ) : (
        <>
          {closed ? (
            <Banner
              icon={Trophy}
              tone="green"
              className="mt-0 mb-3"
              actions={
                <>
                  <Link to="/responsable/classement">
                    <Button variant="primary" icon={Trophy}>
                      Classement glissant
                    </Button>
                  </Link>
                  <Button variant="ghost" icon={RotateCcw} onClick={reopen}>
                    Annuler la clôture
                  </Button>
                </>
              }
            >
              {awards.length} joueurs intégrés · {closure?.rankedAfter} classés au classement
              glissant.
              {reference
                ? " Le classement glissant est désormais celui « après TN 2 2026-2027 » du classeur de référence."
                : ""}
            </Banner>
          ) : (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Chip tone="green" icon={Check}>
                Tournoi terminé
              </Chip>
              <Chip tone="blue">{awards.length} joueurs classés</Chip>
              {corrected > 0 ? <Chip tone="gold">{corrected} correction(s)</Chip> : null}
              <span className="flex-1" />
              {corrected > 0 ? (
                <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setEdits({})}>
                  Annuler les corrections
                </Button>
              ) : null}
              <Button variant="primary" size="lg" icon={Lock} onClick={validate}>
                Clôturer et attribuer les points
              </Button>
            </div>
          )}
          <AwardsTable
            awards={awards}
            editable={!closed}
            onEdit={(name, patch) => setEdits((e) => ({ ...e, [name]: { ...e[name], ...patch } }))}
          />
          {closed ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="flex flex-col gap-2">
                <div className="eyebrow">Documents</div>
                <Link to="/responsable/imprimer/classement">
                  <Button icon={Printer} className="w-full justify-start">
                    Classement glissant (A4, enregistrer en PDF)
                  </Button>
                </Link>
                <Link to={`/responsable/imprimer/points/${stage.id}`}>
                  <Button icon={Printer} className="w-full justify-start">
                    Classement final du TN et points attribués
                  </Button>
                </Link>
                <Button
                  icon={Waypoints}
                  className="w-full justify-start"
                  disabled={!current}
                  title={
                    current ? undefined : "Le cockpit de ce navigateur affiche un autre tournoi"
                  }
                  onClick={() => navigate("/tournoi/schema")}
                >
                  Schéma du TN
                </Button>
              </div>
              <div className="min-w-0">
                <div className="eyebrow mb-1">Mail au secrétariat</div>
                <pre className="bg-surface-2 border-line max-h-[220px] overflow-auto rounded-[10px] border px-3 py-2 font-sans text-[12.5px] whitespace-pre-wrap">
                  {mail}
                </pre>
                <Button
                  size="sm"
                  variant="primary"
                  icon={Copy}
                  className="mt-2"
                  onClick={async () =>
                    toast(
                      (await copyText(mail))
                        ? "Texte copié"
                        : "Copie impossible dans ce navigateur",
                    )
                  }
                >
                  Copier le texte
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

function AwardsTable({
  awards,
  editable,
  onEdit,
}: {
  awards: TournamentAward[];
  editable: boolean;
  onEdit: (name: string, patch: { points?: number; decimal?: number }) => void;
}) {
  const [all, setAll] = useState(false);
  const list = all ? awards : awards.slice(0, 20);
  return (
    <>
      <Table head={["Place", "Joueur", "Club", "Tableau", "Barème", "Décimale", "Total"]} dense>
        {list.map((a, i) => (
          <Row key={a.name} muted={a.abandon}>
            <td>
              <Num className={cx("font-bold", i < 8 && "text-gold-ink")}>{i + 1}</Num>
            </td>
            <td>
              <span className="flex items-center gap-2">
                <Avatar name={a.name} size="xs" crown={i === 0} />
                <span className="font-semibold">{nice(a.name)}</span>
              </span>
            </td>
            <td className="text-ink-muted">{clubShort(a.club)}</td>
            <td>{a.abandon ? <Chip tone="red">Abandon</Chip> : ORIGIN[a.origin]}</td>
            <td>
              {editable ? (
                <input
                  type="number"
                  min={0}
                  className="field w-16 py-0.5 font-mono"
                  value={a.points}
                  aria-label={`${nice(a.name)} : points du barème`}
                  onChange={(e) => onEdit(a.name, { points: Number(e.target.value) })}
                />
              ) : (
                <Num>{a.points}</Num>
              )}
            </td>
            <td>
              {editable ? (
                <input
                  type="number"
                  min={0}
                  step={0.0001}
                  className="field w-24 py-0.5 font-mono"
                  value={Number(a.decimal.toFixed(6))}
                  aria-label={`${nice(a.name)} : décimale`}
                  onChange={(e) => onEdit(a.name, { decimal: Number(e.target.value) })}
                />
              ) : (
                <Num>{dec(a.decimal, 4)}</Num>
              )}
            </td>
            <td>
              <Num className="font-bold">{dec(a.abandon ? 0 : a.points + a.decimal, 4)}</Num>
            </td>
          </Row>
        ))}
      </Table>
      {awards.length > 20 ? (
        <div className="mt-2 text-center">
          <Button size="sm" onClick={() => setAll(!all)}>
            {all ? "Réduire" : `Afficher les ${awards.length} joueurs`}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function secretariatMail(
  season: string,
  stage: Stage,
  awards: TournamentAward[],
  ranked: number,
): string {
  const top = (origin: TournamentAward["origin"]) =>
    awards
      .filter((a) => a.origin === origin && !a.abandon)
      .slice(0, 2)
      .map((a) => nice(a.name))
      .join(", ");
  return `Bonjour,

Le ${stage.name} ${season} de billard 5-Quilles (${stage.city}${stage.start ? `, ${dateRange(stage.start, stage.end)}` : ""}) est clôturé.

Participants : ${awards.length} (abandons : ${awards.filter((a) => a.abandon).length}).
Masters : ${top("M") || "–"}.
National : ${top("N") || "–"}.
Le classement glissant mis à jour compte ${ranked} joueurs.

Pièces jointes : classement final du tournoi avec les points attribués, classement glissant, schéma du tournoi.

Sportivement,
Le responsable national 5-Quilles`;
}

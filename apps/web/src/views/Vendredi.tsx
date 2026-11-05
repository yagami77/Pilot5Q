/** Vendredi : saisie des préqualifications, classement de phase, barrages, qualifiés. */
import type { Match } from "@pilot5q/domain";
import { ArrowRight, Check, Printer, RotateCcw, Trophy, UserX, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useProgressiveFill } from "@/lib/fill";
import { useNavigate } from "react-router";

import { DayTasks } from "@/components/DayTasks";
import { PouleCard } from "@/components/PouleCard";
import { LateForfaits } from "@/dj/LateForfaits";
import { preqStarted } from "@/lib/forfaits";
import { PouleDrawer } from "@/components/PouleDrawer";
import { PrintCenter } from "@/components/PrintCenter";
import { ScoreEditor, draftOf, scoreOf, type ScoreDraft } from "@/components/ScoreEditor";
import { useToast } from "@/components/Toast";
import {
  Button,
  Card,
  Chip,
  GaugeButton,
  NumBadge,
  PageHead,
  PlayerLine,
  cx,
} from "@/components/ui";
import { demoAbandon, demoBarrageScore, demoPreqScore, isDemo } from "@/lib/demo";
import { forfaitsOf, isValidScore, matchWinner, phaseComplete } from "@/lib/engine";
import { longDate, moy, nice, ordinal, plural } from "@/lib/format";
import {
  barragesDone,
  consolanteAllowed,
  dayDate,
  distanceLabel,
  matchesProgress,
  phaseDistance,
  poulesProgress,
  preqRanking,
  qualifiers,
} from "@/lib/tournament";
import { useEditLock, useTournament, type EventInput } from "@/store/tournament";

export function Vendredi() {
  const { state } = useTournament();
  return (
    <>
      <DayTasks day="vendredi" />
      {state.closed.PREQ ? <Resultats /> : <Saisie />}
    </>
  );
}

/* ---------- Saisie des poules ---------- */

function Saisie() {
  const { state, dispatch } = useTournament();
  const toast = useToast();
  const fill = useProgressiveFill();
  const [open, setOpen] = useState<number | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const d = phaseDistance(state, "PREQ");
  const pr = poulesProgress(state, "PREQ");
  const complete = phaseComplete(state, "PREQ");
  const forfaits = forfaitsOf(state, "PREQ");
  const ro = useEditLock();
  const demo = isDemo(state) && !ro;

  const fillDemo = () => {
    const events: EventInput[] = [];
    for (const p of state.poules.PREQ)
      for (const m of p.matches) {
        if (isValidScore(m, d)) continue;
        const s = demoPreqScore(m);
        if (s)
          events.push({ type: "score.entered", payload: { phase: "PREQ", matchId: m.id, ...s } });
      }
    const abandon = demoAbandon();
    if (abandon && !forfaits.includes(abandon))
      events.push({
        type: "forfait.declared",
        payload: { phase: "PREQ", player: abandon, kind: "abandon" },
      });
    if (events.length === 0) {
      toast("Tous les scores sont déjà saisis.");
      return;
    }
    toast("Mode test : saisie des scores réels du tournoi d'exemple…");
    fill(events, () =>
      toast(`${events.length - 1} matchs saisis, un abandon · la phase peut être classée`),
    );
  };

  const classer = () => {
    if (!complete) {
      toast(`Il reste ${pr.total - pr.valid} matchs à valider`);
      return;
    }
    dispatch({ type: "phase.closed", payload: { phase: "PREQ" } });
    toast("Phase classée · barrages constitués");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="cascade">
      <PageHead
        eyebrow={`${longDate(dayDate(state, "vendredi"))} · 11h00`}
        title="Préqualifications"
        help={`Saisissez les scores poule par poule. Le classement de la phase se calcule quand les ${pr.total} matchs sont validés.`}
      >
        <Chip tone="blue">{distanceLabel(d)}</Chip>
        <Chip>
          {plural(state.poules.PREQ.length, "poule")} · {plural(state.billards.length, "billard")}
        </Chip>
        {demo ? (
          <Button icon={WandSparkles} onClick={fillDemo} title="Mode test">
            Mode test : scores d'exemple
          </Button>
        ) : null}
        <Button icon={Printer} onClick={() => setPrintOpen(true)}>
          Imprimer
        </Button>
        <span id="classement" className="rounded-[12px]">
          <GaugeButton
            done={pr.valid}
            total={pr.total}
            label="Classer la phase"
            onClick={classer}
            disabled={!complete}
          />
        </span>
      </PageHead>

      {!preqStarted(state) && !ro ? <LateForfaits /> : null}

      {forfaits.length > 0 ? (
        <div className="bg-alert-soft text-alert-ink mb-3.5 flex flex-wrap items-center gap-2 rounded-[12px] px-4 py-2.5 text-[13px] font-semibold">
          <UserX className="size-4" aria-hidden="true" />
          {plural(forfaits.length, "forfait ou abandon", "forfaits ou abandons")} :{" "}
          {forfaits.map(nice).join(", ")} · classés derniers de leur poule, sans point.
        </div>
      ) : null}

      <div
        id="poules"
        className="grid scroll-mt-4 grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3"
      >
        {state.poules.PREQ.map((p) => (
          <PouleCard
            key={p.num}
            state={state}
            phase="PREQ"
            poule={p}
            distance={d}
            active={open === p.num}
            onOpen={setOpen}
          />
        ))}
      </div>

      <PouleDrawer
        phase="PREQ"
        pouleNum={open}
        onClose={() => setOpen(null)}
        onNavigate={setOpen}
      />
      <PrintCenter day="vendredi" open={printOpen} onClose={() => setPrintOpen(false)} />
    </section>
  );
}

/* ---------- Classement, barrages, qualifiés ---------- */

function Resultats() {
  const { state, dispatch, dispatchMany } = useTournament();
  const toast = useToast();
  const navigate = useNavigate();
  const [printOpen, setPrintOpen] = useState(false);
  const ranking = useMemo(() => preqRanking(state), [state]);
  const size = state.rules.barrageSize;
  const natTo = size + state.rules.nationalSize - size / 2;
  const bd = state.rules.distances.barrage;
  const bClosed = Boolean(state.closed.B);
  const bDone = barragesDone(state);
  const bpr = matchesProgress(state.barrages, bd);
  const ro = useEditLock();
  const demo = isDemo(state) && !ro;
  const placeOf = useMemo(() => new Map(ranking.map((r) => [r.name, r.place])), [ranking]);

  const reopen = () => {
    if (
      !window.confirm(
        "Rouvrir la saisie des préqualifications ? Les barrages et tout ce qui en découle seront effacés.",
      )
    )
      return;
    dispatch({ type: "phase.reopened", payload: { phase: "PREQ" } });
    toast("Saisie rouverte");
  };

  const fillBarrages = () => {
    const events: EventInput[] = [];
    for (const m of state.barrages) {
      const s = demoBarrageScore(m);
      if (s && !isValidScore(m, bd))
        events.push({ type: "score.entered", payload: { phase: "B", matchId: m.id, ...s } });
    }
    dispatchMany(events);
    toast("Scores réels des barrages saisis");
  };

  const classerB = () => {
    if (!phaseComplete(state, "B")) {
      toast("Tous les barrages doivent être saisis");
      return;
    }
    dispatch({ type: "phase.closed", payload: { phase: "B" } });
    toast("Barrages classés · qualifiés connus");
    window.setTimeout(
      () =>
        document
          .getElementById("qualifies")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      300,
    );
  };

  return (
    <section className="cascade">
      <PageHead
        eyebrow={`${longDate(dayDate(state, "vendredi"))} · fin des poules`}
        title="Classement des préqualifications"
        help="Rang dans la poule, puis points de match, points de set, moyenne, ordre d'arrivée."
      >
        {!bClosed && !ro ? (
          <Button icon={RotateCcw} onClick={reopen}>
            Rouvrir la saisie
          </Button>
        ) : null}
        <Button icon={Printer} onClick={() => setPrintOpen(true)}>
          Imprimer classement et barrages
        </Button>
      </PageHead>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card
          id="classement"
          title={`${ranking.length} joueurs classés`}
          aside={<Chip tone="grey">Poule · rang</Chip>}
          bodyClassName="pb-1"
        >
          <div className="text-ink-muted grid grid-cols-[28px_1fr_40px_40px] gap-2 px-3.5 py-2 text-[10.5px] font-bold tracking-[0.06em] uppercase md:grid-cols-[30px_1fr_70px_44px_44px_60px]">
            <span>#</span>
            <span>Joueur</span>
            <span className="hidden md:block">Poule</span>
            <span className="text-right">Pm</span>
            <span className="text-right">Ps</span>
            <span className="hidden text-right md:block">Moy.</span>
          </div>
          <div className="max-h-[720px] overflow-auto">
            {ranking.map((r, i) => (
              <div key={r.name}>
                {i === 0 ? (
                  <div className="zone-row bg-brand-soft text-brand-ink">
                    Places 1 à {size} · Barrages
                  </div>
                ) : i === size ? (
                  <div className="zone-row bg-ok-soft text-ok-ink">
                    Places {size + 1} à {natTo} · National du samedi
                  </div>
                ) : i === natTo ? (
                  <div className="zone-row text-ink-muted">
                    Places {natTo + 1} et plus · Consolante sur volontariat
                  </div>
                ) : null}
                <div
                  className="border-line animate-slide-in grid grid-cols-[28px_1fr_40px_40px] items-center gap-2 border-t px-3.5 py-[5px] text-[12.5px] md:grid-cols-[30px_1fr_70px_44px_44px_60px]"
                  style={{ animationDelay: `${Math.min(i, 45) * 22}ms` }}
                >
                  <span className="text-ink-secondary font-mono font-bold">{r.place}</span>
                  <div className="min-w-0 truncate font-semibold">{nice(r.name)}</div>
                  <span className="text-ink-muted hidden font-mono text-[10.5px] md:block">
                    P{r.poule} · {r.rang ? ordinal(r.rang) : "ff"}
                  </span>
                  <span className="text-ink-secondary text-right font-mono">{r.ptm}</span>
                  <span className="text-ink-secondary text-right font-mono">{r.pts}</span>
                  <span className="text-ink-secondary hidden text-right font-mono md:block">
                    {moy(r.moy)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card
            id="barrages"
            title={`Barrages · ${plural(state.barrages.length, "match")}`}
            aside={
              <>
                <Chip tone="blue">{distanceLabel(bd)}</Chip>
                {demo && !bClosed ? (
                  <Button size="sm" icon={WandSparkles} onClick={fillBarrages}>
                    Scores réels
                  </Button>
                ) : null}
              </>
            }
          >
            <div>
              {state.barrages.map((m, i) => (
                <BarrageRow key={m.id} match={m} index={i} placeOf={placeOf} locked={bClosed} />
              ))}
            </div>
            <div className="border-line flex flex-wrap items-center gap-2.5 border-t px-3.5 py-3">
              <span className="text-ink-muted text-[12px]">
                Vainqueurs → Masters · perdants → National
              </span>
              {bClosed && ro ? null : bClosed ? (
                <Button
                  size="sm"
                  icon={RotateCcw}
                  className="ml-auto"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Rouvrir les barrages ? Les poules du samedi seront recomposées.",
                      )
                    ) {
                      dispatch({ type: "phase.reopened", payload: { phase: "B" } });
                      toast("Barrages rouverts");
                    }
                  }}
                >
                  Rouvrir
                </Button>
              ) : (
                <span className="ml-auto">
                  <GaugeButton
                    done={bpr.valid}
                    total={bpr.total}
                    label="Classer les barrages"
                    onClick={classerB}
                    disabled={!bDone}
                  />
                </span>
              )}
            </div>
          </Card>
        </div>
      </div>

      {bClosed ? (
        <Qualifies onNext={() => navigate("/tournoi/samedi")} onPrint={() => setPrintOpen(true)} />
      ) : null}

      <PrintCenter day="vendredi" open={printOpen} onClose={() => setPrintOpen(false)} />
    </section>
  );
}

function BarrageRow({
  match,
  index,
  placeOf,
  locked,
}: {
  match: Match;
  index: number;
  placeOf: Map<string, number>;
  locked: boolean;
}) {
  const { state, dispatch } = useTournament();
  const d = state.rules.distances.barrage;
  const [draft, setDraft] = useState<ScoreDraft>(() => draftOf(match, d));
  const lastId = useRef(`${match.id}:${match.sa}:${match.sb}`);
  useEffect(() => {
    const key = `${match.id}:${match.sa}:${match.sb}`;
    if (key !== lastId.current) {
      lastId.current = key;
      setDraft(draftOf(match, d));
    }
  }, [match, d]);
  const commit = (nd: ScoreDraft) => {
    const s = scoreOf(nd, d);
    if (s.sa === match.sa && s.sb === match.sb) return;
    dispatch({
      type: "score.entered",
      payload: { phase: "B", matchId: match.id, sa: s.sa, sb: s.sb },
    });
  };
  const w = matchWinner(match, d);
  const side = (name: string, right: boolean) => (
    <div className={cx("flex min-w-0 items-center gap-2", right && "flex-row-reverse text-right")}>
      <NumBadge n={placeOf.get(name) ?? "–"} tone={w === name ? "gold" : "default"} />
      <div
        className={cx("min-w-0 truncate text-[12.5px]", w === name ? "font-bold" : "font-semibold")}
      >
        {nice(name)}
      </div>
    </div>
  );
  return (
    <div
      className="border-line animate-pop grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t px-3 py-2.5"
      style={{ animationDelay: `${index * 60}ms` }}
      data-score-root
    >
      {side(match.a, false)}
      <div className="flex flex-col items-center gap-[3px]">
        <span className="text-ink-muted font-mono text-[10px] font-bold">
          {match.id} · {match.billard ? `B${match.billard}` : "billard ?"}
        </span>
        {match.forfait ? (
          <Chip tone="red">Forfait {match.forfait === "a" ? nice(match.a) : nice(match.b)}</Chip>
        ) : (
          <ScoreEditor
            match={match}
            distance={d}
            draft={draft}
            onDraft={setDraft}
            onCommit={commit}
            disabled={locked}
            layout="inline"
            idBase={`b-${match.id}`}
            size="sm"
          />
        )}
      </div>
      {side(match.b, true)}
    </div>
  );
}

function Qualifies({ onNext, onPrint }: { onNext: () => void; onPrint: () => void }) {
  const { state, dispatch } = useTournament();
  const toast = useToast();
  const q = useMemo(() => qualifiers(state), [state]);
  const placeOf = useMemo(() => new Map(preqRanking(state).map((r) => [r.name, r.place])), [state]);
  const [volunteers, setVolunteers] = useState<Set<string>>(() => new Set(q.consolante));
  const allowed = consolanteAllowed(state);
  const ro = useEditLock();
  const created = state.brackets.CLS.length > 0;
  const max = state.rules.consolanteMax;
  const list = (names: string[], tag: (n: string, i: number) => React.ReactNode) => (
    <div className="flex max-h-[420px] flex-col gap-[3px] overflow-auto px-2.5 py-2">
      {names.map((n, i) => (
        <div key={n} className="animate-slide-in" style={{ animationDelay: `${i * 35}ms` }}>
          <PlayerLine
            name={n}
            num={i + 1}
            className="rounded-[8px] px-1 py-[3px]"
            trailing={tag(n, i)}
          />
        </div>
      ))}
    </div>
  );
  const badge = (text: string, tone: "gold" | "green" | "grey") => (
    <span
      className={cx(
        "ml-auto shrink-0 rounded-[5px] px-1.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap",
        tone === "gold" && "bg-gold-soft text-gold-ink",
        tone === "green" && "bg-ok-soft text-ok-ink",
        tone === "grey" && "text-ink-muted font-mono font-semibold",
      )}
    >
      {text}
    </span>
  );
  const createConsolante = () => {
    const players = q.consolante.filter((n) => volunteers.has(n)).slice(0, max);
    if (players.length < 2) {
      toast("Il faut au moins deux volontaires");
      return;
    }
    dispatch({ type: "consolante.created", payload: { players } });
    toast(`Consolante créée · ${plural(players.length, "joueur")}`);
  };
  return (
    <div id="qualifies" className="mt-4 grid gap-3.5 lg:grid-cols-3">
      <Card
        title={`Masters · ${q.masters.length}`}
        aside={
          <Chip tone="gold" icon={Trophy}>
            samedi 8h30
          </Chip>
        }
        headerClassName="bg-surface-2 border-line border-b"
      >
        {list(q.masters, (_, i) =>
          i < state.masters.length ? badge("Tête de série", "gold") : badge("Barrage", "green"),
        )}
      </Card>
      <Card
        title={`National · ${q.national.length}`}
        aside={<Chip tone="green">samedi 8h30</Chip>}
        headerClassName="bg-surface-2 border-line border-b"
      >
        {list(q.national, (n, i) =>
          i < q.losers.length
            ? badge("barrage", "grey")
            : badge(ordinal(placeOf.get(n) ?? 0), "grey"),
        )}
      </Card>
      <Card
        title={`Consolante · ${q.consolante.length} éligibles`}
        aside={
          <Chip tone="grey">
            {allowed ? `sur volontariat · max ${max}` : "moins de 5 billards 2m80"}
          </Chip>
        }
        headerClassName="bg-surface-2 border-line border-b"
      >
        {list(q.consolante, (n) => (
          <input
            type="checkbox"
            className="accent-brand ml-auto"
            aria-label={`${nice(n)} souhaite jouer la consolante`}
            checked={volunteers.has(n)}
            disabled={created || !allowed || ro}
            onChange={(e) => {
              const next = new Set(volunteers);
              if (e.target.checked) next.add(n);
              else next.delete(n);
              setVolunteers(next);
            }}
          />
        ))}
        <div className="border-line flex items-center gap-2 border-t px-3.5 py-2.5">
          <span className="text-ink-muted text-[12px]">
            {created
              ? `Tableau créé · ${plural(new Set(state.brackets.CLS.flatMap((m) => [m.a, m.b]).filter(Boolean)).size, "joueur")}`
              : `${volunteers.size} volontaires cochés`}
          </span>
          {!created && allowed && !ro ? (
            <Button
              size="sm"
              variant="primary"
              icon={Check}
              className="ml-auto"
              onClick={createConsolante}
            >
              Créer la consolante
            </Button>
          ) : null}
        </div>
      </Card>
      <div className="flex flex-wrap justify-end gap-2.5 lg:col-span-3">
        <Button icon={Printer} onClick={onPrint}>
          Imprimer les tableaux du samedi
        </Button>
        <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={onNext}>
          Préparer le samedi
        </Button>
      </div>
    </div>
  );
}

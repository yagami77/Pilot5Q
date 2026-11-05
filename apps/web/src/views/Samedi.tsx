/** Samedi : poules Masters et National, huitièmes National, consolante. */
import { ArrowLeft, ArrowRight, Check, Printer, TriangleAlert, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { Bracket } from "@/components/Bracket";
import { DayTasks } from "@/components/DayTasks";
import { PouleCard } from "@/components/PouleCard";
import { PouleDrawer } from "@/components/PouleDrawer";
import { PrintCenter } from "@/components/PrintCenter";
import { useToast } from "@/components/Toast";
import { Banner, Button, Card, Chip, GaugeButton, PageHead, PlayerLine, cx } from "@/components/ui";
import {
  clubOf,
  forfaitsOf,
  isValidScore,
  mastersClubConflicts,
  nationalR16,
  phaseComplete,
} from "@/lib/engine";
import { pendingOf, useAutoFill } from "@/lib/fill";
import { longDate, nice, plural } from "@/lib/format";
import {
  bigTables,
  bracketWinner,
  consolanteAllowed,
  dayDate,
  distanceLabel,
  phaseDistance,
  pouleState,
  poulesProgress,
  qualifiers,
} from "@/lib/tournament";
import { useTournament } from "@/store/tournament";

export function Samedi() {
  const { state, dispatch } = useTournament();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState<{ phase: "QM" | "QN"; num: number } | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const dM = phaseDistance(state, "QM");
  const dN = phaseDistance(state, "QN");
  const prM = poulesProgress(state, "QM");
  const prN = poulesProgress(state, "QN");
  const doneM = phaseComplete(state, "QM");
  const doneN = phaseComplete(state, "QN");
  const closedM = Boolean(state.closed.QM);
  const closedN = Boolean(state.closed.QN);
  const closedCLS = Boolean(state.closed.CLS);
  const cls = state.brackets.CLS;
  const hasCls = cls.length > 0;
  const clsDone = phaseComplete(state, "CLS");
  const conflicts = useMemo(() => mastersClubConflicts(state.poules.QM, clubOf(state)), [state]);
  const big = bigTables(state.billards);
  const convocation = big <= 3 ? "8h00" : "8h30";

  const fill = useAutoFill(
    () => {
      const out = [];
      for (const phase of ["QM", "QN"] as const) {
        if (state.closed[phase]) continue;
        const ff = new Set(forfaitsOf(state, phase));
        const d = phaseDistance(state, phase);
        for (const p of state.poules[phase])
          out.push(
            ...pendingOf(
              phase,
              p.matches.filter((m) => !ff.has(m.a) && !ff.has(m.b)),
              d,
            ),
          );
      }
      if (hasCls && !closedCLS) out.push(...pendingOf("CLS", cls, phaseDistance(state, "CLS")));
      // Huitièmes National : dès que les poules sont classées
      if (closedN && !state.closed.N)
        out.push(
          ...pendingOf(
            "N",
            state.brackets.N.filter((m) => m.round === "R16"),
            phaseDistance(state, "N", "R16"),
          ),
        );
      return out;
    },
    { batch: 2, every: 140 },
  );

  const close = (phase: "QM" | "QN" | "CLS", label: string) => {
    if (!phaseComplete(state, phase)) {
      toast("Il reste des matchs à saisir");
      return;
    }
    dispatch({ type: "phase.closed", payload: { phase } });
    toast(`${label} classé`);
  };

  // Huitièmes « en direct » : les noms apparaissent dès que deux poules croisées sont terminées
  const liveR16 = useMemo(
    () => (closedN ? [] : nationalR16(state.poules.QN, dN, forfaitsOf(state, "QN"))),
    [state, closedN, dN],
  );
  // Noms seulement quand les deux poules concernées sont terminées (« 1er poule 1 – 2e poule 8 »)
  const qnComplete = useMemo(
    () =>
      new Set(state.poules.QN.filter((p) => pouleState(state, "QN", p).complete).map((p) => p.num)),
    [state],
  );
  const r16Known = (m: { labelA?: string; labelB?: string }) =>
    [m.labelA, m.labelB].every((l) => qnComplete.has(pouleOfLabel(l)));
  const liveReady = liveR16.filter((m) => m.a && m.b && r16Known(m)).length;
  const r16Pending =
    closedN &&
    state.brackets.N.some(
      (m) => m.round === "R16" && m.a && m.b && !isValidScore(m, phaseDistance(state, "N", "R16")),
    );

  return (
    <section className="cascade">
      <DayTasks day="samedi" actions={{ primes: () => void navigate("/tournoi/primes") }} />
      <PageHead
        eyebrow={`${longDate(dayDate(state, "samedi"))} · convocation ${convocation}`}
        title="Trois tournois en parallèle"
        help={`Les poules sont constituées automatiquement à partir des barrages. Masters sur les 3m10, National sur ${new Set(state.poules.QN.flatMap((p) => p.billards)).size || 4} billards, consolante sur les billards restants.`}
      >
        <Chip>
          Convocations : {state.poules.QM.length * 4} + {state.poules.QN.length * 4} joueurs
        </Chip>
        {!(closedM && closedN && !r16Pending) ? (
          <Button
            icon={WandSparkles}
            onClick={fill.start}
            disabled={fill.running}
            title="Mode test"
          >
            {fill.running ? "Saisie en cours…" : "Mode test : scores aléatoires"}
          </Button>
        ) : null}
        <Button icon={Printer} onClick={() => setPrintOpen(true)}>
          Imprimer
        </Button>
      </PageHead>

      <div className="flex flex-col gap-3.5">
        <Card
          id="masters"
          title={`Qualification Masters · ${plural(state.poules.QM.length, "poule")} de 4`}
          aside={
            <>
              <Chip tone="blue">{distanceLabel(dM)} · 3m10</Chip>
              {conflicts.length ? (
                <Chip tone="red" icon={TriangleAlert}>
                  Conflit club : P{conflicts.join(", P")}
                </Chip>
              ) : null}
              {closedM ? (
                <Chip tone="green" icon={Check}>
                  Classés · quarts constitués
                </Chip>
              ) : (
                <GaugeButton
                  done={prM.valid}
                  total={prM.total}
                  label="Classer les Masters"
                  onClick={() => close("QM", "Masters")}
                  disabled={!doneM}
                />
              )}
            </>
          }
        >
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3 px-4 pt-1 pb-4">
            {state.poules.QM.map((p) => (
              <PouleCard
                key={p.num}
                state={state}
                phase="QM"
                poule={p}
                distance={dM}
                active={open?.phase === "QM" && open.num === p.num}
                onOpen={(num) => setOpen({ phase: "QM", num })}
                conflict={conflicts.includes(p.num)}
              />
            ))}
          </div>
        </Card>

        <Card
          id="national"
          title={`Qualification National · ${plural(state.poules.QN.length, "poule")} de 4`}
          aside={
            <>
              <Chip tone="green">{distanceLabel(dN)} · huitièmes dans la foulée</Chip>
              {closedN ? (
                <Chip tone="green" icon={Check}>
                  Classés · huitièmes ouverts
                </Chip>
              ) : (
                <GaugeButton
                  done={prN.valid}
                  total={prN.total}
                  label="Classer le National"
                  onClick={() => close("QN", "National")}
                  disabled={!doneN}
                />
              )}
            </>
          }
        >
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3 px-4 pt-1 pb-4">
            {state.poules.QN.map((p) => (
              <PouleCard
                key={p.num}
                state={state}
                phase="QN"
                poule={p}
                distance={dN}
                active={open?.phase === "QN" && open.num === p.num}
                onOpen={(num) => setOpen({ phase: "QN", num })}
              />
            ))}
          </div>
          <div id="huitiemes" className="border-line scroll-mt-4 border-t">
            <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
              <h4 className="text-[13.5px] font-bold">Huitièmes de finale</h4>
              <Chip tone="grey">
                {closedN
                  ? `${plural(state.brackets.N.filter((m) => m.round === "R16" && m.a && m.b).length, "match")} · ${distanceLabel(phaseDistance(state, "N", "R16"))}`
                  : `${liveReady}/8 appariements connus · saisie après le classement des poules`}
              </Chip>
            </div>
            {closedN ? (
              <Bracket phase="N" rounds={["R16"]} layout="grid" />
            ) : (
              <div className="grid grid-cols-2 gap-2 px-4 pt-3 pb-4 md:grid-cols-4">
                {liveR16.map((m, i) => (
                  <div
                    key={m.id}
                    className={cx(
                      "border-line bg-surface-2 animate-pop flex flex-col gap-1.5 rounded-[10px] border px-2.5 py-2",
                      m.a && m.b && r16Known(m) && "border-[#bfe6d2]",
                    )}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <span className="text-ink-muted font-mono text-[10px] font-bold">
                      H{m.slot}
                    </span>
                    {(
                      [
                        ["a", m.a, m.labelA],
                        ["b", m.b, m.labelB],
                      ] as const
                    ).map(([k, n, label]) => (
                      <div key={k} className="flex items-center gap-2 text-[12px]">
                        {n && r16Known(m) ? (
                          <PlayerLine name={n} size="xs" />
                        ) : (
                          <span className="text-ink-muted font-medium">{longLabel(label)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card
          id="consolante"
          title="Consolante · tableau à élimination directe"
          aside={
            <>
              <Chip tone="grey">
                {distanceLabel(phaseDistance(state, "CLS"))}
                {hasCls
                  ? ` · ${plural(new Set(cls.flatMap((m) => [m.a, m.b]).filter(Boolean)).size, "joueur")}`
                  : ""}
              </Chip>
              {hasCls && !closedCLS ? (
                <GaugeButton
                  done={
                    cls.filter(
                      (m) =>
                        m.a && m.b && !pendingOf("CLS", [m], phaseDistance(state, "CLS")).length,
                    ).length
                  }
                  total={cls.filter((m) => m.a && m.b).length}
                  label="Classer la consolante"
                  onClick={() => close("CLS", "Consolante")}
                  disabled={!clsDone}
                />
              ) : null}
              {closedCLS ? (
                <Chip tone="gold" icon={Check}>
                  Vainqueur : {nice(bracketWinner(state, "CLS") ?? "")}
                </Chip>
              ) : null}
            </>
          }
        >
          {hasCls ? (
            <Bracket phase="CLS" zoomable championNote="vainqueur de la consolante" />
          ) : (
            <div className="text-ink-muted flex flex-wrap items-center gap-3 px-4 pb-4 text-[13px]">
              {consolanteAllowed(state)
                ? `Le tableau se génère à partir des volontaires pointés le vendredi soir (${qualifiers(state).consolante.length} éligibles), dans l'ordre du classement de sortie des poules.`
                : "Consolante impossible : il faut au moins 5 billards de 2m80."}
              {consolanteAllowed(state) ? (
                <Button size="sm" icon={ArrowLeft} onClick={() => navigate("/tournoi/vendredi")}>
                  Pointer les volontaires
                </Button>
              ) : null}
            </div>
          )}
        </Card>

        {closedM && closedN ? (
          <Banner
            icon={Check}
            actions={
              <Button
                variant="primary"
                iconRight={ArrowRight}
                onClick={() => navigate("/tournoi/dimanche")}
              >
                Passer au dimanche
              </Button>
            }
          >
            Masters et National classés · quarts de finale constitués
            {hasCls && !closedCLS ? " · la consolante peut continuer" : ""}
          </Banner>
        ) : null}
      </div>

      <PouleDrawer
        phase={open?.phase ?? "QN"}
        pouleNum={open?.num ?? null}
        onClose={() => setOpen(null)}
        onNavigate={(num) => setOpen(open ? { ...open, num } : null)}
      />
      <PrintCenter day="samedi" open={printOpen} onClose={() => setPrintOpen(false)} />
    </section>
  );
}

/** Numéro de poule d'un libellé « 1er P3 ». */
function pouleOfLabel(label: string | undefined): number {
  const m = /P(\d+)/.exec(label ?? "");
  return m ? Number(m[1]) : -1;
}

/** « 1er P3 » → « 1er poule 3 ». */
function longLabel(label: string | undefined): string {
  return (label ?? "").replace(/P(\d+)/, "poule $1");
}

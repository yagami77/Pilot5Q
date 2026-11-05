/** Samedi : poules Masters et National, huitièmes National, consolante. */
import { ArrowLeft, ArrowRight, Check, Printer, TriangleAlert, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { Bracket } from "@/components/Bracket";
import { PouleCard } from "@/components/PouleCard";
import { PouleDrawer } from "@/components/PouleDrawer";
import { PrintCenter } from "@/components/PrintCenter";
import { useToast } from "@/components/Toast";
import { Banner, Button, Card, Chip, GaugeButton, PageHead, PlayerLine, cx } from "@/components/ui";
import { clubOf, forfaitsOf, mastersClubConflicts, nationalR16, phaseComplete } from "@/lib/engine";
import { pendingOf, useAutoFill } from "@/lib/fill";
import { longDate, nice, plural } from "@/lib/format";
import {
  bigTables,
  bracketWinner,
  consolanteAllowed,
  dayDate,
  distanceLabel,
  phaseDistance,
  playerByName,
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
  const by = playerByName(state);

  const fill = useAutoFill(() => {
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
    return out;
  });

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
  const liveReady = liveR16.filter((m) => m.a && m.b).length;

  return (
    <section>
      <PageHead
        eyebrow={`${longDate(dayDate(state, "samedi"))} · convocation ${convocation}`}
        title="Trois tournois en parallèle"
        help={`Les poules sont constituées automatiquement à partir des barrages. Masters sur les 3m10, National sur ${new Set(state.poules.QN.flatMap((p) => p.billards)).size || 4} billards, consolante sur les billards restants.`}
      >
        <Chip>
          Convocations : {state.poules.QM.length * 4} + {state.poules.QN.length * 4} joueurs
        </Chip>
        {!(closedM && closedN) ? (
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
          <div className="border-line border-t">
            <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
              <h4 className="text-[13.5px] font-bold">Huitièmes de finale</h4>
              <Chip tone="grey">
                {closedN
                  ? `${plural(state.brackets.N.filter((m) => m.round === "R16" && m.a && m.b).length, "match")} · ${distanceLabel(phaseDistance(state, "N", "R16"))}`
                  : `${liveReady}/8 appariements connus · saisie après le classement des poules`}
              </Chip>
            </div>
            {closedN ? (
              <Bracket phase="N" rounds={["R16"]} delays={false} />
            ) : (
              <div className="grid grid-cols-2 gap-2 px-4 pt-3 pb-4 md:grid-cols-4">
                {liveR16.map((m, i) => (
                  <div
                    key={m.id}
                    className={cx(
                      "border-line bg-surface-2 animate-pop flex flex-col gap-1.5 rounded-[10px] border px-2.5 py-2",
                      m.a && m.b && "border-[#bfe6d2]",
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
                        {n ? (
                          <PlayerLine name={n} club={by.get(n)?.club} size="xs" />
                        ) : (
                          <span className="text-ink-muted">{label}</span>
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
            <Bracket phase="CLS" />
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

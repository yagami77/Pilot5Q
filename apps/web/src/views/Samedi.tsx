/** Samedi : poules Masters et National, huitièmes National, consolante. */
import { ArrowLeft, Check, Printer, TriangleAlert, WandSparkles } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { Bracket } from "@/components/Bracket";
import { DayTasks } from "@/components/DayTasks";
import { PouleGrid, PouleViewToggle, usePouleView, type PouleView } from "@/components/PouleGrid";
import { RollingNumber } from "@/components/RollingNumber";
import { PouleDrawer } from "@/components/PouleDrawer";
import { PrintCenter } from "@/components/PrintCenter";
import { useToast } from "@/components/Toast";
import { Banner, Button, Card, Chip, GaugeButton, PageHead, cx } from "@/components/ui";
import {
  clubOf,
  forfaitsOf,
  isValidScore,
  mastersClubConflicts,
  matchWinner,
  NATIONAL_R16_PAIRS,
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
  nationalDone,
  phaseDistance,
  pouleState,
  poulesProgress,
  qualifiers,
  r16Progress,
} from "@/lib/tournament";
import { useEditLock, useTournament } from "@/store/tournament";

export function Samedi() {
  const { state, dispatch } = useTournament();
  const toast = useToast();
  const ro = useEditLock();
  const navigate = useNavigate();
  const [open, setOpen] = useState<{ phase: "QM" | "QN"; num: number } | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [view, setView] = usePouleView();
  const dM = phaseDistance(state, "QM");
  const dN = phaseDistance(state, "QN");
  const prM = poulesProgress(state, "QM");
  const doneM = phaseComplete(state, "QM");
  const closedM = Boolean(state.closed.QM);
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
      // Huitièmes National : dès que leurs deux poules couplées sont terminées
      if (!state.closed.N)
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

  const r16Pending = state.brackets.N.some(
    (m) => m.round === "R16" && m.a && m.b && !isValidScore(m, phaseDistance(state, "N", "R16")),
  );
  const natDone = nationalDone(state);

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
        {!ro && !(closedM && natDone && !r16Pending) ? (
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

      <div className="mb-2.5 flex justify-end">
        <PouleViewToggle value={view} onChange={setView} />
      </div>

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
          <PouleGrid
            className="px-4 pt-1 pb-4"
            state={state}
            phase="QM"
            poules={state.poules.QM}
            distance={dM}
            view={view}
            open={open?.phase === "QM" ? open.num : null}
            onOpen={(num) => setOpen({ phase: "QM", num })}
            conflicts={conflicts}
          />
        </Card>

        <Card
          id="national"
          title={`Qualification National · ${plural(state.poules.QN.length, "poule")} de 4`}
          aside={
            <>
              <Chip tone="green">
                {distanceLabel(dN)} · huitièmes dès que deux poules couplées sont terminées
              </Chip>
              <R16Indicator />
            </>
          }
        >
          <div
            id="huitiemes"
            className="grid scroll-mt-4 items-start gap-3 px-4 pt-1 pb-4 xl:grid-cols-2"
          >
            {nationalPairs(state.poules.QN.length).map(([x, y], i) => (
              <NationalPair
                key={`${x}-${y}`}
                index={i}
                first={x}
                second={y}
                view={view}
                open={open?.phase === "QN" ? open.num : null}
                onOpen={(num) => setOpen({ phase: "QN", num })}
              />
            ))}
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

        {/* « Passer au dimanche » : dans la barre des tâches du jour */}
        {closedM && natDone ? (
          <Banner icon={Check}>
            Masters classés et huitièmes National joués · quarts de finale constitués
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

/** Paires de poules National affichées côte à côte : 1 et 8, 2 et 7, 3 et 6, 4 et 5. */
function nationalPairs(count: number): [number, number][] {
  const n = count || 8;
  return Array.from({ length: Math.floor(n / 2) }, (_, i) => [i + 1, n - i]);
}

/** Huitièmes d'une paire de poules (ids), celui du 1er de la première poule d'abord. */
function pairR16(first: number, second: number): string[] {
  const ids = NATIONAL_R16_PAIRS.map(([a, b], i) => ({ a, b, id: `N-R16-${i + 1}` })).filter(
    (x) => (x.a === first && x.b === second) || (x.a === second && x.b === first),
  );
  return ids.sort((x, y) => Number(y.a === first) - Number(x.a === first)).map((x) => x.id);
}

/** « Huitièmes terminés X/8 » : remplace « Classer le National ». */
function R16Indicator() {
  const { state } = useTournament();
  const p = r16Progress(state);
  const all = p.done === p.total && p.review === 0;
  return (
    <span
      className={cx(
        "relative inline-flex h-[34px] items-center gap-2 overflow-hidden rounded-[11px] border px-3 text-[12.5px] font-bold",
        all ? "border-[#bfe6d2] text-ok-ink" : "border-line-2 text-ink-secondary",
      )}
      aria-label={`Huitièmes terminés ${p.done} sur ${p.total}`}
    >
      <motion.span
        aria-hidden="true"
        className={cx("absolute inset-y-0 left-0", all ? "bg-ok-soft" : "bg-brand-soft")}
        initial={false}
        animate={{ width: `${(p.done / p.total) * 100}%` }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      />
      {all ? <Check className="relative size-4" aria-hidden="true" /> : null}
      <span className="relative">Huitièmes terminés</span>
      <span className="relative font-mono tabular-nums">
        <RollingNumber value={p.done} />/{p.total}
      </span>
      {p.review ? (
        <span className="bg-alert text-white relative rounded-[6px] px-1.5 text-[10.5px]">
          {p.review} à vérifier
        </span>
      ) : null}
    </span>
  );
}

/** Deux poules couplées côte à côte et, dessous, leurs deux huitièmes. */
function NationalPair({
  index,
  first,
  second,
  view,
  open,
  onOpen,
}: {
  index: number;
  first: number;
  second: number;
  view: PouleView;
  open: number | null;
  onOpen: (num: number) => void;
}) {
  const { state } = useTournament();
  const d = phaseDistance(state, "QN");
  const dR16 = phaseDistance(state, "N", "R16");
  const poules = [first, second]
    .map((n) => state.poules.QN[n - 1])
    .filter((p): p is NonNullable<typeof p> => p !== undefined);
  const complete = poules.map((p) => pouleState(state, "QN", p).complete);
  const ids = pairR16(first, second);
  const matches = ids.map((id) => state.brackets.N.find((m) => m.id === id));
  const ready = matches.every((m) => m && m.a && m.b);
  const done = ready && matches.every((m) => m && matchWinner(m, dR16));
  const review = matches.some((m) => m?.needsReview);
  const numOf = (i: number) => poules[i]?.num ?? (i === 0 ? first : second);
  const status = review
    ? { label: "À vérifier", cls: "bg-alert-soft text-alert-ink" }
    : done
      ? { label: "Huitièmes joués", cls: "bg-ok-soft text-ok-ink" }
      : ready
        ? { label: "Huitièmes à lancer", cls: "bg-brand text-white" }
        : {
            label: `En attente de ${complete.every((c) => !c) ? "deux poules" : "la poule " + numOf(complete[0] ? 1 : 0)}`,
            cls: "bg-surface text-ink-muted border-line border",
          };
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
      className={cx(
        "rounded-[16px] border p-3 transition-[border-color,background-color] duration-500",
        ready && !done
          ? "border-brand-light bg-brand-soft/40"
          : done
            ? "border-[#bfe6d2] bg-ok-soft/30"
            : "border-line bg-surface-2/70",
      )}
      aria-label={`Poules ${numOf(0)} et ${numOf(1)}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <b className="text-[13px]">
          Poules {numOf(0)} et {numOf(1)}
        </b>
        <span className="text-ink-muted font-mono text-[11px]">
          → {ids.map((id) => `H${id.split("-").pop()}`).join(" et ")}
        </span>
        <span
          className={cx(
            "ml-auto rounded-[7px] px-2 py-[3px] text-[11px] font-bold",
            status.cls,
            ready && !done && !review && "animate-pop",
          )}
        >
          {status.label}
        </span>
      </div>
      <PouleGrid
        state={state}
        phase="QN"
        poules={poules}
        distance={d}
        view={view}
        open={open}
        onOpen={onOpen}
        gridClassName="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2"
      />
      <div className="text-ink-muted mt-3 mb-1.5 text-[10.5px] font-bold tracking-[0.08em] uppercase">
        Huitièmes · {distanceLabel(dR16)}
      </div>
      {state.brackets.N.some((m) => m.round === "R16") ? (
        <Bracket
          phase="N"
          rounds={["R16"]}
          layout="grid"
          only={ids}
          gridClassName="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
        />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {pairR16(first, second).map((id) => {
            const i = Number(id.split("-").pop()) - 1;
            const [pa, pb] = NATIONAL_R16_PAIRS[i] ?? [first, second];
            return (
              <div
                key={id}
                className="border-line-2 text-ink-muted flex flex-col gap-1 rounded-[14px] border border-dashed px-3 py-2.5 text-[12px]"
              >
                <span className="font-mono text-[10.5px] font-bold">H{i + 1}</span>
                <span className="font-medium">1er poule {numOf(pa === first ? 0 : 1)}</span>
                <span className="font-medium">2e poule {numOf(pb === first ? 0 : 1)}</span>
              </div>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}

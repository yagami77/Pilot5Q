/** Dimanche : tableaux finaux Masters et National, primes, clôture et podium. */
import { Check, Download, Flag, Printer, Trophy, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Bracket } from "@/components/Bracket";
import { DayTasks } from "@/components/DayTasks";
import { PrintCenter } from "@/components/PrintCenter";
import { RollingNumber } from "@/components/RollingNumber";
import { useToast } from "@/components/Toast";
import { Avatar, Banner, Button, Card, Chip, GaugeButton, PageHead, cx } from "@/components/ui";
import { phaseComplete, toLiveJson } from "@/lib/engine";
import { pendingOf, useAutoFill } from "@/lib/fill";
import { euros, longDate, nice, plural } from "@/lib/format";
import { celebrate } from "@/lib/motion";
import { computePrizes } from "@/lib/prizes";
import {
  bracketPlacement,
  bracketWinner,
  dayDate,
  distanceLabel,
  phaseDistance,
} from "@/lib/tournament";
import { useTournament } from "@/store/tournament";

export function Dimanche() {
  const { state, dispatch } = useTournament();
  const toast = useToast();
  const [printOpen, setPrintOpen] = useState(false);
  const [showTables, setShowTables] = useState(false);
  const prizes = useMemo(() => computePrizes(state), [state]);
  const closedM = Boolean(state.closed.M);
  const closedN = Boolean(state.closed.N);
  const finished = closedM && closedN;
  const d = phaseDistance(state, "M", "F");
  // Clôture : confettis quand les deux tableaux viennent d'être classés
  const wasFinished = useRef(finished);
  useEffect(() => {
    if (finished && !wasFinished.current) {
      const t = window.setTimeout(() => void celebrate(null, 220), 350);
      wasFinished.current = true;
      return () => window.clearTimeout(t);
    }
    wasFinished.current = finished;
    return undefined;
  }, [finished]);

  const progress = (phase: "N" | "M") => {
    const ms = state.brackets[phase].filter((m) => m.round !== "R16");
    const dd = (r: (typeof ms)[number]) => phaseDistance(state, phase, r.round);
    return {
      done: ms.filter((m) => m.a && m.b && pendingOf(phase, [m], dd(m)).length === 0).length,
      total: ms.length,
    };
  };
  const pM = progress("M");
  const pN = progress("N");

  const fill = useAutoFill(
    () => {
      const out = [];
      for (const phase of ["M", "N"] as const) {
        if (state.closed[phase]) continue;
        for (const m of state.brackets[phase])
          out.push(...pendingOf(phase, [m], phaseDistance(state, phase, m.round)));
      }
      return out;
    },
    { batch: 1, every: 380 },
  );

  const close = (phase: "N" | "M") => {
    if (!phaseComplete(state, phase)) {
      toast("Il reste des matchs à saisir");
      return;
    }
    dispatch({ type: "phase.closed", payload: { phase } });
    toast(phase === "M" ? "Masters terminés" : "National terminé");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(toLiveJson(state), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.info?.name ?? "tn"}-${state.info?.city ?? ""}.json`
      .replace(/\s+/g, "-")
      .toLowerCase();
    a.click();
    URL.revokeObjectURL(url);
    toast("JSON 5 Quilles exporté");
  };

  return (
    <section className="cascade">
      <DayTasks day="dimanche" />
      <PageHead
        eyebrow={longDate(dayDate(state, "dimanche"))}
        title={finished && !showTables ? "Tournoi terminé" : "Phases finales"}
        help="Arbitrage fourni par le club : l'arbitre de chaque match est renseigné avec son numéro de licence. Trente minutes de pause minimum entre deux paliers pour un même joueur."
      >
        <Chip tone="gold" icon={Trophy}>
          Primes : <RollingNumber value={euros(prizes.cagnotte)} />
        </Chip>
        {!finished ? (
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

      {finished && !showTables ? (
        <Podium onTables={() => setShowTables(true)} onExport={exportJson} />
      ) : (
        <div className="flex flex-col gap-3.5">
          <Card
            id="masters"
            title="Masters"
            aside={
              <>
                <Chip tone="blue">
                  {distanceLabel(d)} · billards{" "}
                  {[...new Set(state.brackets.M.map((m) => m.billard).filter(Boolean))]
                    .map((b) => `B${b}`)
                    .join(", ") || "3m10"}
                </Chip>
                {closedM ? (
                  <Chip tone="gold" icon={Trophy}>
                    Vainqueur : {nice(bracketWinner(state, "M") ?? "")}
                  </Chip>
                ) : (
                  <GaugeButton
                    done={pM.done}
                    total={pM.total}
                    label="Classer les Masters"
                    onClick={() => close("M")}
                    disabled={!phaseComplete(state, "M")}
                  />
                )}
              </>
            }
          >
            <Bracket
              phase="M"
              rounds={["QF", "SF", "F"]}
              withArbitre
              championNote={`vainqueur Masters · ${euros(prizes.masters.lines[0]?.amount ?? 0)}`}
            />
          </Card>
          <Card
            title="National"
            aside={
              <>
                <Chip tone="green">Huitièmes joués le samedi · puis {distanceLabel(d)}</Chip>
                {closedN ? (
                  <Chip tone="gold" icon={Trophy}>
                    Vainqueur : {nice(bracketWinner(state, "N") ?? "")}
                  </Chip>
                ) : (
                  <GaugeButton
                    done={pN.done}
                    total={pN.total}
                    label="Classer le National"
                    onClick={() => close("N")}
                    disabled={!phaseComplete(state, "N")}
                  />
                )}
              </>
            }
          >
            <Bracket
              phase="N"
              rounds={["R16", "QF", "SF", "F"]}
              editableRounds={["QF", "SF", "F"]}
              withArbitre
              zoomable
              championNote={`vainqueur National · ${euros(prizes.national.lines[0]?.amount ?? 0)}`}
            />
          </Card>
          <PrizesCard />
          {finished ? (
            <Banner
              className="scroll-mt-4"
              icon={Flag}
              tone="gold"
              actions={
                <>
                  <Button icon={Download} onClick={exportJson}>
                    JSON 5 Quilles
                  </Button>
                  <Button variant="primary" icon={Trophy} onClick={() => setShowTables(false)}>
                    Voir le podium
                  </Button>
                </>
              }
            >
              Tournoi clôturé · tableaux finaux et primes imprimables
            </Banner>
          ) : null}
        </div>
      )}

      <PrintCenter day="dimanche" open={printOpen} onClose={() => setPrintOpen(false)} />
    </section>
  );
}

function PrizesCard() {
  const { state } = useTournament();
  const p = useMemo(() => computePrizes(state), [state]);
  const block = (
    title: string,
    total: number,
    lines: typeof p.masters.lines,
    tone: "gold" | "green",
  ) => (
    <div className="min-w-0">
      <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
        <h4 className="text-[13.5px] font-bold">{title}</h4>
        <Chip tone={tone}>
          <RollingNumber value={euros(total)} />
        </Chip>
      </div>
      <table className="w-full text-[12.5px]">
        <tbody>
          {lines.map((l) => (
            <tr key={l.label} className="border-line border-t">
              <td className="px-4 py-1.5 font-semibold">{l.label}</td>
              <td className="text-ink-muted px-2 py-1.5 text-right font-mono whitespace-nowrap">
                {l.count} × <RollingNumber value={euros(l.amount)} />
              </td>
              <td className="text-ink-muted max-w-0 truncate px-4 py-1.5 text-[11.5px]">
                {l.players.length ? l.players.map(nice).join(", ") : "à venir"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <Card
      title="Primes"
      aside={
        <Chip tone="grey">
          {state.rules.inscriptionFee} € × {p.payers} + {euros(p.ffb)} FFB + {euros(p.club)} club ={" "}
          {euros(p.cagnotte)}
        </Chip>
      }
      bodyClassName="grid gap-2 md:grid-cols-2"
    >
      {block("Masters · 80 %", p.masters.total, p.masters.lines, "gold")}
      {block("National · 20 %", p.national.total, p.national.lines, "green")}
    </Card>
  );
}

function Podium({ onTables, onExport }: { onTables: () => void; onExport: () => void }) {
  const { state } = useTournament();
  const prizes = computePrizes(state);
  const step = (phase: "N" | "M") => {
    const place = bracketPlacement(state, phase);
    const of = (r: number) => [...place.entries()].filter(([, v]) => v === r).map(([k]) => k);
    return { first: of(1)[0] ?? "", second: of(2)[0] ?? "", third: of(3) };
  };
  const block = (title: string, phase: "N" | "M", amounts: number[]) => {
    const s = step(phase);
    const tile = (name: string, rank: string, amount: number, big: boolean) => (
      <div
        key={rank + name}
        className={cx("animate-pop flex flex-col items-center gap-2 text-center", big && "-mt-6")}
      >
        <Avatar name={name || "?"} size={big ? "xl" : "lg"} crown={big} />
        <div>
          <div className="text-ink-muted font-mono text-[11px] font-bold">{rank}</div>
          <div className={cx("font-extrabold", big ? "text-[16px]" : "text-[13px]")}>
            {name ? nice(name) : "—"}
          </div>
          <div className="text-gold-ink font-mono text-[12px] font-bold">{euros(amount)}</div>
        </div>
      </div>
    );
    return (
      <Card
        title={title}
        aside={
          <Chip tone="gold" icon={Trophy}>
            {plural(2 + s.third.length, "récompensé")}
          </Chip>
        }
      >
        <div className="grid grid-cols-3 items-end gap-3 px-4 pt-6 pb-5">
          {tile(s.second, "2e", amounts[1] ?? 0, false)}
          {tile(s.first, "1er", amounts[0] ?? 0, true)}
          {tile(s.third[0] ?? "", "3e", amounts[2] ?? 0, false)}
        </div>
        {s.third[1] ? (
          <div className="text-ink-muted border-line border-t px-4 py-2 text-center text-[12px]">
            Demi-finaliste : {nice(s.third[1])} · {euros(amounts[2] ?? 0)}
          </div>
        ) : null}
      </Card>
    );
  };
  const am = (lines: typeof prizes.masters.lines) => lines.map((l) => l.amount);
  return (
    <div className="flex flex-col gap-3.5">
      <Banner
        icon={Check}
        tone="gold"
        actions={
          <>
            <Button icon={Download} onClick={onExport}>
              JSON 5 Quilles
            </Button>
            <Button onClick={onTables}>Revoir les tableaux</Button>
          </>
        }
      >
        {state.info?.name} · {state.info?.city} : tournoi clôturé. Cagnotte {euros(prizes.cagnotte)}{" "}
        · {plural(state.players.length, "joueur")}.
      </Banner>
      <div className="grid gap-3.5 md:grid-cols-2">
        {block("Masters", "M", am(prizes.masters.lines))}
        {block("National", "N", am(prizes.national.lines))}
      </div>
      <PrizesCard />
    </div>
  );
}

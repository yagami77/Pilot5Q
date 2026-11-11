/**
 * Dimanche : tableaux finaux Masters et National, primes en volet repliable, résumé de fin et
 * clôture du tournoi.
 *
 * Retours du 11 novembre : plus de tâche « Arbitres renseignés » (les arbitres restent
 * facultatifs dans la saisie de chaque match) ; primes en haut de page dans un volet qui se
 * replie ; podium avec 3e et 4e distincts ; un seul bouton « Clôturer le tournoi » (barre des
 * tâches), après quoi seul le responsable peut rouvrir ; plus de téléchargement du JSON.
 */
import { Check, Flag, LockKeyhole, Printer, RotateCcw, Trophy, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Bracket } from "@/components/Bracket";
import { DayTasks } from "@/components/DayTasks";
import { PrintCenter } from "@/components/PrintCenter";
import { useToast } from "@/components/Toast";
import { Avatar, Banner, Button, Card, Chip, GaugeButton, PageHead, cx } from "@/components/ui";
import { PrimesPanel, euro2, usePanelOpen } from "@/dj/Primes";
import { closureWhen } from "@/lib/closure";
import { phaseComplete } from "@/lib/engine";
import { pendingOf, useAutoFill } from "@/lib/fill";
import { longDate, nice } from "@/lib/format";
import { celebrate } from "@/lib/motion";
import { podiumOf } from "@/lib/podium";
import { progressivePrimes, type PrimesSheet } from "@/lib/primes";
import { bracketWinner, dayDate, distanceLabel, phaseDistance } from "@/lib/tournament";
import { useEditLock, useTournament } from "@/store/tournament";

/** Montant d'un palier de primes (« 1er », « 2e », « Perdants demies »…). */
function primeOf(sheet: PrimesSheet, phase: "M" | "N", label: string): number {
  return sheet.lines.find((l) => l.phase === phase && l.label === label)?.amount ?? 0;
}

export function Dimanche() {
  const { state, dispatch, id, closure, reopening } = useTournament();
  const toast = useToast();
  const ro = useEditLock();
  const [printOpen, setPrintOpen] = useState(false);
  const [showTables, setShowTables] = useState(false);
  // Volet des primes : ouvert à la première visite, puis tel qu'il a été laissé
  const [primesOpen, setPrimesOpen] = usePanelOpen(`primes:${id ?? ""}`);
  const sheet = useMemo(() => progressivePrimes(state), [state]);
  const closedM = Boolean(state.closed.M);
  const closedN = Boolean(state.closed.N);
  // Les deux tableaux sont classés : le résumé de fin remplace les tableaux
  const ranked = closedM && closedN;
  const d = phaseDistance(state, "M", "F");
  // Confettis quand les deux tableaux viennent d'être classés
  const wasRanked = useRef(ranked);
  useEffect(() => {
    if (ranked && !wasRanked.current) {
      const t = window.setTimeout(() => void celebrate(null, 220), 350);
      wasRanked.current = true;
      return () => window.clearTimeout(t);
    }
    wasRanked.current = ranked;
    return undefined;
  }, [ranked]);

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
    toast(phase === "M" ? "Masters classés" : "National classé");
  };

  const reopen = (phase: "N" | "M") => {
    dispatch({ type: "phase.reopened", payload: { phase } });
    setShowTables(true);
    toast("Saisie rouverte : les scores peuvent être corrigés");
  };

  /** Vainqueur affiché et, tant que le tournoi n'est pas clôturé, retour à la saisie. */
  const ranking = (phase: "N" | "M") => (
    <>
      <Chip tone="gold" icon={Trophy}>
        Vainqueur : {nice(bracketWinner(state, phase) ?? "")}
      </Chip>
      {!ro ? (
        <Button size="sm" icon={RotateCcw} onClick={() => reopen(phase)}>
          Rouvrir la saisie
        </Button>
      ) : null}
    </>
  );

  return (
    <section className="cascade">
      <DayTasks day="dimanche" />
      <PageHead
        eyebrow={longDate(dayDate(state, "dimanche"))}
        title={
          closure ? "Tournoi clôturé" : ranked && !showTables ? "Tournoi terminé" : "Phases finales"
        }
        help="Quarts, demies et finales Masters et National. Les arbitres (numéro de licence) peuvent être notés à la saisie de chaque match : c'est facultatif. Trente minutes de pause minimum entre deux paliers pour un même joueur."
      >
        {!ranked && !ro ? (
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
        {/* Primes : en haut de page, dans un volet qui se replie (état mémorisé) */}
        <PrimesPanel id="primes" open={primesOpen} onToggle={setPrimesOpen} />

        {ranked && !showTables ? (
          <Summary onTables={() => setShowTables(true)} />
        ) : (
          <>
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
                    ranking("M")
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
                championNote={`vainqueur Masters · ${euro2(primeOf(sheet, "M", "1er"))}`}
              />
            </Card>
            <Card
              id="national"
              title="National"
              aside={
                <>
                  <Chip tone="green">Huitièmes joués le samedi · puis {distanceLabel(d)}</Chip>
                  {closedN ? (
                    ranking("N")
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
                championNote={`vainqueur National · ${euro2(primeOf(sheet, "N", "1er"))}`}
              />
            </Card>
            {ranked ? (
              <Banner
                icon={closure ? LockKeyhole : Check}
                tone="gold"
                actions={
                  <Button variant="primary" icon={Trophy} onClick={() => setShowTables(false)}>
                    Voir le résumé
                  </Button>
                }
              >
                {closure
                  ? "Tournoi clôturé · tableaux finaux et primes imprimables"
                  : reopening
                    ? "Tournoi rouvert par le responsable pour correction"
                    : "Tableaux classés · le tournoi peut être clôturé"}
              </Banner>
            ) : null}
          </>
        )}
      </div>

      <PrintCenter day="dimanche" open={printOpen} onClose={() => setPrintOpen(false)} />
    </section>
  );
}

/* ---------- Résumé de fin : podiums Masters et National ---------- */

function Summary({ onTables }: { onTables: () => void }) {
  const { state, closure, reopening, canReopen } = useTournament();
  const consolante = bracketWinner(state, "CLS");
  // Photo du joueur si l'application 5 Quilles en fournit une (sinon le nom seul)
  const photoOf = (n: string) => state.players.find((p) => p.name === n)?.photoUrl ?? null;

  const block = (title: string, phase: "N" | "M") => {
    const { places } = podiumOf(state, phase);
    // Pas de montant ici : les primes sont dans le volet du haut (le rang vient du classement final)
    const tile = (index: number, rank: string) => {
      const name = places[index] ?? "";
      const big = index === 0;
      return (
        <div
          key={rank}
          className={cx(
            "animate-pop flex min-w-0 flex-col items-center gap-2 text-center",
            big && "sm:-mt-6",
          )}
          style={{ animationDelay: `${index * 90}ms` }}
          aria-label={`${rank} ${title} : ${name ? nice(name) : "à venir"}`}
        >
          <Avatar name={name || "?"} photoUrl={photoOf(name)} size={big ? "xl" : "lg"} />
          <div className="min-w-0 max-w-full">
            <div
              className={cx(
                "font-mono text-[11px] font-bold",
                big ? "text-gold-ink" : "text-ink-muted",
              )}
            >
              {rank}
            </div>
            <div className={cx("truncate font-extrabold", big ? "text-[16px]" : "text-[13px]")}>
              {name ? nice(name) : "–"}
            </div>
          </div>
        </div>
      );
    };
    return (
      <Card
        title={title}
        aside={
          <Chip tone="gold" icon={Trophy}>
            {places.filter(Boolean).length} récompensés
          </Chip>
        }
      >
        {/* 2e, 1er, 3e, 4e : le vainqueur surélevé, 3e et 4e chacun à sa place */}
        <div className="grid grid-cols-2 items-end gap-x-3 gap-y-5 px-4 pt-8 pb-5 sm:grid-cols-4">
          {tile(1, "2e")}
          {tile(0, "1er")}
          {tile(2, "3e")}
          {tile(3, "4e")}
        </div>
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Banner
        icon={closure ? LockKeyhole : Flag}
        tone="gold"
        className="mt-0"
        actions={<Button onClick={onTables}>Revoir les tableaux</Button>}
      >
        {state.info?.name} · {state.info?.city} :{" "}
        {closure
          ? `tournoi clôturé le ${closureWhen(closure.at)}${closure.by ? ` par ${closure.by}` : ""}. Toute correction passe désormais par le responsable national.`
          : reopening && !canReopen
            ? "tournoi rouvert par le responsable national pour correction. Vous êtes en consultation seule."
            : reopening
              ? "tournoi rouvert pour correction. Clôturez-le de nouveau avec le bouton « Clôturer le tournoi », en haut de la page."
              : "tout est classé. Il reste à clôturer le tournoi avec le bouton « Clôturer le tournoi », en haut de la page."}
      </Banner>
      <div className="grid gap-3.5 md:grid-cols-2">
        {block("Masters", "M")}
        {block("National", "N")}
      </div>
      {consolante ? (
        <div className="card text-ink-secondary flex flex-wrap items-center gap-2.5 px-4 py-3 text-[13px]">
          <Avatar name={consolante} photoUrl={photoOf(consolante)} size="sm" />
          <span>
            Consolante : vainqueur <b className="text-ink">{nice(consolante)}</b>
          </span>
        </div>
      ) : null}
    </div>
  );
}

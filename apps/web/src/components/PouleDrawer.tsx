/**
 * Tiroir de saisie d'une poule (560 px à droite) : matchs dans l'ordre du code sportif en lignes
 * compactes (les six matchs tiennent sans défilement à 900 px de haut), arbitre indiqué, saisie
 * clavier (Espace = distance, Tab, Échap), poule précédente / suivante, forfait ou abandon d'un
 * joueur. Le classement n'y figure plus : il est dans la grille (mode « Classement »). Les
 * numéros 1 à 4 restent, comme sur les feuilles de match papier dont on recopie les scores.
 */
import type { Match } from "@pilot5q/domain";
import { Check, ChevronLeft, ChevronRight, UserX, X } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { forfaitsOf, isValidScore, matchOutcome, matchWinner } from "@/lib/engine";
import { nice, shortName } from "@/lib/format";
import {
  billardType,
  distanceLabel,
  orderedMatches,
  phaseDistance,
  pouleBillards,
} from "@/lib/tournament";
import { useEditLock, useTournament } from "@/store/tournament";

import {
  ScoreCell,
  ScoreEditor,
  draftMatch,
  draftOf,
  scoreOf,
  scoreState,
  type ScoreDraft,
} from "./ScoreEditor";
import { useToast } from "./Toast";
import { Button, NumBadge, cx } from "./ui";

export function PouleDrawer({
  phase,
  pouleNum,
  onClose,
  onNavigate,
}: {
  phase: "PREQ" | "QN" | "QM";
  pouleNum: number | null;
  onClose: () => void;
  onNavigate: (num: number) => void;
}) {
  const open = pouleNum !== null;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="scrim"
            className="no-print fixed inset-0 z-50 bg-[rgb(15_27_51/0.28)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            role="presentation"
          />
          <motion.aside
            key="drawer"
            aria-label="Saisie des scores"
            className="no-print bg-surface fixed inset-y-0 right-0 z-[60] flex w-full max-w-[560px] flex-col shadow-[-24px_0_60px_-30px_rgb(14_55_168/0.35)]"
            initial={{ x: "104%" }}
            animate={{ x: 0 }}
            exit={{ x: "104%" }}
            transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <DrawerBody
              key={`${phase}-${pouleNum}`}
              phase={phase}
              pouleNum={pouleNum}
              onClose={onClose}
              onNavigate={onNavigate}
            />
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function DrawerBody({
  phase,
  pouleNum,
  onClose,
  onNavigate,
}: {
  phase: "PREQ" | "QN" | "QM";
  pouleNum: number;
  onClose: () => void;
  onNavigate: (num: number) => void;
}) {
  const { state, dispatch } = useTournament();
  const toast = useToast();
  const poules = state.poules[phase];
  const poule = poules.find((p) => p.num === pouleNum);
  const d = phaseDistance(state, phase);
  const editLock = useEditLock();
  const locked = Boolean(state.closed[phase]) || editLock;
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const first =
        rootRef.current?.querySelector<HTMLInputElement>(
          "input[data-score]:not(:disabled):placeholder-shown",
        ) ?? rootRef.current?.querySelector<HTMLInputElement>("input[data-score]:not(:disabled)");
      first?.focus();
    }, 450);
    return () => window.clearTimeout(t);
  }, [pouleNum]);

  const forfaits = useMemo(() => new Set(forfaitsOf(state, phase)), [state, phase]);

  const merged = useMemo(() => {
    if (!poule) return null;
    return {
      ...poule,
      matches: poule.matches.map((m) => {
        const dr = drafts[m.id];
        return dr ? draftMatch(m, dr, d) : m;
      }),
    };
  }, [poule, drafts, d]);

  if (!poule || !merged) return null;

  const bills = pouleBillards(state, phase, poule);
  const ordered = orderedMatches(merged, d);
  const idx = poules.findIndex((p) => p.num === pouleNum);
  const prev = poules[(idx - 1 + poules.length) % poules.length];
  const next = poules[(idx + 1) % poules.length];

  const commit = (m: Match, draft: ScoreDraft) => {
    const s = scoreOf(draft, d);
    const same =
      s.sa === m.sa &&
      s.sb === m.sb &&
      JSON.stringify(s.setsA ?? null) === JSON.stringify(m.setsA ?? null) &&
      JSON.stringify(s.setsB ?? null) === JSON.stringify(m.setsB ?? null);
    if (same) return;
    dispatch({
      type: "score.entered",
      payload: { phase, matchId: m.id, sa: s.sa, sb: s.sb, setsA: s.setsA, setsB: s.setsB },
    });
  };

  const commitAll = () => {
    for (const m of poule.matches) {
      const dr = drafts[m.id];
      if (dr) commit(m, dr);
    }
  };

  const declareForfait = (name: string) => {
    const played = poule.matches.some(
      (m) => (m.a === name || m.b === name) && matchOutcome(m, d) !== null,
    );
    const kind = played ? "abandon" : "forfait";
    const label = played
      ? "abandon (ses matchs joués sont conservés pour ses adversaires)"
      : "forfait";
    if (!window.confirm(`Déclarer ${nice(name)} ${label} ? Il ne marque aucun point.`)) return;
    dispatch({ type: "forfait.declared", payload: { phase, player: name, kind } });
    toast(`${nice(name)} : ${kind} enregistré`);
  };

  return (
    <div ref={rootRef} data-score-root className="flex h-full flex-col">
      <div className="border-line flex items-center gap-3 border-b px-4 py-3">
        <span className="bg-brand grid size-[40px] shrink-0 place-items-center rounded-[11px] font-mono text-[18px] font-extrabold text-white shadow-[0_8px_18px_-10px_rgb(14_55_168/0.7)]">
          {pouleNum}
        </span>
        <div className="min-w-0">
          <h3 className="text-[17px] leading-tight font-extrabold tracking-[-0.02em]">
            Poule {pouleNum}
          </h3>
          <div className="text-ink-muted text-[12px]">
            Billard {bills.join(" & ")} · {billardType(state, bills[0])} · {distanceLabel(d)}
            {locked ? " · phase classée (lecture seule)" : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="bg-surface-2 border-line ml-auto grid size-[34px] place-items-center rounded-[10px] border"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 overflow-auto px-4 pt-3 pb-4">
        <div className="text-ink-muted flex flex-wrap items-center gap-2 text-[11.5px]">
          <span className="kbd">Espace</span> met {d.pointsParSet} au joueur
          <span className="kbd">Tab</span> case suivante
          <span className="kbd">Échap</span> fermer
        </div>

        <LayoutGroup id={`dr-${phase}-${pouleNum}`}>
          <div className="flex flex-col gap-1.5">
            {ordered.map((om, i) => {
              const m = om.match;
              const base = poule.matches.find((x) => x.id === m.id) ?? m;
              const draft = drafts[m.id] ?? draftOf(base, d);
              const valid = isValidScore(m, d);
              // Incohérent, à ne pas confondre avec un match en plusieurs sets en cours
              const invalid = scoreState(m, d) === "invalid";
              const ff = forfaits.has(m.a) || forfaits.has(m.b);
              const multi = d.setsGagnants > 1;
              const w = valid ? matchWinner(m, d) : null;
              const name = (n: string, right: boolean) => (
                <div
                  className={cx(
                    "flex min-w-0 items-center gap-1.5",
                    right && "flex-row-reverse text-right",
                  )}
                >
                  <NumBadge n={poule.players.indexOf(n) + 1} tone={w === n ? "gold" : "default"} />
                  <span
                    className={cx(
                      "min-w-0 truncate text-[13px]",
                      w === n ? "font-bold" : "font-semibold",
                      w && w !== n && "text-ink-muted",
                      forfaits.has(n) && "text-ink-muted line-through",
                    )}
                  >
                    {nice(n)}
                  </span>
                </div>
              );
              const cell = (who: "a" | "b") => (
                <ScoreCell
                  who={who}
                  match={base}
                  draft={draft}
                  onDraft={(nd) => setDrafts({ ...drafts, [m.id]: nd })}
                  onCommit={(nd) => commit(base, nd)}
                  disabled={locked || ff}
                  idBase={`m-${m.id}`}
                  d={d}
                  size="sm"
                />
              );
              return (
                <motion.div
                  key={m.id}
                  layout="position"
                  layoutDependency={i}
                  transition={{ layout: { duration: 0.36, ease: [0.2, 0.8, 0.2, 1] } }}
                  className={cx(
                    "border-line bg-surface rounded-[11px] border transition-[border-color,box-shadow,background-color] duration-300",
                    valid && !ff && "border-[#bfe6d2] bg-[linear-gradient(180deg,#fff,#f3fbf6)]",
                    invalid && "border-[#f5bfc9]",
                    ff && "opacity-70",
                  )}
                  data-match-row={m.id}
                >
                  <div className="text-ink-muted flex items-center gap-1.5 px-2.5 pt-[5px] text-[10.5px] leading-none font-bold tracking-[0.05em] uppercase">
                    Match {i + 1}
                    <span className="font-semibold tracking-normal normal-case">· {om.label}</span>
                    <span className="ml-auto truncate font-medium tracking-normal normal-case">
                      {ff
                        ? "Forfait · adversaire vainqueur"
                        : om.arbitre
                          ? `Arbitre : ${shortName(om.arbitre)}`
                          : ""}
                    </span>
                  </div>
                  {multi ? (
                    <div className="px-2.5 pt-1 pb-1.5">
                      <ScoreEditor
                        match={base}
                        distance={d}
                        draft={draft}
                        onDraft={(nd) => setDrafts({ ...drafts, [m.id]: nd })}
                        onCommit={(nd) => commit(base, nd)}
                        disabled={locked || ff}
                        idBase={`m-${m.id}`}
                        layout="inline"
                        size="sm"
                        compact
                        renderLabel={(who) => name(who === "a" ? m.a : m.b, false)}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2.5 pt-1 pb-[7px]">
                      {name(m.a, false)}
                      <div data-match={m.id} className="flex items-center gap-1">
                        {cell("a")}
                        <span className="text-ink-muted text-[10px] font-bold">–</span>
                        {cell("b")}
                      </div>
                      {name(m.b, true)}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </LayoutGroup>

        {!locked ? (
          <div className="text-ink-muted mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
            <span className="font-semibold">Forfait ou abandon :</span>
            {poule.players
              .filter((n) => !forfaits.has(n))
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => declareForfait(n)}
                  className="border-line-2 hover:border-alert/50 hover:text-alert-ink inline-flex items-center gap-1 rounded-[7px] border px-1.5 py-[2px] font-semibold transition-colors"
                >
                  <UserX className="size-3" aria-hidden="true" />
                  {shortName(n)}
                </button>
              ))}
          </div>
        ) : null}
      </div>

      <div className="border-line bg-surface-2 flex items-center gap-2.5 border-t px-4 py-2.5">
        <Button
          icon={ChevronLeft}
          onClick={() => {
            commitAll();
            if (prev) onNavigate(prev.num);
          }}
        >
          Poule {prev?.num}
        </Button>
        <Button
          iconRight={ChevronRight}
          onClick={() => {
            commitAll();
            if (next) onNavigate(next.num);
          }}
        >
          Poule {next?.num}
        </Button>
        <Button
          variant="primary"
          icon={Check}
          className="ml-auto"
          onClick={() => {
            commitAll();
            onClose();
            toast(`Poule ${pouleNum} enregistrée`);
          }}
        >
          Valider
        </Button>
      </div>
    </div>
  );
}

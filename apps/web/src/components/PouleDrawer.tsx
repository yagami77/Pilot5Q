/**
 * Tiroir de saisie d'une poule (560 px à droite) : matchs dans l'ordre du code sportif,
 * arbitre indiqué, saisie clavier, classement de la poule réordonné en direct (FLIP),
 * forfait ou abandon d'un joueur.
 */
import type { Match } from "@pilot5q/domain";
import { Check, ChevronLeft, ChevronRight, UserX, X } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { forfaitsOf, isValidScore, matchOutcome, rankPouleInPhase } from "@/lib/engine";
import { clubShort, moy, nice, shortName } from "@/lib/format";
import {
  arriveeOf,
  billardType,
  distanceLabel,
  orderedMatches,
  phaseDistance,
  playerByName,
  pouleBillards,
} from "@/lib/tournament";
import { useTournament } from "@/store/tournament";

import { ScoreEditor, draftMatch, draftOf, scoreOf, type ScoreDraft } from "./ScoreEditor";
import { useToast } from "./Toast";
import { Avatar, Button, PlayerLine, cx } from "./ui";

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
  const locked = Boolean(state.closed[phase]);
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

  const by = playerByName(state);
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
  const rank = rankPouleInPhase(merged, d, arriveeOf(state), [...forfaits]);
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
      <div className="border-line flex items-center gap-3 border-b px-5 py-4">
        <Avatar name={`P ${pouleNum}`} size="lg" />
        <div className="min-w-0">
          <h3 className="text-[18px] font-extrabold tracking-[-0.02em]">Poule {pouleNum}</h3>
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

      <div className="flex flex-1 flex-col gap-4 overflow-auto px-5 pt-4 pb-6">
        <div className="text-ink-muted flex flex-wrap items-center gap-2.5 text-[12px]">
          <span className="kbd">Espace</span> met {d.pointsParSet} au joueur
          <span className="kbd">Tab</span> case suivante
          <span className="kbd">Échap</span> fermer
        </div>

        <div className="flex flex-col gap-2.5">
          {ordered.map((om, i) => {
            const m = om.match;
            const base = poule.matches.find((x) => x.id === m.id) ?? m;
            const draft = drafts[m.id] ?? draftOf(base, d);
            const valid = isValidScore(m, d);
            const touched = m.sa !== null || m.sb !== null;
            const bothSet = m.sa !== null && m.sb !== null;
            const ff = forfaits.has(m.a) || forfaits.has(m.b);
            const multi = d.setsGagnants > 1;
            const line = (name: string, who: "a" | "b") => (
              <div
                className={cx(
                  "grid items-center gap-2.5 px-3 py-[7px]",
                  multi ? "grid-cols-[34px_1fr]" : "grid-cols-[34px_1fr_72px]",
                  who === "b" && "border-line border-t border-dashed",
                )}
              >
                <Avatar name={name} size="md" />
                <div className="min-w-0">
                  <div
                    className={cx(
                      "truncate text-[13px] font-semibold",
                      forfaits.has(name) && "text-ink-muted line-through",
                    )}
                  >
                    {nice(name)}
                  </div>
                  <div className="text-ink-muted text-[11px]">
                    {clubShort(by.get(name)?.club ?? "")}
                  </div>
                </div>
                {!multi ? (
                  <ScoreEditorSlot
                    who={who}
                    match={base}
                    draft={draft}
                    onDraft={(nd) => setDrafts({ ...drafts, [m.id]: nd })}
                    onCommit={(nd) => commit(base, nd)}
                    disabled={locked || ff}
                    idBase={`m-${m.id}`}
                    d={d}
                  />
                ) : null}
              </div>
            );
            return (
              <div
                key={m.id}
                className={cx(
                  "border-line bg-surface overflow-hidden rounded-[12px] border transition-[border-color,box-shadow] duration-300",
                  valid && !ff && "border-[#bfe6d2] bg-[linear-gradient(180deg,#fff,#f3fbf6)]",
                  touched && bothSet && !valid && "border-[#f5bfc9]",
                  ff && "opacity-70",
                )}
              >
                <div className="bg-surface-2 text-ink-muted flex items-center gap-2 px-3 py-[7px] text-[11px] font-bold tracking-[0.06em] uppercase">
                  Match {i + 1}
                  <span className="font-semibold normal-case tracking-normal">· {om.label}</span>
                  <span className="ml-auto font-medium normal-case tracking-normal">
                    {ff
                      ? "Forfait · adversaire vainqueur"
                      : om.arbitre
                        ? `Arbitre : ${shortName(om.arbitre)}`
                        : ""}
                  </span>
                </div>
                {line(m.a, "a")}
                {line(m.b, "b")}
                {multi ? (
                  <div className="border-line border-t border-dashed px-3 py-2">
                    <ScoreEditor
                      match={base}
                      distance={d}
                      draft={draft}
                      onDraft={(nd) => setDrafts({ ...drafts, [m.id]: nd })}
                      onCommit={(nd) => commit(base, nd)}
                      disabled={locked || ff}
                      idBase={`m-${m.id}`}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div>
          <div className="text-ink-secondary mb-1.5 text-[12px] font-bold">
            Classement de la poule
          </div>
          <div className="border-line overflow-hidden rounded-[12px] border">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-surface-2 text-ink-muted text-left text-[10.5px] tracking-[0.06em] uppercase">
                  <th className="px-2.5 py-2">#</th>
                  <th className="px-2.5 py-2">Joueur</th>
                  <th className="px-2.5 py-2 text-right">Pm</th>
                  <th className="px-2.5 py-2 text-right">Ps</th>
                  <th className="px-2.5 py-2 text-right">Faits</th>
                  <th className="px-2.5 py-2 text-right">Subis</th>
                  <th className="px-2.5 py-2 text-right">Moy.</th>
                </tr>
              </thead>
              <LayoutGroup id={`rk-${phase}-${pouleNum}`}>
                <tbody>
                  {rank.rows.map((r, i) => (
                    <motion.tr
                      key={r.name}
                      layout
                      transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
                      className={cx(
                        "border-line border-t",
                        rank.complete && i === 0 && "shadow-[inset_3px_0_0_var(--color-gold)]",
                      )}
                    >
                      <td className="text-ink-secondary px-2.5 py-[7px] font-mono font-extrabold">
                        {rank.complete ? i + 1 : "–"}
                      </td>
                      <td className="px-2.5 py-[7px]">
                        <PlayerLine name={r.name} size="sm" muted={forfaits.has(r.name)} />
                      </td>
                      <td className="px-2.5 py-[7px] text-right font-mono">{r.ptm}</td>
                      <td className="px-2.5 py-[7px] text-right font-mono">{r.pts}</td>
                      <td className="px-2.5 py-[7px] text-right font-mono">{r.faits}</td>
                      <td className="px-2.5 py-[7px] text-right font-mono">{r.subis}</td>
                      <td className="px-2.5 py-[7px] text-right font-mono">{moy(r.moy)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </LayoutGroup>
            </table>
          </div>
        </div>

        {!locked ? (
          <div>
            <div className="text-ink-secondary mb-1.5 text-[12px] font-bold">
              Forfait ou abandon
            </div>
            <div className="flex flex-wrap gap-1.5">
              {poule.players
                .filter((n) => !forfaits.has(n))
                .map((n) => (
                  <Button key={n} size="sm" icon={UserX} onClick={() => declareForfait(n)}>
                    {shortName(n)}
                  </Button>
                ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-line bg-surface-2 flex items-center gap-2.5 border-t px-5 py-3">
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

/** Une seule case (joueur A ou B) d'un match à un set, dans la grille du tiroir. */
function ScoreEditorSlot({
  who,
  match,
  draft,
  onDraft,
  onCommit,
  disabled,
  idBase,
  d,
}: {
  who: "a" | "b";
  match: Match;
  draft: ScoreDraft;
  onDraft: (n: ScoreDraft) => void;
  onCommit: (n: ScoreDraft) => void;
  disabled?: boolean;
  idBase: string;
  d: { pointsParSet: number; setsGagnants: number };
}) {
  // Les deux cases d'un match partagent le même brouillon ; on rend celle du joueur demandé.
  const current = draftMatch(match, draft, d);
  const valid = isValidScore(current, d);
  const value = who === "a" ? draft.sa : draft.sb;
  const bad = current.sa !== null && current.sb !== null && !valid;
  return (
    <div data-match={match.id} className="contents">
      <input
        id={`${idBase}-${who}`}
        type="number"
        inputMode="numeric"
        min={0}
        max={d.pointsParSet}
        data-score="true"
        aria-label={`Score de ${nice(who === "a" ? match.a : match.b)}`}
        disabled={disabled}
        placeholder="–"
        value={value ?? ""}
        className={cx(
          "score-input",
          value === d.pointsParSet && valid && "win",
          (value !== null && (value < 0 || value > d.pointsParSet)) || bad ? "err" : "",
          bad && "animate-shake",
        )}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const v = e.target.value.trim() === "" ? null : Number(e.target.value);
          onDraft(who === "a" ? { ...draft, sa: v } : { ...draft, sb: v });
        }}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key !== " " && e.key !== "Enter") return;
          e.preventDefault();
          const next =
            e.key === " "
              ? who === "a"
                ? { ...draft, sa: d.pointsParSet }
                : { ...draft, sb: d.pointsParSet }
              : draft;
          onDraft(next);
          onCommit(next);
          const root = e.currentTarget.closest("[data-score-root]") ?? document;
          const all = [...root.querySelectorAll<HTMLInputElement>("input[data-score]")].filter(
            (i) => !i.disabled,
          );
          const idx = all.indexOf(e.currentTarget);
          const sibling = all[who === "a" ? idx + 1 : idx - 1];
          const target =
            sibling &&
            sibling.value === "" &&
            sibling.closest("[data-match]") === e.currentTarget.closest("[data-match]")
              ? sibling
              : (all.slice(idx + 1).find((i) => i.value === "") ?? all[idx + 1]);
          target?.focus();
          target?.select();
        }}
      />
    </div>
  );
}

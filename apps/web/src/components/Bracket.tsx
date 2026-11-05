/** Tableau à élimination directe : colonnes par tour, saisie des scores et de l'arbitre. */
import type { BracketMatch, BracketRound } from "@pilot5q/domain";
import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { isValidScore, matchWinner } from "@/lib/engine";
import { nice, shortName } from "@/lib/format";
import { distanceLabel, phaseDistance, roundLabel, roundShort } from "@/lib/tournament";
import { useTournament } from "@/store/tournament";

import { ScoreEditor, draftOf, scoreOf, type ScoreDraft } from "./ScoreEditor";
import { Avatar, cx } from "./ui";

export function Bracket({
  phase,
  rounds,
  editableRounds,
  withArbitre = false,
  delays = true,
}: {
  phase: "N" | "M" | "CLS";
  rounds?: BracketRound[];
  /** Tours dont les scores sont saisissables (par défaut tous les tours affichés). */
  editableRounds?: BracketRound[];
  withArbitre?: boolean;
  delays?: boolean;
}) {
  const { state } = useTournament();
  const all = state.brackets[phase];
  const shown = (rounds ?? (["R64", "R32", "R16", "QF", "SF", "F"] as BracketRound[])).filter((r) =>
    all.some((m) => m.round === r),
  );
  const locked = Boolean(state.closed[phase]);
  if (shown.length === 0) {
    return (
      <p className="text-ink-muted px-4 pb-4 text-[13px]">
        Le tableau se remplira à la clôture des poules.
      </p>
    );
  }
  let k = 0;
  // Un seul tour : grille compacte plutôt qu'une colonne
  const single = shown.length === 1;
  return (
    <div className={cx("px-4 pt-3 pb-4", !single && "flex gap-3 overflow-x-auto")} data-score-root>
      {shown.map((r) => {
        const d = phaseDistance(state, phase, r);
        const matches = all.filter((m) => m.round === r).sort((x, y) => x.slot - y.slot);
        const editable = !locked && (editableRounds ?? shown).includes(r);
        return (
          <div
            key={r}
            className={cx(
              "flex flex-col gap-2.5",
              !single && "min-w-[220px] flex-1 justify-around",
            )}
          >
            <h4 className="text-ink-muted mb-1 text-[11px] font-bold tracking-[0.07em] uppercase">
              {roundLabel(r)} · {distanceLabel(d)}
            </h4>
            <div className={cx(single ? "grid grid-cols-2 gap-2.5 md:grid-cols-4" : "contents")}>
              {matches.map((m) => (
                <Slot
                  key={m.id}
                  phase={phase}
                  match={m}
                  editable={editable}
                  withArbitre={withArbitre && r !== "R16"}
                  delay={delays ? k++ * 40 : 0}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Slot({
  phase,
  match,
  editable,
  withArbitre,
  delay,
}: {
  phase: "N" | "M" | "CLS";
  match: BracketMatch;
  editable: boolean;
  withArbitre: boolean;
  delay: number;
}) {
  const { state, dispatch } = useTournament();
  const d = phaseDistance(state, phase, match.round);
  const multi = d.setsGagnants > 1;
  const [draft, setDraft] = useState<ScoreDraft>(() => draftOf(match, d));
  const [openEditor, setOpenEditor] = useState(false);
  const [arbitre, setArbitre] = useState(match.arbitre ?? "");
  const key = `${match.id}:${match.a}:${match.b}:${match.sa}:${match.sb}:${JSON.stringify(match.setsA ?? null)}`;
  const last = useRef(key);
  useEffect(() => {
    if (key !== last.current) {
      last.current = key;
      setDraft(draftOf(match, d));
    }
  }, [key, match, d]);
  const ready = Boolean(match.a && match.b);
  const valid = isValidScore(match, d);
  const w = matchWinner(match, d);
  const commit = (nd: ScoreDraft) => {
    const s = scoreOf(nd, d);
    if (
      s.sa === match.sa &&
      s.sb === match.sb &&
      JSON.stringify(s.setsA ?? null) === JSON.stringify(match.setsA ?? null)
    )
      return;
    dispatch({ type: "score.entered", payload: { phase, matchId: match.id, ...s } });
  };
  const final = match.round === "F";
  const line = (name: string, label: string | undefined, who: "a" | "b") => {
    const sets = who === "a" ? match.sa : match.sb;
    return (
      <div className="flex items-center gap-2">
        {name ? (
          <Avatar name={name} size="xs" crown={w === name} />
        ) : (
          <span className="bg-line-2 size-[22px] shrink-0 rounded-full opacity-50" />
        )}
        <span
          className={cx(
            "min-w-0 flex-1 truncate text-[12.5px]",
            name ? "font-semibold" : "text-ink-muted font-medium",
            w && w !== name && name && "text-ink-muted",
          )}
        >
          {name ? nice(name) : (label ?? "")}
        </span>
        {match.forfait === who ? (
          <span className="text-alert-ink text-[10px] font-bold uppercase">forfait</span>
        ) : multi || !editable || !ready ? (
          <span
            className={cx(
              "font-mono text-[13px] font-bold tabular-nums",
              w === name ? "text-ok-ink" : "text-ink-secondary",
            )}
          >
            {sets ?? "–"}
          </span>
        ) : null}
      </div>
    );
  };
  return (
    <div
      className={cx(
        "animate-pop border-line bg-surface-2 flex flex-col gap-1.5 rounded-[10px] border px-2.5 py-2",
        final && "border-gold bg-gold-soft",
        valid && !final && "border-[#bfe6d2]",
      )}
      style={{ animationDelay: `${delay}ms` }}
      data-match={match.id}
    >
      <div className="text-ink-muted flex items-center gap-1.5 font-mono text-[10px] font-bold">
        {roundShort(match.round)}
        {match.round === "F" ? "" : match.slot}
        {match.billard ? <span>· B{match.billard}</span> : null}
        {multi && editable && ready ? (
          <button
            type="button"
            onClick={() => setOpenEditor((v) => !v)}
            className="text-brand ml-auto inline-flex items-center gap-1 font-sans text-[11px] font-bold"
            aria-expanded={openEditor}
            aria-label={`Saisir ${roundLabel(match.round)} ${match.slot}`}
          >
            <Pencil className="size-3" aria-hidden="true" />
            {valid ? "Modifier" : "Saisir"}
          </button>
        ) : null}
      </div>
      {line(match.a, match.labelA, "a")}
      {line(match.b, match.labelB, "b")}
      {!multi && editable && ready && !match.forfait ? (
        <ScoreEditor
          match={match}
          distance={d}
          draft={draft}
          onDraft={setDraft}
          onCommit={commit}
          layout="inline"
          idBase={`k-${match.id}`}
          size="sm"
        />
      ) : null}
      {multi && editable && ready && openEditor ? (
        <div className="border-line mt-1 border-t border-dashed pt-2">
          <ScoreEditor
            match={match}
            distance={d}
            draft={draft}
            onDraft={setDraft}
            onCommit={commit}
            layout="inline"
            idBase={`k-${match.id}`}
            size="sm"
          />
          <p className="text-ink-muted mt-1 text-[10.5px]">
            {match.setsA && match.setsB
              ? match.setsA.map((a, i) => `${a}-${match.setsB?.[i] ?? ""}`).join(" · ")
              : "Points de chaque set"}
          </p>
        </div>
      ) : null}
      {multi && valid && match.setsA && !openEditor ? (
        <p className="text-ink-muted font-mono text-[10.5px]">
          {match.setsA.map((a, i) => `${a}-${match.setsB?.[i] ?? ""}`).join(" · ")}
        </p>
      ) : null}
      {withArbitre && ready ? (
        <label className="text-ink-muted mt-0.5 flex items-center gap-1.5 text-[10.5px] font-semibold">
          Arbitre
          <input
            className="field h-6 flex-1 px-1.5 py-0 font-mono text-[11px]"
            placeholder="n° de licence"
            aria-label={`Licence de l'arbitre · ${roundLabel(match.round)} ${match.slot}`}
            value={arbitre}
            disabled={!editable}
            onChange={(e) => setArbitre(e.target.value)}
            onBlur={() => {
              const v = arbitre.trim();
              if (v && v !== (match.arbitre ?? ""))
                dispatch({
                  type: "arbitre.set",
                  payload: { phase, matchId: match.id, licence: v },
                });
            }}
          />
        </label>
      ) : null}
      {w && !editable ? <span className="sr-only">Vainqueur : {shortName(w)}</span> : null}
    </div>
  );
}

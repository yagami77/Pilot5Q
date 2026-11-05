/**
 * Saisie du score d'un match : un set (points) ou plusieurs sets (points par set).
 * Espace met la distance dans la case ; la validation visuelle suit docs/DESIGN.md
 * (case verte quand le score est cohérent, vibration rouge sinon).
 */
import type { Distance, Match } from "@pilot5q/domain";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { isValidScore } from "@/lib/engine";

import { cx } from "./ui";

export interface ScoreDraft {
  sa: number | null;
  sb: number | null;
  setsA?: (number | null)[];
  setsB?: (number | null)[];
}

/** Brouillon à partir d'un match enregistré. */
export function draftOf(m: Match, d: Distance): ScoreDraft {
  if (d.setsGagnants === 1) return { sa: m.sa, sb: m.sb };
  const n = 2 * d.setsGagnants - 1;
  const setsA: (number | null)[] = Array.from({ length: n }, (_, i) => m.setsA?.[i] ?? null);
  const setsB: (number | null)[] = Array.from({ length: n }, (_, i) => m.setsB?.[i] ?? null);
  return { sa: m.sa, sb: m.sb, setsA, setsB };
}

/** Score à enregistrer à partir d'un brouillon (sets incomplets ignorés). */
export function scoreOf(
  draft: ScoreDraft,
  d: Distance,
): { sa: number | null; sb: number | null; setsA?: number[]; setsB?: number[] } {
  if (d.setsGagnants === 1) return { sa: draft.sa, sb: draft.sb };
  const setsA: number[] = [];
  const setsB: number[] = [];
  let wa = 0;
  let wb = 0;
  const n = Math.min(draft.setsA?.length ?? 0, draft.setsB?.length ?? 0);
  for (let i = 0; i < n; i++) {
    const a = draft.setsA?.[i];
    const b = draft.setsB?.[i];
    if (a === null || a === undefined || b === null || b === undefined) break;
    setsA.push(a);
    setsB.push(b);
    if (a === d.pointsParSet && b < d.pointsParSet) wa++;
    else if (b === d.pointsParSet && a < d.pointsParSet) wb++;
  }
  if (setsA.length === 0) return { sa: null, sb: null };
  return { sa: wa, sb: wb, setsA, setsB };
}

export function draftMatch(m: Match, draft: ScoreDraft, d: Distance): Match {
  const s = scoreOf(draft, d);
  const out: Match = { ...m, sa: s.sa, sb: s.sb, forfait: null };
  if (s.setsA) out.setsA = s.setsA;
  else delete out.setsA;
  if (s.setsB) out.setsB = s.setsB;
  else delete out.setsB;
  return out;
}

function parse(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface ScoreEditorProps {
  match: Match;
  distance: Distance;
  draft: ScoreDraft;
  onDraft: (next: ScoreDraft) => void;
  /** Appelé quand une case perd le focus ou qu'Espace a été utilisé. */
  onCommit: (next: ScoreDraft) => void;
  disabled?: boolean;
  /** Mise en page : colonne (tiroir) ou ligne (barrages, tableaux). */
  layout?: "stacked" | "inline";
  /** Identifiant de base pour les champs (accessibilité). */
  idBase: string;
  size?: "md" | "sm";
}

export function ScoreEditor({
  match,
  distance: d,
  draft,
  onDraft,
  onCommit,
  disabled,
  layout = "stacked",
  idBase,
  size = "md",
}: ScoreEditorProps) {
  const multi = d.setsGagnants > 1;
  const current = draftMatch(match, draft, d);
  const valid = isValidScore(current, d);
  const touched = current.sa !== null || current.sb !== null;
  const bothSet = current.sa !== null && current.sb !== null;
  const bad = touched && !valid && bothSet;
  const [shake, setShake] = useState(false);
  const prevBad = useRef(false);
  useEffect(() => {
    if (bad && !prevBad.current) {
      setShake(true);
      const t = window.setTimeout(() => setShake(false), 450);
      return () => window.clearTimeout(t);
    }
    prevBad.current = bad;
    return undefined;
  }, [bad]);
  useEffect(() => {
    prevBad.current = bad;
  }, [bad]);

  const inputClass = cx(
    "score-input",
    size === "sm" && "h-[34px] w-[52px] rounded-[8px] text-[14px]",
    multi && "w-[52px]",
  );

  const focusNext = (el: HTMLInputElement, preferSibling: boolean) => {
    const root = el.closest("[data-score-root]") ?? document;
    const all = [...root.querySelectorAll<HTMLInputElement>("input[data-score]")].filter(
      (i) => !i.disabled,
    );
    const idx = all.indexOf(el);
    if (idx < 0) return;
    const sibling = all[idx % 2 === 0 ? idx + 1 : idx - 1];
    if (
      preferSibling &&
      sibling &&
      sibling.value === "" &&
      sibling.closest("[data-match]") === el.closest("[data-match]")
    ) {
      sibling.focus();
      sibling.select();
      return;
    }
    const after = all.slice(idx + 1).find((i) => i.value === "") ?? all[idx + 1];
    if (after) {
      after.focus();
      after.select();
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>, apply: (v: number) => ScoreDraft) => {
    if (e.key === " ") {
      e.preventDefault();
      const next = apply(d.pointsParSet);
      onDraft(next);
      onCommit(next);
      focusNext(e.currentTarget, true);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onCommit(draft);
      focusNext(e.currentTarget, true);
    }
  };

  const field = (
    value: number | null,
    update: (v: number | null) => ScoreDraft,
    label: string,
    win: boolean,
  ) => (
    <input
      id={`${idBase}-${label}`}
      type="number"
      inputMode="numeric"
      min={0}
      max={d.pointsParSet}
      data-score="true"
      aria-label={label}
      disabled={disabled}
      placeholder="–"
      value={value ?? ""}
      className={cx(
        inputClass,
        win && valid && "win",
        (value !== null && (value < 0 || value > d.pointsParSet)) || bad ? "err" : "",
      )}
      onChange={(e) => onDraft(update(parse(e.target.value)))}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => onKey(e, (v) => update(v))}
      onFocus={(e) => e.currentTarget.select()}
    />
  );

  if (!multi) {
    const a = field(draft.sa, (v) => ({ ...draft, sa: v }), "score-a", draft.sa === d.pointsParSet);
    const b = field(draft.sb, (v) => ({ ...draft, sb: v }), "score-b", draft.sb === d.pointsParSet);
    return layout === "inline" ? (
      <div
        data-match={match.id}
        className={cx("flex items-center gap-1", shake && "animate-shake")}
      >
        {a}
        <span className="text-ink-muted text-[10px] font-bold">–</span>
        {b}
      </div>
    ) : (
      <div data-match={match.id} className={cx("contents", shake && "animate-shake")}>
        {a}
        {b}
      </div>
    );
  }

  const n = 2 * d.setsGagnants - 1;
  const setsA = draft.setsA ?? Array.from({ length: n }, () => null);
  const setsB = draft.setsB ?? Array.from({ length: n }, () => null);
  // Un set n'est saisissable que si le match n'est pas déjà décidé avant lui
  const decidedAt = (() => {
    let wa = 0;
    let wb = 0;
    for (let i = 0; i < n; i++) {
      const x = setsA[i];
      const y = setsB[i];
      if (x === null || y === null || x === undefined || y === undefined) return n;
      if (x === d.pointsParSet) wa++;
      else if (y === d.pointsParSet) wb++;
      if (wa === d.setsGagnants || wb === d.setsGagnants) return i + 1;
    }
    return n;
  })();
  const setField = (who: "a" | "b", i: number) => {
    const arr = who === "a" ? setsA : setsB;
    const val = arr[i] ?? null;
    return field(
      val,
      (v) => {
        const next = [...arr];
        next[i] = v;
        return who === "a" ? { ...draft, setsA: next } : { ...draft, setsB: next };
      },
      `set-${i + 1}-${who}`,
      val === d.pointsParSet,
    );
  };
  return (
    <div
      data-match={match.id}
      className={cx("flex flex-col gap-1", shake && "animate-shake")}
      style={{ gridColumn: layout === "inline" ? undefined : "1 / -1" }}
    >
      <div className="text-ink-muted flex items-center gap-1 text-[10px] font-bold tracking-[0.06em] uppercase">
        <span className="w-10">Sets</span>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className="w-[52px] text-center">
            S{i + 1}
          </span>
        ))}
        <span className="ml-2">Gagnés</span>
      </div>
      {(["a", "b"] as const).map((who) => (
        <div key={who} className="flex items-center gap-1">
          <span className="text-ink-secondary w-10 truncate text-[11px] font-semibold">
            {who === "a" ? match.a.split(" ")[0] : match.b.split(" ")[0]}
          </span>
          {Array.from({ length: n }, (_, i) => (
            <span key={i} className={cx(i >= decidedAt && "opacity-30")}>
              {i >= decidedAt ? (
                <input className={inputClass} disabled value="" aria-hidden="true" readOnly />
              ) : (
                setField(who, i)
              )}
            </span>
          ))}
          <span
            className={cx(
              "ml-2 font-mono text-[15px] font-bold tabular-nums",
              valid ? "text-ok-ink" : "text-ink-muted",
            )}
          >
            {who === "a" ? (current.sa ?? "–") : (current.sb ?? "–")}
          </span>
        </div>
      ))}
    </div>
  );
}

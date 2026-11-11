/**
 * Saisie du score d'un match : un set (points) ou plusieurs sets (points par set).
 * Espace met la distance dans la case ; la validation visuelle suit docs/DESIGN.md
 * (case verte quand le score est cohérent, vibration rouge sinon).
 *
 * Matchs en plusieurs sets (Masters du samedi, phases finales du dimanche) :
 * - un set est valide quand exactement un joueur est à la distance et l'autre en dessous ; son
 *   vainqueur est en vert, son perdant en rouge (couleur de résultat, pas une erreur) ;
 * - un set vide ou en cours de saisie reste neutre ; une vraie erreur (valeur hors bornes, deux
 *   joueurs à la distance, set quitté sans vainqueur) est signalée par la bordure d'alerte, la
 *   vibration et un message ;
 * - seuls le set en cours et les précédents sont saisissables ; les sets au-delà de la fin du
 *   match sont désactivés et vidés ;
 * - les cases sont dans l'ordre de saisie (set 1 joueur A, set 1 joueur B, set 2…) : Tab et
 *   Entrée les enchaînent dans cet ordre ;
 * - seuls les sets valides en tête sont enregistrés : un match interrompu reste « en cours ».
 */
import type { Distance, Match } from "@pilot5q/domain";
import { TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";

import { isValidScore } from "@/lib/engine";

import { nice, shortName } from "@/lib/format";

import { useEditLock } from "@/store/tournament";

import { cx } from "./ui";

export interface ScoreDraft {
  sa: number | null;
  sb: number | null;
  setsA?: (number | null)[];
  setsB?: (number | null)[];
}

type Cell = number | null | undefined;

/**
 * État d'un set en cours de saisie : vide, incomplet (une seule case), sans vainqueur (deux
 * valeurs sous la distance), gagné par A ou par B, ou invalide (hors bornes, deux joueurs à la
 * distance).
 */
export type SetState = "empty" | "partial" | "open" | "a" | "b" | "invalid";

const filled = (v: Cell): v is number => v !== null && v !== undefined;

export function setState(a: Cell, b: Cell, pointsParSet: number): SetState {
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v <= pointsParSet;
  if (!filled(a) && !filled(b)) return "empty";
  if ((filled(a) && !ok(a)) || (filled(b) && !ok(b))) return "invalid";
  if (!filled(a) || !filled(b)) return "partial";
  if (a === pointsParSet && b === pointsParSet) return "invalid";
  if (a === pointsParSet) return "a";
  if (b === pointsParSet) return "b";
  return "open";
}

/** Avancement d'un match en plusieurs sets à partir du brouillon. */
export interface SetsProgress {
  /** État de chaque set (longueur : nombre maximal de sets). */
  states: SetState[];
  /** Sets valides en tête : ce sont eux qui comptent et qui sont enregistrés. */
  played: number;
  wa: number;
  wb: number;
  /** Un joueur a gagné le nombre de sets requis. */
  decided: boolean;
  /** Nombre de sets saisissables : les sets joués et, si le match continue, le set en cours. */
  open: number;
}

export function setsProgress(draft: ScoreDraft, d: Distance): SetsProgress {
  const n = 2 * d.setsGagnants - 1;
  const states = Array.from({ length: n }, (_, i) =>
    setState(draft.setsA?.[i], draft.setsB?.[i], d.pointsParSet),
  );
  let wa = 0;
  let wb = 0;
  let played = 0;
  while (played < n && wa < d.setsGagnants && wb < d.setsGagnants) {
    const s = states[played];
    if (s === "a") wa++;
    else if (s === "b") wb++;
    else break;
    played++;
  }
  const decided = wa === d.setsGagnants || wb === d.setsGagnants;
  return { states, played, wa, wb, decided, open: decided ? played : Math.min(n, played + 1) };
}

/** Brouillon à partir d'un match enregistré. */
export function draftOf(m: Match, d: Distance): ScoreDraft {
  if (d.setsGagnants === 1) return { sa: m.sa, sb: m.sb };
  const n = 2 * d.setsGagnants - 1;
  const setsA: (number | null)[] = Array.from({ length: n }, (_, i) => m.setsA?.[i] ?? null);
  const setsB: (number | null)[] = Array.from({ length: n }, (_, i) => m.setsB?.[i] ?? null);
  return { sa: m.sa, sb: m.sb, setsA, setsB };
}

/**
 * Score à enregistrer à partir d'un brouillon. En plusieurs sets, seuls les sets valides en tête
 * comptent : le set en cours, incomplet ou en erreur, n'est pas enregistré.
 */
export function scoreOf(
  draft: ScoreDraft,
  d: Distance,
): { sa: number | null; sb: number | null; setsA?: number[]; setsB?: number[] } {
  if (d.setsGagnants === 1) return { sa: draft.sa, sb: draft.sb };
  const p = setsProgress(draft, d);
  if (p.played === 0) return { sa: null, sb: null };
  const take = (xs: (number | null)[] | undefined) =>
    (xs ?? []).slice(0, p.played).filter((v): v is number => v !== null);
  return { sa: p.wa, sb: p.wb, setsA: take(draft.setsA), setsB: take(draft.setsB) };
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

/**
 * État d'un score enregistré : vide, en cours (match en plusieurs sets interrompu, ou un seul
 * des deux scores saisi), valide, ou incohérent.
 */
export function scoreState(m: Match, d: Distance): "empty" | "partial" | "valid" | "invalid" {
  if (isValidScore(m, d)) return "valid";
  if (d.setsGagnants <= 1) {
    if (m.sa === null && m.sb === null) return "empty";
    return m.sa === null || m.sb === null ? "partial" : "invalid";
  }
  const sets = Math.max(m.setsA?.length ?? 0, m.setsB?.length ?? 0);
  if (sets === 0) return m.sa === null && m.sb === null ? "empty" : "invalid";
  const p = setsProgress(draftOf(m, d), d);
  return p.played === sets && !p.decided ? "partial" : "invalid";
}

function parse(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Cases de score saisissables d'une zone de saisie, dans l'ordre du document. */
function scoreInputs(el: HTMLElement): HTMLInputElement[] {
  const root = el.closest("[data-score-root]") ?? document;
  return [...root.querySelectorAll<HTMLInputElement>("input[data-score]")].filter(
    (i) => !i.disabled,
  );
}

/**
 * Passe à la case suivante : l'autre joueur du même set (ou du même match) s'il est vide, sinon
 * la première case vide plus loin ; à défaut, le bouton de validation de la zone.
 */
function focusNext(el: HTMLInputElement, preferSibling: boolean) {
  const all = scoreInputs(el);
  const idx = all.indexOf(el);
  if (idx < 0) return;
  const matchOf = (i: HTMLElement) => i.closest("[data-match]")?.getAttribute("data-match");
  const sibling = all.find(
    (i) => i !== el && matchOf(i) === matchOf(el) && i.dataset.set === el.dataset.set,
  );
  const target =
    preferSibling && sibling && sibling.value === ""
      ? sibling
      : (all.slice(idx + 1).find((i) => i.value === "") ?? all[idx + 1]);
  if (target) {
    target.focus();
    target.select();
    return;
  }
  const root = el.closest("[data-score-root]");
  root?.querySelector<HTMLButtonElement>("[data-score-submit]:not(:disabled)")?.focus();
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
  /**
   * Plusieurs sets, version dense (tiroir de saisie) : pas de ligne d'en-tête, le libellé de
   * chaque joueur est rendu par `renderLabel` et occupe la largeur restante.
   */
  compact?: boolean;
  renderLabel?: (who: "a" | "b") => ReactNode;
}

export function ScoreEditor(props: ScoreEditorProps) {
  return props.distance.setsGagnants > 1 ? <SetsEditor {...props} /> : <SingleEditor {...props} />;
}

/** Vibration brève quand une incohérence apparaît. */
function useShake(bad: boolean): boolean {
  const [shake, setShake] = useState(false);
  const prev = useRef(false);
  useEffect(() => {
    const was = prev.current;
    prev.current = bad;
    if (bad && !was) {
      setShake(true);
      const t = window.setTimeout(() => setShake(false), 450);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [bad]);
  return shake;
}

/* ---------- Un seul set ---------- */

function SingleEditor({
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
  disabled = useEditLock() || disabled;
  const current = draftMatch(match, draft, d);
  const valid = isValidScore(current, d);
  const bad = current.sa !== null && current.sb !== null && !valid;
  const shake = useShake(bad);

  const field = (who: "a" | "b") => {
    const value = who === "a" ? draft.sa : draft.sb;
    const update = (v: number | null): ScoreDraft =>
      who === "a" ? { ...draft, sa: v } : { ...draft, sb: v };
    const win = value === d.pointsParSet;
    return (
      <input
        id={`${idBase}-score-${who}`}
        type="number"
        inputMode="numeric"
        min={0}
        max={d.pointsParSet}
        data-score="true"
        aria-label={`Score de ${nice(who === "a" ? match.a : match.b)}`}
        aria-invalid={bad || undefined}
        disabled={disabled}
        placeholder="–"
        value={value ?? ""}
        className={cx(
          "score-input",
          size === "sm" && "h-[34px] w-[52px] rounded-[8px] text-[14px]",
          win && valid && "win",
          !win && valid && "lose",
          (value !== null && (value < 0 || value > d.pointsParSet)) || bad ? "err" : "",
        )}
        onChange={(e) => onDraft(update(parse(e.target.value)))}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === " ") {
            e.preventDefault();
            const next = update(d.pointsParSet);
            onDraft(next);
            onCommit(next);
            focusNext(e.currentTarget, true);
          } else if (e.key === "Enter") {
            e.preventDefault();
            onCommit(draft);
            focusNext(e.currentTarget, true);
          }
        }}
        onFocus={(e) => e.currentTarget.select()}
      />
    );
  };

  return layout === "inline" ? (
    <div data-match={match.id} className={cx("flex items-center gap-1", shake && "animate-shake")}>
      {field("a")}
      <span className="text-ink-muted text-[10px] font-bold">–</span>
      {field("b")}
    </div>
  ) : (
    <div data-match={match.id} className={cx("contents", shake && "animate-shake")}>
      {field("a")}
      {field("b")}
    </div>
  );
}

/* ---------- Plusieurs sets ---------- */

function SetsEditor({
  match,
  distance: d,
  draft,
  onDraft,
  onCommit,
  disabled,
  layout = "stacked",
  idBase,
  size = "md",
  compact = false,
  renderLabel,
}: ScoreEditorProps) {
  disabled = useEditLock() || disabled;
  const n = 2 * d.setsGagnants - 1;
  const setsA = Array.from({ length: n }, (_, i) => draft.setsA?.[i] ?? null);
  const setsB = Array.from({ length: n }, (_, i) => draft.setsB?.[i] ?? null);
  const p = setsProgress({ ...draft, setsA, setsB }, d);
  /** Set dont une case a le focus : il n'est pas signalé tant qu'on le saisit. */
  const [focusSet, setFocusSet] = useState<number | null>(null);
  // Erreur d'un set : valeur impossible, ou set quitté sans vainqueur.
  const setError = (i: number): boolean =>
    p.states[i] === "invalid" || (p.states[i] === "open" && focusSet !== i);
  const firstError = Array.from({ length: n }, (_, i) => i).find(setError);
  const bad = firstError !== undefined;
  const shake = useShake(bad);
  const complete = p.decided && !bad;

  /** Brouillon après la saisie d'une case : les sets au-delà de la fin du match sont vidés. */
  const withValue = (who: "a" | "b", i: number, v: number | null): ScoreDraft => {
    const a = [...setsA];
    const b = [...setsB];
    (who === "a" ? a : b)[i] = v;
    const next = setsProgress({ ...draft, setsA: a, setsB: b }, d);
    if (next.decided)
      for (let k = next.played; k < n; k++) {
        a[k] = null;
        b[k] = null;
      }
    return { ...draft, setsA: a, setsB: b };
  };

  const inputClass = cx(
    "score-input w-[52px]",
    size === "sm" && "h-[34px] rounded-[8px] text-[14px]",
    compact && "h-[30px] w-[46px] rounded-[8px] text-[13.5px]",
  );

  const cell = (who: "a" | "b", i: number) => {
    const value = (who === "a" ? setsA : setsB)[i] ?? null;
    const state = p.states[i] ?? "empty";
    const name = nice(who === "a" ? match.a : match.b);
    const closed = i >= p.open;
    const error = setError(i);
    return (
      <input
        key={`${who}${i}`}
        id={`${idBase}-set-${i + 1}-${who}`}
        style={{ gridColumn: i + 2, gridRow: (compact ? 1 : 2) + (who === "a" ? 0 : 1) }}
        type="number"
        inputMode="numeric"
        min={0}
        max={d.pointsParSet}
        // Les cases désactivées ne font pas partie du parcours de saisie
        {...(closed ? {} : { "data-score": "true" })}
        data-set={i + 1}
        data-side={who}
        aria-label={`Set ${i + 1}, ${name}`}
        aria-invalid={error || undefined}
        disabled={disabled || closed}
        placeholder="–"
        value={value ?? ""}
        className={cx(
          inputClass,
          closed && "opacity-35",
          !closed && !error && state === who && "win",
          !closed && !error && (state === "a" || state === "b") && state !== who && "lose",
          !closed && error && "err",
        )}
        onChange={(e) => onDraft(withValue(who, i, parse(e.target.value)))}
        onFocus={(e) => {
          setFocusSet(i);
          e.currentTarget.select();
        }}
        onBlur={() => {
          setFocusSet((f) => (f === i ? null : f));
          onCommit(draft);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === " ") {
            e.preventDefault();
            const el = e.currentTarget;
            const next = withValue(who, i, d.pointsParSet);
            // Rendu immédiat : le set suivant doit être ouvert avant d'y porter le focus
            flushSync(() => onDraft(next));
            onCommit(next);
            focusNext(el, true);
          } else if (e.key === "Enter") {
            e.preventDefault();
            onCommit(draft);
            focusNext(e.currentTarget, true);
          }
        }}
      />
    );
  };

  const won = (who: "a" | "b") => {
    const count = who === "a" ? p.wa : p.wb;
    const other = who === "a" ? p.wb : p.wa;
    return (
      <span
        key={`won-${who}`}
        style={{ gridColumn: n + 2, gridRow: (compact ? 1 : 2) + (who === "a" ? 0 : 1) }}
        aria-label={`Sets gagnés par ${nice(who === "a" ? match.a : match.b)}`}
        className={cx(
          "ml-1.5 text-center font-mono font-bold tabular-nums",
          compact ? "w-4 text-[14px]" : "text-[15px]",
          complete ? (count > other ? "text-ok-ink" : "text-alert-ink") : "text-ink-muted",
        )}
      >
        {p.played === 0 ? "–" : count}
      </span>
    );
  };

  const label = (who: "a" | "b") => (
    <div
      key={`label-${who}`}
      style={{ gridColumn: 1, gridRow: (compact ? 1 : 2) + (who === "a" ? 0 : 1) }}
      className="min-w-0"
    >
      {renderLabel ? (
        renderLabel(who)
      ) : (
        <span
          className="text-ink-secondary block max-w-[96px] truncate pr-1 text-[11.5px] font-semibold"
          title={nice(who === "a" ? match.a : match.b)}
        >
          {shortName(who === "a" ? match.a : match.b)}
        </span>
      )}
    </div>
  );

  const message =
    firstError === undefined
      ? null
      : p.states[firstError] === "open"
        ? `Set ${firstError + 1} : un joueur doit être à ${d.pointsParSet}.`
        : `Set ${firstError + 1} : un seul joueur à ${d.pointsParSet}, l'autre entre 0 et ${d.pointsParSet - 1}.`;

  return (
    <div
      data-match={match.id}
      className={cx("flex flex-col", compact ? "gap-[3px]" : "gap-1.5")}
      style={{ gridColumn: layout === "inline" ? undefined : "1 / -1" }}
    >
      <div
        className={cx(
          "grid items-center gap-x-1",
          compact ? "gap-y-[3px]" : "gap-y-1",
          shake && "animate-shake",
        )}
        style={{
          gridTemplateColumns: `${compact ? "minmax(0,1fr)" : "auto"} repeat(${n}, auto) auto`,
        }}
      >
        {compact ? null : (
          <>
            <span
              style={{ gridColumn: 1, gridRow: 1 }}
              className="text-ink-muted text-[10px] font-bold tracking-[0.06em] uppercase"
            >
              Sets
            </span>
            {Array.from({ length: n }, (_, i) => (
              <span
                key={i}
                style={{ gridColumn: i + 2, gridRow: 1 }}
                className={cx(
                  "text-ink-muted text-center text-[10px] font-bold tracking-[0.06em] uppercase",
                  i >= p.open && "opacity-40",
                )}
              >
                S{i + 1}
              </span>
            ))}
            <span
              style={{ gridColumn: n + 2, gridRow: 1 }}
              className="text-ink-muted ml-1.5 text-center text-[10px] font-bold tracking-[0.06em] uppercase"
            >
              Gagnés
            </span>
          </>
        )}
        {label("a")}
        {label("b")}
        {/* Ordre du document = ordre de saisie : set 1 (A puis B), set 2… */}
        {Array.from({ length: n }, (_, i) => [cell("a", i), cell("b", i)])}
        {won("a")}
        {won("b")}
      </div>
      {message ? (
        <p
          role="alert"
          className="text-alert-ink flex items-center gap-1.5 text-[11.5px] font-semibold"
        >
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Une seule case (joueur A ou B) d'un match à un set, dans la grille du tiroir. */
export function ScoreCell({
  who,
  match,
  draft,
  onDraft,
  onCommit,
  disabled,
  idBase,
  d,
  size = "md",
}: {
  who: "a" | "b";
  match: Match;
  draft: ScoreDraft;
  onDraft: (n: ScoreDraft) => void;
  onCommit: (n: ScoreDraft) => void;
  disabled?: boolean;
  idBase: string;
  d: Distance;
  size?: "md" | "sm";
}) {
  disabled = useEditLock() || disabled;
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
        aria-invalid={bad || undefined}
        disabled={disabled}
        placeholder="–"
        value={value ?? ""}
        className={cx(
          "score-input",
          size === "sm" && "h-[32px] w-[48px] rounded-[8px] text-[14px]",
          value === d.pointsParSet && valid && "win",
          value !== null && value !== d.pointsParSet && valid && "lose",
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
          focusNext(e.currentTarget, true);
        }}
      />
    </div>
  );
}

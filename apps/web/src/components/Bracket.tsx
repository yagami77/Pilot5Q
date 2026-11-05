/**
 * Tableau à élimination directe « vivant » : cartes de match positionnées par tour,
 * connecteurs SVG en Bézier, états à venir / en direct / terminé, saisie inline, vainqueur
 * qui glisse le long du connecteur jusqu'au tour suivant, chiffres qui roulent, finale or,
 * halo doré et confettis pour le champion.
 */
import type { BracketMatch, BracketRound, Distance } from "@pilot5q/domain";
import { Pencil, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { isValidScore, matchWinner } from "@/lib/engine";
import { nice } from "@/lib/format";
import { celebrate, prefersReducedMotion } from "@/lib/motion";
import {
  distanceLabel,
  matchTouched,
  phaseDistance,
  roundLabel,
  roundShort,
} from "@/lib/tournament";
import { useEditLock, useTournament } from "@/store/tournament";

import { RollingNumber } from "./RollingNumber";
import { ScoreCell, ScoreEditor, draftOf, scoreOf, type ScoreDraft } from "./ScoreEditor";
import { Avatar, Button, Chip, cx } from "./ui";

const W = 300;
const HEAD = 28;
const SLOT = 44;
const H = HEAD + 2 * SLOT;
const GAP = 110;
const ALL_ROUNDS: BracketRound[] = ["R64", "R32", "R16", "QF", "SF", "F"];

type Phase = "N" | "M" | "CLS";

export interface BracketProps {
  phase: Phase;
  rounds?: BracketRound[];
  /** Tours dont les scores sont saisissables (par défaut tous les tours affichés). */
  editableRounds?: BracketRound[];
  withArbitre?: boolean;
  /** Grille simple (un seul tour, sans connecteurs) ou arbre complet. */
  layout?: "tree" | "grid";
  /** Curseur de zoom pour les grands tableaux. */
  zoomable?: boolean;
  /** Complément affiché sous le nom du champion (« vainqueur Masters · 586 € »). */
  championNote?: string;
}

function matchLabel(m: BracketMatch): string {
  return m.round === "F" ? "Finale" : `${roundShort(m.round)}${m.slot}`;
}

interface Travel {
  id: string;
  winner: string;
  d: string;
  to: string;
  side: "a" | "b";
}

export function Bracket({
  phase,
  rounds,
  editableRounds,
  withArbitre = false,
  layout = "tree",
  zoomable = false,
  championNote,
}: BracketProps) {
  const { state } = useTournament();
  const editLock = useEditLock();
  const all = state.brackets[phase];
  const shown = (rounds ?? ALL_ROUNDS).filter((r) => all.some((m) => m.round === r));
  const locked = Boolean(state.closed[phase]);
  const [zoom, setZoom] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);

  const dist = (r: BracketRound): Distance => phaseDistance(state, phase, r);
  const winner = (m: BracketMatch) => (m.a && m.b ? matchWinner(m, dist(m.round)) : null);

  /* ---------- géométrie ---------- */
  const geo = useMemo(() => {
    const byRound = shown.map((r) =>
      all.filter((m) => m.round === r).sort((x, y) => x.slot - y.slot),
    );
    const n0 = byRound[0]?.length ?? 0;
    const rowH = n0 > 8 ? 124 : 132;
    const totalH = n0 * rowH;
    const pos = new Map<string, { x: number; y: number }>();
    byRound.forEach((ms, ri) => {
      const x = ri * (W + GAP);
      const slotH = totalH / Math.max(1, ms.length);
      ms.forEach((m, i) => pos.set(m.id, { x, y: (i + 0.5) * slotH - H / 2 }));
    });
    const conns: { from: BracketMatch; to: BracketMatch; side: "a" | "b"; d: string }[] = [];
    byRound.forEach((ms, ri) => {
      if (ri === 0) return;
      const prev = byRound[ri - 1] ?? [];
      prev.forEach((pm) => {
        const to = ms.find((m) => m.slot === Math.ceil(pm.slot / 2));
        if (!to) return;
        const side: "a" | "b" = pm.slot % 2 === 1 ? "a" : "b";
        const P = pos.get(pm.id);
        const Q = pos.get(to.id);
        if (!P || !Q) return;
        const x1 = P.x + W;
        const y1 = P.y + H / 2;
        const x2 = Q.x;
        const y2 = Q.y + HEAD + (side === "a" ? SLOT / 2 : SLOT * 1.5);
        const mx = (x1 + x2) / 2;
        conns.push({ from: pm, to, side, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}` });
      });
    });
    return {
      byRound,
      pos,
      conns,
      width: shown.length * W + (shown.length - 1) * GAP,
      height: totalH + 36,
    };
  }, [all, shown]);

  /* ---------- vainqueurs qui voyagent ---------- */
  const doneRef = useRef<Set<string> | null>(null);
  const [travels, setTravels] = useState<Travel[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [championKey, setChampionKey] = useState<string | null>(null);
  const finalMatch = all.find((m) => m.round === "F");
  const champion = finalMatch ? winner(finalMatch) : null;
  const doneKey = all.map((m) => `${m.id}:${winner(m) ?? ""}`).join("|");

  useEffect(() => {
    const now = new Set(all.filter((m) => winner(m)).map((m) => m.id));
    const before = doneRef.current;
    doneRef.current = now;
    if (!before) return; // premier rendu : état déjà connu, pas d'animation
    const fresh = [...now].filter((id) => !before.has(id));
    if (fresh.length === 0) return;
    const reduced = prefersReducedMotion();
    const next: Travel[] = [];
    for (const id of fresh) {
      const m = all.find((x) => x.id === id);
      const w = m ? winner(m) : null;
      const c = geo.conns.find((x) => x.from.id === id);
      if (m && w && c && layout === "tree" && !reduced) {
        next.push({ id, winner: w, d: c.d, to: c.to.id, side: c.side });
      }
      if (m?.round === "F" && w) setChampionKey(`${id}:${w}`);
    }
    if (next.length) {
      setTravels((t) => [...t, ...next]);
      setHidden((h) => {
        const s = new Set(h);
        next.forEach((t) => s.add(`${t.to}:${t.side}`));
        return s;
      });
    }
    // Les dépendances exactes sont `doneKey` (vainqueurs) ; le reste est stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey]);

  const finishTravel = (t: Travel) => {
    setTravels((ts) => ts.filter((x) => x !== t));
    setHidden((h) => {
      const s = new Set(h);
      s.delete(`${t.to}:${t.side}`);
      return s;
    });
  };

  // Champion : halo + confettis une seule fois par vainqueur de finale
  const finalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!championKey) return;
    const t = window.setTimeout(() => void celebrate(finalRef.current), 950);
    return () => window.clearTimeout(t);
  }, [championKey]);

  if (shown.length === 0) {
    return (
      <p className="text-ink-muted px-4 pb-4 text-[13px]">
        Le tableau se remplira à la clôture des poules.
      </p>
    );
  }

  const card = (m: BracketMatch, style?: CSSProperties, ri = 0) => {
    const r = m.round;
    const editable = !locked && !editLock && (editableRounds ?? shown).includes(r);
    return (
      <MatchCard
        key={m.id}
        phase={phase}
        match={m}
        distance={dist(r)}
        editable={editable}
        withArbitre={withArbitre && r !== "R16" && r !== "R32" && r !== "R64"}
        style={style}
        hiddenA={hidden.has(`${m.id}:a`)}
        hiddenB={hidden.has(`${m.id}:b`)}
        isFinal={r === "F"}
        champion={r === "F" && Boolean(champion)}
        glow={Boolean(championKey) && r === "F"}
        refEl={r === "F" ? finalRef : undefined}
        delay={layout === "grid" ? m.slot * 40 : ri * 60}
      />
    );
  };

  if (layout === "grid") {
    const ms = geo.byRound[0] ?? [];
    return (
      <div
        className="grid grid-cols-1 gap-3 px-4 pt-3 pb-4 sm:grid-cols-2 xl:grid-cols-4"
        data-score-root
      >
        {ms.map((m) => card(m, { position: "relative", width: "100%" }))}
      </div>
    );
  }

  return (
    <div>
      {zoomable ? (
        <div className="text-ink-muted flex items-center gap-2 px-4 pt-2 text-[12px]">
          <label className="flex items-center gap-2">
            Zoom
            <input
              type="range"
              min={50}
              max={100}
              value={Math.round(zoom * 100)}
              onChange={(e) => setZoom(Number(e.target.value) / 100)}
              className="accent-brand"
              aria-label="Zoom du tableau"
            />
            <span className="font-mono">{Math.round(zoom * 100)} %</span>
          </label>
        </div>
      ) : null}
      <div
        className="relative overflow-x-auto px-4 pt-9 pb-5"
        style={{ height: geo.height * zoom + 60 }}
        data-score-root
      >
        <div
          ref={rootRef}
          className="relative origin-top-left"
          style={{ width: geo.width, height: geo.height, transform: `scale(${zoom})` }}
        >
          <svg
            className="pointer-events-none absolute inset-0 overflow-visible"
            width={geo.width}
            height={geo.height}
            aria-hidden="true"
          >
            {geo.conns.map((c) => {
              const lit = Boolean(winner(c.from));
              return (
                <path
                  key={c.from.id}
                  d={c.d}
                  className={cx("conn", lit && "lit", lit && c.to.round === "F" && "gold")}
                />
              );
            })}
          </svg>
          {geo.byRound.map((ms, ri) => {
            const r = shown[ri];
            if (!r) return null;
            return (
              <div
                key={r}
                className="text-ink-muted absolute -top-7 text-[11px] font-extrabold tracking-[0.1em] uppercase whitespace-nowrap"
                style={{ left: ri * (W + GAP) }}
              >
                {roundLabel(r)} · {distanceLabel(dist(r))}
              </div>
            );
          })}
          {geo.byRound.map((ms, ri) =>
            ms.map((m) => {
              const p = geo.pos.get(m.id);
              return card(
                m,
                { position: "absolute", left: p?.x ?? 0, top: p?.y ?? 0, width: W },
                ri,
              );
            }),
          )}
          {travels.map((t) => (
            <Traveler key={`${t.id}-${t.winner}`} travel={t} onDone={() => finishTravel(t)} />
          ))}
        </div>
      </div>
      {champion ? (
        <div className="animate-pop mx-4 mb-4 flex flex-wrap items-center gap-3.5 rounded-[16px] border border-[#f2d48a] bg-[linear-gradient(135deg,#fff4df,#ffe7b5)] px-5 py-4">
          <Avatar name={champion} size="lg" crown className="ring-gold ring-2 ring-offset-2" />
          <div className="min-w-0 flex-1">
            <b className="text-[16px]">{nice(champion)}</b>
            <small className="text-gold-ink block font-semibold">{championNote ?? ""}</small>
          </div>
          <Chip tone="gold" icon={Trophy}>
            Podium
          </Chip>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Voyageur : le vainqueur glisse le long du connecteur ---------- */

function Traveler({ travel, onDone }: { travel: Travel; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") {
      onDone();
      return;
    }
    const anim = el.animate([{ offsetDistance: "0%" }, { offsetDistance: "100%" }], {
      duration: 900,
      easing: "cubic-bezier(.4,0,.2,1)",
      fill: "forwards",
    });
    let cancelled = false;
    anim.finished.then(() => !cancelled && onDone()).catch(() => undefined);
    return () => {
      cancelled = true;
      anim.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={ref}
      className="border-brand-light bg-surface pointer-events-none absolute top-0 left-0 z-10 flex items-center gap-2 rounded-full border py-[5px] pr-3 pl-[5px] text-[12.5px] font-bold whitespace-nowrap shadow-[0_10px_24px_-8px_rgb(14_55_168/0.5)]"
      style={{ offsetPath: `path("${travel.d}")`, offsetRotate: "0deg", offsetDistance: "0%" }}
      aria-hidden="true"
    >
      <Avatar name={travel.winner} size="sm" />
      <span>{nice(travel.winner)}</span>
    </div>
  );
}

/* ---------- Carte de match ---------- */

function MatchCard({
  phase,
  match,
  distance: d,
  editable,
  withArbitre,
  style,
  hiddenA,
  hiddenB,
  isFinal,
  champion,
  glow,
  refEl,
  delay,
}: {
  phase: Phase;
  match: BracketMatch;
  distance: Distance;
  editable: boolean;
  withArbitre: boolean;
  style?: CSSProperties;
  hiddenA: boolean;
  hiddenB: boolean;
  isFinal: boolean;
  champion: boolean;
  glow: boolean;
  refEl?: React.RefObject<HTMLDivElement | null>;
  delay: number;
}) {
  const { dispatch } = useTournament();
  const multi = d.setsGagnants > 1;
  const [draft, setDraft] = useState<ScoreDraft>(() => draftOf(match, d));
  const [open, setOpen] = useState(false);
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
  const valid = ready && isValidScore(match, d);
  const w = valid ? matchWinner(match, d) : null;
  const live = ready && !valid && (matchTouched(match) || open);
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

  const slot = (who: "a" | "b") => {
    const name = who === "a" ? match.a : match.b;
    const label = who === "a" ? match.labelA : match.labelB;
    const hiddenSlot = who === "a" ? hiddenA : hiddenB;
    const sets = who === "a" ? match.setsA : match.setsB;
    const score = who === "a" ? match.sa : match.sb;
    const isWin = Boolean(w) && w === name;
    const isLose = Boolean(w) && w !== name;
    const forfait = match.forfait === who;
    return (
      <div
        className={cx(
          "grid min-h-[44px] grid-cols-[28px_1fr_auto] items-center gap-[9px] px-[11px] py-[6px] transition-[background-color] duration-300",
          who === "b" && "border-line border-t border-dashed",
          isWin &&
            !(champion && isWin) &&
            "bg-[linear-gradient(90deg,var(--color-ok-soft),transparent_70%)]",
          champion && isWin && "bg-[linear-gradient(90deg,var(--color-gold-soft),transparent_70%)]",
          hiddenSlot && "invisible",
          !hiddenSlot && name && "animate-pop",
        )}
        data-side={who}
      >
        {name ? (
          <Avatar name={name} size="sm" crown={champion && isWin} className="size-7 text-[10px]" />
        ) : (
          <span className="border-line-2 size-7 rounded-full border-[1.5px] border-dashed" />
        )}
        <div className="min-w-0">
          {name ? (
            <>
              <div
                className={cx(
                  "truncate text-[13px] leading-[1.15] font-semibold",
                  isWin && (champion ? "text-gold-ink" : "text-ok-ink"),
                  isLose && "opacity-55",
                )}
              >
                {nice(name)}
              </div>
              <div className={cx("text-ink-muted truncate text-[10.5px]", isLose && "opacity-55")}>
                {label ?? ""}
              </div>
            </>
          ) : (
            <div className="text-ink-muted text-[12px] font-medium">{label ?? ""}</div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {forfait ? (
            <span className="text-alert-ink text-[10px] font-bold uppercase">forfait</span>
          ) : !multi && editable && ready && !match.forfait ? (
            <ScoreCell
              who={who}
              match={match}
              draft={draft}
              onDraft={setDraft}
              onCommit={commit}
              idBase={`k-${match.id}`}
              d={d}
              size="sm"
            />
          ) : (
            <>
              {multi && sets && sets.length > 0 ? (
                <span className="text-ink-secondary flex gap-1 font-mono text-[10.5px] font-semibold">
                  {sets.map((s, i) => (
                    <span key={i}>{s}</span>
                  ))}
                </span>
              ) : null}
              <RollingNumber
                value={name && (score !== null || match.forfait) ? (score ?? 0) : name ? "–" : ""}
                className={cx(
                  "min-w-[26px] justify-end font-mono text-[20px] font-bold",
                  isWin ? (champion ? "text-gold" : "text-ok") : "text-ink-secondary",
                )}
              />
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={refEl}
      style={{ ...style, animationDelay: `${delay}ms` }}
      className={cx(
        "bg-surface border-line rounded-[14px] border shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-300",
        !open && "animate-pop",
        live &&
          "border-brand-light shadow-[0_0_0_3px_var(--color-brand-soft),var(--shadow-raised)]",
        isFinal && !champion && "border-[#f2d48a]",
        champion && "border-gold",
        glow && "animate-glow-gold",
        open && "z-20",
      )}
      data-match={match.id}
    >
      <div className="bg-surface-2 border-line text-ink-muted flex items-center gap-2 rounded-t-[14px] border-b px-[11px] py-[6px] text-[10.5px] font-extrabold tracking-[0.07em] uppercase">
        <span
          className={cx(
            "size-2 rounded-full",
            valid ? "bg-ok" : live ? "bg-brand-light animate-live-pulse" : "bg-line-2",
          )}
          aria-hidden="true"
        />
        {matchLabel(match)}
        <span className="text-ink-secondary ml-auto font-mono font-semibold tracking-normal normal-case">
          {match.billard ? `Billard ${match.billard}` : ""}
        </span>
        {multi && editable && ready && !match.forfait ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-brand inline-flex items-center gap-1 font-sans text-[11px] font-bold tracking-normal normal-case"
            aria-expanded={open}
            aria-label={`Saisir ${roundLabel(match.round)} ${match.slot}`}
          >
            <Pencil className="size-3" aria-hidden="true" />
            {valid ? "Modifier" : "Saisir"}
          </button>
        ) : null}
      </div>
      {slot("a")}
      {slot("b")}
      {open ? (
        <div className="bg-surface border-brand-light shadow-raised absolute top-full left-0 z-30 mt-1.5 w-[380px] rounded-[14px] border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-bold">
              {matchLabel(match)} · {distanceLabel(d)}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer la saisie"
              className="bg-surface-2 border-line grid size-7 place-items-center rounded-[8px] border"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
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
          {withArbitre ? (
            <label className="text-ink-muted mt-2 flex items-center gap-1.5 text-[10.5px] font-semibold">
              Arbitre
              <input
                className="field h-7 flex-1 px-1.5 py-0 font-mono text-[11px]"
                placeholder="n° de licence"
                aria-label={`Licence de l'arbitre · ${roundLabel(match.round)} ${match.slot}`}
                value={arbitre}
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
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="primary" onClick={() => setOpen(false)}>
              Valider
            </Button>
          </div>
        </div>
      ) : null}
      {withArbitre && match.arbitre && !open ? (
        <div className="text-ink-muted border-line border-t px-[11px] py-1 text-[10px]">
          Arbitre <span className="font-mono">{match.arbitre}</span>
        </div>
      ) : null}
    </div>
  );
}

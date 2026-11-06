/**
 * Carte d'une poule.
 *
 * - Sans `view` (jeudi) : joueurs, billard, progression des matchs, classement une fois terminée.
 * - Avec `view` (grilles de saisie du vendredi et du samedi) : carte compressée (nom de la poule
 *   et points d'avancement des matchs), rallongée en feuille de match compacte (« scores ») ou en
 *   tableau de classement (« classement »). L'agrandissement est animé par le layout de motion ;
 *   les numéros 1 à 4 ne figurent pas sur ces cartes (ils restent sur les feuilles de match).
 */
import type { Distance, Poule, TournamentState } from "@pilot5q/domain";

import type { Match } from "@pilot5q/domain";
import { AnimatePresence, motion } from "motion/react";

import { forfaitsOf, isValidScore, matchWinner } from "@/lib/engine";
import { moy, ordinal, shortName } from "@/lib/format";
import {
  billardType,
  matchTouched,
  orderedMatches,
  pouleBillards,
  pouleState,
  type Day,
} from "@/lib/tournament";

import { Chip, Dots, PlayerLine, cx } from "./ui";

export interface PouleCardProps {
  state: TournamentState;
  phase: "PREQ" | "QN" | "QM";
  poule: Poule;
  distance: Distance;
  active?: boolean;
  onOpen?: (num: number) => void;
  /** Délais d'apparition (ms) par joueur, pour l'animation du serpentin. */
  delays?: Record<string, number>;
  /** Poule en conflit de club non résolu. */
  conflict?: boolean;
  /** Joueur sélectionné pour un échange manuel. */
  selected?: string | null;
  onSelectPlayer?: (name: string) => void;
  showPlace?: boolean;
  day?: Day;
  /** Mode des grilles de saisie (absent : carte complète du jeudi). */
  view?: PouleView;
  /** Puce du billard (masquée au vendredi, la vue billards étant au-dessus). */
  showBillard?: boolean;
}

/** Modes d'affichage des cartes dans les grilles de saisie. */
export type PouleView = "compact" | "scores" | "classement";

const LAYOUT = { duration: 0.42, ease: [0.2, 0.8, 0.2, 1] } as const;

export function PouleCard(props: PouleCardProps) {
  return props.view ? <GridCard {...props} view={props.view} /> : <FullCard {...props} />;
}

/** États des points d'avancement d'une poule (validé, en cours, incohérent, à jouer). */
function matchDots(
  poule: Poule,
  distance: Distance,
  forfaits: Set<string> = new Set(),
): ("ok" | "ko" | "half" | "none")[] {
  return poule.matches.map((m) => {
    // Un match contre un joueur forfait ne se joue pas : il compte comme réglé
    if (isValidScore(m, distance) || m.forfait || forfaits.has(m.a) || forfaits.has(m.b))
      return "ok" as const;
    if (!matchTouched(m)) return "none" as const;
    const bothSet = m.sa !== null && m.sb !== null;
    if (distance.setsGagnants === 1 && bothSet) return "ko" as const;
    return "half" as const;
  });
}

/* ---------- Carte des grilles de saisie ---------- */

function GridCard({
  state,
  phase,
  poule,
  distance,
  active,
  onOpen,
  conflict,
  view,
  showBillard = true,
}: PouleCardProps & { view: PouleView }) {
  const r = pouleState(state, phase, poule);
  const forfaits = new Set(forfaitsOf(state, phase));
  const dots = matchDots(poule, distance, forfaits);
  const done = dots.filter((x) => x === "ok").length;
  const live = !r.complete && dots.some((x) => x !== "none");
  const bills = pouleBillards(state, phase, poule);
  const type = billardType(state, bills[0]);
  const three = poule.players.length === 3;
  const Wrapper = onOpen ? motion.button : motion.div;
  return (
    <Wrapper
      layout
      layoutDependency={view}
      transition={{ layout: LAYOUT }}
      type={onOpen ? "button" : undefined}
      onClick={onOpen ? () => onOpen(poule.num) : undefined}
      aria-label={onOpen ? `Ouvrir la saisie de la poule ${poule.num}` : undefined}
      data-poule={poule.num}
      style={{ borderRadius: 14 }}
      className={cx(
        "card flex min-w-0 flex-col overflow-hidden p-0 text-left transition-[box-shadow,border-color] duration-200",
        onOpen && "hover:shadow-raised hover:border-line-2",
        three && "border-dashed",
        r.complete && "border-[#bfe6d2]",
        live && "live-card border-brand-light shadow-[0_0_0_3px_var(--color-brand-soft)]",
        active && "border-brand shadow-[0_0_0_3px_var(--color-brand-soft),var(--shadow-raised)]",
        conflict && "border-alert",
      )}
    >
      <motion.div
        layout="position"
        layoutDependency={view}
        transition={{ layout: LAYOUT }}
        className="flex items-center gap-2 px-3 py-2.5"
      >
        <b className="flex shrink-0 items-center gap-1.5 text-[13.5px] whitespace-nowrap">
          {live ? (
            <span
              className="bg-brand-light animate-live-pulse size-2 shrink-0 rounded-full"
              aria-hidden="true"
            />
          ) : r.complete ? (
            <span className="bg-ok size-2 shrink-0 rounded-full" aria-hidden="true" />
          ) : null}
          Poule {poule.num}
        </b>
        {showBillard && bills.length ? (
          <span
            className={cx(
              "rounded-[6px] px-1.5 py-[1px] font-mono text-[10.5px] font-semibold",
              type === "3m10" ? "bg-brand-soft text-brand-ink" : "bg-surface-2 text-ink-muted",
            )}
          >
            B{bills.join("·")}
          </span>
        ) : null}
        <span
          className="ml-auto flex items-center gap-2"
          aria-label={`${done} matchs sur ${poule.matches.length}`}
        >
          <Dots states={dots} />
          <span
            className={cx(
              "w-[26px] text-right font-mono text-[10.5px] font-bold tabular-nums",
              r.complete ? "text-ok" : live ? "text-brand-light" : "text-ink-muted",
            )}
          >
            {done}/{poule.matches.length}
          </span>
        </span>
      </motion.div>
      <AnimatePresence initial={false} mode="popLayout">
        {view === "scores" ? (
          <motion.div
            key="scores"
            layout="position"
            layoutDependency={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3, delay: 0.12 } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="border-line border-t border-dashed px-3 pt-1.5 pb-2.5"
          >
            <MatchSheet poule={poule} distance={distance} forfaits={forfaits} />
          </motion.div>
        ) : view === "classement" ? (
          <motion.div
            key="classement"
            layout="position"
            layoutDependency={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3, delay: 0.12 } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="border-line border-t border-dashed px-2 pt-1 pb-2"
          >
            <RankTable rows={r.rows} complete={r.complete} forfaits={forfaits} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Wrapper>
  );
}

/** Feuille de match compacte : les matchs dans l'ordre du code sportif, gagnant en gras. */
function MatchSheet({
  poule,
  distance,
  forfaits,
}: {
  poule: Poule;
  distance: Distance;
  forfaits: Set<string>;
}) {
  const multi = distance.setsGagnants > 1;
  return (
    <div className="flex flex-col" aria-label="Feuille de match">
      {orderedMatches(poule, distance).map((om) => {
        const m = om.match;
        const valid = isValidScore(m, distance) || Boolean(m.forfait);
        const w = valid ? matchWinner(m, distance) : null;
        const ff = forfaits.has(m.a) || forfaits.has(m.b);
        const name = (n: string) => (
          <span
            className={cx(
              "min-w-0 truncate",
              w === n ? "text-ink font-bold" : w ? "text-ink-muted" : "text-ink-secondary",
              forfaits.has(n) && "line-through",
            )}
          >
            {shortName(n)}
          </span>
        );
        const score = (side: "a" | "b") =>
          m.forfait === side ? "ff" : String((side === "a" ? m.sa : m.sb) ?? "");
        return (
          <div
            key={m.id}
            className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 py-[3px] text-[11.5px] leading-tight"
            title={
              multi && m.setsA && m.setsB
                ? m.setsA.map((a, i) => `${a}-${m.setsB?.[i] ?? ""}`).join(" · ")
                : undefined
            }
          >
            <span className="flex justify-end">{name(m.a)}</span>
            <span
              className={cx(
                "min-w-[52px] rounded-[5px] px-1 text-center font-mono text-[11px] tabular-nums",
                valid ? "bg-surface-2" : "text-ink-muted",
              )}
            >
              {valid || m.sa !== null || m.sb !== null ? (
                <>
                  <span className={cx(w && (w === m.a ? "text-ok-ink font-bold" : "text-alert-ink"))}>
                    {score("a")}
                  </span>
                  <span className="text-ink-muted">–</span>
                  <span className={cx(w && (w === m.b ? "text-ok-ink font-bold" : "text-alert-ink"))}>
                    {score("b")}
                  </span>
                </>
              ) : ff ? (
                "ff"
              ) : (
                "–"
              )}
            </span>
            {name(m.b)}
          </div>
        );
      })}
    </div>
  );
}

/** Classement compact d'une poule : rang, joueur, Pm, Ps, moyenne (réordonné en direct). */
function RankTable({
  rows,
  complete,
  forfaits,
}: {
  rows: ReturnType<typeof pouleState>["rows"];
  complete: boolean;
  forfaits: Set<string>;
}) {
  return (
    <div className="text-[11.5px]" aria-label="Classement de la poule">
      <div className="text-ink-muted grid grid-cols-[18px_minmax(0,1fr)_24px_24px_40px] gap-1.5 px-1 py-1 text-[9.5px] font-bold tracking-[0.06em] uppercase">
        <span>#</span>
        <span>Joueur</span>
        <span className="text-right">Pm</span>
        <span className="text-right">Ps</span>
        <span className="text-right">Moy.</span>
      </div>
      {rows.map((x, i) => (
        <motion.div
          key={x.name}
          layout="position"
          layoutDependency={i}
          transition={{ layout: LAYOUT }}
          className={cx(
            "grid grid-cols-[18px_minmax(0,1fr)_24px_24px_40px] items-center gap-1.5 rounded-[6px] px-1 py-[3px]",
            complete && i === 0 && "bg-gold-soft/60",
            complete && i === 1 && "bg-ok-soft/50",
          )}
        >
          <span
            className={cx(
              "font-mono font-bold",
              complete ? (i === 0 ? "text-gold-ink" : "text-ink-secondary") : "text-ink-muted",
            )}
          >
            {forfaits.has(x.name) ? "ff" : complete ? i + 1 : "–"}
          </span>
          <span
            className={cx(
              "min-w-0 truncate font-semibold",
              forfaits.has(x.name) && "text-ink-muted line-through",
            )}
          >
            {shortName(x.name)}
          </span>
          <span className="text-right font-mono font-bold tabular-nums">{x.ptm}</span>
          <span className="text-ink-secondary text-right font-mono tabular-nums">{x.pts}</span>
          <span className="text-ink-muted text-right font-mono tabular-nums">
            {x.joues > 0 ? moy(x.moy) : "–"}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

/* ---------- Carte complète (jeudi) ---------- */

function FullCard({
  state,
  phase,
  poule,
  distance,
  active,
  onOpen,
  delays,
  conflict,
  selected,
  onSelectPlayer,
  showPlace,
}: PouleCardProps) {
  const r = pouleState(state, phase, poule);
  const forfaits = new Set(forfaitsOf(state, phase));
  const rec = new Map(r.rows.map((x) => [x.name, x]));
  const done = poule.matches.filter((m) => isValidScore(m, distance)).length;
  // Un set : les deux scores saisis mais incohérents → rouge ; sinon en cours → bleu
  const dots = matchDots(poule, distance);
  const bills = pouleBillards(state, phase, poule);
  const type = billardType(state, bills[0]);
  const live = !r.complete && dots.some((x) => x !== "none");
  const status = r.complete
    ? "Terminée"
    : done
      ? `${done}/${poule.matches.length} matchs`
      : live
        ? "En cours"
        : "À jouer";
  const byName = new Map(state.players.map((p) => [p.name, p]));
  const clubCounts = new Map<string, number>();
  for (const n of poule.players) {
    const c = byName.get(n)?.club ?? "";
    clubCounts.set(c, (clubCounts.get(c) ?? 0) + 1);
  }
  const numOf = (n: string) => poule.players.indexOf(n) + 1;
  const rankOf = new Map(r.rows.map((x, i) => [x.name, i + 1]));
  // Matchs joués, dans l'ordre du code sportif, avec leurs vrais scores
  const played = orderedMatches(poule, distance).filter(
    (om) => isValidScore(om.match, distance) || Boolean(om.match.forfait),
  );
  const Wrapper = onOpen ? "button" : "div";
  return (
    <Wrapper
      type={onOpen ? "button" : undefined}
      onClick={onOpen ? () => onOpen(poule.num) : undefined}
      aria-label={onOpen ? `Ouvrir la saisie de la poule ${poule.num}` : undefined}
      className={cx(
        "card flex min-w-0 flex-col overflow-hidden p-0 text-left transition-[transform,box-shadow,border-color] duration-200",
        onOpen && "hover:shadow-raised hover:-translate-y-0.5",
        r.complete && "border-[#bfe6d2]",
        live && "live-card border-brand-light shadow-[0_0_0_3px_var(--color-brand-soft)]",
        active && "border-brand shadow-[0_0_0_3px_var(--color-brand-soft),var(--shadow-raised)]",
        conflict && "border-alert",
      )}
    >
      <div className="border-line flex items-center justify-between gap-2 border-b px-[13px] pt-[11px] pb-2">
        <b className="flex items-center gap-2 text-[14px]">
          {live ? (
            <span
              className="bg-brand-light animate-live-pulse size-2 rounded-full"
              aria-hidden="true"
            />
          ) : null}
          Poule {poule.num}
        </b>
        <Chip tone={type === "3m10" ? "blue" : "grey"} className="px-2 py-[3px] text-[11px]">
          B{bills.join("·")} · {type}
        </Chip>
      </div>
      <div className="flex flex-col gap-[3px] px-[11px] pt-[8px] pb-2">
        {poule.players.map((n, i) => {
          const x = rec.get(n);
          const club = byName.get(n)?.club ?? "";
          const isConflict = conflict && (clubCounts.get(club) ?? 0) >= 3;
          const delay = delays?.[n];
          const rank = rankOf.get(n);
          const row = (
            <PlayerLine
              name={n}
              num={i + 1}
              crown={r.complete && rank === 1}
              muted={forfaits.has(n)}
              className={cx(
                "rounded-[8px] px-1 py-[3px]",
                delay !== undefined && "animate-slide-in",
                isConflict && "bg-alert-soft",
                selected === n && "bg-brand-soft ring-brand-light ring-2",
              )}
              trailing={
                showPlace ? (
                  <span className="text-ink-muted ml-auto font-mono text-[11px]">
                    {byName.get(n)?.place ?? "nouveau"}
                  </span>
                ) : forfaits.has(n) ? (
                  <span className="text-alert-ink ml-auto text-[10.5px] font-bold">forfait</span>
                ) : x && x.joues > 0 ? (
                  <span className="ml-auto flex items-baseline gap-1.5 font-mono text-[11px] tabular-nums">
                    {r.complete && rank ? (
                      <span
                        className={cx(
                          "font-sans text-[10.5px] font-bold",
                          rank === 1
                            ? "text-gold-ink"
                            : rank === 2
                              ? "text-ok-ink"
                              : "text-ink-muted",
                        )}
                      >
                        {ordinal(rank)}
                      </span>
                    ) : null}
                    <span
                      className={cx("font-bold", x.ptm >= 4 ? "text-ok-ink" : "text-ink-secondary")}
                    >
                      {x.ptm}
                    </span>
                    <span className="text-ink-muted text-[9.5px] font-semibold">Pm</span>
                  </span>
                ) : undefined
              }
            />
          );
          return onSelectPlayer ? (
            <button
              key={n}
              type="button"
              onClick={() => onSelectPlayer(n)}
              className="text-left"
              style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
              aria-pressed={selected === n}
            >
              {row}
            </button>
          ) : (
            <div key={n} style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}>
              {row}
            </div>
          );
        })}
      </div>
      {played.length > 0 ? (
        <div
          className="border-line grid grid-cols-2 gap-x-2 gap-y-[3px] border-t border-dashed px-[13px] py-[7px]"
          aria-label="Matchs joués"
        >
          {played.map((om) => (
            <MatchScore key={om.match.id} match={om.match} distance={distance} numOf={numOf} />
          ))}
        </div>
      ) : null}
      {poule.matches.length > 0 ? (
        <div className="border-line flex items-center gap-[5px] border-t border-dashed px-[13px] pt-2 pb-[11px]">
          <Dots states={dots} />
          <span
            className={cx(
              "ml-auto text-[11px] font-bold",
              r.complete ? "text-ok" : live ? "text-brand-light" : "text-ink-muted",
            )}
          >
            {live ? "En direct · " : ""}
            {status}
          </span>
        </div>
      ) : null}
    </Wrapper>
  );
}

/** Score compact d'un match joué : « 2 100–64 3 », vainqueur en gras. */
function MatchScore({
  match,
  distance,
  numOf,
}: {
  match: Match;
  distance: Distance;
  numOf: (name: string) => number;
}) {
  const w = matchWinner(match, distance);
  const multi = distance.setsGagnants > 1;
  const left = match.forfait === "a" ? "ff" : String(match.sa ?? "");
  const right = match.forfait === "b" ? "ff" : String(match.sb ?? "");
  const num = (name: string) => (
    <span
      className={cx(
        "grid size-[15px] place-items-center rounded-[4px] text-[9.5px] font-bold",
        w === name ? "bg-ink text-white" : "bg-surface-2 text-ink-muted",
      )}
    >
      {numOf(name)}
    </span>
  );
  return (
    <span
      className="animate-pop flex items-center gap-1 font-mono text-[11px] tabular-nums"
      title={
        multi && match.setsA && match.setsB
          ? match.setsA.map((a, i) => `${a}-${match.setsB?.[i] ?? ""}`).join(" · ")
          : undefined
      }
    >
      {num(match.a)}
      <span className={cx(w === match.a ? "text-ok-ink font-bold" : w ? "text-alert-ink" : "text-ink-muted")}>
        {left}
      </span>
      <span className="text-ink-muted">–</span>
      <span className={cx(w === match.b ? "text-ok-ink font-bold" : w ? "text-alert-ink" : "text-ink-muted")}>
        {right}
      </span>
      {num(match.b)}
    </span>
  );
}

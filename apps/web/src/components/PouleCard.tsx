/** Carte d'une poule : joueurs, billard, progression des matchs, classement une fois terminée. */
import type { Distance, Poule, TournamentState } from "@pilot5q/domain";

import type { Match } from "@pilot5q/domain";

import { forfaitsOf, isValidScore, matchWinner } from "@/lib/engine";
import { ordinal } from "@/lib/format";
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
}

export function PouleCard({
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
  const dots = poule.matches.map((m) => {
    if (isValidScore(m, distance)) return "ok" as const;
    if (!matchTouched(m)) return "none" as const;
    // Un set : les deux scores saisis mais incohérents → rouge ; sinon en cours → bleu
    const bothSet = m.sa !== null && m.sb !== null;
    if (distance.setsGagnants === 1 && bothSet) return "ko" as const;
    return "half" as const;
  });
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
      <span className={cx(w === match.a ? "text-ink font-bold" : "text-ink-muted")}>{left}</span>
      <span className="text-ink-muted">–</span>
      <span className={cx(w === match.b ? "text-ink font-bold" : "text-ink-muted")}>{right}</span>
      {num(match.b)}
    </span>
  );
}

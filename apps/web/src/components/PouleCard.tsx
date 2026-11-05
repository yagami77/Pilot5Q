/** Carte d'une poule : joueurs, billard, progression des matchs, classement une fois terminée. */
import type { Distance, Poule, TournamentState } from "@pilot5q/domain";

import { isValidScore } from "@/lib/engine";
import { billardType, matchTouched, pouleBillards, pouleState, type Day } from "@/lib/tournament";

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
  const names = r.complete ? r.rows.map((x) => x.name) : poule.players;
  const byName = new Map(state.players.map((p) => [p.name, p]));
  const clubCounts = new Map<string, number>();
  for (const n of poule.players) {
    const c = byName.get(n)?.club ?? "";
    clubCounts.set(c, (clubCounts.get(c) ?? 0) + 1);
  }
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
      <div className="flex flex-col gap-[5px] px-[11px] pt-[9px] pb-2.5">
        {names.map((n, i) => {
          const x = rec.get(n);
          const club = byName.get(n)?.club ?? "";
          const isConflict = conflict && (clubCounts.get(club) ?? 0) >= 3;
          const wins = x ? x.ptm / 2 : 0;
          const losses = x ? x.joues - wins : 0;
          const delay = delays?.[n];
          const row = (
            <PlayerLine
              name={n}
              club={club}
              size="sm"
              className={cx(
                "rounded-[9px] px-1 py-1",
                delay !== undefined && "animate-slide-in",
                isConflict && "bg-alert-soft",
                selected === n && "bg-brand-soft ring-brand-light ring-2",
              )}
              prefix={
                r.complete && i === 0 ? (
                  <span className="text-gold -mr-1 text-[12px]" aria-label="Première">
                    ★
                  </span>
                ) : undefined
              }
              trailing={
                showPlace ? (
                  <span className="text-ink-muted ml-auto font-mono text-[11px]">
                    {byName.get(n)?.place ?? "nouveau"}
                  </span>
                ) : x && x.joues > 0 ? (
                  <span
                    className={cx(
                      "ml-auto font-mono text-[11px] font-semibold tabular-nums",
                      x.ptm >= 4 ? "text-ok" : "text-ink-muted",
                    )}
                  >
                    {wins}V · {losses}D
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

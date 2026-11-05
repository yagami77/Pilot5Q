/**
 * Affichage au club : tableau des poules (lisible à deux mètres) et liste alphabétique des
 * joueurs avec poule et billard (très compacte). Sans club.
 */
import type { Poule, TournamentState } from "@pilot5q/domain";

import { longDate, nice } from "@/lib/format";
import {
  billardType,
  dayDate,
  distanceLabel,
  phaseDistance,
  pouleBillards,
  type Day,
} from "@/lib/tournament";

import { PrintFoot, PrintHeader } from "./brand";

const PHASE_DAY: Record<"PREQ" | "QN" | "QM", string> = {
  PREQ: "Préqualifications",
  QN: "Qualification National",
  QM: "Qualification Masters",
};

function PouleTile({
  state,
  phase,
  poule,
  large,
  medium = false,
}: {
  state: TournamentState;
  phase: "PREQ" | "QN" | "QM";
  poule: Poule;
  large: boolean;
  medium?: boolean;
}) {
  const bills = pouleBillards(state, phase, poule);
  return (
    <div className="board-tile">
      <div className="flex items-baseline justify-between gap-[2mm] border-b-[0.35mm] border-[#0f1b33] pb-[1.2mm]">
        <span className="flex items-baseline gap-[1.6mm]">
          <span className="sheet-label">Poule</span>
          <span className={large || medium ? "board-num board-num-lg" : "board-num"}>
            {poule.num}
          </span>
        </span>
        <span className="flex items-baseline gap-[1.6mm]">
          <span className="sheet-label">
            Billard{bills.length > 1 ? "s" : ""}
            <span className="block text-right tracking-normal normal-case">
              {billardType(state, bills[0])}
            </span>
          </span>
          <span className={large || medium ? "board-bill board-bill-lg" : "board-bill"}>
            {bills.join(" & ") || "—"}
          </span>
        </span>
      </div>
      <ol className="mt-[1.4mm] flex flex-col">
        {poule.players.map((n, i) => (
          <li
            key={n}
            className={
              large
                ? "board-player board-player-lg"
                : medium
                  ? "board-player board-player-md"
                  : "board-player"
            }
          >
            <span className="board-dot">{i + 1}</span>
            <span className="truncate">{nice(n)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Tableau des poules d'une phase, A4 paysage. */
export function PoulesBoard({
  state,
  phase,
  title,
  day,
}: {
  state: TournamentState;
  phase: "PREQ" | "QN" | "QM";
  title: string;
  day: Day;
}) {
  const poules = state.poules[phase];
  const cols = poules.length > 8 ? 3 : 2;
  const large = poules.length <= 4;
  const medium = !large && poules.length <= 8;
  return (
    <section className="print-page print-board">
      <PrintHeader
        state={state}
        title={title}
        date={longDate(dayDate(state, day), true)}
        day={PHASE_DAY[phase]}
        right={distanceLabel(phaseDistance(state, phase))}
        rightSub={`${poules.length} poules`}
      />
      <div
        className="grid gap-[3mm]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {poules.map((p) => (
          <PouleTile
            key={p.num}
            state={state}
            phase={phase}
            poule={p}
            large={large}
            medium={medium}
          />
        ))}
      </div>
      <PrintFoot>
        Ordre des matchs : 2 contre 3, 1 contre 4, perdants, gagnants, dernier match du 4, dernier
        match du 1. La poule au numéro le plus élevé commence sur un billard partagé.
      </PrintFoot>
    </section>
  );
}

/** Liste alphabétique des joueurs avec poule et billard, A4 portrait, trois colonnes. */
export function PlayersBoard({ state }: { state: TournamentState }) {
  const masters = new Set(state.masters);
  const pouleOf = new Map<string, Poule>();
  for (const p of state.poules.PREQ) for (const n of p.players) pouleOf.set(n, p);
  const list = [...state.players].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  let letter = "";
  return (
    <section className="print-page print-board">
      <PrintHeader
        state={state}
        title="Joueurs · poule et billard"
        date={longDate(dayDate(state, "vendredi"), true)}
        day="Convocation 10h30"
        right={`${list.length}`}
        rightSub="joueurs, par ordre alphabétique"
      />
      <div className="players-cols">
        <div className="players-row players-head">
          <span />
          <span>Joueur</span>
          <span>Poule</span>
          <span>Billard</span>
        </div>
        {list.map((p) => {
          const po = pouleOf.get(p.name);
          const first = p.name.charAt(0).toUpperCase();
          const newLetter = first !== letter;
          letter = first;
          return (
            <div
              key={p.licence}
              className={newLetter ? "players-row players-letter" : "players-row"}
            >
              <b className="players-initial">{newLetter ? first : ""}</b>
              <span className="truncate font-semibold">{nice(p.name)}</span>
              {masters.has(p.name) ? (
                <span className="col-span-2 text-[7pt] font-bold tracking-[0.06em] whitespace-nowrap text-[#5b6680] uppercase">
                  Masters
                </span>
              ) : (
                <>
                  <span className="font-mono font-bold">{po?.num ?? "—"}</span>
                  <span className="font-mono">
                    {po ? pouleBillards(state, "PREQ", po).join(" & ") : "—"}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
      <PrintFoot>Masters : préqualifiés, entrée en lice le samedi.</PrintFoot>
    </section>
  );
}

/**
 * Affichage au club : tableau des poules (toutes les poules sur une page, lisible à deux
 * mètres, bande récapitulative des billards) et liste alphabétique des joueurs avec poule et
 * billard. Sans club : il reste sur la liste de pointage.
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

import { DocBanner, PrintFoot } from "./brand";

const PHASE_DAY: Record<"PREQ" | "QN" | "QM", string> = {
  PREQ: "Préqualifications",
  QN: "Qualification National",
  QM: "Qualification Masters",
};

/** Colonnes de la grille selon le nombre de poules (4 colonnes à partir de 13 poules). */
export function boardColumns(count: number): number {
  return count <= 8 ? 2 : count <= 18 ? 3 : 4;
}

/** Pastille d'un billard : pleine pour un 3m10, contour pour un 2m80. */
function BillardPill({ state, billards }: { state: TournamentState; billards: number[] }) {
  const type = billardType(state, billards[0]);
  const full = type === "3m10";
  return (
    <span className={`board-pill ${full ? "board-pill-full" : ""}`}>
      Billard{billards.length > 1 ? "s" : ""} <b>{billards.length ? billards.join(" & ") : "—"}</b>
      <span>· {type}</span>
    </span>
  );
}

function PouleCard({
  state,
  phase,
  poule,
}: {
  state: TournamentState;
  phase: "PREQ" | "QN" | "QM";
  poule: Poule;
}) {
  const bills = pouleBillards(state, phase, poule);
  return (
    <div className="board-card">
      <div className="board-card-head">
        <span className="board-poule">
          <span className="p-label">Poule</span>
          <span className="board-num">{poule.num}</span>
        </span>
        <BillardPill state={state} billards={bills} />
      </div>
      <ol className="board-players">
        {poule.players.map((n, i) => (
          <li key={n} className="board-player">
            <span className="board-dot">{i + 1}</span>
            <span>{nice(n)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Pour chaque billard : ses poules, celle qui commence en premier. */
export function billardPlan(
  state: TournamentState,
  phase: "PREQ" | "QN" | "QM",
): { num: number; type: string; poules: number[] }[] {
  return state.billards.map((b) => ({
    num: b.num,
    type: b.type,
    poules: state.poules[phase]
      .filter((p) => pouleBillards(state, phase, p).includes(b.num))
      .map((p) => p.num)
      .sort((x, y) => y - x),
  }));
}

function BillardsBand({ state, phase }: { state: TournamentState; phase: "PREQ" | "QN" | "QM" }) {
  const plan = billardPlan(state, phase).filter((b) => b.poules.length > 0);
  if (plan.length === 0) return null;
  const cols = plan.length <= 4 ? plan.length : 4;
  return (
    <div className="board-bills">
      <div className="flex items-baseline justify-between">
        <span className="p-label">Billards · qui commence</span>
        <span className="p-label">Pastille pleine : 3m10 · contour : 2m80</span>
      </div>
      <div
        className="board-bills-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {plan.map((b) => (
          <div key={b.num} className="board-bill">
            <span
              className={`board-bill-num ${b.type === "3m10" ? "board-bill-num-full" : "board-bill-num-line"}`}
            >
              {b.num}
            </span>
            <span className="board-bill-text">
              <b>Poule {b.poules[0]}</b>
              {b.poules.length > 1 ? `commence · puis ${b.poules.slice(1).join(", ")}` : b.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tableau des poules d'une phase sur une seule page A4 portrait (A3 par simple échelle). */
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
  const cols = boardColumns(poules.length);
  const size =
    poules.length <= 4
      ? "board-grid-lg"
      : poules.length <= 8
        ? "board-grid-md"
        : cols === 4
          ? "board-grid-sm"
          : "";
  const d = phaseDistance(state, phase);
  return (
    <section className="print-page print-fixed">
      <DocBanner
        state={state}
        title={title}
        date={longDate(dayDate(state, day), true)}
        sub={`${PHASE_DAY[phase]} · ${poules.length} poules · joueurs dans l'ordre du tirage`}
        cells={[
          { label: "Distance", value: distanceLabel(d), size: "sm" },
          { label: "Poules", value: String(poules.length) },
        ]}
      />
      <div
        className={`board-grid ${size}`}
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridAutoRows: "minmax(0, 1fr)",
        }}
      >
        {poules.map((p) => (
          <PouleCard key={p.num} state={state} phase={phase} poule={p} />
        ))}
      </div>
      <BillardsBand state={state} phase={phase} />
      <PrintFoot>
        Sur un billard partagé, la poule au numéro le plus élevé commence. L'ordre des matchs et les
        arbitres figurent sur les feuilles de match.
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
    <section className="print-page">
      <DocBanner
        state={state}
        title="Joueurs · poule et billard"
        date={longDate(dayDate(state, "vendredi"), true)}
        sub="Liste alphabétique · convocation 10h30"
        cells={[
          { label: "Joueurs", value: String(list.length) },
          { label: "Masters", value: String(masters.size), sub: "entrent samedi" },
        ]}
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

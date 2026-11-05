/**
 * Feuilles de match à remplir au stylo : A4 paysage, deux demi-feuilles A5 côte à côte avec
 * un trait de coupe. En-tête compact (tournoi, poule, billard(s), distance), colonnes ordre,
 * match, gagnant, score (une case par set), paraphe. Sans tableau des joueurs ni arbitre pour
 * les poules et les barrages ; l'arbitre (licence) reste demandé pour les quarts, demies et
 * finales (SPEC §6).
 */
import type { BracketMatch, Distance, Match, Poule, TournamentState } from "@pilot5q/domain";
import type { ReactNode } from "react";

import { matchLabels, matchWinner } from "@/lib/engine";
import { longDate, shortName } from "@/lib/format";
import {
  billardType,
  dayDate,
  distanceLabel,
  orderedMatches,
  phaseDistance,
  pouleBillards,
  roundLabel,
  type Day,
} from "@/lib/tournament";

import { PrintLogo, Tricolore, tournamentLine } from "./brand";
import { paginateHalves, pairs } from "./layout";

/* ---------- Modèle ---------- */

export interface SheetLine {
  /** Nom pré-rempli (vide : ligne d'écriture). */
  name: string;
  /** Numéro du joueur dans la poule (1 à 4). */
  num?: number;
  /** Libellé gris au-dessus de la ligne d'écriture (« Perdant M1 »). */
  hint?: string;
  /** Score connu (réimpression) : points d'un set, ou points par set. */
  sets?: (number | null)[];
  won?: boolean;
}

export interface SheetMatch {
  order: number;
  label: string;
  a: SheetLine;
  b: SheetLine;
}

export interface HalfSheetData {
  key: string;
  /** Phase (« Préqualifications », « Masters », « Barrages »…). */
  phase: string;
  /** Repère principal (« Poule », « Barrage », « Quart »…). */
  bigLabel: string;
  bigValue: string;
  /** « TN 2 · Ronchin ». */
  tournament: string;
  billards: number[];
  billardType: string;
  /** Billard partagé : la poule au numéro le plus élevé commence. */
  turn?: "premier" | "ensuite";
  distance: Distance;
  date: string;
  matches: SheetMatch[];
  /** Champs à remplir en bas (arbitre, heure). */
  fields?: string[];
  rule: string;
}

const PLACEHOLDERS_4: [string | null, string | null][] = [
  [null, null],
  [null, null],
  ["Perdant M1", "Perdant M2"],
  ["Gagnant M1", "Gagnant M2"],
  ["4", "Son dernier adversaire"],
  ["1", "Son dernier adversaire"],
];
const PLACEHOLDERS_3: [string | null, string | null][] = [
  [null, null],
  ["1", "Gagnant M1"],
  ["1", "Perdant M1"],
];

function setsOf(m: Match, side: "a" | "b", d: Distance): (number | null)[] | undefined {
  if (m.forfait) return undefined;
  if (d.setsGagnants > 1) {
    const s = side === "a" ? m.setsA : m.setsB;
    return s && s.length ? s : undefined;
  }
  const v = side === "a" ? m.sa : m.sb;
  return v === null ? undefined : [v];
}

function ruleText(d: Distance, size: number): string {
  const order =
    size === 3
      ? "Ordre : 2–3, 1–gagnant, 1–perdant."
      : "Ordre : 2–3, 1–4, perdants, gagnants, dernier match du 4, dernier match du 1.";
  const valid =
    d.setsGagnants === 1
      ? `Match valide : un joueur à ${d.pointsParSet}, l'autre en dessous.`
      : `Set gagné à ${d.pointsParSet}, ${d.setsGagnants} sets gagnants : noter les points de chaque set.`;
  return `${valid} ${order} Les joueurs qui ne jouent pas arbitrent ; chacun paraphe après son match.`;
}

/** Feuille d'une poule (vendredi ou samedi). */
export function pouleSheet(
  state: TournamentState,
  phase: "PREQ" | "QN" | "QM",
  poule: Poule,
  day: Day,
): HalfSheetData {
  const d = phaseDistance(state, phase);
  const bills = pouleBillards(state, phase, poule);
  const size = poule.players.length;
  const labels = matchLabels(size);
  const ordered = orderedMatches(poule, d);
  const numOf = (n: string) => poule.players.indexOf(n) + 1;
  const first = ordered[0]?.match;
  const second = ordered[1]?.match;
  const resolved =
    size === 4
      ? Boolean(first && second && matchWinner(first, d) && matchWinner(second, d))
      : Boolean(first && matchWinner(first, d));
  const placeholders = size === 3 ? PLACEHOLDERS_3 : PLACEHOLDERS_4;
  const line = (m: Match, side: "a" | "b"): SheetLine => {
    const name = side === "a" ? m.a : m.b;
    const w = matchWinner(m, d);
    const sets = setsOf(m, side, d);
    return {
      name,
      num: numOf(name),
      ...(sets ? { sets } : {}),
      won: w === name,
    };
  };
  const matches: SheetMatch[] = ordered.map((om, i) => {
    const fixed = i < (size === 3 ? 1 : 2);
    if (fixed || resolved) {
      return {
        order: i + 1,
        label: labels[i] ?? "",
        a: line(om.match, "a"),
        b: line(om.match, "b"),
      };
    }
    const [pa, pb] = placeholders[i] ?? [null, null];
    const known = (p: string | null): SheetLine => {
      if (p && /^\d$/.test(p)) {
        const name = poule.players[Number(p) - 1] ?? "";
        return { name, num: Number(p) };
      }
      return { name: "", hint: p ?? "" };
    };
    return { order: i + 1, label: labels[i] ?? "", a: known(pa), b: known(pb) };
  });
  return {
    key: `${phase}-${poule.num}`,
    phase: { PREQ: "Préqualifications", QN: "Qualification National", QM: "Qualification Masters" }[
      phase
    ],
    bigLabel: "Poule",
    bigValue: String(poule.num),
    tournament: tournamentLine(state),
    billards: bills,
    billardType: billardType(state, bills[0]),
    distance: d,
    date: longDate(dayDate(state, day), true),
    matches,
    rule: ruleText(d, size),
  };
}

/** « Vainqueur SF1 » → « Vainqueur demi-finale 1 », « 1er P3 » → « 1er poule 3 ». */
function friendlyLabel(label: string): string {
  return label
    .replace(/\bSF(\d)/, "demi-finale $1")
    .replace(/\bQF(\d)/, "quart $1")
    .replace(/\bR16-?(\d)/, "huitième $1")
    .replace(/\bP(\d+)/, "poule $1");
}

/** Feuille d'un match isolé (barrage, tour de tableau). */
function singleMatchSheet(
  state: TournamentState,
  m: Match,
  opts: {
    key: string;
    phase: string;
    bigLabel: string;
    bigValue: string;
    d: Distance;
    day: Day;
    labelA?: string;
    labelB?: string;
    fields?: string[];
  },
): HalfSheetData {
  const w = matchWinner(m, opts.d);
  const side = (s: "a" | "b"): SheetLine => {
    const name = s === "a" ? m.a : m.b;
    const sets = setsOf(m, s, opts.d);
    return name
      ? { name, ...(sets ? { sets } : {}), won: w === name }
      : { name: "", hint: friendlyLabel((s === "a" ? opts.labelA : opts.labelB) ?? "") };
  };
  const bills = m.billard ? [m.billard] : [];
  const rule =
    opts.d.setsGagnants === 1
      ? `Match valide : un joueur à ${opts.d.pointsParSet}, l'autre en dessous. Les deux joueurs paraphent la feuille.`
      : `Set gagné à ${opts.d.pointsParSet}, ${opts.d.setsGagnants} sets gagnants : noter les points de chaque set. Pause de 30 minutes minimum entre deux paliers.`;
  return {
    key: opts.key,
    phase: opts.phase,
    bigLabel: opts.bigLabel,
    bigValue: opts.bigValue,
    tournament: tournamentLine(state),
    billards: bills,
    billardType: bills[0] ? billardType(state, bills[0]) : "",
    distance: opts.d,
    date: longDate(dayDate(state, opts.day), true),
    matches: [{ order: 1, label: "", a: side("a"), b: side("b") }],
    ...(opts.fields ? { fields: opts.fields } : {}),
    rule,
  };
}

export function barrageSheets(state: TournamentState): HalfSheetData[] {
  const d = state.rules.distances.barrage;
  return state.barrages.map((m) =>
    singleMatchSheet(state, m, {
      key: `B-${m.id}`,
      phase: "Barrages",
      bigLabel: "Barrage",
      bigValue: m.id.replace(/^B/, ""),
      d,
      day: "vendredi",
    }),
  );
}

export function finalSheets(state: TournamentState): HalfSheetData[] {
  const out: HalfSheetData[] = [];
  for (const phase of ["M", "N"] as const)
    for (const m of state.brackets[phase] as BracketMatch[]) {
      if (m.round === "R16" || m.round === "R32" || m.round === "R64") continue;
      out.push(
        singleMatchSheet(state, m, {
          key: `${phase}-${m.id}`,
          phase: phase === "M" ? "Masters" : "National",
          bigLabel: m.round === "F" ? "Tour" : roundLabel(m.round).replace(/s$/, ""),
          bigValue: m.round === "F" ? "Finale" : String(m.slot),
          d: phaseDistance(state, phase, m.round),
          day: "dimanche",
          ...(m.labelA ? { labelA: m.labelA } : {}),
          ...(m.labelB ? { labelB: m.labelB } : {}),
          fields: ["Arbitre (nom et licence)", "Heure de début"],
        }),
      );
    }
  return out;
}

/** Feuilles des poules d'une phase, regroupées par billard (pages de deux demi-feuilles). */
export function pouleSheetPages(
  state: TournamentState,
  phase: "PREQ" | "QN" | "QM",
  day: Day,
): HalfSheetData[][] {
  const poules = state.poules[phase];
  const shared = (p: Poule) => {
    const b = pouleBillards(state, phase, p);
    return poules.filter((q) => pouleBillards(state, phase, q).some((x) => b.includes(x)));
  };
  return paginateHalves(
    poules.map((p) => {
      const mates = shared(p);
      const sheet = pouleSheet(state, phase, p, day);
      if (mates.length > 1)
        sheet.turn = Math.max(...mates.map((q) => q.num)) === p.num ? "premier" : "ensuite";
      return { item: sheet, billards: pouleBillards(state, phase, p) };
    }),
  );
}

export function pairPages(sheets: HalfSheetData[]): HalfSheetData[][] {
  return pairs(sheets);
}

/* ---------- Rendu ---------- */

function Scissors() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="4.2mm"
      height="4.2mm"
      fill="none"
      stroke="#8a93a3"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="6" cy="6" r="3" />
      <path d="M8.12 8.12 12 12" />
      <path d="M20 4 8.12 15.88" />
      <circle cx="6" cy="18" r="3" />
      <path d="M14.8 14.8 20 20" />
    </svg>
  );
}

/** Page A4 paysage de deux demi-feuilles avec trait de coupe. */
export function SheetPage({ halves }: { halves: HalfSheetData[] }) {
  return (
    <section className="print-sheet">
      {halves.map((h) => (
        <HalfSheet key={h.key} data={h} />
      ))}
      {halves.length < 2 ? <div /> : null}
      <div className="sheet-cut" aria-hidden="true">
        <span className="sheet-scissors">
          <Scissors />
        </span>
      </div>
    </section>
  );
}

function NumDot({ n }: { n: number }) {
  return (
    <span className="mr-[1.6mm] inline-grid size-[4.2mm] shrink-0 place-items-center rounded-full border-[0.25mm] border-[#5b6680] font-mono text-[7pt] leading-none font-bold text-[#3c4a66]">
      {n}
    </span>
  );
}

function PlayerRow({
  line,
  setCount,
  compact,
}: {
  line: SheetLine;
  setCount: number;
  compact: boolean;
}) {
  return (
    <div className="sheet-row" style={{ gridTemplateColumns: rowColumns(setCount, compact) }}>
      <div className="sheet-name">
        {line.name ? (
          <span className="flex min-w-0 items-center">
            {line.num ? <NumDot n={line.num} /> : null}
            <span className="truncate">{compact ? shortName(line.name) : nice2(line.name)}</span>
          </span>
        ) : (
          <span className="sheet-write">
            <span className="sheet-hint">{line.hint}</span>
          </span>
        )}
      </div>
      <div className="grid place-items-center">
        <span className="sheet-check">{line.won ? "✕" : ""}</span>
      </div>
      <div className="flex items-center gap-[1.5mm]">
        {Array.from({ length: setCount }, (_, i) => (
          <span key={i} className="sheet-box">
            {line.sets?.[i] ?? ""}
          </span>
        ))}
      </div>
      <div className="sheet-sign" />
    </div>
  );
}

/** « DUPONT JEAN » → « Dupont Jean » (nom complet quand la place le permet). */
function nice2(name: string): string {
  return name.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase());
}

function rowColumns(setCount: number, compact: boolean): string {
  const scores = `${setCount * 14 + (setCount - 1) * 1.5}mm`;
  return `minmax(0,1fr) 9mm ${scores} ${compact ? "17mm" : "22mm"}`;
}

/** Joueur d'un match isolé : nom sur sa ligne, puis gagnant, une case par set, paraphe. */
function SinglePlayer({ line, setCount }: { line: SheetLine; setCount: number }) {
  return (
    <div className="sheet-player">
      <div className="sheet-player-name">
        {line.name ? (
          nice2(line.name)
        ) : (
          <span className="sheet-write">
            <span className="sheet-hint">{line.hint}</span>
          </span>
        )}
      </div>
      <div className="flex items-end gap-[2.4mm]">
        <div className="flex flex-col items-center gap-[1mm]">
          <span className="sheet-label">Gagnant</span>
          <span className="sheet-check">{line.won ? "✕" : ""}</span>
        </div>
        <div className="flex gap-[1.6mm]">
          {Array.from({ length: setCount }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-[1mm]">
              <span className="sheet-label">{setCount > 1 ? `Set ${i + 1}` : "Score"}</span>
              <span className="sheet-box sheet-box-lg">{line.sets?.[i] ?? ""}</span>
            </div>
          ))}
        </div>
        <div className="flex min-w-[18mm] flex-1 flex-col gap-[1mm]">
          <span className="sheet-label">Paraphe</span>
          <span className="sheet-sign w-full" />
        </div>
      </div>
    </div>
  );
}

export function HalfSheet({ data }: { data: HalfSheetData }) {
  const d = data.distance;
  const setCount = d.setsGagnants === 1 ? 1 : 2 * d.setsGagnants - 1;
  const single = data.matches.length === 1;
  const compact = setCount > 1 && !single;
  const billards =
    data.billards.length === 0 ? "—" : data.billards.join(data.billards.length > 1 ? " & " : "");
  return (
    <article className="sheet-half">
      <Tricolore />
      <div className="mt-[2.2mm] flex items-center justify-between gap-[3mm] text-[7.5pt] text-[#5b6680]">
        <span className="inline-flex min-w-0 items-center gap-[1.6mm]">
          <PrintLogo size={4.6} />
          <b className="text-[8.5pt] font-extrabold text-[#0f1b33]">Pilot5Q</b>
          <span className="truncate">· {data.tournament}</span>
        </span>
        <span className="shrink-0 font-semibold">{data.date}</span>
      </div>

      <div className="sheet-head">
        <div>
          <div className="sheet-label">{data.bigLabel}</div>
          <div className="sheet-big">{data.bigValue || "—"}</div>
          {data.turn ? (
            <div className="sheet-sub">{data.turn === "premier" ? "commence" : "joue ensuite"}</div>
          ) : null}
        </div>
        <div>
          <div className="sheet-label">Billard{data.billards.length > 1 ? "s" : ""}</div>
          <div className="sheet-big">{billards}</div>
          {data.billardType ? <div className="sheet-sub">{data.billardType}</div> : null}
        </div>
        <div className="text-right">
          <div className="sheet-label">{data.phase}</div>
          <div className="mt-[1.4mm] text-[12pt] leading-[1.15] font-extrabold text-[#0f1b33]">
            {distanceLabel(d)}
          </div>
          <div className="sheet-sub">Feuille de match</div>
        </div>
      </div>

      {single ? (
        <div className="sheet-single">
          {[data.matches[0]!.a, data.matches[0]!.b].map((line, i) => (
            <SinglePlayer key={i} line={line} setCount={setCount} />
          ))}
        </div>
      ) : (
        <div className="sheet-table">
          <div
            className="sheet-cols"
            style={{ gridTemplateColumns: `14mm ${rowColumns(setCount, compact)}` }}
          >
            <span>Ordre</span>
            <span>Match</span>
            <span className="text-center">Gagnant</span>
            <span className={setCount > 1 ? "flex gap-[1.5mm]" : "text-center"}>
              {setCount > 1
                ? Array.from({ length: setCount }, (_, i) => (
                    <span key={i} className="w-[14mm] text-center">
                      Set {i + 1}
                    </span>
                  ))
                : "Score"}
            </span>
            <span>Paraphe</span>
          </div>
          {data.matches.map((m) => (
            <div key={m.order} className="sheet-match">
              <div className="sheet-order">
                <b>M{m.order}</b>
                <span>{m.label}</span>
              </div>
              <div className="min-w-0">
                <PlayerRow line={m.a} setCount={setCount} compact={compact} />
                <PlayerRow line={m.b} setCount={setCount} compact={compact} />
              </div>
            </div>
          ))}
        </div>
      )}

      {data.fields?.length ? (
        <div className="mt-[5mm] grid gap-[4mm]">
          {data.fields.map((f) => (
            <div key={f} className="flex items-end gap-[3mm]">
              <span className="sheet-label shrink-0">{f}</span>
              <span className="sheet-sign flex-1" />
            </div>
          ))}
        </div>
      ) : null}

      <p className="sheet-rule">{data.rule}</p>
    </article>
  );
}

/** Rend une liste de pages de demi-feuilles. */
export function SheetPages({ pages }: { pages: HalfSheetData[][] }): ReactNode {
  return (
    <>
      {pages.map((halves) => (
        <SheetPage key={halves.map((h) => h.key).join("|")} halves={halves} />
      ))}
    </>
  );
}

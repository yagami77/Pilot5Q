/**
 * Feuilles de match à remplir au stylo : A4 paysage, deux demi-feuilles A5 côte à côte avec
 * un trait de coupe. Bandeau plein (tournoi, lieu, journée) avec un grand cartouche « POULE ·
 * BILLARD » lisible de loin ; six blocs de match de hauteur égale, zébrés, avec pour chaque
 * joueur une case GAGNANT, une boîte SCORE (ou une boîte par set et le total de sets) et un
 * PARAPHE ; rappel des règles en pied (pas de QR code : il n'était pas utilisé, la place revient
 * aux blocs de match). Barrages, quarts, demies et finales : deux matchs par demi-feuille,
 * arbitres et heure demandés le dimanche (SPEC §6).
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

import { PrintBanner, PrintLogo, type BannerCell } from "./brand";
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
  /** Sets gagnés (distance à plusieurs sets, réimpression). */
  setsWon?: number;
  won?: boolean;
  lost?: boolean;
}

export interface SheetMatch {
  order: number;
  label: string;
  a: SheetLine;
  b: SheetLine;
  /** Match isolé : titre du bloc (« Barrage 3 », « Quart 1 »). */
  title?: string;
  billards?: number[];
  billardType?: string;
  /** Champs à remplir sous le match (arbitres, heure). */
  fields?: string[];
}

export interface HalfSheetData {
  key: string;
  /** Poule (six blocs) ou matchs isolés (deux blocs par demi-feuille). */
  kind: "poule" | "single";
  /** Phase (« Préqualifications », « Masters », « Barrages »…). */
  phase: string;
  /** « TN 2 ». */
  tournament: string;
  /** « Ronchin ». */
  place: string;
  /** « Vendredi 30 octobre 2026 ». */
  date: string;
  /** Cartouche blanc du bandeau. */
  cells: BannerCell[];
  distance: Distance;
  /** Billard partagé : « Commence » ou « Joue après la poule 9 ». */
  turn?: string;
  matches: SheetMatch[];
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

function line(m: Match, side: "a" | "b", d: Distance, num?: number): SheetLine {
  const name = side === "a" ? m.a : m.b;
  const w = matchWinner(m, d);
  const sets = setsOf(m, side, d);
  const setsWon = d.setsGagnants > 1 ? (side === "a" ? m.sa : m.sb) : null;
  return {
    name,
    ...(num ? { num } : {}),
    ...(sets ? { sets } : {}),
    ...(setsWon !== null && setsWon !== undefined ? { setsWon } : {}),
    won: w === name,
    lost: Boolean(w) && w !== name,
  };
}

function validText(d: Distance): string {
  return d.setsGagnants === 1
    ? `Match valide : un joueur à ${d.pointsParSet}, l'autre en dessous.`
    : `Set gagné à ${d.pointsParSet}, ${d.setsGagnants} sets gagnants : noter les points de chaque set et le total de sets.`;
}

function ruleText(d: Distance, size: number): string {
  const order =
    size === 3
      ? "Ordre : 2–3, 1–gagnant, 1–perdant."
      : "Ordre : 2–3, 1–4, perdants, gagnants, dernier de 4, dernier de 1.";
  return `${validText(d)} ${order} Les joueurs qui ne jouent pas arbitrent ; chacun paraphe après son match.`;
}

const PHASE_NAME = {
  PREQ: "Préqualifications",
  QN: "Qualification National",
  QM: "Qualification Masters",
} as const;

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
  const matches: SheetMatch[] = ordered.map((om, i) => {
    const fixed = i < (size === 3 ? 1 : 2);
    if (fixed || resolved) {
      return {
        order: i + 1,
        label: labels[i] ?? "",
        a: line(om.match, "a", d, numOf(om.match.a)),
        b: line(om.match, "b", d, numOf(om.match.b)),
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
  const type = billardType(state, bills[0]);
  return {
    key: `${phase}-${poule.num}`,
    kind: "poule",
    phase: PHASE_NAME[phase],
    tournament: state.info?.name ?? "",
    place: state.info?.city ?? "",
    date: longDate(dayDate(state, day), true),
    cells: [
      { label: "Poule", value: String(poule.num) },
      {
        label: bills.length > 1 ? "Billards" : "Billard",
        value: bills.length ? bills.join(" & ") : "—",
        sub: type,
      },
    ],
    distance: d,
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

/** Match isolé (barrage, tour de tableau) avec sa phase, prêt à être groupé par deux. */
export interface SingleSheet {
  phase: string;
  /** Libellé du cartouche (« Barrage », « Quart », « Finale »). */
  label: string;
  /** Valeur du cartouche (« 3 », « Masters »). */
  value: string;
  d: Distance;
  day: Day;
  match: SheetMatch;
}

function singleMatch(
  state: TournamentState,
  m: Match,
  opts: {
    phase: string;
    label: string;
    value: string;
    title: string;
    d: Distance;
    day: Day;
    labelA?: string;
    labelB?: string;
    fields?: string[];
  },
): SingleSheet {
  const side = (s: "a" | "b"): SheetLine => {
    const name = s === "a" ? m.a : m.b;
    return name
      ? line(m, s, opts.d)
      : { name: "", hint: friendlyLabel((s === "a" ? opts.labelA : opts.labelB) ?? "") };
  };
  const bills = m.billard ? [m.billard] : [];
  return {
    phase: opts.phase,
    label: opts.label,
    value: opts.value,
    d: opts.d,
    day: opts.day,
    match: {
      order: 1,
      label: "",
      title: opts.title,
      a: side("a"),
      b: side("b"),
      billards: bills,
      billardType: bills[0] ? billardType(state, bills[0]) : "",
      ...(opts.fields ? { fields: opts.fields } : {}),
    },
  };
}

export function barrageSheets(state: TournamentState): SingleSheet[] {
  const d = state.rules.distances.barrage;
  return state.barrages.map((m) => {
    const n = m.id.replace(/^B/, "");
    return singleMatch(state, m, {
      phase: "Barrages",
      label: "Barrage",
      value: n,
      title: `Barrage ${n}`,
      d,
      day: "vendredi",
    });
  });
}

export function finalSheets(state: TournamentState): SingleSheet[] {
  const out: SingleSheet[] = [];
  for (const phase of ["M", "N"] as const)
    for (const m of state.brackets[phase] as BracketMatch[]) {
      if (m.round === "R16" || m.round === "R32" || m.round === "R64") continue;
      const phaseName = phase === "M" ? "Masters" : "National";
      const roundName = m.round === "F" ? "Finale" : roundLabel(m.round).replace(/s$/, "");
      const round = m.round === "F" ? "Finale" : `${roundName} ${m.slot}`;
      out.push(
        singleMatch(state, m, {
          phase: phaseName,
          label: m.round === "F" ? phaseName : `${phaseName} · ${roundName}`,
          value: m.round === "F" ? "Finale" : String(m.slot),
          title: `${round} ${phaseName}`,
          d: phaseDistance(state, phase, m.round),
          day: "dimanche",
          ...(m.labelA ? { labelA: m.labelA } : {}),
          ...(m.labelB ? { labelB: m.labelB } : {}),
          fields: ["Arbitre 1", "Arbitre 2", "Heure"],
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
      if (mates.length > 1) {
        const first = Math.max(...mates.map((q) => q.num));
        sheet.turn = first === p.num ? "Commence" : `Joue après la poule ${first}`;
      }
      return { item: sheet, billards: pouleBillards(state, phase, p) };
    }),
  );
}

/**
 * Demi-feuilles de matchs isolés : deux matchs par demi-feuille, sans mélanger les phases
 * (Masters et National restent sur des demi-feuilles distinctes).
 */
export function singleHalves(state: TournamentState, singles: SingleSheet[]): HalfSheetData[] {
  const groups = new Map<string, SingleSheet[]>();
  for (const s of singles) groups.set(s.phase, [...(groups.get(s.phase) ?? []), s]);
  const out: HalfSheetData[] = [];
  for (const group of groups.values())
    for (const pair of pairs(group)) {
      const first = pair[0]!;
      const d = first.d;
      const cells: BannerCell[] = pair.map((s) => {
        const b = s.match.billards?.[0];
        return {
          label: s.label,
          value: s.value,
          size: /^\d+$/.test(s.value) ? "lg" : "sm",
          sub: b ? `Billard ${b} · ${s.match.billardType}` : "Billard à préciser",
        };
      });
      out.push({
        key: pair.map((s) => `${s.phase}-${s.match.title}`).join("+"),
        kind: "single",
        phase: first.phase,
        tournament: state.info?.name ?? "",
        place: state.info?.city ?? "",
        date: longDate(dayDate(state, first.day), true),
        cells,
        distance: d,
        matches: pair.map((s, i) => ({ ...s.match, order: i + 1 })),
        rule:
          d.setsGagnants === 1
            ? `${validText(d)} Les deux joueurs paraphent la feuille après le match.`
            : `${validText(d)} Pause de 30 minutes minimum entre deux paliers. Les deux joueurs paraphent la feuille.`,
      });
    }
  return out;
}

export function pairPages(halves: HalfSheetData[]): HalfSheetData[][] {
  return pairs(halves);
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

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" aria-hidden="true">
      <path d="M4.5 12.5l5 5 10-11" strokeLinecap="round" strokeLinejoin="round" />
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

/** « DUPONT JEAN » → « Dupont Jean » (nom complet quand la place le permet). */
function nice2(name: string): string {
  return name.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase());
}

/** Nombre de cases de score : une, ou une par set possible (2n − 1). */
function setCountOf(d: Distance): number {
  return d.setsGagnants === 1 ? 1 : 2 * d.setsGagnants - 1;
}

/** Colonnes d'un bloc de poule : match, joueur, gagnant, score (ou sets + total), paraphe. */
function blockColumns(setCount: number): string {
  if (setCount === 1) return "13.5mm minmax(0,1fr) 9.5mm 20mm 25mm";
  const sets = `${setCount * 11.2 + (setCount - 1) * 1.2}mm`;
  return `12mm minmax(0,1fr) 10mm ${sets} 9mm 18mm`;
}

function CheckBox({ on }: { on?: boolean }) {
  return (
    <span className={`sheet-check ${on ? "sheet-check-on" : ""}`}>{on ? <Check /> : null}</span>
  );
}

function ScoreBox({
  value,
  line,
  small,
}: {
  value: number | null | undefined;
  line: SheetLine;
  small?: boolean;
}) {
  const filled = value !== null && value !== undefined;
  const cls = filled ? (line.won ? "sheet-box-w" : line.lost ? "sheet-box-l" : "") : "";
  return (
    <span className={`sheet-box ${cls}`} style={small ? { height: "9mm" } : undefined}>
      {filled ? value : ""}
    </span>
  );
}

function Name({ line, compact, big }: { line: SheetLine; compact?: boolean; big?: boolean }) {
  if (!line.name)
    return (
      <span className="sheet-write">
        <span className="sheet-hint">{line.hint}</span>
      </span>
    );
  const weight = line.lost ? { fontWeight: 500, color: "#3c4a66" } : undefined;
  return (
    <>
      {line.num ? <span className="sheet-dot">{line.num}</span> : null}
      <span className="nm" style={weight}>
        {compact && !big ? shortName(line.name) : nice2(line.name)}
      </span>
    </>
  );
}

/** Cellules d'une ligne de joueur dans un bloc de poule (placées dans la grille du bloc). */
function PlayerCells({ line, setCount }: { line: SheetLine; setCount: number }) {
  const multi = setCount > 1;
  return (
    <>
      <div className="sheet-name">
        <Name line={line} compact={multi} />
      </div>
      <CheckBox on={line.won} />
      {multi ? (
        <div className="sheet-sets" style={{ gridTemplateColumns: `repeat(${setCount}, 1fr)` }}>
          {Array.from({ length: setCount }, (_, i) => (
            <ScoreBox key={i} value={line.sets?.[i]} line={line} small />
          ))}
        </div>
      ) : (
        <ScoreBox value={line.sets?.[0]} line={line} />
      )}
      {multi ? <ScoreBox value={line.setsWon} line={line} small /> : null}
      <div className="sheet-sign" />
    </>
  );
}

function PouleBlocks({ data }: { data: HalfSheetData }) {
  const setCount = setCountOf(data.distance);
  const columns = blockColumns(setCount);
  const multi = setCount > 1;
  return (
    <>
      <div className="sheet-cols" style={{ gridTemplateColumns: columns }}>
        <span>Match</span>
        <span>Joueur</span>
        <span className="c">Gagnant</span>
        {multi ? (
          <span className="sheet-sets" style={{ gridTemplateColumns: `repeat(${setCount}, 1fr)` }}>
            {Array.from({ length: setCount }, (_, i) => (
              <span key={i} className="c">
                Set {i + 1}
              </span>
            ))}
          </span>
        ) : (
          <span className="c">Score</span>
        )}
        {multi ? <span className="c">Sets</span> : null}
        <span>Paraphe</span>
      </div>
      <div className="sheet-blocks">
        {data.matches.map((m) => (
          <div
            key={m.order}
            className="sheet-block"
            style={{ gridTemplateColumns: columns, gridTemplateRows: "1fr 1fr" }}
          >
            <div className="sheet-order" style={{ gridRow: "1 / span 2" }}>
              <b>M{m.order}</b>
              <span>{m.label}</span>
            </div>
            <PlayerCells line={m.a} setCount={setCount} />
            <PlayerCells line={m.b} setCount={setCount} />
          </div>
        ))}
      </div>
    </>
  );
}

/** Un match isolé : bandeau sombre (titre, billard), deux joueurs, champs du dimanche. */
function Game({ m, d }: { m: SheetMatch; d: Distance }) {
  const setCount = setCountOf(d);
  const multi = setCount > 1;
  const columns = multi
    ? `11mm ${setCount * 13 + (setCount - 1) * 1.5}mm 12mm minmax(20mm,1fr)`
    : "11mm 24mm minmax(30mm,48mm)";
  const b = m.billards?.[0];
  return (
    <div className="sheet-game">
      <div className="sheet-game-head">
        <b>{m.title}</b>
        <span>
          {b ? (
            <>
              Billard <strong>{b}</strong> · {m.billardType} ·{" "}
            </>
          ) : null}
          {distanceLabel(d)}
        </span>
      </div>
      <div className="sheet-game-body">
        {[m.a, m.b].map((lineData, i) => (
          <div key={i} className="sheet-player">
            <div className="sheet-player-name">
              <Name line={lineData} big />
            </div>
            <div className="sheet-player-fields" style={{ gridTemplateColumns: columns }}>
              <div className="sheet-field">
                <span className="p-label">Gagnant</span>
                <CheckBox on={lineData.won} />
              </div>
              {multi ? (
                <div className="sheet-field">
                  <div
                    className="sheet-sets"
                    style={{ gridTemplateColumns: `repeat(${setCount}, 1fr)` }}
                  >
                    {Array.from({ length: setCount }, (_, k) => (
                      <span key={k} className="p-label">
                        Set {k + 1}
                      </span>
                    ))}
                  </div>
                  <div
                    className="sheet-sets"
                    style={{ gridTemplateColumns: `repeat(${setCount}, 1fr)` }}
                  >
                    {Array.from({ length: setCount }, (_, k) => (
                      <ScoreBox key={k} value={lineData.sets?.[k]} line={lineData} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="sheet-field">
                  <span className="p-label">Score</span>
                  <ScoreBox value={lineData.sets?.[0]} line={lineData} />
                </div>
              )}
              {multi ? (
                <div className="sheet-field">
                  <span className="p-label">Sets</span>
                  <ScoreBox value={lineData.setsWon} line={lineData} />
                </div>
              ) : null}
              <div className="sheet-field">
                <span className="p-label">Paraphe</span>
                <span className="sheet-sign" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {m.fields?.length ? (
        <div className="sheet-game-fields">
          {m.fields.map((f) => (
            <span key={f}>
              {f}
              <span className="sheet-sign" />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HalfSheet({ data }: { data: HalfSheetData }) {
  const d = data.distance;
  return (
    <article className="sheet-half">
      <PrintBanner
        small
        eyebrow="Feuille de match"
        title={data.tournament}
        sub={[data.place, data.date].filter(Boolean).join(" · ")}
        cells={data.cells}
      />
      <div className="p-context">
        <span>
          <b>{data.phase}</b>
          <span className="sep">·</span>
          {distanceLabel(d)}
          {data.turn ? (
            <>
              <span className="sep">·</span>
              <b>{data.turn}</b>
            </>
          ) : null}
        </span>
        <span className="p-label">
          {data.kind === "poule" ? `${data.matches.length} matchs` : ""}
        </span>
      </div>

      {data.kind === "poule" ? (
        <PouleBlocks data={data} />
      ) : (
        <div className="sheet-single">
          {data.matches.map((m) => (
            <Game key={m.order} m={m} d={d} />
          ))}
        </div>
      )}

      <div className="sheet-foot">
        <p className="sheet-rule">{data.rule}</p>
        <span className="p-foot-brand">
          <PrintLogo height={4.6} />
        </span>
      </div>
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

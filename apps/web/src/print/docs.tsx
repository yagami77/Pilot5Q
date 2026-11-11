/**
 * Documents imprimables (A4). Chaque document est une fonction de l'état qui rend une ou
 * plusieurs pages `.print-page` : bandeau d'en-tête commun, tableaux zébrés aux filets fins,
 * cases à cocher de 6 mm, scores des matchs joués (gagnant en vert gras, perdant en rouge
 * maigre, lisibles en noir et blanc), pagination explicite avec numéro de page.
 */
import type { BracketRound, Poule, TournamentState } from "@pilot5q/domain";
import type { ReactNode } from "react";

import { FlowDiagram } from "@/components/FlowDiagram";

import { PlayersBoard, PoulesBoard } from "./boards";
import { DocBanner, PrintFoot, Score, winClass, type BannerCell } from "./brand";
import { consolantePages, consolanteRounds } from "./consolanteRounds";
import { chunk } from "./layout";
import {
  SheetPages,
  barrageSheets,
  finalSheets,
  pairPages,
  pouleSheetPages,
  singleHalves,
} from "./sheets";

import "./print.css";

import { matchWinner } from "@/lib/engine";
import { mastersRotationOf } from "@/lib/mastersRotation";
import { bracketNaming } from "@/lib/bracketNaming";
import { clubShort, dateRange, euros, longDate, nice, shortName } from "@/lib/format";
import { progressivePrimes } from "@/lib/primes";
import {
  billardType,
  dayDate,
  distanceLabel,
  orderedMatches,
  phaseDistance,
  pouleBillards,
  pouleState,
  preqRanking,
  qualifiers,
  type Day,
} from "@/lib/tournament";

export type DocId =
  | "schema"
  | "pointage"
  | "joueurs-poules"
  | "tableau-poules"
  | "premiers-matchs"
  | "feuilles-preq"
  | "classement-preq"
  | "resultats-poules"
  | "tableau-barrages"
  | "feuilles-barrages"
  | "pointage-consolante"
  | "poules-samedi"
  | "feuilles-qm"
  | "feuilles-qn"
  | "tours-masters"
  | "tableau-consolante"
  | "tours-consolante"
  | "tableaux-finaux"
  | "feuilles-finales"
  | "primes";

export interface DocDef {
  id: DocId;
  label: string;
  /** Page large (A4 paysage). */
  landscape?: boolean;
  pages: (state: TournamentState) => number;
  available: (state: TournamentState) => boolean;
  render: (state: TournamentState) => ReactNode;
}

/* ---------- Briques ---------- */

/** Lignes par page des listes paginées (cases à cocher de 6 mm : lignes de 7,6 mm). */
export const ROWS = { pointage: 30, classement: 34, consolante: 30, poulesParPage: 6 } as const;

function Page({ children, fixed = true }: { children: ReactNode; fixed?: boolean }) {
  return (
    <section className={`print-page print-doc ${fixed ? "print-fixed" : ""}`}>{children}</section>
  );
}

/** Case à cocher au stylo (6 mm), éventuellement déjà cochée. */
function Box({ on = false }: { on?: boolean }) {
  return <span className={`p-box ${on ? "p-box-on" : ""}`} aria-hidden="true" />;
}

/** Numéro de page « 2/3 » (vide pour un document d'une page). */
function pageOf(i: number, n: number): string | undefined {
  return n > 1 ? `${i + 1}/${n}` : undefined;
}

function Foot({ children, page }: { children?: ReactNode; page?: string }) {
  return <PrintFoot {...(page ? { page } : {})}>{children}</PrintFoot>;
}

/* ---------- Documents ---------- */

function pouleOfMap(state: TournamentState, phase: "PREQ" | "QN" | "QM") {
  const map = new Map<string, Poule>();
  for (const p of state.poules[phase]) for (const n of p.players) map.set(n, p);
  return map;
}

const sortFr = (a: string, b: string) => a.localeCompare(b, "fr");

function Pointage({ state }: { state: TournamentState }) {
  const masters = new Set(state.masters);
  const pouleOf = pouleOfMap(state, "PREQ");
  const list = [...state.players].sort((a, b) => sortFr(a.name, b.name));
  const fee = state.rules.inscriptionFee;
  const juniors = list.filter((p) => p.junior).length;
  const pages = chunk(list, ROWS.pointage);
  const cells: BannerCell[] = [
    { label: "Droit", value: `${fee} €`, size: "md", sub: "U21 exemptés" },
    { label: "Joueurs", value: String(list.length) },
  ];
  return (
    <>
      {pages.map((rows, pi) => (
        <Page key={pi}>
          <DocBanner
            state={state}
            title="Pointage des droits d'inscription"
            date={longDate(dayDate(state, "vendredi"), true)}
            sub="Liste alphabétique · cocher à l'encaissement · Masters convoqués le samedi"
            cells={cells}
          />
          <table className="pt pt-tall mt-[3.5mm]">
            <thead>
              <tr>
                <th className="w-[9mm]">Payé</th>
                <th>Joueur</th>
                <th className="w-[20mm]">Licence</th>
                <th>Club</th>
                <th className="w-[24mm]">Poule · billard</th>
                <th className="w-[14mm] c">Droit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const m = masters.has(p.name);
                const po = pouleOf.get(p.name);
                return (
                  <tr key={p.licence} className={m ? "hl" : undefined}>
                    <td className="c">
                      <Box />
                    </td>
                    <td className="font-bold">
                      {nice(p.name)}
                      {m ? <span className="p-tag p-tag-gold">Masters · samedi</span> : null}
                      {p.junior ? <span className="p-tag p-tag-line">U21</span> : null}
                    </td>
                    <td className="num">{p.licence}</td>
                    <td className="muted">{clubShort(p.club)}</td>
                    <td className="num">
                      {m
                        ? "Masters"
                        : po
                          ? `P${po.num} · B${pouleBillards(state, "PREQ", po).join("/")}`
                          : "—"}
                    </td>
                    <td className="c num">{p.junior ? "exempté" : `${fee} €`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Foot page={pageOf(pi, pages.length)}>
            Fond doré : Masters préqualifiés, convoqués le samedi (ils règlent leur inscription le
            samedi). U21 : exemptés ({juniors} signalé{juniors > 1 ? "s" : ""}). Total attendu :{" "}
            {euros(fee * (list.length - juniors))}.
          </Foot>
        </Page>
      ))}
    </>
  );
}

function PremiersMatchs({ state }: { state: TournamentState }) {
  const d = phaseDistance(state, "PREQ");
  return (
    <Page>
      <DocBanner
        state={state}
        title="Premiers matchs par billard"
        date={longDate(dayDate(state, "vendredi"), true)}
        sub="Sur un billard partagé, la poule au numéro le plus élevé commence · match 1 : 2 contre 3"
        cells={[
          { label: "Distance", value: distanceLabel(d), size: "sm" },
          { label: "Billards", value: String(state.billards.length) },
        ]}
      />
      <table className="pt pt-tall mt-[3.5mm]">
        <thead>
          <tr>
            <th className="w-[16mm]">Billard</th>
            <th className="w-[16mm]">Poule</th>
            <th>Premier match</th>
            <th className="w-[34mm]">Arbitre</th>
            <th className="w-[30mm]">Puis</th>
          </tr>
        </thead>
        <tbody>
          {state.billards.map((b) => {
            const poules = state.poules.PREQ.filter((p) =>
              pouleBillards(state, "PREQ", p).includes(b.num),
            ).sort((x, y) => y.num - x.num);
            const first = poules[0];
            const om = first ? orderedMatches(first, d)[0] : undefined;
            return (
              <tr key={b.num}>
                <td>
                  <span className="num text-[13pt] font-bold">{b.num}</span>
                  <span className="muted ml-[1.5mm] text-[7.5pt]">{b.type}</span>
                </td>
                <td className="num font-bold">{first ? `P${first.num}` : "—"}</td>
                <td className="font-semibold">
                  {om ? (
                    <>
                      {nice(om.match.a)} <span className="muted">contre</span> {nice(om.match.b)}
                    </>
                  ) : (
                    <span className="muted">libre</span>
                  )}
                </td>
                <td>{om?.arbitre ? nice(om.arbitre) : ""}</td>
                <td className="muted">
                  {poules
                    .slice(1)
                    .map((p) => `Poule ${p.num}`)
                    .join(", ") || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Foot>Les joueurs de la poule qui ne jouent pas arbitrent et marquent.</Foot>
    </Page>
  );
}

function ClassementPreq({ state }: { state: TournamentState }) {
  const ranking = preqRanking(state);
  const size = state.rules.barrageSize;
  const natTo = size + state.rules.nationalSize - size / 2;
  const pages = chunk(ranking, ROWS.classement);
  return (
    <>
      {pages.map((rows, pi) => (
        <Page key={pi}>
          <DocBanner
            state={state}
            title="Classement des préqualifications"
            date={longDate(dayDate(state, "vendredi"), true)}
            sub={`Places 1 à ${size} : barrages · ${size + 1} à ${natTo} : National · au-delà : consolante sur volontariat`}
            cells={[
              { label: "Classés", value: String(ranking.length) },
              { label: "Barrages", value: String(size), sub: `places 1 à ${size}` },
            ]}
          />
          <table className="pt mt-[3.5mm]">
            <thead>
              <tr>
                <th className="w-[11mm] c">Place</th>
                <th>Joueur</th>
                <th className="w-[12mm] c">Poule</th>
                <th className="w-[11mm] c">Rang</th>
                <th className="w-[11mm] c">Pm</th>
                <th className="w-[11mm] c">Ps</th>
                <th className="w-[13mm] c">Faits</th>
                <th className="w-[13mm] c">Subis</th>
                <th className="w-[15mm] c">Moy.</th>
                <th className="w-[22mm]">Suite</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className={r.place <= size ? "hl-blue" : undefined}>
                  <td className="c num font-bold">{r.place}</td>
                  <td className="font-semibold">{nice(r.name)}</td>
                  <td className="c num">{r.poule}</td>
                  <td className="c num">{r.rang ?? "–"}</td>
                  <td className="c num font-bold">{r.ptm}</td>
                  <td className="c num">{r.pts}</td>
                  <td className="c num">{r.faits}</td>
                  <td className="c num">{r.subis}</td>
                  <td className="c num">{r.moy.toFixed(3)}</td>
                  <td className={r.place <= size ? "font-bold" : "muted"}>
                    {r.place <= size ? "Barrage" : r.place <= natTo ? "National" : "Consolante*"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Foot page={pageOf(pi, pages.length)}>
            Classement : rang dans la poule, points de match, points de set, moyenne, ordre
            d'arrivée. Poules de 3 : +2 Pm et +1 Ps. * Consolante sur volontariat.
          </Foot>
        </Page>
      ))}
    </>
  );
}

function ResultatsPoules({
  state,
  phase,
  title,
}: {
  state: TournamentState;
  phase: "PREQ" | "QN" | "QM";
  title: string;
}) {
  const d = phaseDistance(state, phase);
  const poules = state.poules[phase];
  const pages = chunk(poules, ROWS.poulesParPage);
  const day: Day = phase === "PREQ" ? "vendredi" : "samedi";
  return (
    <>
      {pages.map((rows, pi) => (
        <Page key={pi}>
          <DocBanner
            state={state}
            title={title}
            date={longDate(dayDate(state, day), true)}
            sub={`${phase === "PREQ" ? "Préqualifications" : phase === "QM" ? "Qualification Masters" : "Qualification National"} · classement de chaque poule, puis ses matchs dans l'ordre du code sportif`}
            cells={[
              { label: "Distance", value: distanceLabel(d), size: "sm" },
              { label: "Poules", value: String(poules.length) },
            ]}
          />
          <div className="mt-[3.5mm] grid grid-cols-2 gap-x-[6mm] gap-y-[4mm]">
            {rows.map((p) => {
              const r = pouleState(state, phase, p).rows;
              const bills = pouleBillards(state, phase, p);
              return (
                <div key={p.num}>
                  <table className="pt">
                    <thead>
                      <tr className="group">
                        <th colSpan={5}>
                          Poule {p.num}
                          <small>
                            Billard{bills.length > 1 ? "s" : ""} {bills.join(" & ")}
                          </small>
                        </th>
                      </tr>
                      <tr>
                        <th className="w-[7mm] c">Rg</th>
                        <th>Joueur</th>
                        <th className="w-[9mm] c">Pm</th>
                        <th className="w-[9mm] c">Ps</th>
                        <th className="w-[13mm] c">Moy.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.map((row) => (
                        <tr key={row.name}>
                          <td className="c num font-bold">{row.rang ?? "–"}</td>
                          <td className="font-semibold">{nice(row.name)}</td>
                          <td className="c num font-bold">{row.ptm}</td>
                          <td className="c num">{row.pts}</td>
                          <td className="c num">{row.moy.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <table className="pt pt-compact mt-[1.5mm] text-[8.6pt]">
                    <tbody>
                      {orderedMatches(p, d).map((om, i) => (
                        <tr key={om.match.id}>
                          <td className="num muted w-[8mm]">M{i + 1}</td>
                          <td>
                            <span className={winClass(om.match, d, om.match.a)}>
                              {shortName(om.match.a)}
                            </span>
                            <span className="muted"> – </span>
                            <span className={winClass(om.match, d, om.match.b)}>
                              {shortName(om.match.b)}
                            </span>
                          </td>
                          <td className="r w-[30mm]">
                            <Score m={om.match} d={d} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
          <Foot page={pageOf(pi, pages.length)}>
            Classement d'une poule : points de match, puis match direct (égalité à deux), points de
            set, moyenne, ordre d'arrivée.
          </Foot>
        </Page>
      ))}
    </>
  );
}

function TableauBarrages({ state }: { state: TournamentState }) {
  const ranking = preqRanking(state);
  const placeOf = new Map(ranking.map((r) => [r.name, r.place]));
  const d = state.rules.distances.barrage;
  return (
    <Page>
      <DocBanner
        state={state}
        title="Barrages"
        date={longDate(dayDate(state, "vendredi"), true)}
        sub="Places 1 à 16 des préqualifications : 1–16, 2–15… 8–9 · vainqueurs → Masters, perdants → National"
        cells={[
          { label: "Distance", value: distanceLabel(d), size: "sm" },
          { label: "Matchs", value: String(state.barrages.length) },
        ]}
      />
      <table className="pt pt-tall mt-[3.5mm]">
        <thead>
          <tr>
            <th className="w-[14mm]">Match</th>
            <th className="w-[18mm]">Billard</th>
            <th>Joueur A (place)</th>
            <th className="w-[24mm] c">Score</th>
            <th>Joueur B (place)</th>
            <th className="w-[36mm]">Vainqueur → Masters</th>
          </tr>
        </thead>
        <tbody>
          {state.barrages.map((m) => {
            const w = matchWinner(m, d);
            return (
              <tr key={m.id}>
                <td className="num font-bold">{m.id}</td>
                <td>
                  <span className="num text-[12pt] font-bold">{m.billard ?? "—"}</span>
                  <span className="muted ml-[1.5mm] text-[7.5pt]">
                    {m.billard ? billardType(state, m.billard) : ""}
                  </span>
                </td>
                <td className={winClass(m, d, m.a)}>
                  {nice(m.a)} <span className="muted num">({placeOf.get(m.a) ?? "–"})</span>
                </td>
                <td className="c">
                  <Score m={m} d={d} />
                </td>
                <td className={winClass(m, d, m.b)}>
                  {nice(m.b)} <span className="muted num">({placeOf.get(m.b) ?? "–"})</span>
                </td>
                <td className="font-extrabold">{w ? nice(w) : <span className="p-sign" />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Foot>Les perdants rejoignent le National avec les places 17 à 40.</Foot>
    </Page>
  );
}

function PointageConsolante({ state }: { state: TournamentState }) {
  const q = qualifiers(state);
  const ranking = preqRanking(state);
  const placeOf = new Map(ranking.map((r) => [r.name, r.place]));
  const pages = chunk(q.consolante, ROWS.consolante);
  return (
    <>
      {pages.map((rows, pi) => (
        <Page key={pi}>
          <DocBanner
            state={state}
            title="Consolante · volontaires"
            date={longDate(dayDate(state, "samedi"), true)}
            sub={`${distanceLabel(state.rules.distances.cls)} · maximum ${state.rules.consolanteMax} joueurs · tableau à élimination directe dans l'ordre du classement`}
            cells={[{ label: "Éligibles", value: String(q.consolante.length) }]}
          />
          <table className="pt pt-tall mt-[3.5mm]">
            <thead>
              <tr>
                <th className="w-[12mm]">Joue</th>
                <th className="w-[14mm] c">Place</th>
                <th>Joueur</th>
                <th className="w-[50mm]">Paraphe</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n}>
                  <td className="c">
                    <Box />
                  </td>
                  <td className="c num font-bold">{placeOf.get(n) ?? "–"}</td>
                  <td className="font-semibold">{nice(n)}</td>
                  <td>
                    <span className="p-sign" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Foot page={pageOf(pi, pages.length)}>
            Places 41 et suivantes des préqualifications, sur volontariat.
          </Foot>
        </Page>
      ))}
    </>
  );
}

/**
 * Tours de jeu Masters (livret) : liste ordonnée des matchs. Avec 3 billards 3m10, les poules
 * 1 à 3 commencent et le premier billard libéré prend le match suivant de la liste.
 */
function ToursMasters({ state }: { state: TournamentState }) {
  const d = phaseDistance(state, "QM");
  const rot = mastersRotationOf(state);
  const n = Math.max(1, Math.min(rot.billards.length, state.poules.QM.length));
  return (
    <Page>
      <DocBanner
        state={state}
        title="Tours de jeu · Masters"
        date={longDate(dayDate(state, "samedi"), true)}
        sub={
          rot.needed
            ? `Rotation : les poules 1 à ${n} commencent, le premier billard libéré prend le match suivant`
            : "Chaque poule enchaîne ses matchs sur son billard"
        }
        cells={[
          { label: "Distance", value: distanceLabel(d), size: "sm" },
          { label: "3m10", value: String(rot.billards.length), sub: "billards" },
        ]}
      />
      <table className="pt pt-tall mt-[3.5mm]">
        <thead>
          <tr>
            <th className="w-[14mm]">Heure</th>
            <th className="w-[8mm] c">#</th>
            <th className="w-[9mm] c">Joué</th>
            <th className="w-[13mm] c">Billard</th>
            <th className="w-[11mm] c">Poule</th>
            <th className="w-[11mm] c">Match</th>
            <th>Joueur 1</th>
            <th>Joueur 2</th>
            <th className="w-[30mm]">Arbitre</th>
          </tr>
        </thead>
        <tbody>
          {rot.rows.map((r) => (
            <tr
              key={r.order}
              className={r.order > 1 && (r.order - 1) % n === 0 ? "rule-top" : undefined}
            >
              <td>
                <span className="p-sign" />
              </td>
              <td className="c num font-bold">{r.order}</td>
              <td className="c">
                <Box on={r.played} />
              </td>
              <td className="c num text-[12pt] font-bold">{r.billard ?? ""}</td>
              <td className="c num font-bold">{r.poule}</td>
              <td className="c num">M{r.match}</td>
              <td className={r.aIsName ? "font-semibold" : "muted text-[8pt] italic"}>
                {r.aIsName ? nice(r.a) : r.a}
              </td>
              <td className={r.bIsName ? "font-semibold" : "muted text-[8pt] italic"}>
                {r.bIsName ? nice(r.b) : r.b}
              </td>
              <td className="text-[8.5pt] italic">{r.arbitre ? nice(r.arbitre) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Foot>
        {rot.needed
          ? "Noter le billard et l'heure, cocher « Joué » à la fin du match. "
          : "Cocher « Joué » à la fin de chaque match. "}
        Les deux joueurs qui ne jouent pas arbitrent et marquent ; les joueurs des matchs 3 à 6
        dépendent des résultats des deux premiers.
      </Foot>
    </Page>
  );
}

/**
 * Tours de jeu de la consolante (onglet « TDJ CLS » de l'outil Excel) : tour par tour, la liste
 * des matchs dans l'ordre du tableau. Même présentation que les tours de jeu Masters : heure à
 * noter, case « Joué », joueurs connus ou « Vainqueur B1 ». La colonne « Billard » est vide : il
 * se note à la main sur place (pas de billard indiqué pour la consolante).
 */
function ToursConsolante({ state }: { state: TournamentState }) {
  const rounds = consolanteRounds(state);
  const pages = consolantePages(rounds);
  const total = rounds.tours.reduce((n, t) => n + t.rows.length, 0);
  return (
    <>
      {pages.map((tours, pi) => (
        <Page key={tours.map((t) => t.round).join("-")}>
          <DocBanner
            state={state}
            title="Tours de jeu · Consolante"
            date={longDate(dayDate(state, "samedi"), true)}
            sub="Élimination directe · matchs dans l'ordre du tableau"
            cells={[{ label: "Matchs", value: String(total) }]}
          />
          <table className="pt pt-tall mt-[3.5mm]">
            <thead>
              <tr>
                <th className="w-[14mm]">Heure</th>
                <th className="w-[8mm] c">#</th>
                <th className="w-[9mm] c">Joué</th>
                <th className="w-[15mm] c">Billard</th>
                <th className="w-[11mm] c">Match</th>
                <th>Joueur 1</th>
                <th>Joueur 2</th>
                <th className="w-[24mm] c">Score</th>
              </tr>
            </thead>
            {tours.map((t) => (
              <tbody key={t.round}>
                <tr className="group">
                  <th colSpan={8}>
                    {t.label}
                    <small>
                      {distanceLabel(t.distance)} · {t.rows.length} match
                      {t.rows.length > 1 ? "s" : ""}
                    </small>
                  </th>
                </tr>
                {t.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="p-sign" />
                    </td>
                    <td className="c num font-bold">{r.order}</td>
                    <td className="c">
                      <Box on={r.played} />
                    </td>
                    {/* Billard : à remplir à la main */}
                    <td className="c">
                      <span className="p-sign" />
                    </td>
                    <td className="c num font-bold">{r.code}</td>
                    <td
                      className={
                        r.aKnown ? winClass(r.match, t.distance, r.a) : "muted text-[8pt] italic"
                      }
                    >
                      {r.aKnown ? nice(r.a) : r.a}
                    </td>
                    <td
                      className={
                        r.bKnown ? winClass(r.match, t.distance, r.b) : "muted text-[8pt] italic"
                      }
                    >
                      {r.bKnown ? nice(r.b) : r.b}
                    </td>
                    <td className="c">
                      <Score m={r.match} d={t.distance} />
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
          <Foot page={pageOf(pi, pages.length)}>
            Noter l'heure et le billard, cocher « Joué » et reporter le score à la fin du match. Un
            joueur en attente est désigné par le match qui le qualifie.
          </Foot>
        </Page>
      ))}
    </>
  );
}

const BRACKET_ROUNDS: BracketRound[] = ["R64", "R32", "R16", "QF", "SF", "F"];

/** Tours d'un tableau répartis en pages A4 (≈ 32 lignes de 6,5 mm par page, en-têtes compris). */
export function bracketPages(state: TournamentState, phase: "N" | "M" | "CLS"): BracketRound[][] {
  const b = state.brackets[phase];
  const pages: BracketRound[][] = [];
  let current: BracketRound[] = [];
  let used = 0;
  for (const r of BRACKET_ROUNDS) {
    const rows = b.filter((m) => m.round === r).length;
    if (rows === 0) continue;
    const cost = rows + 1.6;
    if (current.length && used + cost > 32) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(r);
    used += cost;
  }
  if (current.length) pages.push(current);
  return pages;
}

function BracketTable({
  state,
  phase,
  title,
}: {
  state: TournamentState;
  phase: "N" | "M" | "CLS";
  title: string;
}) {
  const b = state.brackets[phase];
  // Noms des tours et codes des matchs : les mêmes qu'à l'écran (B = barrages, S, H, Q, D, F)
  const naming = bracketNaming(b);
  // Tous les tours présents, premier tour compris (barrages et seizièmes de la consolante)
  const pages = bracketPages(state, phase);
  const played = b.filter((m) => matchWinner(m, phaseDistance(state, phase, m.round))).length;
  return (
    <>
      {pages.map((rounds, k) => (
        <Page key={rounds.join("-")}>
          <DocBanner
            state={state}
            title={title}
            date={longDate(dayDate(state, phase === "CLS" ? "samedi" : "dimanche"), true)}
            sub="Élimination directe · le vainqueur de chaque match passe au tour suivant"
            cells={[
              { label: "Matchs", value: String(b.length) },
              { label: "Joués", value: String(played) },
            ]}
          />
          <table className="pt mt-[3.5mm]">
            {rounds.map((r) => {
              const d = phaseDistance(state, phase, r);
              return (
                <tbody key={r}>
                  <tr className="group">
                    <th colSpan={5}>
                      {naming.round(r)}
                      <small>{distanceLabel(d)}</small>
                    </th>
                  </tr>
                  {b
                    .filter((m) => m.round === r)
                    .map((m) => (
                      <tr key={m.id}>
                        <td className="num w-[12mm] font-bold">{naming.code(m)}</td>
                        {/* Billard : jamais pour la consolante (et « B » y désigne un barrage) */}
                        <td className="num muted w-[14mm] c">
                          {m.billard && phase !== "CLS" ? `B${m.billard}` : ""}
                        </td>
                        <td className={m.a ? winClass(m, d, m.a) : "muted"}>
                          {m.a ? nice(m.a) : naming.waiting(m.labelA)}
                        </td>
                        <td className="w-[34mm] c">
                          <Score m={m} d={d} />
                        </td>
                        <td className={m.b ? winClass(m, d, m.b) : "muted"}>
                          {m.b ? nice(m.b) : naming.waiting(m.labelB)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              );
            })}
          </table>
          <Foot page={pageOf(k, pages.length)}>
            Score : gagnant en gras, perdant en maigre. Les joueurs en attente sont désignés par le
            match qui les qualifie.
          </Foot>
        </Page>
      ))}
    </>
  );
}

function Primes({ state }: { state: TournamentState }) {
  const p = progressivePrimes(state);
  const money = (n: number) =>
    `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const block = (phase: "M" | "N", title: string) => {
    const lines = p.lines.filter((l) => l.phase === phase);
    const total = lines.reduce((t, l) => t + l.amount, 0);
    return (
      <tbody>
        <tr className="group">
          <th colSpan={6}>
            {title}
            <small>{money(total)}</small>
          </th>
        </tr>
        {lines.map((l) => (
          <tr key={l.key}>
            <td className="nowrap">
              <b>{l.label}</b> <span className="muted text-[8pt]">{l.detail}</span>
            </td>
            <td className="font-semibold">{l.name ? nice(l.name) : <span className="p-sign" />}</td>
            <td className="r num font-bold">{money(l.amount)}</td>
            <td>
              <span className="p-sign" />
            </td>
            <td className="c">
              <Box />
            </td>
            <td>
              <span className="p-sign" />
            </td>
          </tr>
        ))}
      </tbody>
    );
  };
  return (
    <Page>
      <DocBanner
        state={state}
        title="Primes · préparation des chèques"
        date={dateRange(dayDate(state, "samedi"), dayDate(state, "dimanche"))}
        sub={`Cagnotte : ${state.rules.inscriptionFee} € × ${p.players - p.juniors} joueurs non juniors + ${euros(p.ffb)} FFB + ${euros(p.club)} club · Masters 80 %, National 20 %`}
        cells={[{ label: "Cagnotte", value: money(p.total), size: "md" }]}
      />
      <table className="pt mt-[3.5mm]">
        <thead>
          <tr>
            <th className="w-[46mm]">Palier</th>
            <th>Bénéficiaire</th>
            <th className="w-[22mm] r">Montant</th>
            <th className="w-[24mm]">Chèque n°</th>
            <th className="w-[12mm] c">Remis</th>
            <th className="w-[34mm]">Signature</th>
          </tr>
        </thead>
        {block("M", "Masters")}
        {block("N", "National")}
      </table>
      <Foot>
        Samedi : 3e et 4e des poules Masters, payables dès la fin de leur poule. Dimanche : après
        chaque tour. Les bénéficiaires encore inconnus à l'impression se complètent à la main.
      </Foot>
    </Page>
  );
}

/* ---------- Registre ---------- */

const drawn = (s: TournamentState) => s.poules.PREQ.length > 0;
const preqClosed = (s: TournamentState) => Boolean(s.closed.PREQ);
const satReady = (s: TournamentState) => s.poules.QM.length > 0 || s.poules.QN.length > 0;

export const DOCS: DocDef[] = [
  {
    id: "schema",
    label: "Schéma du TN (A4 paysage)",
    landscape: true,
    pages: () => 1,
    available: (s) => s.players.length > 0,
    render: (s) => (
      <section className="print-page print-doc print-fixed print-landscape">
        <DocBanner
          state={s}
          title="Schéma du tournoi"
          date={`${longDate(dayDate(s, "jeudi"), true)} → ${longDate(dayDate(s, "dimanche"), true)}`}
          sub="Du tirage du jeudi aux finales du dimanche : chaque ruban est un groupe de joueurs"
          cells={[{ label: "Inscrits", value: String(s.players.length) }]}
        />
        <div className="mt-[3mm] min-h-0 flex-1">
          <FlowDiagram print />
        </div>
        <Foot>
          La largeur d'un ruban est proportionnelle au nombre de joueurs. Or : Masters · vert :
          National · bleu : qualifications du vendredi · gris : consolante. Étapes à venir en
          pointillé.
        </Foot>
      </section>
    ),
  },
  {
    id: "pointage",
    label: "Liste alphabétique · pointage des droits d'inscription",
    pages: (s) => chunk(s.players, ROWS.pointage).length,
    available: (s) => s.players.length > 0,
    render: (s) => <Pointage state={s} />,
  },
  {
    id: "joueurs-poules",
    label: "Liste des joueurs par poule et billard",
    pages: (s) => Math.max(1, Math.ceil(s.players.length / 120)),
    available: drawn,
    render: (s) => <PlayersBoard state={s} />,
  },
  {
    id: "tableau-poules",
    label: "Tableau des poules du vendredi (affichage)",
    pages: () => 1,
    available: drawn,
    render: (s) => <PoulesBoard state={s} phase="PREQ" title="Poules du vendredi" day="vendredi" />,
  },
  {
    id: "premiers-matchs",
    label: "Premiers matchs par billard",
    pages: () => 1,
    available: drawn,
    render: (s) => <PremiersMatchs state={s} />,
  },
  {
    id: "feuilles-preq",
    label: "Feuilles de match des poules (A4 paysage, 2 par page)",
    landscape: true,
    pages: (s) => pouleSheetPages(s, "PREQ", "vendredi").length,
    available: drawn,
    render: (s) => <SheetPages pages={pouleSheetPages(s, "PREQ", "vendredi")} />,
  },
  {
    id: "classement-preq",
    label: "Classement des préqualifications",
    pages: (s) => chunk(preqRanking(s), ROWS.classement).length,
    available: preqClosed,
    render: (s) => <ClassementPreq state={s} />,
  },
  {
    id: "resultats-poules",
    label: "Résultats des poules",
    pages: (s) => chunk(s.poules.PREQ, ROWS.poulesParPage).length,
    available: preqClosed,
    render: (s) => <ResultatsPoules state={s} phase="PREQ" title="Résultats des poules" />,
  },
  {
    id: "tableau-barrages",
    label: "Tableau des barrages",
    pages: () => 1,
    available: preqClosed,
    render: (s) => <TableauBarrages state={s} />,
  },
  {
    id: "feuilles-barrages",
    label: "Feuilles de match des barrages (2 par page)",
    landscape: true,
    pages: (s) => pairPages(singleHalves(s, barrageSheets(s))).length,
    available: preqClosed,
    render: (s) => <SheetPages pages={pairPages(singleHalves(s, barrageSheets(s)))} />,
  },
  {
    id: "pointage-consolante",
    label: "Pointage des volontaires consolante",
    pages: (s) => chunk(qualifiers(s).consolante, ROWS.consolante).length,
    available: preqClosed,
    render: (s) => <PointageConsolante state={s} />,
  },
  {
    id: "poules-samedi",
    label: "Poules Masters et National du samedi (affichage)",
    pages: () => 2,
    available: satReady,
    render: (s) => (
      <>
        <PoulesBoard state={s} phase="QM" title="Poules Masters" day="samedi" />
        <PoulesBoard state={s} phase="QN" title="Poules National" day="samedi" />
      </>
    ),
  },
  {
    id: "feuilles-qm",
    label: "Feuilles de match Masters (2 par page)",
    landscape: true,
    pages: (s) => pouleSheetPages(s, "QM", "samedi").length,
    available: satReady,
    render: (s) => <SheetPages pages={pouleSheetPages(s, "QM", "samedi")} />,
  },
  {
    id: "feuilles-qn",
    label: "Feuilles de match National (2 par page)",
    landscape: true,
    pages: (s) => pouleSheetPages(s, "QN", "samedi").length,
    available: satReady,
    render: (s) => <SheetPages pages={pouleSheetPages(s, "QN", "samedi")} />,
  },
  {
    id: "tours-masters",
    label: "Tours de jeu Masters",
    pages: () => 1,
    available: (s) => s.poules.QM.length > 0,
    render: (s) => <ToursMasters state={s} />,
  },
  {
    id: "tableau-consolante",
    label: "Tableau de la consolante",
    pages: (s) => bracketPages(s, "CLS").length,
    available: (s) => s.brackets.CLS.length > 0,
    render: (s) => <BracketTable state={s} phase="CLS" title="Consolante" />,
  },
  {
    id: "tours-consolante",
    label: "Tours de jeu de la consolante",
    pages: (s) => Math.max(1, consolantePages(consolanteRounds(s)).length),
    // Disponible dès que la consolante est créée (vendredi soir)
    available: (s) => s.brackets.CLS.length > 0,
    render: (s) => <ToursConsolante state={s} />,
  },
  {
    id: "tableaux-finaux",
    label: "Tableaux National et Masters",
    pages: (s) => bracketPages(s, "M").length + bracketPages(s, "N").length,
    available: (s) => s.brackets.N.length > 0 || s.brackets.M.length > 0,
    render: (s) => (
      <>
        {s.brackets.M.length > 0 ? (
          <BracketTable state={s} phase="M" title="Tableau final · Masters" />
        ) : null}
        {s.brackets.N.length > 0 ? (
          <BracketTable state={s} phase="N" title="Tableau final · National" />
        ) : null}
      </>
    ),
  },
  {
    id: "feuilles-finales",
    label: "Feuilles de match des quarts, demies et finales (2 par page)",
    landscape: true,
    pages: (s) => pairPages(singleHalves(s, finalSheets(s))).length,
    available: (s) => s.brackets.N.length > 0 || s.brackets.M.length > 0,
    render: (s) => <SheetPages pages={pairPages(singleHalves(s, finalSheets(s)))} />,
  },
  {
    id: "primes",
    label: "Tableau des primes (préparation des chèques)",
    pages: () => 1,
    available: (s) => s.players.length > 0 && Boolean(s.closed.B),
    render: (s) => <Primes state={s} />,
  },
];

export function docById(id: string): DocDef | undefined {
  return DOCS.find((d) => d.id === id);
}

/** Documents proposés pour une journée (et un moment de la journée). */
export function docsFor(day: Day, state: TournamentState): DocDef[] {
  const ids: DocId[] =
    day === "jeudi"
      ? ["pointage", "joueurs-poules", "tableau-poules", "premiers-matchs", "feuilles-preq"]
      : day === "vendredi"
        ? state.closed.B
          ? [
              "classement-preq",
              "resultats-poules",
              "tableau-barrages",
              "pointage-consolante",
              // Proposés dès que la consolante est créée (fin du vendredi)
              "tableau-consolante",
              "tours-consolante",
              "poules-samedi",
              "feuilles-qm",
              "feuilles-qn",
              "tours-masters",
            ]
          : state.closed.PREQ
            ? [
                "classement-preq",
                "resultats-poules",
                "tableau-barrages",
                "feuilles-barrages",
                "pointage-consolante",
              ]
            : ["feuilles-preq", "premiers-matchs", "tableau-poules", "pointage"]
        : day === "samedi"
          ? [
              "poules-samedi",
              "feuilles-qm",
              "feuilles-qn",
              "tours-masters",
              "tableau-consolante",
              "tours-consolante",
              "tableaux-finaux",
              "primes",
            ]
          : ["tableaux-finaux", "feuilles-finales", "primes"];
  ids.push("schema");
  return ids.map(docById).filter((d): d is DocDef => Boolean(d) && d!.available(state));
}

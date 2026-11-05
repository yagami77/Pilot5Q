/** Classement glissant : tableau avec les 5 TN de la fenêtre, évolution, export CSV, impression. */
import {
  latestStage,
  rankingCsv,
  rankingRows,
  windowStages,
  type RankingEntry,
  type RankingRow,
} from "@pilot5q/domain";
import { Download, FileDown, Printer, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { Avatar, Button, Card, Chip, PageHead, Tile, cx } from "@/components/ui";
import { clubShort, nice } from "@/lib/format";

import { SEASON_FIXTURE } from "./demo";
import { useSeasonDoc } from "./store";
import { Empty, Num, Row, Table, dec, downloadText } from "./ui";

const MAX_TN_POINTS = 80;

/** Barres miniatures des points par TN de la fenêtre. */
export function MiniBars({
  row,
  stages,
}: {
  row: RankingRow;
  stages: { season: string; tn: number }[];
}) {
  const values = stages.map(
    (s) => row.results.find((r) => r.season === s.season && r.tn === s.tn)?.pts ?? null,
  );
  const dropped =
    row.count >= 5
      ? values.indexOf(Math.min(...values.filter((v): v is number => v !== null)))
      : -1;
  return (
    <span
      className="flex h-6 items-end gap-[3px]"
      aria-label={values.map((v) => (v === null ? "–" : dec(v, 2))).join(", ")}
    >
      {values.map((v, i) => (
        <span
          key={i}
          className={cx(
            "w-[7px] rounded-t-[2px] transition-[height] duration-500",
            v === null ? "bg-line-2 h-[3px]" : i === dropped ? "bg-gold/70" : "bg-brand",
          )}
          style={
            v === null
              ? undefined
              : {
                  height: `${Math.max(3, Math.round((Math.min(v, MAX_TN_POINTS) / MAX_TN_POINTS) * 24))}px`,
                }
          }
          title={
            v === null
              ? "Non joué"
              : `${dec(v, 3)}${i === dropped ? " (retiré : 4 meilleurs sur 5)" : ""}`
          }
        />
      ))}
    </span>
  );
}

/** Positions d'une fenêtre précédente, par licence puis nom. */
function previousPositions(entries: RankingEntry[] | undefined): Map<string, number> {
  const out = new Map<string, number>();
  if (!entries) return out;
  for (const r of rankingRows(entries)) {
    out.set(r.licence || r.name, r.position);
  }
  return out;
}

/** Comparaison du classement courant avec le classement « après TN 2 » du classeur de référence. */
export interface ReferenceComparison {
  /** Joueurs classés des deux côtés. */
  common: number;
  expected: number;
  received: number;
  /** Même total au centième près (barème identique, décimale au plus 1/100 d'écart). */
  sameBarème: number;
  /** Total identique (barème et décimale). */
  identical: number;
  /** Même position. */
  samePosition: number;
  /** Joueurs dont seule la décimale diffère. */
  decimalOnly: { name: string; got: number; expected: number }[];
}

export function compareWithReference(rows: RankingRow[]): ReferenceComparison {
  const exp = SEASON_FIXTURE.expectedAfter;
  const byName = new Map(exp.map((e) => [e.name, e]));
  let common = 0;
  let sameBareme = 0;
  let identical = 0;
  let samePosition = 0;
  const decimalOnly: ReferenceComparison["decimalOnly"] = [];
  for (const r of rows) {
    const e = byName.get(r.name);
    if (!e) continue;
    common++;
    if (e.position === r.position) samePosition++;
    if (Math.abs(e.pts - r.pts) < 1e-9) identical++;
    else if (Math.floor(e.pts + 1e-9) === Math.floor(r.pts + 1e-9)) {
      sameBareme++;
      decimalOnly.push({ name: r.name, got: r.pts, expected: e.pts });
    }
  }
  return {
    common,
    expected: exp.length,
    received: rows.length,
    sameBarème: sameBareme + identical,
    identical,
    samePosition,
    decimalOnly,
  };
}

/** Le classement courant est-il exactement celui du classeur de référence ? */
export function matchesReference(rows: RankingRow[]): boolean {
  const c = compareWithReference(rows);
  return c.identical === c.expected && c.received === c.expected && c.samePosition === c.expected;
}

/** Le classement courant correspond-il au classement « après TN 2 » (même joueurs, même barème) ? */
export function isAfterReference(rows: RankingRow[]): boolean {
  const c = compareWithReference(rows);
  return c.common === c.expected && c.received === c.expected && c.sameBarème === c.expected;
}

export function Ranking() {
  const doc = useSeasonDoc();
  const [query, setQuery] = useState("");
  const rows = useMemo(() => rankingRows(doc.ranking), [doc.ranking]);
  const last = latestStage(doc.ranking);
  const stages = last ? windowStages(last.season, last.tn) : [];
  const lastClosure = useMemo(() => {
    const list = Object.values(doc.closures).sort((a, b) => a.closedAt.localeCompare(b.closedAt));
    return list[list.length - 1];
  }, [doc.closures]);
  const previous = useMemo(() => previousPositions(lastClosure?.rankingBefore), [lastClosure]);
  const reference = useMemo(() => compareWithReference(rows), [rows]);
  const afterReference =
    reference.common === reference.expected &&
    reference.received === reference.expected &&
    reference.sameBarème === reference.expected;
  const q = query.trim().toLowerCase();
  const visible =
    q === ""
      ? rows
      : rows.filter((r) => `${r.name} ${r.club} ${r.licence}`.toLowerCase().includes(q));
  const title = last
    ? `Classement glissant après le TN ${last.tn} ${last.season}`
    : "Classement glissant";
  return (
    <>
      <PageHead
        eyebrow={`Saison ${doc.id}`}
        title={title}
        help="Somme des points des 5 derniers TN (barème + décimale de départage) ; un joueur ayant joué les 5 TN compte ses 4 meilleurs résultats. Départage par la moyenne (points faits / points subis)."
      >
        <Button
          icon={Download}
          onClick={() =>
            downloadText(`classement-glissant-${doc.id}.csv`, rankingCsv(rows, stages))
          }
          disabled={rows.length === 0}
        >
          Export CSV
        </Button>
        <Link to="/responsable/imprimer/classement?pdf=1">
          <Button icon={FileDown} disabled={rows.length === 0}>
            Télécharger en PDF
          </Button>
        </Link>
        <Link to="/responsable/imprimer/classement">
          <Button variant="primary" icon={Printer} disabled={rows.length === 0}>
            Vue imprimable A4
          </Button>
        </Link>
      </PageHead>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Classés" value={rows.length} tone="blue" />
        <Tile
          label="5 TN joués"
          value={rows.filter((r) => r.count === 5).length}
          detail="4 meilleurs résultats"
        />
        <Tile
          label="Fenêtre"
          value={stages.length ? `TN${stages[0]?.tn}→TN${stages[stages.length - 1]?.tn}` : "–"}
          detail={
            stages.length ? `${stages[0]?.season} → ${stages[stages.length - 1]?.season}` : ""
          }
        />
        <Tile
          label="Tête"
          value={rows[0] ? nice(rows[0].name).split(" ")[0] : "–"}
          tone="gold"
          detail={rows[0] ? `${dec(rows[0].pts, 3)} pts` : ""}
        />
      </div>
      {afterReference ? <ReferenceBanner c={reference} /> : null}
      {!lastClosure && doc.id === SEASON_FIXTURE.season && last?.tn === 1 ? (
        <div className="bg-brand-soft text-brand-ink mb-4 rounded-[12px] px-4 py-3 text-[12.5px]">
          Démonstration : fenêtre reconstituée à partir du classeur de référence (TN 3 à 5 2025-2026
          et TN 1 2026-2027). Le TN 2 2025-2026, sorti de la fenêtre au TN 2 2026-2027, n'y figure
          pas : l'ordre peut différer du classement officiel publié avant le TN 2, dont les places
          servent à la liste ordonnée. Clôturez le TN 2 pour obtenir le classement « après TN 2 » du
          classeur.
        </div>
      ) : null}
      <Card
        title={`${visible.length} joueurs`}
        aside={
          <input
            className="field w-[240px]"
            placeholder="Rechercher…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Rechercher dans le classement"
          />
        }
        bodyClassName="p-3 pt-0"
      >
        {rows.length === 0 ? (
          <Empty icon={Trophy}>
            Aucun TN dans la fenêtre : le classement apparaîtra après la première clôture.
          </Empty>
        ) : (
          <Table
            head={[
              "Pos.",
              "Évol.",
              "Joueur",
              "Club",
              "Points",
              "Moy.",
              "Nb",
              ...stages.map((s) => `TN${s.tn} ${s.season.slice(2, 4)}-${s.season.slice(7, 9)}`),
              "Fenêtre",
            ]}
            dense
          >
            {visible.map((r) => {
              const prev = previous.get(r.licence || r.name);
              const delta = prev === undefined ? null : prev - r.position;
              return (
                <Row key={r.licence || r.name}>
                  <td>
                    <Num className={cx("font-bold", r.position <= 8 && "text-gold-ink")}>
                      {r.position}
                    </Num>
                  </td>
                  <td>
                    {delta === null ? (
                      lastClosure ? (
                        <Chip tone="blue">nouveau</Chip>
                      ) : null
                    ) : delta === 0 ? (
                      <span className="text-ink-muted">=</span>
                    ) : (
                      <Num
                        className={
                          delta > 0 ? "text-ok-ink font-semibold" : "text-alert-ink font-semibold"
                        }
                      >
                        {delta > 0 ? `▲ ${delta}` : `▼ ${-delta}`}
                      </Num>
                    )}
                  </td>
                  <td>
                    <span className="flex items-center gap-2">
                      <Avatar name={r.name} size="xs" crown={r.position <= 8} />
                      <span className="font-semibold">{nice(r.name)}</span>
                    </span>
                  </td>
                  <td className="text-ink-muted">{clubShort(r.club)}</td>
                  <td>
                    <Num className="font-bold">{dec(r.pts, 3)}</Num>
                  </td>
                  <td>
                    <Num>{dec(r.moy, 3)}</Num>
                  </td>
                  <td>
                    <Num>{r.count}</Num>
                  </td>
                  {stages.map((s) => {
                    const res = r.results.find((x) => x.season === s.season && x.tn === s.tn);
                    return (
                      <td key={`${s.season}-${s.tn}`}>
                        {res ? (
                          <Num>{dec(res.pts, 2)}</Num>
                        ) : (
                          <span className="text-ink-muted">–</span>
                        )}
                      </td>
                    );
                  })}
                  <td>
                    <MiniBars row={r} stages={stages} />
                  </td>
                </Row>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}

/** Bandeau de preuve : comparaison avec le classeur de référence. */
function ReferenceBanner({ c }: { c: ReferenceComparison }) {
  const exact = c.identical === c.expected && c.samePosition === c.expected;
  const title = SEASON_FIXTURE.expectedAfterTitle.replace("CLASSEMENT GLISSANT 5 QUILLES ", "");
  return (
    <div className="bg-ok-soft text-ok-ink animate-pop mb-4 rounded-[12px] px-4 py-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2 font-semibold">
        <Trophy className="size-4" aria-hidden="true" />
        {exact
          ? `Identique au classement « ${title} » du classeur de référence : ${c.expected} joueurs, mêmes points, même ordre.`
          : `Conforme au classement « ${title} » du classeur de référence : ${c.expected} joueurs, points du barème identiques pour tous, ${c.identical} totaux identiques à la décimale près, ${c.samePosition} positions identiques.`}
      </div>
      {!exact && c.decimalOnly.length > 0 ? (
        <p className="mt-1 text-[12.5px]">
          {c.decimalOnly.length} décimales diffèrent légèrement (joueurs du National) : l'outil
          Excel compte 4 à 6 matchs au lieu de 3 dans les poules National 2 à 8, ce qui fausse sa
          décimale « points de set / matchs / 100 ». Pilot5Q compte les matchs réellement joués ;
          les positions ne changent qu'entre joueurs à égalité de points du barème.
        </p>
      ) : null}
    </div>
  );
}

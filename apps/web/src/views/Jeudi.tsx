/** Jeudi : structure des billards, tirages, création des poules du vendredi, documents. */
import type { Billard, Poule } from "@pilot5q/domain";
import {
  ArrowRight,
  Check,
  Pencil,
  Play,
  Plus,
  Printer,
  Shuffle,
  Trash2,
  TriangleAlert,
  Trophy,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { PouleCard } from "@/components/PouleCard";
import { Serpentin } from "@/components/Serpentin";
import { PrintCenter } from "@/components/PrintCenter";
import { useToast } from "@/components/Toast";
import { Avatar, Banner, Button, Card, Chip, PageHead, Select, Tile, cx } from "@/components/ui";
import { drawPreqBillards } from "@/lib/draw";
import { pouleMatches, pouleSizes, resolveClubConflicts, serpentin } from "@/lib/engine";
import { clubShort, longDate, nice, plural } from "@/lib/format";
import { drawLaterPhaseEvents, preqPouleCount } from "@/lib/setup";
import {
  bigTables,
  clubOf,
  dayDate,
  distanceLabel,
  phaseDistance,
  pouleBillards,
  smallTables,
} from "@/lib/tournament";
import { useTournament } from "@/store/tournament";

export function Jeudi() {
  const { state, dispatch, dispatchMany, amendBillards } = useTournament();
  const toast = useToast();
  const navigate = useNavigate();
  const [printOpen, setPrintOpen] = useState(false);
  const [drawSeq, setDrawSeq] = useState(0);
  const [serpDone, setSerpDone] = useState(true);
  const [swapMode, setSwapMode] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [unresolved, setUnresolved] = useState<number[]>([]);

  const drawn = state.poules.PREQ.length > 0;
  const locked =
    Boolean(state.closed.PREQ) ||
    state.poules.PREQ.some((p) => p.matches.some((m) => m.sa !== null));
  const players = state.players;
  const juniors = players.filter((p) => p.junior).length;
  const masters = players.slice(0, state.rules.mastersPrequalified);
  const field = players.slice(state.rules.mastersPrequalified).map((p) => p.name);
  const sizes = pouleSizes(field.length, state.rules.maxPoulesOf3);
  const nb4 = sizes.filter((s) => s === 4).length;
  const nb3 = sizes.length - nb4;
  const pouleCount = preqPouleCount(state);
  const preqAssign = state.billardAssignments.PREQ ?? {};
  const d = phaseDistance(state, "PREQ");
  const capacity = state.billards.length * 8 + 8;

  const draw = () => {
    const raw = serpentin(field, state.rules.maxPoulesOf3);
    const res = resolveClubConflicts(raw, clubOf(state));
    const poules: Poule[] = res.poules.map((names, i) => ({
      num: i + 1,
      players: names,
      billards: preqAssign[String(i + 1)] ?? [],
      matches: pouleMatches(i + 1, names),
    }));
    setUnresolved(res.unresolved);
    setDrawSeq((n) => n + 1);
    setSerpDone(false);
    dispatch({ type: "poules.drawn", payload: { phase: "PREQ", poules } });
    window.setTimeout(
      () =>
        document
          .getElementById("serpentin")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
    toast(
      res.unresolved.length
        ? `Tirage effectué · ${plural(res.unresolved.length, "poule")} à corriger à la main`
        : "Tirage en cours…",
    );
  };

  const redraw = () => {
    if (locked) {
      toast("Des scores sont déjà saisis : le tirage est figé.");
      return;
    }
    draw();
  };

  const swap = (name: string) => {
    if (!selected) {
      setSelected(name);
      return;
    }
    if (selected === name) {
      setSelected(null);
      return;
    }
    const poules = state.poules.PREQ.map((p) => {
      const names = p.players.map((n) => (n === selected ? name : n === name ? selected : n));
      return { ...p, players: names, matches: pouleMatches(p.num, names) };
    });
    dispatch({ type: "poules.drawn", payload: { phase: "PREQ", poules } });
    setSelected(null);
    const res = resolveClubConflicts(
      poules.map((p) => p.players),
      clubOf(state),
    );
    setUnresolved(res.unresolved);
    toast(`${nice(selected)} et ${nice(name)} échangés`);
  };

  const conflicts = useMemo(() => {
    const clubs = clubOf(state);
    return state.poules.PREQ.filter((p) => {
      const counts = new Map<string, number>();
      for (const n of p.players) counts.set(clubs[n] ?? "", (counts.get(clubs[n] ?? "") ?? 0) + 1);
      return [...counts.values()].some((v) => v >= 3);
    }).map((p) => p.num);
  }, [state]);
  const conflictSet = new Set([...conflicts, ...unresolved]);
  const totalMatches = state.poules.PREQ.reduce((n, p) => n + p.matches.length, 0);

  return (
    <section>
      <PageHead
        eyebrow={`${longDate(dayDate(state, "jeudi"))} · Préparation`}
        title="Tirage des billards et création des poules"
        help={
          drawn
            ? "Les poules du vendredi sont créées. Vérifiez les billards, imprimez les documents et passez au vendredi."
            : "Les inscrits sont importés et classés. Il reste à affecter les billards et à lancer le tirage."
        }
      >
        <Chip tone="blue">{distanceLabel(d)}</Chip>
        <Chip>Convocation vendredi 10h30</Chip>
        <Button icon={Printer} onClick={() => setPrintOpen(true)}>
          Imprimer
        </Button>
      </PageHead>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Tile
          label="Inscrits"
          value={players.length}
          detail={
            <>
              dont {plural(juniors, "junior")} ·{" "}
              {players.length > capacity
                ? `${players.length - capacity} au-delà de la capacité`
                : `capacité ${capacity}`}
            </>
          }
        />
        <Tile
          label="Masters préqualifiés"
          value={masters.length}
          detail="Têtes de série, entrent samedi"
          tone="gold"
        />
        <Tile
          label="Poules du vendredi"
          value={pouleCount}
          detail={`${plural(nb4, "poule")} de 4${nb3 ? ` · ${plural(nb3, "poule")} de 3` : ""}`}
        />
        <Tile
          label="Billards"
          value={state.billards.length}
          detail={`${bigTables(state.billards)} × 3m10 · ${smallTables(state.billards)} × 2m80`}
          tone="blue"
        />
      </div>

      <Card
        className="mt-3.5"
        title="Têtes de série · qualifiés directs Masters"
        aside={
          <Chip tone="gold" icon={Trophy}>
            Classement glissant
          </Chip>
        }
      >
        <div className="grid grid-cols-2 gap-2.5 px-4 pt-1 pb-4 sm:grid-cols-4 lg:grid-cols-8">
          {masters.map((p, i) => (
            <div
              key={p.licence}
              className="bg-surface-2 border-line animate-pop flex min-w-0 flex-col items-center gap-1.5 rounded-[12px] border px-1.5 py-3 text-center"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Avatar name={p.name} size="lg" crown={i === 0} />
              <span className="text-brand font-mono text-[10.5px] font-semibold">
                #{p.place ?? "–"}
              </span>
              <span className="text-[12px] leading-[1.2] font-bold">{nice(p.name)}</span>
              <span className="text-ink-muted max-w-full truncate text-[10.5px]">
                {clubShort(p.club)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <BillardStructure
        billards={state.billards}
        locked={drawn}
        onChange={(billards) => {
          amendBillards(billards);
          const count = preqPouleCount(state);
          dispatchMany([
            {
              type: "billards.assigned",
              payload: { phase: "PREQ", assignments: drawPreqBillards(count, billards) },
            },
            ...drawLaterPhaseEvents(billards),
          ]);
          toast("Structure enregistrée · billards retirés au sort");
        }}
      />

      <PreqBillards
        pouleCount={pouleCount}
        locked={locked}
        onShuffle={() => {
          dispatch({
            type: "billards.assigned",
            payload: { phase: "PREQ", assignments: drawPreqBillards(pouleCount, state.billards) },
          });
          toast("Billards des poules tirés au sort");
        }}
        onAssign={(poule, billard) => {
          dispatch({
            type: "billards.assigned",
            payload: { phase: "PREQ", assignments: { ...preqAssign, [poule]: [billard] } },
          });
        }}
      />

      <LaterPhases />

      {!drawn ? (
        <div className="bg-brand-cta relative mt-3.5 flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-[18px] px-6 py-[22px] text-white shadow-[0_24px_50px_-24px_rgb(14_55_168/0.7)]">
          <span
            className="pointer-events-none absolute -top-20 -right-20 size-[260px] rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.22),transparent_70%)]"
            aria-hidden="true"
          />
          <div className="relative min-w-0">
            <h3 className="text-[20px] font-extrabold tracking-[-0.02em]">
              Tirer les poules du vendredi
            </h3>
            <p className="mt-1 max-w-[60ch] opacity-85">
              {field.length} joueurs répartis en serpentin dans {plural(pouleCount, "poule")} selon
              la liste ordonnée des participants. Le contrôle des clubs est automatique : jamais
              trois joueurs du même club dans une poule.
            </p>
          </div>
          <Button variant="white" size="lg" icon={Play} onClick={draw} className="relative">
            Lancer le tirage
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="eyebrow">Serpentin</div>
              <h2 className="text-[18px]">Poules du vendredi</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="grey">Têtes de poule en haut · place au classement à droite</Chip>
              {!locked ? (
                <>
                  <Button
                    size="sm"
                    icon={Pencil}
                    variant={swapMode ? "primary" : "default"}
                    onClick={() => {
                      setSwapMode((v) => !v);
                      setSelected(null);
                    }}
                    aria-pressed={swapMode}
                  >
                    {swapMode ? "Terminer la correction" : "Corriger à la main"}
                  </Button>
                  <Button size="sm" icon={Shuffle} onClick={redraw}>
                    Refaire le tirage
                  </Button>
                </>
              ) : null}
            </div>
          </div>
          {swapMode ? (
            <div className="bg-brand-soft text-brand-ink mb-3 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold">
              {selected
                ? `${nice(selected)} sélectionné · cliquez sur le joueur avec qui l'échanger.`
                : "Cliquez sur un joueur, puis sur un second pour les échanger de poule."}
            </div>
          ) : null}
          <Card
            className="mb-3.5"
            title="Le serpentin du tirage"
            aside={<Chip tone="gold">TS = tête de poule</Chip>}
          >
            <Serpentin
              poules={state.poules.PREQ}
              animate={drawSeq}
              conflicts={conflictSet}
              onDone={() => setSerpDone(true)}
            />
          </Card>
          {serpDone ? (
            conflictSet.size > 0 ? (
              <Banner tone="red" icon={TriangleAlert} className="mt-0 mb-3.5">
                {plural(conflictSet.size, "poule")} avec trois joueurs du même club (
                {[...conflictSet].map((n) => `P${n}`).join(", ")}) : corrigez à la main en
                échangeant un joueur.
              </Banner>
            ) : (
              <Banner
                icon={Check}
                className="mt-0 mb-3.5"
                actions={
                  <>
                    <Button icon={Printer} onClick={() => setPrintOpen(true)}>
                      Imprimer listes et feuilles de match
                    </Button>
                    <Button
                      variant="primary"
                      iconRight={ArrowRight}
                      onClick={() => navigate("/tournoi/vendredi")}
                    >
                      Passer au vendredi
                    </Button>
                  </>
                }
              >
                {plural(state.poules.PREQ.length, "poule créée", "poules créées")} · aucune poule
                avec trois joueurs du même club · têtes de poule en première ligne ·{" "}
                {plural(totalMatches, "match")} à jouer
              </Banner>
            )
          ) : null}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
            {state.poules.PREQ.map((p) => (
              <PouleCard
                key={p.num}
                state={state}
                phase="PREQ"
                poule={p}
                distance={d}
                conflict={conflictSet.has(p.num)}
                selected={selected}
                onSelectPlayer={swapMode ? swap : undefined}
                showPlace
              />
            ))}
          </div>
        </div>
      )}

      <PrintCenter day="jeudi" open={printOpen} onClose={() => setPrintOpen(false)} />
    </section>
  );
}

/* ---------- Structure des billards ---------- */

function BillardStructure({
  billards,
  locked,
  onChange,
}: {
  billards: Billard[];
  locked: boolean;
  onChange: (b: Billard[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Billard[]>(billards);
  const big = bigTables(draft);
  const valid =
    draft.length >= 8 && big >= 3 && new Set(draft.map((b) => b.num)).size === draft.length;
  return (
    <Card
      className="mt-3.5"
      title="Structure des billards"
      aside={
        <>
          {bigTables(billards) < 3 || billards.length < 8 ? (
            <Chip tone="red" icon={TriangleAlert}>
              Minimum 8 billards dont 3 de 3m10
            </Chip>
          ) : (
            <Chip tone="grey">
              Numérotation du club hôte · {bigTables(billards)} × 3m10 · {smallTables(billards)} ×
              2m80
            </Chip>
          )}
          {!locked ? (
            editing ? (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setDraft(billards);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={Check}
                  disabled={!valid}
                  onClick={() => {
                    onChange([...draft].sort((a, b) => a.num - b.num));
                    setEditing(false);
                  }}
                >
                  Enregistrer
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                icon={Pencil}
                onClick={() => {
                  setDraft(billards);
                  setEditing(true);
                }}
              >
                Modifier
              </Button>
            )
          ) : (
            <Chip tone="green" icon={Check}>
              Figée depuis le tirage
            </Chip>
          )}
        </>
      }
    >
      {editing ? (
        <div className="px-4 pb-4">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-ink-muted text-left text-[10.5px] tracking-[0.06em] uppercase">
                <th className="py-1.5 pr-3">N° du billard</th>
                <th className="py-1.5 pr-3">Type</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {draft.map((b, i) => (
                <tr key={i} className="border-line border-t">
                  <td className="py-1.5 pr-3">
                    <input
                      type="number"
                      min={1}
                      aria-label={`Numéro du billard ${i + 1}`}
                      className="field w-24 font-mono"
                      value={b.num}
                      onChange={(e) =>
                        setDraft(
                          draft.map((x, k) =>
                            k === i ? { ...x, num: Number(e.target.value) } : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <Select
                      ariaLabel={`Type du billard ${b.num}`}
                      value={b.type}
                      onChange={(v) =>
                        setDraft(
                          draft.map((x, k) => (k === i ? { ...x, type: v as Billard["type"] } : x)),
                        )
                      }
                      options={[
                        { value: "3m10", label: "3m10 (grand)" },
                        { value: "2m80", label: "2m80 (petit)" },
                      ]}
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <Button
                      size="sm"
                      variant="danger"
                      icon={Trash2}
                      aria-label={`Retirer le billard ${b.num}`}
                      onClick={() => setDraft(draft.filter((_, k) => k !== i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button
            size="sm"
            icon={Plus}
            className="mt-2"
            onClick={() =>
              setDraft([
                ...draft,
                { num: Math.max(0, ...draft.map((b) => b.num)) + 1, type: "2m80" },
              ])
            }
          >
            Ajouter un billard
          </Button>
          {!valid ? (
            <p className="text-alert-ink mt-2 text-[12.5px] font-semibold">
              Il faut au moins 8 billards dont 3 de 3m10, avec des numéros distincts.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {billards.map((b) => (
            <span
              key={b.num}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-[12.5px] font-bold",
                b.type === "3m10"
                  ? "bg-brand-soft text-brand-ink border-transparent"
                  : "bg-surface-2 border-line text-ink-secondary",
              )}
            >
              <span className="font-mono">{b.num}</span>
              <span className="text-[10.5px] font-semibold opacity-70">{b.type}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------- Billards des poules du vendredi ---------- */

function PreqBillards({
  pouleCount,
  locked,
  onShuffle,
  onAssign,
}: {
  pouleCount: number;
  locked: boolean;
  onShuffle: () => void;
  onAssign: (poule: string, billard: number) => void;
}) {
  const { state } = useTournament();
  const [editing, setEditing] = useState(false);
  const assign = state.billardAssignments.PREQ ?? {};
  const options = state.billards.map((b) => ({
    value: String(b.num),
    label: `Billard ${b.num} · ${b.type}`,
  }));
  return (
    <Card
      className="mt-3.5"
      title="Billards et poules affectées"
      aside={
        <>
          <Chip tone="grey">2 poules par billard · 3m10 et 2m80 sans priorité</Chip>
          {!locked ? (
            <>
              <Button
                size="sm"
                icon={Pencil}
                variant={editing ? "primary" : "default"}
                onClick={() => setEditing((v) => !v)}
                aria-pressed={editing}
              >
                {editing ? "Terminer" : "Modifier"}
              </Button>
              <Button size="sm" icon={Shuffle} onClick={onShuffle}>
                Tirer au sort
              </Button>
            </>
          ) : null}
        </>
      }
    >
      {editing ? (
        <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: pouleCount }, (_, i) => String(i + 1)).map((key) => (
            <label key={key} className="flex flex-col gap-1 text-[12px] font-semibold">
              Poule {key}
              <Select
                ariaLabel={`Billard de la poule ${key}`}
                value={String(assign[key]?.[0] ?? "")}
                onChange={(v) => onAssign(key, Number(v))}
                options={[{ value: "", label: "—" }, ...options]}
              />
            </label>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 px-4 pt-1 pb-4">
          {state.billards.map((b) => {
            const poules = Array.from({ length: pouleCount }, (_, i) => i + 1).filter((n) =>
              assign[String(n)]?.includes(b.num),
            );
            return (
              <div
                key={b.num}
                className="bg-surface-2 border-line flex flex-col gap-2 rounded-[12px] border p-3"
              >
                <div className="flex items-center justify-between">
                  <b className="text-[15px]">Billard {b.num}</b>
                  <span
                    className={cx(
                      "rounded-[6px] border px-[7px] py-[3px] text-[10.5px] font-bold",
                      b.type === "3m10"
                        ? "bg-brand-soft text-brand-ink border-transparent"
                        : "bg-surface border-line-2 text-ink-muted",
                    )}
                  >
                    {b.type}
                  </span>
                </div>
                <div className="flex min-h-6 flex-wrap gap-1.5">
                  {poules.length ? (
                    poules.map((n, k) => (
                      <span
                        key={n}
                        className="bg-surface border-line-2 text-ink-secondary animate-pop rounded-full border px-2 py-[3px] text-[11px] font-bold"
                        style={{ animationDelay: `${k * 25}ms` }}
                      >
                        Poule {n}
                      </span>
                    ))
                  ) : (
                    <span className="bg-surface border-line-2 text-ink-muted rounded-full border px-2 py-[3px] text-[11px] font-bold opacity-60">
                      libre
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ---------- Billards des phases suivantes ---------- */

function LaterPhases() {
  const { state, dispatch, dispatchMany } = useTournament();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const A = state.billardAssignments;
  const options = state.billards.map((b) => ({
    value: String(b.num),
    label: `B${b.num} · ${b.type}`,
  }));
  const bigOptions = options.filter(
    (o) => state.billards.find((b) => String(b.num) === o.value)?.type === "3m10",
  );
  const locked = Boolean(state.closed.M && state.closed.N);
  const block = (
    title: string,
    tag: string,
    big: boolean,
    phase: "B" | "QM" | "QN" | "M" | "N",
    keys: { key: string; label: string }[],
  ) => {
    const assign = A[phase] ?? {};
    return (
      <div className="bg-surface-2 border-line flex flex-col gap-2 rounded-[12px] border p-3">
        <div className="flex items-center justify-between">
          <b className="text-[14px]">{title}</b>
          <span
            className={cx(
              "rounded-[6px] border px-[7px] py-[3px] text-[10.5px] font-bold",
              big
                ? "bg-brand-soft text-brand-ink border-transparent"
                : "bg-surface border-line-2 text-ink-muted",
            )}
          >
            {tag}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {keys.map(({ key, label }) =>
            editing ? (
              <label key={key} className="flex items-center gap-1 text-[11px] font-bold">
                {label}
                <Select
                  ariaLabel={`${title} · ${label}`}
                  value={String(assign[key]?.[0] ?? "")}
                  onChange={(v) => {
                    const next = { ...assign, [key]: [Number(v)] };
                    // National : les poules croisées partagent le billard
                    if (phase === "QN") {
                      const n = Number(key);
                      next[String(9 - n)] = [Number(v)];
                    }
                    dispatch({ type: "billards.assigned", payload: { phase, assignments: next } });
                  }}
                  options={[
                    { value: "", label: "—" },
                    ...(phase === "QM" && bigOptions.length ? bigOptions : options),
                  ]}
                />
              </label>
            ) : (
              <span
                key={key}
                className="bg-surface border-line-2 text-ink-secondary rounded-full border px-2 py-[3px] text-[11px] font-bold"
              >
                {label} → {assign[key]?.[0] !== undefined ? `B${assign[key]?.[0]}` : "—"}
              </span>
            ),
          )}
        </div>
      </div>
    );
  };
  const pairs = [1, 2, 3, 4].map((i) => ({ key: String(i), label: `P${i} & P${9 - i}` }));
  return (
    <Card
      className="mt-3.5"
      title="Billards des phases suivantes"
      aside={
        <>
          <Chip tone="grey">Tirés le jeudi, modifiables jusqu'au dimanche matin</Chip>
          {!locked ? (
            <>
              <Button
                size="sm"
                icon={Pencil}
                variant={editing ? "primary" : "default"}
                onClick={() => setEditing((v) => !v)}
                aria-pressed={editing}
              >
                {editing ? "Terminer" : "Modifier"}
              </Button>
              <Button
                size="sm"
                icon={Shuffle}
                onClick={() => {
                  dispatchMany(drawLaterPhaseEvents(state.billards));
                  toast("Billards des barrages, du samedi et des quarts tirés au sort");
                }}
              >
                Tirer au sort
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2.5 px-4 pt-1 pb-4">
        {block(
          "Barrages",
          "vendredi",
          false,
          "B",
          Array.from({ length: 8 }, (_, i) => ({ key: `B${i + 1}`, label: `B${i + 1}` })),
        )}
        {block("National · poules", "samedi", false, "QN", pairs)}
        {block(
          "Masters · poules",
          "3m10",
          true,
          "QM",
          [1, 2, 3, 4].map((i) => ({ key: String(i), label: `P${i}` })),
        )}
        {block(
          "Quarts Masters",
          "dimanche · 3m10",
          true,
          "M",
          [1, 2, 3, 4].map((i) => ({ key: `M-QF${i}`, label: `Q${i}` })),
        )}
        {block(
          "Quarts National",
          "dimanche",
          false,
          "N",
          [1, 2, 3, 4].map((i) => ({ key: `N-QF${i}`, label: `Q${i}` })),
        )}
      </div>
    </Card>
  );
}

export { pouleBillards };

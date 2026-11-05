/** Accueil : ouvrir le tournoi d'exemple, importer un CSV d'inscrits, reprendre un tournoi. */
import type { Player } from "@pilot5q/domain";
import { ArrowRight, FileText, Sparkles, Trash2, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router";

import { RoleSwitch } from "@/admin/RoleSwitch";
import { useToast } from "@/components/Toast";
import { BrandMark } from "@/components/TopBar";
import { Avatar, Button, Card, Chip, cx } from "@/components/ui";
import { DEMO, demoEvents } from "@/lib/demo";
import { orderParticipants, parseInscritsCsv } from "@/lib/engine";
import { clubShort, dateRange, nice, plural } from "@/lib/format";
import { createTournamentEvents, type TournamentForm } from "@/lib/setup";
import { useTournament } from "@/store/tournament";

const SEASON = "2026-2027";

export function Home() {
  const { ready, id, state, open, destroy } = useTournament();
  const navigate = useNavigate();
  const toast = useToast();
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [form, setForm] = useState<TournamentForm>({
    name: "TN 3",
    season: SEASON,
    city: "",
    club: "",
    friday: "2026-12-04",
    big: 4,
    small: 7,
  });
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const openDemo = () => {
    open(`demo-${Date.now().toString(36)}`, demoEvents());
    toast("Tournoi d'exemple ouvert");
    void navigate("/tournoi/jeudi");
  };

  const readFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseInscritsCsv(text);
      if (parsed.length === 0) {
        toast("Aucun inscrit trouvé dans ce fichier");
        return;
      }
      setPlayers(orderParticipants(parsed, {}, {}));
      setFileName(file.name);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Fichier illisible");
    }
  };

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  const create = () => {
    if (!players) return;
    if (!form.name || !form.city || !form.club) {
      toast("Nom du tournoi, ville et club sont nécessaires");
      return;
    }
    if (form.big + form.small < 8 || form.big < 3) {
      toast("Il faut au moins 8 billards dont 3 de 3m10 (SPEC §1)");
      return;
    }
    const slug = `${form.name}-${form.city}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    open(`${slug}-${Date.now().toString(36)}`, createTournamentEvents(form, players));
    toast("Tournoi créé");
    void navigate("/tournoi/jeudi");
  };

  const capacity = (form.big + form.small) * 8 + 8;

  return (
    <main className="mx-auto max-w-[1100px] px-4 pt-10 pb-20">
      <header className="flex flex-col items-center gap-3 text-center">
        <BrandMark className="size-12 rounded-[14px] [&>svg]:size-7" />
        <p className="text-ink-muted text-xs font-semibold tracking-[0.2em] uppercase">
          Billard 5-Quilles · FFB
        </p>
        <h1 className="text-brand text-[40px] leading-none md:text-5xl">Pilot5Q</h1>
        <p className="text-ink-secondary max-w-xl text-base font-medium">
          Le cockpit du directeur de jeu pour un Tournoi National : billards, poules,
          préqualifications, barrages, National, Masters, consolante, primes.
        </p>
      </header>
      <RoleSwitch />

      {ready && id && state.info ? (
        <Card
          className="animate-fade-up mt-8"
          bodyClassName="flex flex-wrap items-center gap-4 p-5"
        >
          <Avatar name={state.info.club} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Tournoi en cours</div>
            <div className="text-[18px] font-extrabold">
              {state.info.name} · {state.info.city}
            </div>
            <div className="text-ink-muted text-[13px]">
              {state.info.club} · {dateRange(state.info.dates[0], state.info.dates[1])} ·{" "}
              {plural(state.players.length, "inscrit")}
            </div>
          </div>
          <Button
            variant="danger"
            icon={Trash2}
            onClick={() => {
              if (window.confirm("Supprimer définitivement ce tournoi de cet ordinateur ?")) {
                destroy();
                toast("Tournoi supprimé");
              }
            }}
          >
            Supprimer
          </Button>
          <Button
            variant="primary"
            size="lg"
            iconRight={ArrowRight}
            onClick={() => navigate("/tournoi")}
          >
            Reprendre
          </Button>
        </Card>
      ) : null}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card
          className="animate-fade-up flex flex-col"
          bodyClassName="flex flex-1 flex-col gap-4 p-6"
        >
          <span className="bg-gold-soft text-gold-ink grid size-11 place-items-center rounded-[12px]">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[20px]">Ouvrir le tournoi d'exemple</h2>
            <p className="text-ink-muted mt-1">
              {DEMO.tournament.name} à {DEMO.tournament.city} : {DEMO.players.length} inscrits,{" "}
              {DEMO.billards.length} billards, {DEMO.poules.length} poules et les scores réels d'un
              tournoi complet pour tester chaque journée.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip tone="gold">8 têtes de série</Chip>
            <Chip tone="blue">4 × 3m10 · 7 × 2m80</Chip>
            <Chip tone="grey">noms fictifs</Chip>
          </div>
          <Button
            variant="primary"
            size="lg"
            iconRight={ArrowRight}
            onClick={openDemo}
            className="mt-auto self-start"
          >
            Ouvrir le tournoi d'exemple
          </Button>
        </Card>

        <Card
          className="animate-fade-up flex flex-col [animation-delay:80ms]"
          bodyClassName="flex flex-1 flex-col gap-4 p-6"
        >
          <span className="bg-brand-soft text-brand grid size-11 place-items-center rounded-[12px]">
            <Upload className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[20px]">Importer un CSV d'inscrits</h2>
            <p className="text-ink-muted mt-1">
              Le fichier des inscriptions du site fédéral (séparateur « ; »). Les joueurs sont
              ordonnés par date d'inscription ; le classement glissant arrivera avec le responsable
              national.
            </p>
          </div>
          {players === null ? (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cx(
                "mt-auto flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed p-5 text-center transition-colors",
                dragging
                  ? "border-brand bg-brand-soft"
                  : "border-line-2 bg-surface-2 hover:border-brand",
              )}
            >
              <FileText className="text-brand size-6" aria-hidden="true" />
              <span className="font-semibold">Déposer le fichier CSV ici</span>
              <span className="text-ink-muted text-[12.5px]">ou cliquer pour le choisir</span>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                aria-label="Fichier CSV des inscrits"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void readFile(f);
                }}
              />
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="bg-ok-soft text-ok-ink flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] font-semibold">
                <FileText className="size-4" aria-hidden="true" />
                {fileName} · {plural(players.length, "inscrit")}
                <button
                  type="button"
                  className="ml-auto underline"
                  onClick={() => setPlayers(null)}
                >
                  Changer
                </button>
              </div>
              <div className="border-line max-h-40 overflow-auto rounded-[10px] border text-[12.5px]">
                {players.slice(0, 12).map((p) => (
                  <div
                    key={p.licence}
                    className="border-line flex items-center gap-2 border-b px-3 py-1.5 last:border-b-0"
                  >
                    <span className="text-ink-muted w-6 font-mono">{p.seed}</span>
                    <Avatar name={p.name} size="xs" />
                    <span className="truncate font-semibold">{nice(p.name)}</span>
                    <span className="text-ink-muted ml-auto truncate">{clubShort(p.club)}</span>
                  </div>
                ))}
                {players.length > 12 ? (
                  <div className="text-ink-muted px-3 py-1.5 text-center">
                    … {players.length - 12} autres inscrits
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                <Field label="Tournoi">
                  <input
                    className="field"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field>
                <Field label="Saison">
                  <input
                    className="field"
                    value={form.season}
                    onChange={(e) => setForm({ ...form, season: e.target.value })}
                  />
                </Field>
                <Field label="Ville">
                  <input
                    className="field"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </Field>
                <Field label="Club hôte">
                  <input
                    className="field"
                    value={form.club}
                    onChange={(e) => setForm({ ...form, club: e.target.value })}
                  />
                </Field>
                <Field label="Vendredi">
                  <input
                    type="date"
                    className="field"
                    value={form.friday}
                    onChange={(e) => setForm({ ...form, friday: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="3m10">
                    <input
                      type="number"
                      min={0}
                      className="field"
                      value={form.big}
                      onChange={(e) => setForm({ ...form, big: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="2m80">
                    <input
                      type="number"
                      min={0}
                      className="field"
                      value={form.small}
                      onChange={(e) => setForm({ ...form, small: Number(e.target.value) })}
                    />
                  </Field>
                </div>
              </div>
              <p className="text-ink-muted text-[12px]">
                Capacité : {capacity} joueurs ({form.big + form.small} billards × 8 + 8).
                {players.length > capacity
                  ? ` ${players.length - capacity} inscrits au-delà de la capacité : liste d'attente à gérer à la main.`
                  : ""}
              </p>
              <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={create}>
                Créer le tournoi
              </Button>
            </div>
          )}
        </Card>
      </div>
      <p className="text-ink-muted mt-8 text-center text-[12.5px]">
        Tout reste dans ce navigateur : aucune donnée n'est envoyée à un serveur.
      </p>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-ink-muted text-[11px] font-bold tracking-[0.06em] uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

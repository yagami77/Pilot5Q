/** Paramétrage des TN : billards minimum, capacité, consolante, primes, droits, horaires, canevas du mail. */
import {
  DEFAULT_MAIL_TEMPLATE,
  DEFAULT_SEASON_SETTINGS,
  baremeTable,
  otherPointsTable,
  renderTemplate,
  type SeasonSettings,
} from "@pilot5q/domain";
import { RotateCcw, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";

import { useToast } from "@/components/Toast";
import { Button, Card, PageHead } from "@/components/ui";

import { AccountsCard } from "./Accounts";
import { hourText } from "./convocations";
import { useSeason, useSeasonDoc } from "./store";
import { Field, Input, MailBody, Num, Row, Table, TextArea } from "./ui";

const DIST_LABELS: Record<keyof SeasonSettings["distances"], string> = {
  preq: "Poules du vendredi",
  barrage: "Barrages",
  qn: "Poules National",
  qm: "Poules Masters",
  huitiemes: "Huitièmes National",
  cls: "Consolante",
  final: "Quarts, demies, finales",
};

export function Settings() {
  const doc = useSeasonDoc();
  const { update, destroy } = useSeason();
  const toast = useToast();
  const navigate = useNavigate();
  const s = doc.settings;
  const set = (patch: Partial<SeasonSettings>) =>
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const num = (k: keyof SeasonSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set({ [k]: Number(e.target.value) } as Partial<SeasonSettings>);
  const capacityExample = (tables: number) =>
    Math.min(s.maxPlayers, tables * s.playersPerTable + s.extraPlayers);
  const preview = renderTemplate(s.mailTemplate, {
    prenom: "Jean",
    nom: "DUPONT",
    club: "BC Exemple",
    tournoi: "TN 2 2026-2027",
    lieu: "BC Ronchin (Ronchin)",
    dates: "30 octobre au 1er novembre 2026",
    heure: `vendredi 30 octobre à ${hourText(s.convocationFriday)}`,
    poule: " Poule communiquée après le tirage.",
    billard: "4",
    adresse: "Salle de billard, 59790 Ronchin",
    url: "https://…",
  });
  const customTemplate = s.mailTemplate !== DEFAULT_MAIL_TEMPLATE;
  return (
    <>
      <PageHead
        eyebrow={`Saison ${doc.id}`}
        title="Paramètres des TN"
        help="Valeurs par défaut de SPEC §8 et de l'outil de référence. Elles s'appliquent à chaque tournoi ouvert pour un club hôte."
      >
        <Button
          icon={RotateCcw}
          onClick={() => {
            set({ ...DEFAULT_SEASON_SETTINGS });
            toast("Paramètres par défaut rétablis");
          }}
        >
          Valeurs par défaut
        </Button>
      </PageHead>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Billards et joueurs acceptés" bodyClassName="grid grid-cols-2 gap-3 px-4 pb-4">
          <Field label="Billards minimum">
            <Input type="number" min={1} value={s.minTables} onChange={num("minTables")} />
          </Field>
          <Field label="dont 3m10 minimum">
            <Input type="number" min={0} value={s.minBigTables} onChange={num("minBigTables")} />
          </Field>
          <Field label="Joueurs par billard">
            <Input
              type="number"
              min={1}
              value={s.playersPerTable}
              onChange={num("playersPerTable")}
            />
          </Field>
          <Field label="Joueurs supplémentaires">
            <Input type="number" min={0} value={s.extraPlayers} onChange={num("extraPlayers")} />
          </Field>
          <Field label="Maximum de joueurs">
            <Input type="number" min={1} value={s.maxPlayers} onChange={num("maxPlayers")} />
          </Field>
          <Field label="Prioritaires en liste d'attente" hint="premiers du classement glissant">
            <Input
              type="number"
              min={0}
              value={s.waitlistPriority}
              onChange={num("waitlistPriority")}
            />
          </Field>
          <Field label="Consolante : billards 2m80 minimum">
            <Input
              type="number"
              min={0}
              value={s.consolanteMinSmallTables}
              onChange={num("consolanteMinSmallTables")}
            />
          </Field>
          <p className="text-ink-muted col-span-2 text-[12.5px]">
            Exemples : 8 billards → {capacityExample(8)} joueurs · 11 billards →{" "}
            {capacityExample(11)} · 12 billards → {capacityExample(12)} (plafond {s.maxPlayers}).
          </p>
        </Card>
        <Card title="Droits, dotations et primes" bodyClassName="px-4 pb-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Droit d'inscription (€)" hint="U21 exemptés">
              <Input
                type="number"
                min={0}
                value={s.inscriptionFee}
                onChange={num("inscriptionFee")}
              />
            </Field>
            <Field label="Dotation FFB (€)">
              <Input type="number" min={0} value={s.ffbShare} onChange={num("ffbShare")} />
            </Field>
            <Field label="Dotation club (€)">
              <Input type="number" min={0} value={s.clubShare} onChange={num("clubShare")} />
            </Field>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(["prizesMasters", "prizesNational"] as const).map((key) => (
              <div key={key}>
                <div className="eyebrow mb-1.5">
                  {key === "prizesMasters" ? "Masters (80 %)" : "National (20 %)"}
                </div>
                <Table head={["Palier", "Nb", "% chacun"]} dense>
                  {s[key].map((line, i) => (
                    <Row key={line.label}>
                      <td>{line.label}</td>
                      <td>
                        <Num>{line.count}</Num>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          className="field w-20 py-0.5"
                          value={line.pct}
                          aria-label={`${line.label} : pourcentage`}
                          onChange={(e) =>
                            set({
                              [key]: s[key].map((l, j) =>
                                j === i ? { ...l, pct: Number(e.target.value) } : l,
                              ),
                            } as Partial<SeasonSettings>)
                          }
                        />
                      </td>
                    </Row>
                  ))}
                </Table>
              </div>
            ))}
          </div>
          <p className="text-ink-muted mt-2 text-[12.5px]">
            Total :{" "}
            {[...s.prizesMasters, ...s.prizesNational].reduce((a, l) => a + l.pct * l.count, 0)} %
            de la cagnotte.
          </p>
        </Card>
        <Card title="Distances par phase" bodyClassName="px-4 pb-4">
          <Table head={["Phase", "Points par set", "Sets gagnants"]} dense>
            {(Object.keys(DIST_LABELS) as (keyof SeasonSettings["distances"])[]).map((k) => (
              <Row key={k}>
                <td>{DIST_LABELS[k]}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    className="field w-24 py-0.5"
                    value={s.distances[k].pointsParSet}
                    aria-label={`${DIST_LABELS[k]} : points par set`}
                    onChange={(e) =>
                      set({
                        distances: {
                          ...s.distances,
                          [k]: { ...s.distances[k], pointsParSet: Number(e.target.value) },
                        },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={1}
                    className="field w-20 py-0.5"
                    value={s.distances[k].setsGagnants}
                    aria-label={`${DIST_LABELS[k]} : sets gagnants`}
                    onChange={(e) =>
                      set({
                        distances: {
                          ...s.distances,
                          [k]: { ...s.distances[k], setsGagnants: Number(e.target.value) },
                        },
                      })
                    }
                  />
                </td>
              </Row>
            ))}
          </Table>
        </Card>
        <Card title="Horaires de convocation" bodyClassName="grid grid-cols-3 gap-3 px-4 pb-4">
          <Field label="Vendredi">
            <Input
              type="time"
              value={s.convocationFriday}
              onChange={(e) => set({ convocationFriday: e.target.value })}
            />
          </Field>
          <Field label="Samedi et dimanche">
            <Input
              type="time"
              value={s.convocationWeekend}
              onChange={(e) => set({ convocationWeekend: e.target.value })}
            />
          </Field>
          <Field label="Si 3 billards 3m10">
            <Input
              type="time"
              value={s.convocationWeekendThreeBig}
              onChange={(e) => set({ convocationWeekendThreeBig: e.target.value })}
            />
          </Field>
          <div className="col-span-3">
            <div className="eyebrow mb-1.5">Barème réforme 2026-2027</div>
            <div className="grid gap-3 md:grid-cols-[1fr_260px]">
              <Table head={["Palier", "Masters", "National"]} dense>
                {baremeTable().map((l) => (
                  <Row key={l.label}>
                    <td>{l.label}</td>
                    <td>
                      <Num>{l.masters ?? "–"}</Num>
                    </td>
                    <td>
                      <Num>{l.national ?? "–"}</Num>
                    </td>
                  </Row>
                ))}
              </Table>
              <Table head={["Hors tableaux", "Points"]} dense>
                {otherPointsTable().map((l) => (
                  <Row key={l.label}>
                    <td>{l.label}</td>
                    <td>
                      <Num>{l.points}</Num>
                    </td>
                  </Row>
                ))}
              </Table>
            </div>
            <p className="text-ink-muted mt-2 text-[12px]">
              Décimale de départage : points de set / matchs joués / 100. Classement glissant : 4
              meilleurs résultats sur les 5 derniers TN.
            </p>
          </div>
        </Card>
        <Card
          title="Canevas du mail de convocation"
          aside={
            <span className="text-ink-muted text-[12px]">
              Variables : prenom, nom, club, tournoi, lieu, dates, heure, poule, billard, adresse,
              url
            </span>
          }
          className="lg:col-span-2"
          bodyClassName="grid gap-3 px-4 pb-4 md:grid-cols-2"
        >
          <div className="flex min-w-0 flex-col gap-2">
            <Field label="Canevas">
              <TextArea
                rows={12}
                value={s.mailTemplate}
                onChange={(e) => set({ mailTemplate: e.target.value })}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                icon={RotateCcw}
                disabled={!customTemplate}
                onClick={() => {
                  set({ mailTemplate: DEFAULT_MAIL_TEMPLATE });
                  toast("Canevas par défaut rétabli");
                }}
              >
                Revenir au canevas par défaut
              </Button>
              <span className="text-ink-muted text-[12px]">
                {customTemplate
                  ? "Canevas propre à cette saison (différent du canevas par défaut)."
                  : "Canevas par défaut."}
              </span>
            </div>
          </div>
          <Field
            label="Aperçu"
            hint="La phrase « En cas de forfait… » est en rouge dans l'email copié en HTML ; le texte brut reste inchangé."
          >
            <MailBody text={preview} className="min-h-[120px]" />
          </Field>
        </Card>
      </div>
      <AccountsCard />
      <Card
        title="Zone sensible"
        className="border-alert-soft mt-4"
        bodyClassName="flex flex-wrap items-center gap-3 px-4 pb-4"
      >
        <p className="text-ink-muted min-w-0 flex-1 text-[13px]">
          Supprime la saison {doc.id} de ce navigateur (clubs, calendrier, joueurs, classement). Le
          tournoi ouvert dans le cockpit n'est pas touché.
        </p>
        <Button
          variant="danger"
          icon={Trash2}
          onClick={() => {
            if (!window.confirm(`Supprimer définitivement la saison ${doc.id} de cet ordinateur ?`))
              return;
            destroy();
            toast("Saison supprimée");
            void navigate("/responsable");
          }}
        >
          Supprimer la saison
        </Button>
      </Card>
    </>
  );
}

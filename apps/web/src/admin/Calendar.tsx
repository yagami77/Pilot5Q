/** Calendrier de la saison : dates de compétition, fenêtre d'inscription, URL, club hôte. */
import { stageStatus, sundayOf, type Stage } from "@pilot5q/domain";
import { Plus, Trash2 } from "lucide-react";

import { useToast } from "@/components/Toast";
import { Button, Card, PageHead } from "@/components/ui";
import { longDate } from "@/lib/format";

import { StageStatusChip } from "./Dashboard";
import { stageId } from "./demo";
import { useSeason, useSeasonDoc } from "./store";
import { Field, Input, SelectField } from "./ui";

export function Calendar() {
  const doc = useSeasonDoc();
  const { update } = useSeason();
  const toast = useToast();
  const now = new Date().toISOString();
  const stages = [...doc.stages].sort((a, b) => a.number - b.number);
  const setStage = (id: string, patch: Partial<Stage>) =>
    update((d) => ({ ...d, stages: d.stages.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const clubOptions = [
    { value: "", label: "Club à désigner" },
    ...[...doc.clubs]
      .sort((a, b) => a.city.localeCompare(b.city, "fr"))
      .map((c) => ({ value: c.id, label: `${c.city} · ${c.name}` })),
  ];
  const addStage = () => {
    const n = (stages[stages.length - 1]?.number ?? 0) + 1;
    update((d) => ({
      ...d,
      stages: [
        ...d.stages,
        {
          id: stageId(d.id, n),
          season: d.id,
          number: n,
          kind: n > 5 ? "FINALE" : "TN",
          name: n > 5 ? "Finale" : `TN ${n}`,
          clubId: null,
          city: "",
          start: "",
          end: "",
          registrationOpen: null,
          registrationClose: null,
          registrationUrl: "",
          big: 0,
          small: 0,
          djLicence: null,
          tournamentId: null,
          openedAt: null,
          closedAt: null,
        },
      ],
    }));
  };
  return (
    <>
      <PageHead
        eyebrow={`Saison ${doc.id}`}
        title="Calendrier"
        help="Pour chaque étape : club hôte, dates de compétition (vendredi → dimanche), ouverture et fermeture des inscriptions, adresse d'inscription. Choisir un club pré-remplit ville et billards."
      >
        <Button icon={Plus} onClick={addStage}>
          Ajouter une étape
        </Button>
      </PageHead>
      <div className="grid gap-3">
        {stages.map((s) => {
          const locked = Boolean(s.openedAt || s.closedAt);
          return (
            <Card
              key={s.id}
              title={
                <span className="flex items-center gap-2">
                  <span className="bg-brand grid size-7 place-items-center rounded-full font-mono text-[12px] font-bold text-white">
                    {s.number}
                  </span>
                  {s.name}
                  {s.start ? (
                    <span className="text-ink-muted font-medium"> · {longDate(s.start, true)}</span>
                  ) : null}
                </span>
              }
              aside={
                <>
                  <StageStatusChip stage={s} now={now} />
                  {!locked && stageStatus(s, now) === "a-venir" && stages.length > 1 ? (
                    <Button
                      size="sm"
                      variant="danger"
                      icon={Trash2}
                      onClick={() => {
                        if (window.confirm(`Supprimer ${s.name} du calendrier ?`)) {
                          update((d) => ({ ...d, stages: d.stages.filter((x) => x.id !== s.id) }));
                          toast("Étape supprimée");
                        }
                      }}
                    >
                      Supprimer
                    </Button>
                  ) : null}
                </>
              }
              bodyClassName="grid gap-3 px-4 pb-4 md:grid-cols-2 xl:grid-cols-4"
            >
              <Field label="Nom de l'étape">
                <Input value={s.name} onChange={(e) => setStage(s.id, { name: e.target.value })} />
              </Field>
              <Field label="Club hôte" className="xl:col-span-2">
                <SelectField
                  options={clubOptions}
                  value={s.clubId ?? ""}
                  disabled={locked}
                  onChange={(e) => {
                    const club = doc.clubs.find((c) => c.id === e.target.value);
                    setStage(s.id, {
                      clubId: club?.id ?? null,
                      city: club?.city ?? s.city,
                      big: club?.big ?? s.big,
                      small: club?.small ?? s.small,
                    });
                  }}
                />
              </Field>
              <Field label="Ville">
                <Input value={s.city} onChange={(e) => setStage(s.id, { city: e.target.value })} />
              </Field>
              <Field label="Début (vendredi)">
                <Input
                  type="date"
                  value={s.start}
                  disabled={locked}
                  onChange={(e) =>
                    setStage(s.id, {
                      start: e.target.value,
                      end: e.target.value ? sundayOf(e.target.value) : "",
                    })
                  }
                />
              </Field>
              <Field label="Fin (dimanche)">
                <Input
                  type="date"
                  value={s.end}
                  disabled={locked}
                  onChange={(e) => setStage(s.id, { end: e.target.value })}
                />
              </Field>
              <Field label="Billards 3m10">
                <Input
                  type="number"
                  min={0}
                  value={s.big}
                  disabled={locked}
                  onChange={(e) => setStage(s.id, { big: Number(e.target.value) })}
                />
              </Field>
              <Field label="Billards 2m80">
                <Input
                  type="number"
                  min={0}
                  value={s.small}
                  disabled={locked}
                  onChange={(e) => setStage(s.id, { small: Number(e.target.value) })}
                />
              </Field>
              <Field label="Ouverture des inscriptions">
                <Input
                  type="datetime-local"
                  value={s.registrationOpen ?? ""}
                  onChange={(e) => setStage(s.id, { registrationOpen: e.target.value || null })}
                />
              </Field>
              <Field label="Fermeture des inscriptions">
                <Input
                  type="datetime-local"
                  value={s.registrationClose ?? ""}
                  onChange={(e) => setStage(s.id, { registrationClose: e.target.value || null })}
                />
              </Field>
              <Field label="URL d'inscription" className="xl:col-span-2">
                <Input
                  type="url"
                  value={s.registrationUrl}
                  placeholder="https://…"
                  onChange={(e) => setStage(s.id, { registrationUrl: e.target.value })}
                />
              </Field>
            </Card>
          );
        })}
      </div>
    </>
  );
}

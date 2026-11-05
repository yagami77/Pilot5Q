/** Base des clubs hôtes : liste, ajout, modification, suppression. */
import { capacityFor, hostCapable, type HostClub } from "@pilot5q/domain";
import { MapPin, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import { useToast } from "@/components/Toast";
import { Avatar, Button, Card, Chip, PageHead } from "@/components/ui";

import { useSeason, useSeasonDoc } from "./store";
import { Empty, Field, Input, Num, Row, Table } from "./ui";

function blank(): HostClub {
  return {
    id: `club-${Date.now().toString(36)}`,
    name: "",
    ffbNumber: "",
    address: "",
    postcode: "",
    city: "",
    phone: "",
    email: "",
    lat: null,
    lng: null,
    big: 3,
    small: 5,
  };
}

export function Clubs() {
  const doc = useSeasonDoc();
  const { update } = useSeason();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<HostClub | null>(null);
  const clubs = [...doc.clubs].sort((a, b) => a.city.localeCompare(b.city, "fr"));
  const edit = (c: HostClub) => {
    setSelected(c.id);
    setDraft({ ...c });
  };
  const save = () => {
    if (!draft) return;
    if (draft.name.trim() === "" || draft.city.trim() === "") {
      toast("Nom et ville sont nécessaires");
      return;
    }
    update((d) => ({
      ...d,
      clubs: d.clubs.some((c) => c.id === draft.id)
        ? d.clubs.map((c) => (c.id === draft.id ? draft : c))
        : [...d.clubs, draft],
    }));
    setSelected(draft.id);
    toast("Club enregistré");
  };
  const remove = (id: string) => {
    if (!window.confirm("Supprimer ce club de la base ?")) return;
    update((d) => ({
      ...d,
      clubs: d.clubs.filter((c) => c.id !== id),
      stages: d.stages.map((s) => (s.clubId === id ? { ...s, clubId: null } : s)),
    }));
    setSelected(null);
    setDraft(null);
    toast("Club supprimé");
  };
  const set = <K extends keyof HostClub>(k: K, v: HostClub[K]) =>
    setDraft((prev) => (prev ? { ...prev, [k]: v } : prev));
  return (
    <>
      <PageHead
        eyebrow={`Saison ${doc.id}`}
        title="Clubs hôtes"
        help="Un club hôte doit disposer d'au moins 8 billards dont 3 de 3m10 (SPEC §1). Les billards du club pré-remplissent chaque étape qu'il accueille."
      >
        <Button variant="primary" icon={Plus} onClick={() => edit(blank())}>
          Ajouter un club
        </Button>
      </PageHead>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Card title={`${clubs.length} clubs`} bodyClassName="p-3 pt-0">
          {clubs.length === 0 ? (
            <Empty icon={MapPin}>Aucun club : ajoutez le premier club hôte.</Empty>
          ) : (
            <Table head={["Club", "Ville", "N° FFB", "3m10", "2m80", "Capacité"]}>
              {clubs.map((c) => {
                const cap = hostCapable(c.big, c.small, doc.settings);
                return (
                  <Row key={c.id} onClick={() => edit(c)} active={selected === c.id}>
                    <td>
                      <span className="flex items-center gap-2">
                        <Avatar name={c.name || "?"} size="xs" />
                        <span className="font-semibold">{c.name}</span>
                      </span>
                    </td>
                    <td>
                      {c.city}
                      {c.postcode ? <span className="text-ink-muted"> · {c.postcode}</span> : null}
                    </td>
                    <td>
                      <Num>{c.ffbNumber}</Num>
                    </td>
                    <td>
                      <Num>{c.big}</Num>
                    </td>
                    <td>
                      <Num>{c.small}</Num>
                    </td>
                    <td>
                      {cap.ok ? (
                        <Chip tone="green">
                          {capacityFor(c.big + c.small, doc.settings)} joueurs
                        </Chip>
                      ) : (
                        <Chip tone="red">{cap.reason}</Chip>
                      )}
                    </td>
                  </Row>
                );
              })}
            </Table>
          )}
        </Card>
        <Card
          title={
            draft
              ? doc.clubs.some((c) => c.id === draft.id)
                ? "Modifier le club"
                : "Nouveau club"
              : "Fiche club"
          }
          bodyClassName="flex flex-col gap-3 p-4 pt-0"
        >
          {!draft ? (
            <Empty icon={MapPin}>Sélectionnez un club pour le modifier.</Empty>
          ) : (
            <>
              <Field label="Nom du club">
                <Input value={draft.name} onChange={(e) => set("name", e.target.value)} autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Numéro FFB">
                  <Input
                    value={draft.ffbNumber}
                    onChange={(e) => set("ffbNumber", e.target.value)}
                    placeholder="13240"
                  />
                </Field>
                <Field label="Téléphone">
                  <Input value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
                </Field>
              </div>
              <Field label="Adresse">
                <Input value={draft.address} onChange={(e) => set("address", e.target.value)} />
              </Field>
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <Field label="Code postal">
                  <Input value={draft.postcode} onChange={(e) => set("postcode", e.target.value)} />
                </Field>
                <Field label="Ville">
                  <Input value={draft.city} onChange={(e) => set("city", e.target.value)} />
                </Field>
              </div>
              <Field label="Email">
                <Input
                  type="email"
                  value={draft.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude">
                  <Input
                    type="number"
                    step="0.0001"
                    value={draft.lat ?? ""}
                    onChange={(e) =>
                      set("lat", e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                </Field>
                <Field label="Longitude">
                  <Input
                    type="number"
                    step="0.0001"
                    value={draft.lng ?? ""}
                    onChange={(e) =>
                      set("lng", e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Billards 3m10">
                  <Input
                    type="number"
                    min={0}
                    value={draft.big}
                    onChange={(e) => set("big", Number(e.target.value))}
                  />
                </Field>
                <Field label="Billards 2m80 / 2m60">
                  <Input
                    type="number"
                    min={0}
                    value={draft.small}
                    onChange={(e) => set("small", Number(e.target.value))}
                  />
                </Field>
              </div>
              {(() => {
                const cap = hostCapable(draft.big, draft.small, doc.settings);
                return cap.ok ? null : <Chip tone="red">{cap.reason}</Chip>;
              })()}
              <div className="mt-1 flex flex-wrap gap-2">
                <Button variant="primary" icon={Save} onClick={save}>
                  Enregistrer
                </Button>
                {doc.clubs.some((c) => c.id === draft.id) ? (
                  <Button variant="danger" icon={Trash2} onClick={() => remove(draft.id)}>
                    Supprimer
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDraft(null);
                    setSelected(null);
                  }}
                >
                  Fermer
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

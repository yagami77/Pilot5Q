/** Base historique des joueurs : recherche, édition, ajout. */
import { normalizeLicence, normalizeName, searchPlayers, type PlayerRecord } from "@pilot5q/domain";
import { Download, Plus, Save, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { useToast } from "@/components/Toast";
import { Avatar, Button, Card, Chip, PageHead } from "@/components/ui";
import { clubShort, nice } from "@/lib/format";

import { useSeason, useSeasonDoc } from "./store";
import { Empty, Field, Input, Num, Row, Table, downloadText } from "./ui";

const PAGE = 60;

export function Players() {
  const doc = useSeasonDoc();
  const { update } = useSeason();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [draft, setDraft] = useState<PlayerRecord | null>(null);
  const [isNew, setIsNew] = useState(false);
  const juniors = useMemo(() => new Set(doc.juniors), [doc.juniors]);
  const found = useMemo(() => {
    const list = searchPlayers(doc.players, query);
    return [...list].sort(
      (a, b) =>
        (a.currentPlace ?? 9999) - (b.currentPlace ?? 9999) || a.name.localeCompare(b.name, "fr"),
    );
  }, [doc.players, query]);
  const save = () => {
    if (!draft) return;
    const licence = normalizeLicence(draft.licence);
    const name = normalizeName(draft.name);
    if (licence === "" || name === "") {
      toast("Licence et nom sont nécessaires");
      return;
    }
    if (isNew && doc.players.some((p) => p.licence === licence)) {
      toast("Cette licence existe déjà");
      return;
    }
    const record = { ...draft, licence, name };
    update((d) => ({
      ...d,
      players: isNew
        ? [...d.players, record]
        : d.players.map((p) => (p.licence === draft.licence ? record : p)),
      juniors: record.junior
        ? [...new Set([...d.juniors, licence])]
        : d.juniors.filter((l) => l !== licence),
    }));
    setDraft(null);
    toast("Joueur enregistré");
  };
  const exportCsv = () => {
    const head =
      "Licence;Nom;Club;Classement en cours;Dernier classement;Saison du dernier classement;U21";
    const lines = doc.players.map((p) =>
      [
        p.licence,
        p.name,
        p.club,
        p.currentPlace ?? "",
        p.lastPlace ?? "",
        p.lastSeason ?? "",
        juniors.has(p.licence) ? "oui" : "",
      ].join(";"),
    );
    downloadText(`base-joueurs-${doc.id}.csv`, [head, ...lines].join("\n"));
  };
  return (
    <>
      <PageHead
        eyebrow={`Saison ${doc.id}`}
        title="Base joueurs"
        help="Licence (clé), nom, club, classement en cours (vide si absent des 5 derniers TN), dernier classement et saison du dernier classement. Mise à jour automatique à chaque clôture de TN."
      >
        <Button icon={Download} onClick={exportCsv}>
          Export CSV
        </Button>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => {
            setIsNew(true);
            setDraft({
              licence: "",
              name: "",
              club: "",
              lastSeason: null,
              currentPlace: null,
              lastPlace: null,
            });
          }}
        >
          Ajouter un joueur
        </Button>
      </PageHead>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card
          title={`${found.length} joueur${found.length > 1 ? "s" : ""}`}
          aside={
            <input
              className="field w-[260px]"
              placeholder="Rechercher nom, club, licence…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              aria-label="Rechercher un joueur"
            />
          }
          bodyClassName="p-3 pt-0"
        >
          {found.length === 0 ? (
            <Empty icon={Users}>Aucun joueur ne correspond.</Empty>
          ) : (
            <>
              <Table
                head={["Joueur", "Club", "Licence", "Classement", "Dernier", "Saison", ""]}
                dense
              >
                {found.slice(0, limit).map((p) => (
                  <Row
                    key={p.licence}
                    onClick={() => {
                      setIsNew(false);
                      setDraft({ ...p, junior: juniors.has(p.licence) });
                    }}
                    active={draft?.licence === p.licence}
                  >
                    <td>
                      <span className="flex items-center gap-2">
                        <Avatar name={p.name} size="xs" />
                        <span className="font-semibold">{nice(p.name)}</span>
                      </span>
                    </td>
                    <td className="text-ink-muted">{clubShort(p.club)}</td>
                    <td>
                      <Num>{p.licence}</Num>
                    </td>
                    <td>
                      {p.currentPlace !== null ? (
                        <Num className="text-brand font-bold">{p.currentPlace}</Num>
                      ) : (
                        <span className="text-ink-muted">–</span>
                      )}
                    </td>
                    <td>
                      <Num>{p.lastPlace ?? "–"}</Num>
                    </td>
                    <td className="text-ink-muted">{p.lastSeason ?? "–"}</td>
                    <td>{juniors.has(p.licence) ? <Chip tone="gold">U21</Chip> : null}</td>
                  </Row>
                ))}
              </Table>
              {found.length > limit ? (
                <div className="mt-3 text-center">
                  <Button size="sm" onClick={() => setLimit(limit + PAGE)}>
                    Afficher {Math.min(PAGE, found.length - limit)} de plus
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </Card>
        <Card
          title={draft ? (isNew ? "Nouveau joueur" : "Modifier le joueur") : "Fiche joueur"}
          bodyClassName="flex flex-col gap-3 p-4 pt-0"
        >
          {!draft ? (
            <Empty icon={Users}>Sélectionnez un joueur pour le modifier.</Empty>
          ) : (
            <>
              <Field label="Licence" hint="Clé du joueur : 6 chiffres et une lettre">
                <Input
                  value={draft.licence}
                  disabled={!isNew}
                  onChange={(e) => setDraft({ ...draft, licence: e.target.value })}
                />
              </Field>
              <Field label="Nom prénom">
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Club">
                <Input
                  value={draft.club}
                  onChange={(e) => setDraft({ ...draft, club: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Classement en cours">
                  <Input
                    type="number"
                    min={1}
                    value={draft.currentPlace ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        currentPlace: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Dernier classement">
                  <Input
                    type="number"
                    min={1}
                    value={draft.lastPlace ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        lastPlace: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Saison du dernier classement">
                <Input
                  value={draft.lastSeason ?? ""}
                  placeholder="2025-2026"
                  onChange={(e) => setDraft({ ...draft, lastSeason: e.target.value || null })}
                />
              </Field>
              <label className="flex items-center gap-2 text-[13px] font-semibold">
                <input
                  type="checkbox"
                  checked={Boolean(draft.junior)}
                  onChange={(e) => setDraft({ ...draft, junior: e.target.checked })}
                />
                Junior (U21) cette saison
              </label>
              <div className="mt-1 flex flex-wrap gap-2">
                <Button variant="primary" icon={Save} onClick={save}>
                  Enregistrer
                </Button>
                {!isNew ? (
                  <Button
                    variant="danger"
                    icon={Trash2}
                    onClick={() => {
                      if (!window.confirm("Supprimer ce joueur de la base ?")) return;
                      update((d) => ({
                        ...d,
                        players: d.players.filter((p) => p.licence !== draft.licence),
                      }));
                      setDraft(null);
                      toast("Joueur supprimé");
                    }}
                  >
                    Supprimer
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={() => setDraft(null)}>
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

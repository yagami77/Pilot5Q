/**
 * Informations aux joueurs : le DJ rédige la logistique (accès, horaires), l'hébergement et
 * la restauration ; aperçu de l'email, destinataires (emails des inscrits connus), copie du
 * message et des adresses. L'envoi réel et la notification 5 Quilles viendront avec le serveur.
 */
import { Check, Copy, FileText, Mail, Server, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/Toast";
import { Button, Card, Chip, PageHead, cx } from "@/components/ui";
import { useDjMeta } from "@/lib/djMeta";
import { dateRange, nice, plural } from "@/lib/format";
import { useTournament } from "@/store/tournament";

const TEMPLATE = `Logistique
- Adresse de la salle : …
- Parking : …
- Convocations : vendredi 10h30, samedi et dimanche 8h30.

Hébergement
- Hôtels conseillés à proximité : …

Restauration
- Buvette sur place, repas du midi : …
- Réservation conseillée auprès du club : …`;

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function Informations({ readOnly = false }: { readOnly?: boolean }) {
  const { state, id } = useTournament();
  const toast = useToast();
  const [meta, update] = useDjMeta(id);
  const info = state.info;
  const defaultSubject = info ? `${info.name} · ${info.city} : informations pratiques` : "";
  const [subject, setSubject] = useState(meta.info.subject || defaultSubject);
  const [text, setText] = useState(meta.info.text);
  const loaded = useRef(false);
  // Le suivi arrive d'IndexedDB après le premier rendu
  useEffect(() => {
    if (loaded.current) return;
    if (meta.info.updatedAt || meta.info.text) {
      loaded.current = true;
      setText(meta.info.text);
      setSubject(meta.info.subject || defaultSubject);
    }
  }, [meta.info, defaultSubject]);
  // Enregistrement automatique (léger délai)
  useEffect(() => {
    if (readOnly) return;
    if (text === meta.info.text && subject === (meta.info.subject || defaultSubject)) return;
    const t = window.setTimeout(() => {
      loaded.current = true;
      void update((m) => ({ ...m, info: { text, subject, updatedAt: new Date().toISOString() } }));
    }, 500);
    return () => window.clearTimeout(t);
  }, [text, subject, readOnly, update, meta.info, defaultSubject]);

  const recipients = useMemo(
    () =>
      state.players
        .filter((p) => p.email && p.email.includes("@"))
        .map((p) => ({ name: p.name, email: p.email! })),
    [state.players],
  );
  const missing = state.players.length - recipients.length;
  const greeting = "Bonjour à toutes et à tous,";
  const intro = info
    ? `Voici les informations pratiques du ${info.name} de ${info.city} (${dateRange(info.dates[0], info.dates[1])}), organisé par le ${info.club}.`
    : "";
  const signature = info ? `Le directeur de jeu · ${info.club}` : "Le directeur de jeu";
  const full = [greeting, "", intro, "", text.trim(), "", "Sportivement,", signature]
    .filter((x, i, a) => !(x === "" && a[i - 1] === ""))
    .join("\n");

  return (
    <section className="cascade">
      <PageHead
        eyebrow={info ? `${info.name} · ${info.city}` : "Tournoi"}
        title="Informations aux joueurs"
        help="Logistique, hébergement et restauration : rédigez une fois, copiez dans votre messagerie. Le texte est enregistré sur cet appareil."
      >
        <Chip tone="grey" icon={Server}>
          Envoi direct et notification 5 Quilles : avec le serveur
        </Chip>
      </PageHead>

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card
          title="Message"
          aside={
            <>
              {meta.info.updatedAt ? (
                <Chip tone="green" icon={Check}>
                  Enregistré
                </Chip>
              ) : null}
              {!readOnly ? (
                <Button
                  size="sm"
                  icon={FileText}
                  onClick={() =>
                    setText((t) => (t.trim() ? `${t.trim()}\n\n${TEMPLATE}` : TEMPLATE))
                  }
                >
                  Insérer un modèle
                </Button>
              ) : null}
            </>
          }
        >
          <div className="flex flex-col gap-2.5 px-4 pb-4">
            <label className="flex flex-col gap-1 text-[12px] font-semibold">
              Objet
              <input
                className="field"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={readOnly}
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-semibold">
              Texte (logistique, hébergement, restauration)
              <textarea
                className="field min-h-[340px] resize-y font-sans text-[13px] leading-relaxed"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={TEMPLATE}
                disabled={readOnly}
              />
            </label>
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card
            title="Aperçu de l'email"
            aside={
              <Button
                size="sm"
                icon={Copy}
                onClick={() =>
                  void copy(`${subject}\n\n${full}`).then((ok) =>
                    toast(ok ? "Message copié" : "Copie impossible : sélectionnez le texte"),
                  )
                }
              >
                Copier le message
              </Button>
            }
          >
            <div className="mx-4 mb-4 overflow-hidden rounded-[12px] border border-line">
              <div className="bg-surface-2 border-line grid gap-1 border-b px-4 py-2.5 text-[12px]">
                <div className="flex gap-2">
                  <span className="text-ink-muted w-10">De</span>
                  <b>{info?.club ?? "Club hôte"}</b>
                </div>
                <div className="flex gap-2">
                  <span className="text-ink-muted w-10">À</span>
                  <span>
                    {recipients.length
                      ? plural(recipients.length, "joueur")
                      : "les inscrits (adresses à venir)"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-ink-muted w-10">Objet</span>
                  <b className="min-w-0 truncate">{subject}</b>
                </div>
              </div>
              <div className="bg-white">
                <div className="tricolore-inline h-[3px]" aria-hidden="true" />
                <div className="px-5 py-4">
                  <div className="text-brand mb-3 flex items-center gap-2 text-[13px] font-extrabold">
                    <Mail className="size-4" aria-hidden="true" />
                    Pilot5Q · {info?.name} {info?.city}
                  </div>
                  <pre
                    className={cx(
                      "font-sans text-[13px] leading-relaxed whitespace-pre-wrap",
                      !text.trim() && "text-ink-muted",
                    )}
                  >
                    {text.trim() ? full : "Le texte du message apparaîtra ici."}
                  </pre>
                </div>
              </div>
            </div>
          </Card>

          <Card
            title={`Destinataires · ${recipients.length}`}
            aside={
              <Button
                size="sm"
                icon={Users}
                disabled={recipients.length === 0}
                onClick={() =>
                  void copy(recipients.map((r) => r.email).join(", ")).then((ok) =>
                    toast(ok ? "Adresses copiées" : "Copie impossible"),
                  )
                }
              >
                Copier les adresses
              </Button>
            }
          >
            <div className="px-4 pb-4">
              {recipients.length ? (
                <div className="flex max-h-[180px] flex-wrap gap-1.5 overflow-auto">
                  {recipients.map((r) => (
                    <span
                      key={r.email}
                      className="bg-surface-2 border-line rounded-full border px-2.5 py-[3px] text-[11.5px]"
                      title={r.email}
                    >
                      {nice(r.name)}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="text-ink-muted mt-2 text-[12px]">
                {missing > 0
                  ? `${plural(missing, "inscrit")} sans adresse email connue (l'adresse vient du fichier d'inscription fédéral).`
                  : "Tous les inscrits ont une adresse email."}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

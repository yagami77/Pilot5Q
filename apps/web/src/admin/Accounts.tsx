/**
 * Comptes des responsables nationaux, stockés dans ce navigateur (implémentation locale de
 * l'authentification) : liste, ajout, changement de mot de passe. Avec le serveur, les comptes
 * seront partagés et les mots de passe hachés côté serveur.
 */
import { KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "@/auth/context";
import type { ResponsableAccount } from "@/auth/provider";
import { useToast } from "@/components/Toast";
import { Avatar, Button, Card, Chip } from "@/components/ui";

import { Field, Input, frDateTime } from "./ui";

export function AccountsCard() {
  const { provider, session } = useAuth();
  const toast = useToast();
  const [accounts, setAccounts] = useState<ResponsableAccount[]>([]);
  const [form, setForm] = useState({ username: "", displayName: "", password: "" });
  const [password, setPassword] = useState("");
  const reload = () => void provider.listAccounts().then(setAccounts);
  useEffect(reload, [provider]);
  const me = session?.role === "responsable" ? session.username : null;

  const create = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await provider.createAccount(form.username, form.displayName, form.password);
      setForm({ username: "", displayName: "", password: "" });
      reload();
      toast("Compte créé");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Création impossible");
    }
  };
  const change = async (e: FormEvent) => {
    e.preventDefault();
    if (!me) return;
    try {
      await provider.changePassword(me, password);
      setPassword("");
      reload();
      toast("Mot de passe modifié");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Modification impossible");
    }
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="text-brand size-4" aria-hidden="true" />
          Comptes des responsables
        </span>
      }
      aside={<Chip tone="grey">stockés dans ce navigateur</Chip>}
      className="mt-4"
      bodyClassName="grid gap-4 px-4 pb-4 lg:grid-cols-3"
    >
      <ul className="flex flex-col gap-2">
        {accounts.map((a) => (
          <li
            key={a.username}
            className="border-line flex items-center gap-2.5 rounded-[12px] border px-3 py-2"
          >
            <Avatar name={a.displayName} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold">{a.displayName}</div>
              <div className="text-ink-muted font-mono text-[11.5px]">
                @{a.username} · créé le {frDateTime(a.createdAt)}
              </div>
            </div>
            {a.username === me ? <Chip tone="blue">vous</Chip> : null}
            {a.demo ? <Chip tone="gold">démo</Chip> : null}
          </li>
        ))}
      </ul>
      <form className="flex flex-col gap-2" onSubmit={(e) => void create(e)}>
        <div className="eyebrow">Ajouter un compte</div>
        <Field label="Identifiant">
          <Input
            value={form.username}
            autoComplete="off"
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </Field>
        <Field label="Nom affiché">
          <Input
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </Field>
        <Field label="Mot de passe" hint="8 caractères minimum">
          <Input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Button type="submit" size="sm" icon={UserPlus} className="self-start">
          Créer le compte
        </Button>
      </form>
      <form className="flex flex-col gap-2" onSubmit={(e) => void change(e)}>
        <div className="eyebrow">Mon mot de passe</div>
        <Field
          label="Nouveau mot de passe"
          hint="Changer le mot de passe du compte de démonstration le retire de l'écran de connexion."
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" size="sm" icon={KeyRound} className="self-start" disabled={!me}>
          Modifier
        </Button>
        <p className="text-ink-muted mt-auto text-[11.5px]">
          Prototype : ces comptes ne protègent que l'accès depuis ce navigateur. Comptes partagés et
          sécurité réelle avec le serveur.
        </p>
      </form>
    </Card>
  );
}

/**
 * Saisie d'un arbitre par licence (dimanche) : le nom est retrouvé parmi les joueurs du tournoi
 * et la base joueurs de la saison ; suggestions par début de licence ou par nom. La valeur est
 * enregistrée à la validation (Entrée, perte du focus ou choix d'une suggestion).
 */
import { Check, UserRound } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { findByLicence, searchPeople, type KnownPerson } from "@/lib/arbitres";
import { nice } from "@/lib/format";

import { cx } from "./ui";

export function ArbitreField({
  label,
  value,
  people,
  onCommit,
  disabled,
}: {
  label: string;
  value: string | null | undefined;
  people: KnownPerson[];
  onCommit: (licence: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value ?? "");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  // Valeur changée ailleurs (annulation, autre onglet) : on la reprend hors saisie
  useEffect(() => {
    if (!focused) setText(value ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const found = findByLicence(people, text);
  const suggestions = focused && !found ? searchPeople(people, text, 5) : [];

  const commit = (licence: string) => {
    const v = licence.trim();
    setText(v);
    if (v !== (value ?? "")) onCommit(v);
  };
  const choose = (p: KnownPerson) => {
    commit(p.licence);
    setFocused(false);
  };

  return (
    <div className="relative min-w-0">
      <label className="flex min-w-0 items-center gap-2">
        <span className="text-ink-muted w-[62px] shrink-0 text-[10.5px] font-bold tracking-[0.04em] uppercase">
          {label}
        </span>
        <input
          className={cx(
            "field h-8 w-[104px] shrink-0 px-2 py-0 font-mono text-[12px]",
            text && !found && !focused && "border-gold",
          )}
          placeholder="n° licence"
          aria-label={`${label} : numéro de licence`}
          aria-autocomplete="list"
          aria-controls={suggestions.length ? listId : undefined}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Laisse le temps au clic sur une suggestion
            window.setTimeout(() => setFocused(false), 120);
            commit(text);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && suggestions.length) {
              e.preventDefault();
              setActive((a) => (a + 1) % suggestions.length);
            } else if (e.key === "ArrowUp" && suggestions.length) {
              e.preventDefault();
              setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              const s = suggestions[active];
              if (s) choose(s);
              else commit(text);
            }
          }}
        />
        <span
          className={cx(
            "flex min-w-0 flex-1 items-center gap-1 text-[12px]",
            found ? "text-ok-ink font-semibold" : "text-ink-muted",
          )}
          aria-live="polite"
        >
          {found ? (
            <>
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate" title={`${nice(found.name)} · ${found.club}`}>
                {nice(found.name)}
              </span>
            </>
          ) : text.trim() && !focused ? (
            <span className="text-gold-ink truncate">Licence inconnue</span>
          ) : focused ? (
            <span className="truncate">licence ou nom</span>
          ) : null}
        </span>
      </label>
      {suggestions.length ? (
        <ul
          id={listId}
          role="listbox"
          className="bg-surface border-line shadow-raised absolute top-full right-0 left-[70px] z-40 mt-1 overflow-hidden rounded-[10px] border py-1"
        >
          {suggestions.map((p, i) => (
            <li
              key={p.licence}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(p);
              }}
              className={cx(
                "flex cursor-pointer items-center gap-2 px-2.5 py-1 text-[12px]",
                i === active ? "bg-brand-soft" : "hover:bg-surface-2",
              )}
            >
              <UserRound className="text-ink-muted size-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-semibold">{nice(p.name)}</span>
              <span className="text-ink-muted font-mono text-[10.5px]">{p.licence}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

import type { TournamentEvent } from "@pilot5q/domain";
import { describe, expect, it } from "vitest";

import { findByLicence, knownPeople, normLicence, searchPeople } from "./arbitres";
import { demoEvents } from "./demo";
import { replay } from "./engine";

const at = "2026-11-01T09:00:00.000Z";
const state = replay(demoEvents().map((e) => ({ ...e, at }) as TournamentEvent));
const first = state.players[0]!;

describe("arbitres : licence → nom", () => {
  it("retrouve un joueur du tournoi par sa licence, sans tenir compte des espaces ni de la casse", () => {
    const people = knownPeople(state);
    expect(people).toHaveLength(state.players.length);
    const lic = ` ${first.licence.toLowerCase()} `;
    expect(normLicence(lic)).toBe(first.licence.toUpperCase());
    expect(findByLicence(people, lic)).toMatchObject({ name: first.name, source: "tournoi" });
    expect(findByLicence(people, "000000Z")).toBeNull();
    expect(findByLicence(people, "")).toBeNull();
  });

  it("complète avec la base joueurs de la saison, sans doublon", () => {
    const people = knownPeople(state, [
      { licence: first.licence, name: "AUTRE NOM", club: "X" },
      { licence: "999001A", name: "ARBITRE CLUB", club: "BC Hôte" },
    ]);
    expect(people).toHaveLength(state.players.length + 1);
    expect(findByLicence(people, first.licence)?.name).toBe(first.name);
    expect(findByLicence(people, "999001a")).toMatchObject({
      name: "ARBITRE CLUB",
      source: "saison",
    });
  });

  it("suggestions : début de licence, puis nom sans accents", () => {
    const people = knownPeople(state, [{ licence: "999001A", name: "ÉLODIE ARBITRE", club: "" }]);
    expect(searchPeople(people, first.licence.slice(0, 5))[0]?.licence.slice(0, 5)).toBe(
      first.licence.slice(0, 5),
    );
    expect(searchPeople(people, "elodie").map((p) => p.licence)).toEqual(["999001A"]);
    expect(searchPeople(people, "e")).toEqual([]);
  });
});

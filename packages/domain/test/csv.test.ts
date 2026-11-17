import { describe, expect, it } from "vitest";

import { fixMojibake, orderParticipants, parseInscritsCsv } from "../src/index.js";
import type { Player } from "../src/index.js";

const header =
  "id;date;licence;email;id_evenement;forfait;cle;paye;actif;prenom_licencie;nom_licencie;nom_club;num_club;nom_ligue;date_debut_evenement;date_fin_evenement;saison;etat";

const csv =
  "﻿" +
  [
    header,
    '12;03/09/2026 18:45;123456a;alice.martin@example.test;7;;k1;1;1;Alice;"Martin; Dupont";BC Exemple;10;Ligue Nord;30/10/2026;01/11/2026;2026-2027;Enregistrée',
    "13;02/09/2026 09:10;234567B;bob.durand@example.test;7;;k2;1;1;Bob;Durand;Cercle de billard d'Exemple;11;Ligue Nord;30/10/2026;01/11/2026;2026-2027;EnregistrÃ©e",
    "14;04/09/2026 10:00;345678C;chloe.petit@example.test;7;;k3;0;1;Chloé;Petit;BC Exemple;10;Ligue Nord;30/10/2026;01/11/2026;2026-2027;Annulée",
    "15;05/09/2026 10:00;456789D;dan.roux@example.test;7;05/09/2026;k4;0;1;Dan;Roux;BC Exemple;10;Ligue Nord;30/10/2026;01/11/2026;2026-2027;Enregistrée",
    "16;02/09/2026 09:10;234567B;bob.durand@example.test;7;;k2;1;1;Bob;Durand;Cercle de billard d'Exemple;11;Ligue Nord;30/10/2026;01/11/2026;2026-2027;Enregistrée",
  ].join("\r\n") +
  "\r\n";

describe("parseInscritsCsv", () => {
  const players = parseInscritsCsv(csv);

  it("ignore les inscriptions non enregistrées, les forfaits et les doublons de licence", () => {
    expect(players.map((p) => p.licence)).toEqual(["234567B", "123456A"]);
  });

  it("produit NOM PRENOM en majuscules, club, email, seed par ordre d'inscription", () => {
    expect(players[0]).toEqual({
      licence: "234567B",
      name: "DURAND BOB",
      club: "Cercle de billard d'Exemple",
      email: "bob.durand@example.test",
      seed: 1,
      place: null,
    });
    expect(players[1]).toMatchObject({
      name: "MARTIN; DUPONT ALICE",
      club: "BC Exemple",
      seed: 2,
      place: null,
    });
  });

  it("répare les accents mal encodés", () => {
    expect(fixMojibake("EnregistrÃ©e")).toBe("Enregistrée");
    expect(fixMojibake("Déjà correct")).toBe("Déjà correct");
    expect(fixMojibake("ChloÃ«")).toBe("Chloë");
  });

  it("lit la catégorie de licence (U21), la date de naissance et garde les inscriptions en attente", () => {
    // Entête de l'export fédéral de novembre 2026 : deux colonnes en plus, « ; » final,
    // dates ISO, licences parfois en minuscules, champs entre guillemets.
    const text = [
      "id;date;licence;email;id_evenement;forfait;cle;paye;actif;prenom_licencie;nom_licencie;date_naissance_licencie;categorie_licencie;nom_club;num_club;nom_ligue;date_debut_evenement;date_fin_evenement;saison;etat;",
      '"3";"2026-10-08 16:37:53";"111111a";"a@example.test";"1";"";"k";"non";"oui";"ANN";"JUNIOR";"";"-21 ans";"BC Exemple";"10";"L";"2026-10-30 00:00:00";"2026-11-01 00:00:00";"2026-2027";"Enregistrée"',
      '"2";"2026-10-07 09:00:00";"222222B";"b@example.test";"1";"";"k";"non";"non";"BOB";"ATTENTE";"14/03/1980";"+21 ans";"BC Exemple";"10";"L";"2026-10-30 00:00:00";"2026-11-01 00:00:00";"2026-2027";"En attente"',
      '"1";"2026-10-06 09:00:00";"333333C";"c@example.test";"1";"";"k";"non";"oui";"CAT";"ANNULEE";"";"+21 ans";"BC Exemple";"10";"L";"2026-10-30 00:00:00";"2026-11-01 00:00:00";"2026-2027";"Annulée"',
    ].join("\n");
    const list = parseInscritsCsv(text);
    expect(list.map((p) => [p.licence, p.name, p.seed])).toEqual([
      ["222222B", "ATTENTE BOB", 1],
      ["111111A", "JUNIOR ANN", 2],
    ]);
    expect(list[0]).toMatchObject({ junior: false, pending: true, birthDate: "1980-03-14" });
    expect(list[1]).toMatchObject({ junior: true });
    expect(list[1]?.pending).toBeUndefined();
    expect(list[1]?.birthDate).toBeUndefined();
  });

  it("accepte un ordre de colonnes différent et un fichier vide", () => {
    const text =
      "licence;nom_licencie;prenom_licencie;etat;date;nom_club\nx1;Zed;Ann;Enregistrée;01/01/2026 10:00;C\n";
    expect(parseInscritsCsv(text)[0]).toMatchObject({ licence: "X1", name: "ZED ANN", club: "C" });
    expect(parseInscritsCsv("")).toEqual([]);
  });
});

describe("orderParticipants", () => {
  const p = (licence: string, seed: number): Player => ({
    licence,
    name: `N ${licence}`,
    club: "C",
    seed,
    place: null,
  });
  it("classement glissant, puis base joueurs (9 si P ≤ 8, sinon P + 0,5), puis nouveaux", () => {
    const players = [
      p("NEW2", 1),
      p("G12", 2),
      p("K5", 3),
      p("NEW1", 4),
      p("K20", 5),
      p("G3", 6),
      p("G9", 7),
    ];
    const ranking = { G12: 12, G3: 3, G9: 9 };
    const lastKnown = { K5: { place: 5, season: 2025 }, K20: { place: 20, season: 2024 } };
    const ordered = orderParticipants(players, ranking, lastKnown);
    expect(ordered.map((x) => x.licence)).toEqual(["G3", "G9", "K5", "G12", "K20", "NEW2", "NEW1"]);
    expect(ordered.map((x) => x.seed)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(ordered.map((x) => x.place)).toEqual([3, 9, 9, 12, 20.5, null, null]);
    expect(ordered[2]?.lastSeason).toBe(2025);
  });
});

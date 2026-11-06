# Pilot5Q — Spécification fonctionnelle (V1)

Application web de gestion des **Tournois Nationaux (TN) de billard 5-Quilles** (FFB). Elle remplace un classeur Excel/VBA. Deux rôles : **responsable national** et **directeur de jeu (DJ)** du club hôte. Langue de l'interface : français.

La V1 vise le cockpit du DJ sur un tournoi complet, avec des données d'exemple, le tout dans le navigateur (aucun serveur). Le responsable national viendra ensuite.

## 1. Vocabulaire

- **TN** : tournoi national, 3 jours (vendredi, samedi, dimanche). 5 TN par saison.
- **DJ** : directeur de jeu du club hôte.
- **PREQ** : préqualifications du vendredi (poules). **B** : barrages du vendredi. **Q N / Q M** : qualifications National / Masters du samedi (poules). **N / M** : phases finales National / Masters. **CLS** : consolante (tournoi de classement, élimination directe).
- **Serpentin** : répartition des joueurs en poules en zigzag (1→n puis n→1…).
- **Classement glissant** : classement national sur les 5 derniers TN. **Base joueurs** : dernier classement connu de chaque joueur.
- **Points de match (Pm)** : 2 par victoire. **Points de set (Ps)** : gagnant = max sets possibles − sets subis ; perdant = sets gagnés. **Moyenne** : points faits / points subis.
- **Triangulaire** : 3 joueurs ou plus à égalité de points de match.
- **Billards** : 3m10 (grands) et 2m80 (petits). Un club doit avoir ≥ 8 billards dont ≥ 3 de 3m10.

## 2. Avant le tournoi

- Capacité : `N_billards × 8 + 8`, plafonnée à 100. Au-delà : liste d'attente (priorité aux 34 premiers du classement, puis ordre d'inscription).
- Inscrits : fichier CSV du site fédéral, séparateur `;`, colonnes `id;date;licence;email;id_evenement;forfait;cle;paye;actif;prenom_licencie;nom_licencie;nom_club;num_club;nom_ligue;date_debut_evenement;date_fin_evenement;saison;etat`. Champs utiles : `date` (horodatage d'inscription), `licence` (identifiant unique), `prenom_licencie`, `nom_licencie`, `nom_club`, `email`.
- **Liste ordonnée des participants** (ordre du serpentin). Pour chaque inscrit, une *place* :
  1. présent au classement glissant → sa place `P` ;
  2. sinon, connu dans la base joueurs avec un dernier classement `P` → place `9` si `P ≤ 8`, sinon `P + 0,5` ;
  3. sinon, nouveau joueur → fin de liste, dans l'ordre d'inscription.
  Tri croissant par place. Les **8 premiers** sont préqualifiés Masters et ne jouent pas le vendredi.
- Juniors (U21) : exemptés du droit d'inscription (30 €). À signaler sur la liste de pointage.

## 3. Jeudi : billards et poules

- Le DJ numérote ses billards (type 3m10 / 2m80).
- Tirage des billards pour : les poules du vendredi (en général 2 poules par billard, la poule au numéro le plus élevé commence), les 8 barrages, les poules 1 à 4 du National (la 8 joue avec la 1, la 7 avec la 2, la 6 avec la 3, la 5 avec la 4), les 4 poules Masters (sur 3m10), les quarts National et Masters. Tirage aléatoire, modifiable à la main. **Les poules fortes ne sont pas prioritaires sur les 3m10.** Répartition des poules de 3 entre formats (précision du client du 7 novembre, qui remplace le « une poule de 4 et une poule de 3 sur les premiers billards » du livret) : 1 poule de 3 → de préférence sur un 3m10 (un 2m80 reste acceptable) ; 2 → une sur un 3m10, une sur un 2m80 ; 3 avec des formats en nombre comparable → deux sur des 3m10 et une sur un 2m80 ; s'il y a au moins 1,5 fois plus de 2m80 que de 3m10 → l'inverse.
- **Création des poules du vendredi** : joueurs 9 à n de la liste ordonnée, serpentin, poules de 4, au plus 3 poules de 3. **Les poules de 3 sont les premières (poules 1 à k)** : c'est la règle de l'outil Excel de référence (une poule est de 3 si son numéro est inférieur ou égal au nombre de poules de 3) et du livret (« la poule au numéro le plus élevé joue en premier, de cette façon les poules de 4 commenceront nécessairement avant les poules de 3 »). Au dernier passage du serpentin, ce sont donc les joueurs les plus faibles du tirage qui manquent, et les têtes de série 1 à k jouent un match de moins.
- **Contrainte club** : jamais 3 joueurs du même club dans une poule. Résolution : décaler le moins bien classé des trois d'un cran vers le bas dans la liste du serpentin, répéter ; si impossible, signaler et laisser corriger à la main. S'applique au vendredi et aux poules Masters du samedi, pas au National.
- Documents : tableau des poules, liste alphabétique des joueurs avec poule et billard, liste des premiers matchs par billard, feuilles de match, **liste alphabétique de pointage des droits d'inscription** (case à cocher, Masters en évidence car ils paient le samedi, U21 signalés).

## 4. Vendredi : préqualifications et barrages

- Ordre des matchs d'une poule de 4 : 2–3, 1–4, perdants, gagnants, dernier match de 4, dernier match de 1. Poule de 3 : 2–3, 1–gagnant, dernier. Les joueurs qui ne jouent pas arbitrent.
- Distance : 1 set à 100. Saisie : uniquement les points de chaque joueur ; un match valide a exactement un joueur à 100 et l'autre entre 0 et 99.
- Forfait avant le début (après tirage) : poule de 4 → poule de 3, les autres poules ne bougent pas ; 2 forfaits dans une poule de 4 ou 1 dans une poule de 3 → retirage des poules. Abandon après le début : sans match joué → comme un forfait ; avec matchs joués → ses matchs sont annulés, la poule devient une poule de 3. Un forfait ne marque aucun point.
- **Classement d'une poule** : 1) Pm ; 2) égalité à **deux** → match direct ; 3) égalité à plus de deux → Ps, puis moyenne, puis ordre d'arrivée (place dans la liste ordonnée). Poule de 3 : +2 Pm et +1 Ps à chacun avant le classement de phase ; moyenne réelle.
- **Classement de phase** : rang dans la poule, Pm, Ps, moyenne, ordre d'arrivée.
- **Barrages** : places 1 à 16 → 8 matchs `1–16, 2–15, … 8–9`, 1 set à 100. Vainqueurs → Masters ; perdants + places 17 à 40 → National (32) ; places ≥ 41 → consolante sur volontariat.
- Documents : résultats et classement des poules, tableau et feuilles des barrages, feuille de pointage des volontaires consolante ; après les barrages : résultats des barrages, poules National et Masters, feuilles de match du samedi, tours de jeu Masters s'il n'y a que 3 billards 3m10.

## 5. Samedi

- **Masters** : 8 préqualifiés + 8 vainqueurs de barrage, serpentin dans l'ordre de la liste des participants, contrainte club, 4 poules de 4, 2 sets gagnants à 60, billards 3m10. Quarts prédéfinis : `Q1 = 1er P1 vs 2e P4`, `Q2 = 1er P3 vs 2e P2`, `Q3 = 1er P4 vs 2e P1`, `Q4 = 1er P2 vs 2e P3` ; demies `Q1–Q2`, `Q3–Q4`.
- **National** : 32 joueurs (8 perdants de barrage puis places 17 à 40), serpentin, 8 poules de 4, 1 set à 100, sans contrainte club. Huitièmes prédéfinis dans la foulée : `1er P1–2e P8`, `2e P1–1er P8`, `1er P2–2e P7`, `2e P2–1er P7`, `1er P3–2e P6`, `2e P3–1er P6`, `1er P4–2e P5`, `2e P4–1er P5` (1 set à 100).
- Forfait avant le début d'une poule du samedi : poule de 3 ; +2 Pm et +max sets (1 National, 3 Masters) en Ps aux restants.
- **Consolante** : volontaires parmi les éliminés, dans l'ordre du classement de sortie des poules, tableau à élimination directe (max 32 ou 40 selon le paramétrage, départ en seizièmes), 1 set à 100 (ou 80). Abandon → match donné 100–66 (80–53). Uniquement si ≥ 5 billards 2m80.
- Match contre un joueur forfait/abandon : adversaire vainqueur ; points subis = moyenne des points subis par l'adversaire dans la phase précédente, ramenée à la distance en cours.

## 6. Dimanche

- Quarts, demies, finales National et Masters en 3 sets gagnants à 60. Arbitre de chaque match renseigné (numéro de licence). Pause ≥ 30 min entre deux paliers.
- Primes : cagnotte = 30 € × joueurs non juniors + 450 € FFB + 200 € club. Masters 80 % (1er 20, 2e 12, demies 8 ×2, quarts 4 ×4, 3e/4e de poule 2 ×8), National 20 % (1er 8, 2e 4, demies 2 ×2, quarts 1 ×4). Tableau visible dès le samedi pour payer les éliminés.
- Clôture : vérification, tableaux finaux, points attribués, mise à jour du classement glissant (hors V1), PDF schéma du TN.

## 7. Barème et classement glissant (source : réforme 2026-2027)

- Masters : vainqueur 80, finaliste 54, demi-finalistes 38, quarts 26, 3e de poule 18, 4e de poule 13. National : 25 / 17 / 11 / 9 / 7. Consolante et qualifications : à confirmer (3e de poule 2, 4e 1 dans l'app 5 Quilles).
- Classement glissant : 4 meilleurs résultats sur les 5 derniers TN (somme simple si moins de 5 participations). Départage par la décimale (points de set / matchs / 100).

## 8. Paramètres par défaut

| Paramètre | Valeur |
|---|---|
| Poules vendredi, barrages, National (poules et huitièmes), consolante | 1 set à 100 |
| Masters (poules) | 2 sets gagnants à 60 |
| Quarts, demies, finales | 3 sets gagnants à 60 |
| Préqualifiés Masters | 8 |
| Barrages | 16 joueurs → 8 matchs |
| National | 32 joueurs, 8 poules |
| Consolante | max 40, si ≥ 5 billards 2m80 |
| Convocations | vendredi 10h30 ; samedi et dimanche 8h30 (8h00 si 3 billards 3m10) |
| Droit d'inscription | 30 € (U21 exemptés) |

## 9. Sortie vers l'application 5 Quilles (hors V1, à prévoir)

Un JSON public en lecture seule au format de `getTNdata.php` : `{ tournoi, lieu, infos: { joueurs: [[nom, poule, billard]], poules: [["POULE n - BILLARD(S) x", j1..j4]], billards: [[n°, "POULE x", jA, jB]] }, compétitions: [{ nom: "PRE Q"|"N1 Q"|"N1 KO"|"M Q"|"M KO", nomLong, classement: [[rang, nom, ?, matchs, victoires, ptsPour, ptsContre, moyenne]], poules: [{ nom, distanceSet, matchs: [{ j1, j2, j1Status, j2Status, setsJ1, setsJ2, billard }] }] }] }`.

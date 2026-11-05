# Pilot5Q — Direction design

Référence visuelle validée par le client : la maquette interactive `pilot5q-cockpit.html` (chemin fourni dans le brief de travail ; elle n'est pas dans le dépôt). Tout écran de l'application doit en reprendre l'esprit : **orienté tâche et journée**, un seul geste principal possible à chaque étape, aucune ambiguïté sur « que dois-je faire maintenant ».

## Identité

- Thème clair uniquement. Fond `#F4F6FB`, surfaces blanches, texte `#0F1B33`, secondaire `#3C4A66`, atténué `#6B7A99`, traits `#E4E9F3`.
- Bleu signature `#0E37A8` (dégradé vers `#1E4FD8` sur les actions principales), bleu doux `#E9EFFC`. Rouge `#DC3F5A` réservé aux alertes et moments forts (`#FDE9ED` en fond). Or `#E89F1F` pour les vainqueurs et têtes de série (`#FFF4DF`). Vert `#1E9E62` pour « validé » (`#E5F6EC`).
- Fine bande tricolore (3 px) en haut de page, rien d'autre de « drapeau ».
- Typographie : **Geist** (titres 800, interface 500/600), **Geist Mono** pour les scores, classements et identifiants, chiffres tabulaires partout où des nombres s'alignent.
- Rayons 14 px (cartes) / 10 px (petits éléments), ombres très légères teintées de bleu, dégradés clairs sur les bandeaux d'action.
- Avatars ronds à initiales, couleur dérivée du nom (teinte stable), en attendant les photos.

## Structure du cockpit

1. Barre haute : marque, tournoi (logo club, nom, lieu, dates, billards, inscrits), état de synchronisation, utilisateur.
2. Rail des phases : Jeudi · Vendredi · Samedi · Dimanche, avec état (à venir, en cours, terminée, verrouillée). Les phases verrouillées expliquent pourquoi.
3. Vue de la phase : en-tête (eyebrow date, titre, phrase d'aide), chips de contexte, actions à droite. Tuiles de synthèse, puis cartes.
4. Tiroir de saisie à droite (560 px) pour une poule : matchs dans l'ordre du code sportif, arbitre indiqué, saisie clavier (Espace = 100, Tab = suivant, Échap = fermer), classement de la poule qui se réordonne en direct.
5. Bouton « Classer la phase » qui se remplit comme une jauge, actif seulement quand tout est saisi et valide.
6. Centre d'impression : liste de documents cochables selon la phase, aperçu papier.

## Mouvement (Motion / View Transitions, toujours au service du sens)

- Tirage : les joueurs se posent dans les poules un par un, dans l'ordre du serpentin (40 ms d'écart).
- Score validé : la case passe en vert ; saisie incohérente : légère vibration et rouge.
- Classement : réordonnancement animé (FLIP) des lignes.
- Changement de phase : transition continue, contenu qui monte en fondu.
- Listes de qualifiés : apparition en cascade.
- Respecter `prefers-reduced-motion`.

## Impression

Les mêmes composants rendent les documents en noir sur blanc via des feuilles de style `@media print`, format A4, sans animation : feuilles de match (en-tête tournoi, billard, distance, ordre des matchs, cases gagnant, scores, arbitre, signatures), listes, tableaux, classements, liste de pointage (Masters surlignés, U21 signalés).

# Pilot5Q

Application web de gestion des **Tournois Nationaux de billard 5-Quilles** (FFB) : cockpit du
directeur de jeu, du jeudi (billards, poules) au dimanche (finales). Tout tourne dans le navigateur,
sans serveur.

- Règles métier : [`docs/SPEC.md`](docs/SPEC.md)
- Direction design : [`docs/DESIGN.md`](docs/DESIGN.md)

## Lancer

Prérequis : Node 22 (`.nvmrc`) et pnpm 10.

```sh
pnpm install
pnpm dev          # serveur Vite de apps/web
pnpm test         # tests Vitest de tous les paquets
pnpm lint         # ESLint
pnpm typecheck    # tsc
pnpm build        # build de tous les paquets (domain puis web)
pnpm format       # Prettier
```

Un seul paquet : `pnpm --filter @pilot5q/domain test`, `pnpm --filter @pilot5q/web dev`, etc.

## Structure

```
apps/web           Interface (Vite + React 19 + Tailwind v4 + react-router)   @pilot5q/web
packages/domain    Moteur de règles, TypeScript pur, sans dépendance          @pilot5q/domain
docs/              Spécification et design
.github/workflows  CI (lint, typecheck, test, build) et déploiement GitHub Pages
```

## Déploiement

Chaque push sur `main` ou `claude/**` déploie `apps/web` sur GitHub Pages (`/Pilot5Q/`), via
`.github/workflows/deploy-pages.yml`. Le build copie `index.html` en `404.html` pour que le routage
côté client fonctionne sur Pages.

# Pilot5Q — contexte pour les agents

Application web (navigateur uniquement, pas de serveur) de gestion des Tournois Nationaux de
billard 5-Quilles (FFB). Interface en français.

## Sources de vérité

- **Règles métier** : `docs/SPEC.md` (vocabulaire, liste ordonnée, serpentin, contrainte club,
  classements, barrages, Masters/National, consolante, paramètres par défaut §8). Ne pas inventer de
  règle : en cas de doute, citer le paragraphe de SPEC.md ou signaler le point à confirmer.
- **Design** : `docs/DESIGN.md` (thème clair, couleurs, Geist / Geist Mono, bande tricolore, cockpit
  par journée, mouvement, impression A4).
- Ne pas modifier `docs/SPEC.md` ni `docs/DESIGN.md` sans demande explicite.

## Structure du monorepo (pnpm workspaces)

- `packages/domain` (`@pilot5q/domain`) : moteur de règles en TypeScript pur, **zéro dépendance
  runtime**, build `tsc` vers `dist/` (ESM). Le contrat de types est dans `src/types.ts`, les
  signatures du moteur dans `src/engine.ts` (stubs `not implemented` à remplacer). Fixture de
  référence : `test/fixtures/tn-exemple.json` (76 joueurs, 11 billards, 17 poules, classements
  attendus).
- `apps/web` (`@pilot5q/web`) : Vite 6 + React 19 + Tailwind CSS v4 (`@tailwindcss/vite`), `motion`,
  `lucide-react`, `react-router` v7 (mode déclaratif, `basename = import.meta.env.BASE_URL`),
  `idb-keyval` pour la persistance locale. Les tokens de design sont dans `src/index.css` (`@theme`).
  L'app importe `@pilot5q/domain` **directement depuis ses sources** (alias Vite + `paths` TS) :
  pas besoin de builder le domaine pour `dev`, `test` ou `typecheck`.

## Conventions

- Code (identifiants, noms de fichiers) en **anglais** ; commentaires, documentation, messages de
  commit et textes d'interface en **français**.
- TypeScript strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`) ; imports de types avec
  `import type`. Dans `packages/domain`, les imports relatifs portent l'extension `.js`.
- Prettier : `printWidth` 100, guillemets doubles, virgules finales. ESLint flat config à la
  racine (`eslint.config.js`).
- Tests : Vitest. `packages/domain` en environnement `node`, `apps/web` en `jsdom` avec
  `@testing-library/react` (setup dans `src/test/setup.ts`). Fichiers `*.test.ts(x)` à côté du code
  ou dans `test/`.
- Les fixtures contiennent les bases réelles transmises par le responsable national (joueurs,
  licences, clubs : données publiques du site fédéral) et les scores réels du TN 2 2026-2027 de
  Ronchin. Aucun email de joueur dans le dépôt.

## Commandes

```sh
pnpm install
pnpm dev                                  # apps/web
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm --filter @pilot5q/domain test        # tests du moteur
pnpm --filter @pilot5q/domain test:watch
pnpm --filter @pilot5q/web test           # tests de l'interface
pnpm --filter @pilot5q/web build          # BASE_PATH=/Pilot5Q/ en CI (GitHub Pages)
```

## CI / déploiement

- `.github/workflows/ci.yml` : lint, typecheck, test, build sur chaque push et pull request.
- `.github/workflows/deploy-pages.yml` : push sur `main` ou `claude/**` → build de `apps/web` avec
  `BASE_PATH=/Pilot5Q/` → GitHub Pages. `scripts/postbuild.mjs` copie `index.html` en `404.html`.
- `pnpm-lock.yaml` est versionné ; CI installe avec `--frozen-lockfile`.

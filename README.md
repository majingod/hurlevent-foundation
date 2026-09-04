# Hurlevent Foundation

Plateforme de gestion pour le GN **Hurlevent** (univers de Destéa, Québec).
Ce dépôt héberge Arlor, le créateur de personnage : une application web qui
guide les joueurs dans la création et la gestion de leur fiche.

## Stack

React 19 · Vite · Tailwind CSS · shadcn/ui · Supabase · Vercel · monorepo
pnpm. Le front principal vit dans `artifacts/arlor`.

## Installation

```bash
corepack enable
pnpm install
```

## Commandes

```bash
pnpm dev         # serveur de dev
pnpm build       # build de production
pnpm typecheck   # vérification TypeScript
pnpm test        # suite de tests
pnpm lint        # ESLint
```

## Variables d'environnement

Voir `artifacts/arlor/.env.example`.

## Structure des dossiers

- `artifacts/arlor/src/moteurCreation` — logique pure de création de
  personnage.
- `artifacts/arlor/src/creation` — clients Supabase et visiteur.
- `artifacts/arlor/src/components/createur` — wizard de création.
- `supabase/migrations` — migrations prod-first : la migration est
  appliquée en prod puis committée verbatim.

## CI

Sur chaque pull request et push sur `main` : typecheck, lint, build, vitest,
puis la garde de dérive de la capture visiteur.

## Licence

MIT.

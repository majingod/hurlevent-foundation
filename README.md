# Hurlevent Foundation

Plateforme de gestion pour le GN **Hurlevent** (univers de Destéa, Québec).

## Stack
- Monorepo **pnpm** (`pnpm-workspace.yaml`)
- Frontend principal : `artifacts/arlor` — Vite + React 19 + Tailwind + Supabase
- Backend API : `artifacts/api-server` — Express 5
- Base de données : Supabase (projet `dezocltwpuhbvpxwcbdy`)
- Déploiement : Vercel → https://hurlevent-foundation.vercel.app

## Migrations Supabase
Source de vérité : `supabase/migrations/`. Le contenu doit correspondre à `schema_migrations` en prod.

## Dév local
```bash
pnpm install
pnpm run dev    # lance artifacts/arlor
```

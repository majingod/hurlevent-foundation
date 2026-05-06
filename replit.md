# Hurlevent — GN Médiéval-Fantastique de Destéa

A French LARP (Live Action Role Play) character management and event platform for the Hurlevent medieval-fantasy game set in the world of Destéa. Players create and manage characters, browse the encyclopaedia, register for events, and admins manage all game data.

## Run & Operate

- `pnpm --filter @workspace/arlor run dev` — run the frontend (reads PORT + BASE_PATH from workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- Required env: `VITE_SUPABASE_URL` — Supabase project URL (add in Replit Secrets)
- Required env: `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key (add in Replit Secrets). `VITE_SUPABASE_PUBLISHABLE_KEY` is accepted as a fallback.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + react-router-dom v6, Tailwind v3 + shadcn/ui
- Fonts: Cinzel (headings) + Inter (body) via Google Fonts
- Auth & Data: Supabase (supabase-js v2) — auth, 25+ tables, RPC calls
- API: Express 5 (scaffolded, minimal usage)
- DB: PostgreSQL + Drizzle ORM (scaffolded, not yet used by frontend)

## Where things live

- `artifacts/arlor/` — main frontend artifact (previewPath `/`)
- `artifacts/arlor/src/integrations/supabase/` — Supabase client + full TypeScript DB types
- `artifacts/arlor/src/contexts/AuthContext.tsx` — auth state (Supabase auth)
- `artifacts/arlor/src/pages/` — all pages (Accueil, Encyclopedie, Evenements, Connexion, admin/*)
- `artifacts/arlor/src/components/creation/` — multi-step character creation wizard
- `artifacts/arlor/src/constants/colors.ts` — Base44 color palette (gold/dark-brown theme)
- `artifacts/arlor/tailwind.config.ts` — Tailwind v3 config referencing color constants
- `artifacts/api-server/` — Express backend (scaffolded, running on /api)
- `lib/db/src/schema/` — Drizzle schema (empty — app uses Supabase directly)

## Architecture decisions

- **Supabase as primary backend**: The app uses Supabase directly from the frontend (auth, 25+ tables, RPC calls like `creer_demande_race`, `peut_acheter_trait_racial`, `get_joueurs_avec_count`). Replacing this would be a large migration project.
- **Tailwind v3 + postcss**: Uses Tailwind v3 (not v4) with postcss/autoprefixer, configured via `tailwind.config.ts`. The `@tailwindcss/vite` plugin was removed in favour of `css.postcss.plugins`.
- **react-router-dom v6**: Uses `BrowserRouter` with `basename={import.meta.env.BASE_URL}` for correct Replit path-based routing.
- **Replit api-server scaffolded but minimal**: The Express server exists and runs, but the frontend talks to Supabase directly — not through the api-server.

## Product

- Public pages: Home (next event, feature cards), Rules, Encyclopaedia (races/classes/spells/bestiary/lore/etc.), Events, Login
- Authenticated: Player dashboard, character creation wizard (multi-step: race → class → skills → spells → prayers → runic assemblages → crafting → summary), character sheet
- Admin: Dashboard, player management, character management, event management, master skills, data overview

## User preferences

- App language: French
- Theme: Dark medieval fantasy — black backgrounds, gold (#d4af37) accents, Cinzel serif headings

## Gotchas

- Supabase credentials (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) must be set as Replit secrets for the app to load. The frontend also accepts `VITE_SUPABASE_PUBLISHABLE_KEY` as a fallback for the anon key.
- Tailwind v3 content paths in `tailwind.config.ts` must include `./src/**/*.{ts,tsx}`
- The `lovable-tagger` Vite plugin was dropped (Lovable-only tooling, not needed on Replit)

## Pointers

- See the `pnpm-workspace` skill for workspace structure
- Supabase DB types: `artifacts/arlor/src/integrations/supabase/types.ts` (2778 lines, full schema)

# Hurlevent Foundation — Notes pour Claude Code

## Environnement

### Gestionnaire de paquets : pnpm uniquement

Ce monorepo utilise **pnpm exclusivement**. Le `pnpm-workspace.yaml` définit les
workspaces (`artifacts/*`, `lib/*`, `lib/integrations/*`, `scripts`) et un
`catalog:` partagé qui ne fonctionne qu'avec pnpm.

**Ne jamais utiliser :**
- `bun install` — bun ne résout pas correctement le `catalog:` du workspace et
  reste muet pendant plusieurs minutes sur ce repo (problème reproduit).
- `npm install` — casse la structure `node_modules/.pnpm` (symlinks) sur
  laquelle s'appuient les `tsconfig` (`types: ["node", "vite/client"]`).

### Installer les dépendances

Pour travailler sur le workspace `arlor` (créateur de personnage, front
principal), commande à utiliser :

```bash
pnpm install --filter @workspace/arlor --prefer-offline
```

- `--filter @workspace/arlor` ne tire que les deps de cet artifact (≈ 7 s à
  froid, < 2 s à chaud) au lieu de tout le workspace.
- `--prefer-offline` réutilise le cache pnpm quand le lockfile n'a pas changé.

Cette commande est aussi exécutée automatiquement par le SessionStart hook
(`.claude/hooks/session-start.sh`) au démarrage de chaque session Claude Code
on the web.

### Builder le workspace arlor

```bash
pnpm --filter @workspace/arlor build
```

Sortie attendue : `✓ built in ~7s`, artefacts dans
`artifacts/arlor/dist/`. Un warning « chunk > 500 kB » est normal et
pré-existant.

### Typecheck

```bash
pnpm --filter @workspace/arlor typecheck
```

Le repo est à **0 erreur TypeScript** sur `main` (vérifié session 46
post-PR #191 — refactor étape 11, −762 lignes de code mort).

Toute erreur introduite par un changement est un **bloqueur à fixer avant
merge** : ne pas merger une PR qui dégrade le compteur, ne pas laisser
passer une régression typecheck.

### Dev server

```bash
pnpm --filter @workspace/arlor dev
```

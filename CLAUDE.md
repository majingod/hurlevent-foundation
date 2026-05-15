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

Le repo a actuellement ~16 erreurs TypeScript pré-existantes (types Supabase
générés incomplets pour certaines RPC, namespace `JSX` global). Ne pas
considérer un échec du typecheck comme un bloqueur tant qu'on n'ajoute pas
de **nouvelles** erreurs (vérifier en comparant le nombre d'erreurs avant et
après les changements).

### Dev server

```bash
pnpm --filter @workspace/arlor dev
```

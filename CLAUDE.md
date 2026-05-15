# CLAUDE.md

## Environnement

- **Gestionnaire de paquets : `pnpm` exclusivement.** Ce monorepo est en pnpm.
  Ne pas utiliser `bun` ni `npm install` dans ce repo.
- **Installation des dépendances du frontend :**
  `pnpm install --filter @workspace/arlor --prefer-offline`
- **Vérification du build avant toute PR :**
  `pnpm --filter @workspace/arlor build`

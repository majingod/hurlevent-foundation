#!/bin/bash
#
# SessionStart hook : installe les dépendances pnpm du workspace arlor.
#
# Le monorepo utilise pnpm exclusivement (voir CLAUDE.md). Ne JAMAIS
# remplacer cette commande par `bun install` ou `npm install` — la résolution
# du `catalog:` et des symlinks `node_modules/.pnpm` casse sans pnpm.
#
# Synchrone : la session attend la fin de l'install avant de démarrer, ce qui
# évite la course où le premier `pnpm tsc`/`vite build` partirait sans deps.
set -euo pipefail

# Ne tourne que dans les sessions Claude Code on the web (conteneurs jetables).
# En local, l'utilisateur gère ses node_modules lui-même.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# --prefer-offline pour utiliser le cache pnpm quand le lockfile n'a pas changé.
# --filter @workspace/arlor pour ne tirer que les deps de l'artifact actif,
# beaucoup plus rapide qu'un install full workspace.
pnpm install --filter @workspace/arlor --prefer-offline

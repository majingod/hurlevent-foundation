import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "node:fs";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Cible de build AUTONOME (lot A1, s312).
 *
 * Compile LE MÊME wizard visiteur que le site en UN seul fichier
 * `dist-hors-ligne/hurlevent-hors-ligne.html` (JS + CSS + snapshot + fontes
 * inlinés) qui s'ouvre dans n'importe quel navigateur, avec ou sans réseau,
 * sans installation ni service worker.
 *
 * Différences avec `vite.config.ts` (site) :
 *  - `viteSingleFile()` au lieu de `VitePWA` (aucun SW) ;
 *  - entrée `index-hors-ligne.html` → `main-hors-ligne.tsx` ;
 *  - flag `VITE_CIBLE_HORS_LIGNE = "1"` : force `clientVisiteur` (le pathname
 *    en HashRouter n'est jamais `/visiteur`, voir `creation/clientActif.ts`) ;
 *  - `assetsInlineLimit` très haut → tout est inliné en data-URI.
 */

/** Renomme l'unique HTML produit en `hurlevent-hors-ligne.html`. */
function renommerSortie() {
  return {
    name: "renommer-sortie-hors-ligne",
    apply: "build" as const,
    closeBundle() {
      const dir = path.resolve(import.meta.dirname, "dist-hors-ligne");
      const src = path.join(dir, "index-hors-ligne.html");
      const dest = path.join(dir, "hurlevent-hors-ligne.html");
      if (fs.existsSync(src)) fs.renameSync(src, dest);
    },
  };
}

export default defineConfig({
  base: "./",
  define: {
    "import.meta.env.VITE_CIBLE_HORS_LIGNE": JSON.stringify("1"),
    __APP_VERSION__: JSON.stringify("hors-ligne"),
  },
  plugins: [react(), viteSingleFile(), renommerSortie()],
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  // Aucun asset statique copié : la sortie doit être LE seul HTML autonome
  // (l'accueil hors-ligne ne référence ni favicon ni icône du dossier public).
  publicDir: false,
  build: {
    outDir: path.resolve(import.meta.dirname, "dist-hors-ligne"),
    emptyOutDir: true,
    // Tout inline (fontes woff2, snapshot, images) → un seul fichier autonome.
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, "index-hors-ligne.html"),
    },
  },
});

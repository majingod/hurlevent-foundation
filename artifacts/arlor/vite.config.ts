import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { VitePWA } from "vite-plugin-pwa";
import fs from "node:fs";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;

if (rawPort !== undefined && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

const APP_VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? String(Date.now());

export default defineConfig({
  base: basePath,
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "favicon-32x32.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "Hurlevent — GN de Destéa",
        short_name: "Hurlevent",
        description:
          "Gère ton personnage du GN médiéval-fantastique Hurlevent, dans l'univers de Destéa.",
        lang: "fr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0a0a0a",
        theme_color: "#0a0a0a",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/pwa-maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // P2-b : le mode visiteur (route publique `/visiteur`) rend le client
        // `clientVisiteur` atteignable depuis le graphe de l'app (via le Proxy
        // `clientActif`). Il embarque le snapshot des règles (JSON bundlé) → le
        // chunk principal dépasse la limite workbox par défaut (2 MiB) et, sans
        // ce relèvement, l'app shell NE SERAIT PAS précaché → plus d'offline.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // SPA hors ligne : toute navigation profonde (`/visiteur`, refresh…) doit
        // retomber sur `index.html` servi par le SW (le serveur est injoignable).
        navigateFallback: "index.html",
        // Le fichier autonome doit être servi TEL QUEL (téléchargement), jamais
        // remplacé par le shell SPA par le service worker.
        navigateFallbackDenylist: [/^\/hurlevent-hors-ligne\.html$/],
      },
    }),
    {
      name: "emit-version-json",
      apply: "build" as const,
      closeBundle() {
        const dir = path.resolve(import.meta.dirname, "dist");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          path.join(dir, "version.json"),
          JSON.stringify({ version: APP_VERSION }),
        );
      },
    },
  ],
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
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});

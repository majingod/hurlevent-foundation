/**
 * Fontes auto-hébergées (@fontsource) — importées par les DEUX cibles :
 * le site principal (`main.tsx`) et le build hors-ligne (`main-hors-ligne.tsx`).
 *
 * Remplace l'ancien `@import url('https://fonts.googleapis.com/...')` de
 * `index.css` (appel réseau à chaque chargement) :
 *  - hors-ligne : indispensable (aucun réseau, tout doit être inliné) ;
 *  - site principal : bonus (offline PWA + vie privée, plus d'appel Google).
 *
 * Mêmes graisses que l'ancien @import : Cinzel 400/500/600/700/800/900 (titres,
 * `font-heading`) et Inter 300/400/500/600/700 (corps). Module unique pour que
 * les deux points d'entrée restent synchronisés (une graisse ajoutée ici
 * profite aux deux cibles).
 */
import "@fontsource/cinzel/400.css";
import "@fontsource/cinzel/500.css";
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/cinzel/800.css";
import "@fontsource/cinzel/900.css";

import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

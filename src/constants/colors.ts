/**
 * src/constants/colors.ts
 * Palette Base44 pour Hurlevent redesign
 * Variables HSL exactes du projet fredgenerator.base44.app
 */

export const COLORS_BASE44 = {
  // Backgrounds
  background: "hsl(28, 15%, 8%)",           // #1a1410 - Marron très foncé
  card: "hsl(28, 18%, 12%)",                // #1f1815 - Marron card
  darkBrown: "hsl(28, 30%, 10%)",           // #18110a - Très foncé
  midBrown: "hsl(28, 25%, 16%)",            // #2a2117 - Marron moyen

  // Texte
  foreground: "hsl(38, 30%, 85%)",          // #d4c5b0 - Gris clair (principal)
  foregroundMuted: "hsl(38, 20%, 70%)",     // Gris plus foncé

  // Or & Accents
  gold: "hsl(42, 75%, 52%)",                // #d4af37 - Or classique
  goldAccent: "hsl(42, 85%, 60%)",          // #e8c547 - Or clair (highlights)
  goldDark: "hsl(42, 70%, 45%)",            // #c4992f - Or foncé (bordures)

  // Accents supplémentaires
  bordeaux: "hsl(350, 55%, 28%)",           // #5a2d3a - Bordeaux/rouge foncé
  popover: "hsl(28, 18%, 12%)",             // Comme card
  primary: "hsl(42, 70%, 50%)",             // Or primary
  secondary: "hsl(350, 40%, 25%)",          // Bordeaux secondary
  accent: "hsl(42, 50%, 30%)",              // Or accent foncé
  destructive: "hsl(0, 70%, 40%)",          // Rouge destructif
  border: "hsl(38, 20%, 22%)",              // Bordures gris clair
  input: "hsl(28, 18%, 15%)",               // Input backgrounds
  ring: "hsl(42, 75%, 52%)",                // Focus ring (or)
  muted: "hsl(28, 15%, 25%)",               // Muted backgrounds
  mutedForeground: "hsl(38, 15%, 50%)",     // Muted texte
} as const;

// Utilisation dans tailwind.config.ts:
// extend: {
//   colors: {
//     background: COLORS_BASE44.background,
//     foreground: COLORS_BASE44.foreground,
//     card: COLORS_BASE44.card,
//     gold: COLORS_BASE44.gold,
//     border: COLORS_BASE44.border,
//     // ... etc
//   }
// }

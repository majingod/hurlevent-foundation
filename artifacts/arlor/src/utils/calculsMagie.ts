// ============================================================
// UTILITAIRES DE CALCUL — Magie & Prières — Hurlevent
// Fonctions de calcul partagées entre :
//   - Créateur étapes 5-6 (sorts/prières)
//   - Étape 10 (récapitulatif)
//   - Fiche personnage (onglets Sorts et Prières)
// ============================================================

import {
  PORTEES,
  DUREES,
  COUT_ZONE,
  SECONDES_BASE_DOMAINE,
  SECONDES_PORTEE,
  SECONDES_ZONE,
  SECONDES_DUREE,
  secondesNiveauPriere,
} from "@/constants/magie";

// --- Calcul du coût PS à partir du coût XP ---
// Formule : Math.ceil(coutXp / 5 + 0.5)
export function calculerCoutPS(coutXp: number): number {
  return Math.ceil(coutXp / 5 + 0.5);
}

// --- Calcul du coût XP total d'un sort ou d'une prière ---
// Formule : CEIL((cout_zone + cout_portee + cout_duree + niveau) × cout_xp_base)
// ⚠️ MIROIR EXACT de la fonction SQL public.calculer_cout_xp_magie (CEIL) :
// avec un coût de base 0.5 ou 1.5, la DB arrondit à l'entier supérieur.
export function calculerCoutXP(
  zoneChoisie: string,
  porteeChoisie: string,
  dureeChoisie: string,
  niveau: number,
  coutXpBase: number
): number {
  const coutZone   = COUT_ZONE[zoneChoisie]                              ?? 0;
  const coutPortee = PORTEES.find(p => p.label === porteeChoisie)?.cout  ?? 0;
  const coutDuree  = DUREES.find(d => d.label === dureeChoisie)?.cout    ?? 0;
  return Math.ceil((coutZone + coutPortee + coutDuree + niveau) * coutXpBase);
}

// --- Coût XP maximum autorisé pour un personnage ---
// Formule : (niveau_personnage × 10) + 10
export function coutXpMaxAutorise(niveauPersonnage: number): number {
  return Math.max(niveauPersonnage ?? 1, 1) * 10 + 10;
}

// --- Refus de plafond ---
// ⚠️ MIROIR EXACT de la fonction SQL public.refus_plafond_magie : renvoie null
// si le coût passe, sinon le message joueur au caractère près (accents inclus).
// Manuel : « Un sort ne peut jamais coûter plus cher que 10 points d'expérience
// plus 10 fois le niveau du personnage (10+(10*niv.)). »
export function refusPlafondMagie(
  type: "sort" | "priere",
  niveauPersonnage: number,
  coutXp: number,
): string | null {
  const niveau = Math.max(niveauPersonnage ?? 1, 1);
  const plafond = coutXpMaxAutorise(niveau);
  if (coutXp <= plafond) return null;
  return (
    (type === "priere" ? "Cette prière coûterait " : "Ce sort coûterait ") +
    coutXp +
    " XP. À ton niveau (" +
    niveau +
    "), " +
    (type === "priere" ? "une prière" : "un sort") +
    " ne peut pas dépasser " +
    plafond +
    " XP. Baisse le niveau, la portée, la durée ou le nombre de cibles."
  );
}

// --- Filtrage des portées disponibles selon la portée maximale du sort ---
// sorts.portee / prieres.portee contient le label de la portée maximale autorisée
export function filterPorteesDisponibles(porteeMax: string) {
  const indexMax = PORTEES.findIndex(p => p.label === porteeMax);
  return indexMax >= 0 ? PORTEES.slice(0, indexMax + 1) : PORTEES;
}

// --- Filtrage des durées disponibles selon la durée maximale du sort ---
// sorts.duree / prieres.duree contient le label de la durée maximale autorisée
export function filterDureesDisponibles(dureeMax: string) {
  const indexMax = DUREES.findIndex(d => d.label === dureeMax);
  return indexMax >= 0 ? DUREES.slice(0, indexMax + 1) : DUREES;
}

// --- Calcul de la durée d'incantation d'une prière (en secondes) ---
// Formule : Math.ceil((2 + sec_portee + sec_zone + sec_duree + sec_niveau) / 2)
export function calculerDureeIncantation(
  porteeChoisie: string,
  zoneChoisie: string,
  dureeChoisie: string,
  niveau: number
): number {
  const secPortee = SECONDES_PORTEE[porteeChoisie] ?? 0;
  const secZone   = SECONDES_ZONE[zoneChoisie]     ?? 0;
  const secDuree  = SECONDES_DUREE[dureeChoisie]   ?? 0;
  const secNiveau = secondesNiveauPriere(niveau);
  return Math.ceil((SECONDES_BASE_DOMAINE + secPortee + secZone + secDuree + secNiveau) / 2);
}

// --- Note contextuelle selon zone_effet (sort/prière ciblant un mort ou un objet) ---
export function getNoteZone(zoneEffet: string): string | null {
  if (zoneEffet === "1 cible (mort)")  return "Ce sort cible uniquement un cadavre.";
  if (zoneEffet === "1 cible (objet)") return "Ce sort cible uniquement un objet.";
  return null;
}

// --- Vérification si la zone ne permet qu'un seul choix (pré-sélection automatique) ---
export function isZoneUnique(zoneEffet: string): boolean {
  return ["Personnelle", "1 cible", "1 cible (mort)", "1 cible (objet)"].includes(zoneEffet);
}

// ============================================================
// PALIERS / TRONC / BONUS PAR NIVEAU — colonnes dérivées (PR #361)
// Colonnes jsonb sorts/prieres castées via ces interfaces locales :
// on ne régénère pas les types Supabase pour ces champs.
// ============================================================

export interface PalierSort {
  niveau: number;
  libelle: string;
  texte: string;
}

export interface BonusNiveauFormule {
  variable: "duree" | "cibles" | "rayon" | "questions";
  seuil: number;       // 0 = chaque niveau
  increment: number;
  unite: string;       // "minute" | "cible" | "pied" | "question"
  gratuit: boolean;
  condition: string | null;
}

export interface BonusNiveau {
  texte: string;
  formule: BonusNiveauFormule | null;
}

/** n unités bonus au niveau donné ; null si formule absente ou n ≤ 0. */
export const calculerBonusNiveau = (
  bonus: BonusNiveau | null | undefined,
  niveau: number,
): { n: number; unite: string; gratuit: boolean } | null => {
  const f = bonus?.formule;
  if (!f) return null;
  const n = (f.seuil === 0 ? niveau : Math.max(0, niveau - f.seuil)) * f.increment;
  return n > 0 ? { n, unite: f.unite, gratuit: f.gratuit } : null;
};

// ============================================================
// EFFETS CALCULÉS — moteur template + vars (PR-1, s162)
// Affiche le résultat final d'un sort/prière (nombres calculés selon le niveau
// de l'instance) à la place de la prose « moitié du niveau arrondi sup. ».
// Fonctions PURES, sans React (réutilisées par É6/É7 plus tard).
// ============================================================

export interface VarEffet {
  fois?: number;
  div?: number;
  arrondi?: "sup" | "inf" | "aucun";
  plus?: number;
  min?: number;
  max?: number;
}

export interface EffetInstance {
  template: string;
  vars?: Record<string, VarEffet>;
  paliers_mode?: "remplace" | "cumule";
}

/** Segment de texte rendu : `fort` = mis en évidence (or, issu de `**…**`). */
export interface SegmentEffet {
  texte: string;
  fort: boolean;
}

/**
 * Valeur calculée d'une var, dans l'ordre :
 *   x = niveau × (fois ?? 1) → x = x / (div ?? 1) → arrondi
 *   → x = x + (plus ?? 0) → clamp [min, max] si fournis.
 */
export function calculerVarEffet(v: VarEffet, niveau: number): number {
  let x = niveau * (v.fois ?? 1);
  x = x / (v.div ?? 1);
  const arrondi = v.arrondi ?? "sup";
  if (arrondi === "sup") x = Math.ceil(x);
  else if (arrondi === "inf") x = Math.floor(x);
  x = x + (v.plus ?? 0);
  if (v.min != null) x = Math.max(v.min, x);
  if (v.max != null) x = Math.min(v.max, x);
  return x;
}

/**
 * Rend un `effet_instance` en segments prêts à afficher, ou `null` (→ fallback
 * vers l'affichage description/paliers actuel).
 *
 * Substitutions dans l'ordre : `{paliers}`, `{palier}`, `{niveau}`, puis chaque
 * `{nomvar}` / `{s:nomvar}` des `vars`. Palier actif = dernier palier (trié
 * croissant) dont `niveau <= niveau`. Texte final trimé vide → `null`.
 */
export function rendreEffetInstance(
  effet: EffetInstance | null | undefined,
  paliers: PalierSort[] | null | undefined,
  niveau: number,
): SegmentEffet[] | null {
  if (!effet?.template) return null;

  const tries = (paliers ?? []).slice().sort((a, b) => a.niveau - b.niveau);
  const atteints = tries.filter((p) => p.niveau <= niveau);
  const palierActif = atteints.length ? atteints[atteints.length - 1] : null;

  // Remplacement de toutes les occurrences d'un token littéral.
  const sub = (s: string, token: string, valeur: string) => s.split(token).join(valeur);

  let texte = effet.template;

  const textePaliers =
    effet.paliers_mode === "cumule" && atteints.length
      ? " " + atteints.map((p) => p.texte).join(" ")
      : "";
  texte = sub(texte, "{paliers}", textePaliers);
  texte = sub(texte, "{palier}", palierActif?.texte ?? "");
  texte = sub(texte, "{niveau}", String(niveau));

  for (const [nom, v] of Object.entries(effet.vars ?? {})) {
    const valeur = calculerVarEffet(v, niveau);
    texte = sub(texte, `{s:${nom}}`, valeur > 1 ? "s" : "");
    texte = sub(texte, `{${nom}}`, String(valeur));
  }

  const texteFinal = texte.trim();
  if (!texteFinal) return null;

  // Parse des segments `**…**` → fort sur les portions internes (index impair).
  const segments: SegmentEffet[] = [];
  texteFinal.split("**").forEach((part, i) => {
    if (part === "") return;
    segments.push({ texte: part, fort: i % 2 === 1 });
  });

  if (segments.length === 0) return null;
  return segments;
}

// ============================================================
// UTILITAIRES DE CALCUL — Magie & Prières — Hurlevent
// Fonctions de calcul partagées entre :
//   - Créateur étapes 5-6 (sorts/prières)
//   - Étape 10 (récapitulatif)
//   - Fiche personnage (onglets Sorts et Prières)
// ============================================================

import { PORTEES, DUREES, COUT_ZONE } from "@/constants/magie";

// --- Calcul du coût PS à partir du coût XP ---
// Formule : Math.ceil(coutXp / 5 + 0.5)
export function calculerCoutPS(coutXp: number): number {
  return Math.ceil(coutXp / 5 + 0.5);
}

// --- Calcul du coût XP total d'un sort ou d'une prière ---
// Formule : (cout_zone + cout_portee + cout_duree + niveau) × cout_xp_base
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
  return (coutZone + coutPortee + coutDuree + niveau) * coutXpBase;
}

// --- Coût XP maximum autorisé pour un personnage ---
// Formule : (niveau_personnage × 10) + 10
export function coutXpMaxAutorise(niveauPersonnage: number): number {
  return niveauPersonnage * 10 + 10;
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
  const secPortee = PORTEES.find(p => p.label === porteeChoisie)?.cout ?? 0;
  const secZone   = COUT_ZONE[zoneChoisie]                              ?? 0;
  const secDuree  = DUREES.find(d => d.label === dureeChoisie)?.cout    ?? 0;
  return Math.ceil((2 + secPortee + secZone + secDuree + niveau) / 2);
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

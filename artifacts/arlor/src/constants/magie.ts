// ============================================================
// CONSTANTES DE MAGIE — Hurlevent
// Utilisé par : Créateur étapes 5-6 (sorts/prières),
//               Étape 10 (récapitulatif), Fiche personnage
// ============================================================

export const ZONES_PAR_TYPE: Record<string, string[]> = {
  "Personnelle":                       ["Personnelle"],
  "1 cible":                           ["1 Cible"],
  "1 cible (mort)":                    ["1 Cible"],
  "1 cible (objet)":                   ["1 Cible"],
  "Nombre de cibles":                  ["Personnelle", "1 Cible", "2 Cibles", "3 Cibles", "4 Cibles", "5 Cibles"],
  "Nombre de cibles (objets)":         ["1 Cible", "2 Cibles", "3 Cibles", "4 Cibles", "5 Cibles"],
  "Nombre de cibles ou rayon 3 pieds": ["Personnelle", "1 Cible", "2 Cibles", "3 Cibles", "4 Cibles", "5 Cibles", "Rayon 3 pieds"],
  "Tous rayons":                       ["Rayon 3 pieds", "Rayon 6 pieds", "Rayon 10 pieds", "Rayon 25 pieds", "Rayon 50 pieds"],
  "Nombre de cibles ou tous rayons":   ["Personnelle", "1 Cible", "2 Cibles", "3 Cibles", "4 Cibles", "5 Cibles", "Rayon 3 pieds", "Rayon 6 pieds", "Rayon 10 pieds", "Rayon 25 pieds", "Rayon 50 pieds"],
};

export const COUT_ZONE: Record<string, number> = {
  "Personnelle":    1,
  "1 Cible":        2,
  "2 Cibles":       4,
  "3 Cibles":       6,
  "4 Cibles":       8,
  "5 Cibles":       10,
  "Rayon 3 pieds":  6,
  "Rayon 6 pieds":  8,
  "Rayon 10 pieds": 10,
  "Rayon 25 pieds": 14,
  "Rayon 50 pieds": 18,
};

export const PORTEES: { label: string; cout: number }[] = [
  { label: "Toucher",  cout: 0  },
  { label: "5 Pieds",  cout: 1  },
  { label: "10 Pieds", cout: 2  },
  { label: "25 Pieds", cout: 4  },
  { label: "50 Pieds", cout: 8  },
  { label: "À vue",    cout: 10 },
];

export const DUREES: { label: string; cout: number }[] = [
  { label: "Instantanée", cout: 1 },
  { label: "1 Minute",    cout: 2 },
  { label: "5 Minutes",   cout: 3 },
  { label: "10 Minutes",  cout: 4 },
  { label: "20 Minutes",  cout: 5 },
  { label: "30 Minutes",  cout: 6 },
  { label: "40 Minutes",  cout: 7 },
  { label: "50 Minutes",  cout: 8 },
  { label: "60 Minutes",  cout: 9 },
];

// ============================================================
// SECONDES DE PRIÈRE (durée d'incantation) — manuel 2026
// « Construction des sorts de prêtre ». Tables PROPRES aux prières,
// distinctes des colonnes de coût XP ci-dessus.
// ⚠️ MIROIR EXACT de la fonction SQL public.calculer_duree_incantation_priere
// (migration 20260602164244). Toute modif ici DOIT être répliquée côté SQL.
// ============================================================
export const SECONDES_BASE_DOMAINE = 2;

export const SECONDES_PORTEE: Record<string, number> = {
  "Toucher":  1,
  "5 Pieds":  2,
  "10 Pieds": 3,
  "25 Pieds": 5,
  "50 Pieds": 7,
  "À vue":    10,
};

export const SECONDES_ZONE: Record<string, number> = {
  "Personnelle":    1,
  "1 Cible":        2,
  "2 Cibles":       3,
  "3 Cibles":       5,
  "4 Cibles":       7,
  "5 Cibles":       10,
  "Rayon 3 pieds":  2,
  "Rayon 6 pieds":  4,
  "Rayon 10 pieds": 5,
  "Rayon 25 pieds": 8,
  "Rayon 50 pieds": 15,
};

export const SECONDES_DUREE: Record<string, number> = {
  "Instantanée": 1,
  "1 Minute":    2,
  "5 Minutes":   3,
  "10 Minutes":  4,
  "20 Minutes":  5,
  "30 Minutes":  6,
  "40 Minutes":  7,
  "50 Minutes":  8,
  "60 Minutes":  9,
};

// Niveau → secondes (paliers manuel 2026, jusqu'à niv 20)
export function secondesNiveauPriere(niveau: number): number {
  if (niveau <= 3)  return 1;
  if (niveau <= 6)  return 2;
  if (niveau <= 9)  return 3;
  if (niveau <= 12) return 5;
  if (niveau <= 15) return 7;
  if (niveau <= 18) return 10;
  return 13; // 19-20
}

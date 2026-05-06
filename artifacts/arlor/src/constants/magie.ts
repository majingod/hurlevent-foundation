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

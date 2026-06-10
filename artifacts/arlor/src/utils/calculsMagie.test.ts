import { describe, it, expect } from "vitest";
import { calculerCoutXP, calculerDureeIncantation } from "./calculsMagie";

// Garde-fou : ces valeurs sont validées sur le manuel 2026 et doivent rester
// strictement alignées avec la fonction SQL public.calculer_duree_incantation_priere
// (migration 20260602164244). Si un de ces cas casse, NE PAS ajuster la valeur
// attendue sans revérifier le manuel ET la fonction SQL.
describe("calculerDureeIncantation (manuel 2026)", () => {
  it("Testi « Armure de Bois » : Toucher / Personnelle / 40 Minutes / niv 5 → 7 s", () => {
    expect(calculerDureeIncantation("Toucher", "Personnelle", "40 Minutes", 5)).toBe(7);
  });

  it("Exemple manuel : 10 Pieds / Rayon 6 pieds / Instantanée / niv 8 → 7 s", () => {
    expect(calculerDureeIncantation("10 Pieds", "Rayon 6 pieds", "Instantanée", 8)).toBe(7);
  });

  it("Minimum absolu : Toucher / Personnelle / Instantanée / niv 1 → 3 s", () => {
    expect(calculerDureeIncantation("Toucher", "Personnelle", "Instantanée", 1)).toBe(3);
  });

  it("Maximum : À vue / Rayon 50 pieds / 60 Minutes / niv 20 → 25 s", () => {
    expect(calculerDureeIncantation("À vue", "Rayon 50 pieds", "60 Minutes", 20)).toBe(25);
  });
});

// Garde-fou : calculerCoutXP doit rester un MIROIR EXACT de la fonction SQL
// public.calculer_cout_xp_magie (CEIL). Toute divergence front/DB fausse
// l'affichage du coût avant achat.
describe("calculerCoutXP (parité DB calculer_cout_xp_magie)", () => {
  it("Globe d'Air : Personnelle(1) + Toucher(0) + 40 Minutes(7) + niv 1 = 9 pts × 0.5 → 5 XP (CEIL, valeur prod)", () => {
    expect(calculerCoutXP("Personnelle", "Toucher", "40 Minutes", 1, 0.5)).toBe(5);
  });

  it("coût entier sans arrondi : 1 Cible(2) + 5 Pieds(1) + 1 Minute(2) + niv 3 = 8 pts × 2 → 16 XP", () => {
    expect(calculerCoutXP("1 Cible", "5 Pieds", "1 Minute", 3, 2)).toBe(16);
  });

  it("demi-XP arrondi sup : 1 Cible(2) + Toucher(0) + Instantanée(1) + niv 2 = 5 pts × 1.5 → 8 XP (7.5 → CEIL)", () => {
    expect(calculerCoutXP("1 Cible", "Toucher", "Instantanée", 2, 1.5)).toBe(8);
  });
});

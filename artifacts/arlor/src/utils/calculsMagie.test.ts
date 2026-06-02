import { describe, it, expect } from "vitest";
import { calculerDureeIncantation } from "./calculsMagie";

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

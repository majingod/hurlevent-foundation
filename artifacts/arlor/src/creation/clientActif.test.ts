import { describe, it, expect, vi } from "vitest";

// `clientActif` importe `clientServeur` qui instancie le client supabase à
// l'init du module (`createClient`, lecture de `localStorage` + env VITE_*).
// L'env de test est node sans `.env` : on neutralise ce seul module. On teste
// l'AIGUILLAGE (quel client pour quel pathname), pas le passe-plat supabase.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
  setModeStaff: () => {},
  setProfilActifHeader: () => {},
}));

import { clientPourPathname } from "./clientActif";
import { clientServeur } from "./clientServeur";
import { clientVisiteur } from "./visiteur/clientVisiteur";

describe("clientPourPathname — aiguillage URL du guichet de création", () => {
  it("route /visiteur → clientVisiteur", () => {
    expect(clientPourPathname("/visiteur")).toBe(clientVisiteur);
  });

  it("route /visiteur/creation (sous-chemin) → clientVisiteur", () => {
    expect(clientPourPathname("/visiteur/creation")).toBe(clientVisiteur);
  });

  it("route /visiteurs-truc (préfixe piégeux) → clientServeur", () => {
    expect(clientPourPathname("/visiteurs-truc")).toBe(clientServeur);
  });

  it("route /personnage/nouveau (mode connecté) → clientServeur", () => {
    expect(clientPourPathname("/personnage/nouveau")).toBe(clientServeur);
  });
});

/**
 * [VIS-6] Lot 2 — visibilité de la bannière de reprise + drapeau d'ignore.
 *
 * `repriseDisponible()` est le prédicat pur qui pilote l'affichage de la bannière
 * du tableau de bord : visible SSI un brouillon existe ET la reprise n'a pas été
 * ignorée définitivement. Testé sans DOM (config vitest = node).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  repriseDisponible,
  estRepriseIgnoree,
  ignorerRepriseDefinitivement,
  CLE_REPRISE_IGNOREE,
} from "./repriseFlags";
import { CLE_BROUILLON } from "../visiteur/stockageBrouillon";
import { creerBrouillonVide } from "@/moteurCreation/brouillon/types";

function installerLocalStorage(): void {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

const poserBrouillon = () =>
  localStorage.setItem(CLE_BROUILLON, JSON.stringify(creerBrouillonVide()));

beforeEach(() => {
  installerLocalStorage();
});

describe("repriseDisponible — bannière de reprise", () => {
  it("aucun brouillon → masquée", () => {
    expect(repriseDisponible()).toBe(false);
  });

  it("brouillon présent, pas de drapeau → visible", () => {
    poserBrouillon();
    expect(repriseDisponible()).toBe(true);
  });

  it("brouillon présent MAIS reprise ignorée → masquée", () => {
    poserBrouillon();
    ignorerRepriseDefinitivement();
    expect(estRepriseIgnoree()).toBe(true);
    expect(repriseDisponible()).toBe(false);
  });

  it("le drapeau persiste sous la clé attendue", () => {
    ignorerRepriseDefinitivement();
    expect(localStorage.getItem(CLE_REPRISE_IGNOREE)).toBe("1");
  });
});

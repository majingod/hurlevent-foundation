/**
 * Tests de persistance du brouillon visiteur.
 * `localStorage` est stubé (la config vitest tourne en environnement `node`).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getSnapshot } from "@/moteurCreation/snapshot";
import { creerBrouillonVide } from "@/moteurCreation/brouillon/types";
import {
  CLE_BROUILLON,
  chargerBrouillon,
  sauverBrouillon,
  effacerBrouillon,
  estPerime,
} from "./stockageBrouillon";

// Stub minimal de localStorage (Storage-like) posé sur globalThis.
function installerLocalStorage(): void {
  const store = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: stub,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  installerLocalStorage();
});

describe("round-trip", () => {
  it("charger(sauver(b)) est deep-equal à b", () => {
    const b = creerBrouillonVide();
    sauverBrouillon(b);
    expect(chargerBrouillon()).toEqual(b);
  });

  it("absence de brouillon → null", () => {
    expect(chargerBrouillon()).toBeNull();
  });

  it("effacerBrouillon supprime le slot", () => {
    sauverBrouillon(creerBrouillonVide());
    effacerBrouillon();
    expect(chargerBrouillon()).toBeNull();
  });
});

describe("garde de version", () => {
  it("schemaVersion inconnu (999) → null (jeté, pas de crash)", () => {
    const b = creerBrouillonVide();
    localStorage.setItem(
      CLE_BROUILLON,
      JSON.stringify({ ...b, schemaVersion: 999 })
    );
    expect(chargerBrouillon()).toBeNull();
  });

  it("JSON corrompu → null", () => {
    localStorage.setItem(CLE_BROUILLON, "{pas du json");
    expect(chargerBrouillon()).toBeNull();
  });
});

describe("péremption (n'empêche pas le chargement)", () => {
  it("snapshot plus récent que le brouillon → estPerime true, mais charge quand même", () => {
    const b = creerBrouillonVide();
    b.meta.snapshotGenereLe = "2000-01-01T00:00:00.000Z"; // très ancien
    sauverBrouillon(b);

    const charge = chargerBrouillon();
    expect(charge).not.toBeNull();
    expect(estPerime(charge!)).toBe(true);
  });

  it("brouillon aligné sur le snapshot courant → non périmé", () => {
    const b = creerBrouillonVide();
    b.meta.snapshotGenereLe = getSnapshot().manifest.genere_le;
    expect(estPerime(b)).toBe(false);
  });
});

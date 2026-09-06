import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEXTES_FILET } from "@/components/FiletErreur";

interface PayloadSignalerErreur {
  route: string;
  message: string;
  version: string;
}

const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

function stubWindow(pathname: string, search = ""): { addEventListener: ReturnType<typeof vi.fn> } {
  const addEventListener = vi.fn();
  vi.stubGlobal("window", {
    location: { pathname, search },
    addEventListener,
  });
  return { addEventListener };
}

// Le module porte un dédoublonnage et un plafond à l'échelle du « chargement
// de page » dans des variables de module : chaque test recharge le module à
// froid pour ne pas hériter de l'état d'un test précédent.
async function chargerFilet() {
  vi.resetModules();
  return import("./filet");
}

beforeEach(() => {
  rpcMock.mockReset();
  vi.stubGlobal("__APP_VERSION__", "test-abc1234");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signalerErreur", () => {
  it("TypeError → rpc appelé 1 fois avec { route, message, version }", async () => {
    stubWindow("/tableau-de-bord");
    const { signalerErreur } = await chargerFilet();

    signalerErreur(new TypeError("x"));

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("signaler_erreur", {
      route: "/tableau-de-bord",
      message: "TypeError: x",
      version: "test-abc1234",
    });
  });

  it("négatif : un location.search non vide (?id=…) n'apparaît pas dans la route envoyée", async () => {
    stubWindow("/tableau-de-bord", "?id=123");
    const { signalerErreur } = await chargerFilet();

    signalerErreur(new TypeError("x"));

    const payload = rpcMock.mock.calls[0][1] as PayloadSignalerErreur;
    expect(payload.route).toBe("/tableau-de-bord");
    expect(payload.route).not.toContain("?");
    expect(payload.route).not.toContain("id=123");
  });

  it("message de 1000 caractères → tronqué à 500 côté client", async () => {
    stubWindow("/x");
    const { signalerErreur } = await chargerFilet();

    signalerErreur(new Error("a".repeat(1000)));

    const payload = rpcMock.mock.calls[0][1] as PayloadSignalerErreur;
    expect(payload.message.length).toBe(500);
  });

  it("rpc qui rejette → signalerErreur ne lève pas et ne rejette pas", async () => {
    stubWindow("/x");
    rpcMock.mockReturnValue(Promise.reject(new Error("boom")));
    const { signalerErreur } = await chargerFilet();

    expect(() => signalerErreur(new Error("y"))).not.toThrow();
  });

  it("positif jumeau : rpc qui résout → signalerErreur ne lève pas non plus", async () => {
    stubWindow("/x");
    rpcMock.mockReturnValue(Promise.resolve());
    const { signalerErreur } = await chargerFilet();

    expect(() => signalerErreur(new Error("y"))).not.toThrow();
  });

  it("même erreur (route + message) 3 fois → rpc appelé 1 fois", async () => {
    stubWindow("/x");
    const { signalerErreur } = await chargerFilet();
    const erreur = new Error("répétée");

    signalerErreur(erreur);
    signalerErreur(erreur);
    signalerErreur(erreur);

    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("positif jumeau : deux erreurs différentes → rpc appelé 2 fois", async () => {
    stubWindow("/x");
    const { signalerErreur } = await chargerFilet();

    signalerErreur(new Error("une"));
    signalerErreur(new Error("deux"));

    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  it("25 erreurs distinctes → rpc appelé 20 fois (plafond, fail-closed)", async () => {
    stubWindow("/x");
    const { signalerErreur } = await chargerFilet();

    for (let i = 0; i < 25; i += 1) {
      signalerErreur(new Error(`erreur ${i}`));
    }

    expect(rpcMock).toHaveBeenCalledTimes(20);
  });
});

describe("installerFilet", () => {
  it("appelé 2 fois → addEventListener('error') enregistré 1 seule fois (idempotent)", async () => {
    const { addEventListener } = stubWindow("/x");
    const { installerFilet } = await chargerFilet();

    installerFilet();
    installerFilet();

    const appelsError = addEventListener.mock.calls.filter(([type]) => type === "error");
    expect(appelsError).toHaveLength(1);
  });
});

describe("TEXTES_FILET — C101 verbatim", () => {
  it("les 4 textes correspondent exactement à la spécification D65", () => {
    expect(TEXTES_FILET.titre).toBe("Quelque chose a cassé.");
    expect(TEXTES_FILET.corps).toBe(
      "Recharge la page pour continuer. Si ça se reproduit, envoie le détail à l'orga.",
    );
    expect(TEXTES_FILET.boutonRecharger).toBe("Recharger");
    expect(TEXTES_FILET.boutonCopier).toBe("Copier le détail");
  });
});

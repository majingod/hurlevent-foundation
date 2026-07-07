import { QueryClient, onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import { queryClientVisiteur } from "./queryClientVisiteur";

const queryFnLocale = async () => "REPONSE_LOCALE";

afterEach(() => {
  onlineManager.setOnline(true);
  queryClientVisiteur.clear();
});

describe("queryClientVisiteur — mode avion (BUG s312-1)", () => {
  it("REPRO : un QueryClient par défaut met en pause une queryFn 100 % locale hors-ligne", async () => {
    onlineManager.setOnline(false);
    const clientDefaut = new QueryClient();
    const p = clientDefaut.fetchQuery({
      queryKey: ["repro"],
      queryFn: queryFnLocale,
    });
    p.catch(() => {});
    const resultat = await Promise.race([
      p,
      new Promise((r) => setTimeout(() => r("BLOQUE"), 250)),
    ]);
    expect(resultat).toBe("BLOQUE"); // le bug : jamais résolu
    clientDefaut.clear();
  });

  it("FIX : le client visiteur exécute la queryFn locale hors-ligne", async () => {
    onlineManager.setOnline(false);
    const resultat = await queryClientVisiteur.fetchQuery({
      queryKey: ["fix"],
      queryFn: queryFnLocale,
    });
    expect(resultat).toBe("REPONSE_LOCALE");
  });

  it("FIX : les mutations sont aussi en networkMode always", () => {
    expect(queryClientVisiteur.getDefaultOptions().mutations?.networkMode).toBe(
      "always",
    );
    expect(queryClientVisiteur.getDefaultOptions().queries?.networkMode).toBe(
      "always",
    );
  });
});

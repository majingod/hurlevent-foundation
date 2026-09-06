import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { signalerErreur } from "@/lib/filet";

/**
 * BUG s312-1 — QueryClient dédié au mode visiteur (route /visiteur).
 *
 * TanStack Query v5 a `networkMode: 'online'` par défaut : en mode avion
 * (`navigator.onLine === false`), toute query/mutation est mise en PAUSE et sa
 * fonction ne s'exécute JAMAIS — même quand elle est 100 % locale
 * (clientVisiteur : snapshot embarqué + localStorage). Résultat : spinner
 * « Préparation du créateur de personnage… » infini hors-ligne.
 *
 * `networkMode: 'always'` force l'exécution locale, réseau ou pas. Scopé à la
 * route visiteur via un QueryClientProvider dans CreationVisiteur.tsx : le
 * client global d'App.tsx (mode connecté) garde le comportement par défaut
 * (pause hors-ligne + reprise au retour du réseau), qui est le bon pour lui.
 *
 * Les caches de toasts répliquent le pattern d'App.tsx (meta
 * `skipGlobalErrorToast` respectée).
 */
export const queryClientVisiteur = new QueryClient({
  defaultOptions: {
    queries: { networkMode: "always" },
    mutations: { networkMode: "always" },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.skipGlobalErrorToast === true) return;
      toast.error(`Erreur de chargement: ${error.message}`);
      console.error("[Query Error]", query.queryKey, error);
      signalerErreur(error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.skipGlobalErrorToast === true) return;
      toast.error(`Erreur: ${error.message}`);
      console.error("[Mutation Error]", mutation.options.mutationKey, error);
      signalerErreur(error);
    },
  }),
});

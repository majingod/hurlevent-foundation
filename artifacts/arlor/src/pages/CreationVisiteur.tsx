import { QueryClientProvider } from "@tanstack/react-query";

import PersonnageNouveauV2 from "@/pages/PersonnageNouveauV2";
import { queryClientVisiteur } from "@/creation/visiteur/queryClientVisiteur";
import {
  chargerBrouillon,
  estPerime,
} from "@/creation/visiteur/stockageBrouillon";

/**
 * Page PUBLIQUE du créateur en mode visiteur (P2-b).
 *
 * Wrapper léger : en-tête d'accueil + bannière « contenu périmé » (B5, douce et
 * non bloquante), puis le wizard partagé en `modeVisiteur`. Toute la logique de
 * création vit dans `PersonnageNouveauV2` ; le client actif (`clientActif`) route
 * vers `clientVisiteur` grâce au pathname `/visiteur`.
 */
const CreationVisiteur = () => {
  // B5 : recalcul à CHAQUE render (pas de state figé). Le brouillon peut être
  // absent (première visite) → aucune bannière.
  const brouillon = chargerBrouillon();
  const perime = brouillon ? estPerime(brouillon) : false;

  return (
    // BUG s312-1 : provider scopé — voir queryClientVisiteur.ts. Sans lui,
    // toutes les queries/mutations du wizard sont PAUSED en mode avion.
    <QueryClientProvider client={queryClientVisiteur}>
      <div className="mx-auto max-w-4xl px-4 pt-10">
        <header className="space-y-2">
          <h1 className="font-heading text-3xl text-primary">
            Créateur de personnage — mode visiteur
          </h1>
          <p className="text-sm text-muted-foreground">
            Aucun compte requis. Ton brouillon est sauvegardé sur cet appareil
            et fonctionne même sans réseau.
          </p>
        </header>

        {perime && (
          <div className="mt-6 rounded border border-primary/35 bg-primary/10 p-4 text-sm text-primary/80">
            ⚠️ Les règles embarquées dans ce mode datent d'une version
            précédente du jeu. Ton brouillon reste valide : tout sera revérifié
            au moment de créer ton vrai personnage avec un compte.
          </div>
        )}

        <PersonnageNouveauV2 modeVisiteur />
      </div>
    </QueryClientProvider>
  );
};

export default CreationVisiteur;

import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { ModeAffichageProvider } from "@/contexts/ModeAffichageContext";
import AccueilHorsLigne from "@/pages/AccueilHorsLigne";
import CreationVisiteur from "@/pages/CreationVisiteur";
import FicheVisiteur from "@/pages/FicheVisiteur";
import Encyclopedie from "@/pages/Encyclopedie";
import Regles from "@/pages/Regles";
import "./polices.ts";
import "./index.css";

/**
 * Point d'entrée de la cible AUTONOME (`index-hors-ligne.html`).
 *
 * Une seule base de code, deux cibles : ce point d'entrée sert LE MÊME wizard
 * visiteur que le site, compilé en un fichier `.html` unique (JS+CSS+snapshot+
 * fontes inlinés — voir `vite.hors-ligne.config.ts`).
 *
 * Volontairement minimal, par rapport à `main.tsx` :
 *  - `HashRouter` (le protocole `file://` n'a pas de vraies routes) ;
 *  - PAS de Layout/menu du site, PAS d'auth provider, PAS de PWA register ;
 *  - le `QueryClientProvider` scopé vit dans `CreationVisiteur` (fix s312-1).
 *
 * L'aiguillage du guichet de création est forcé sur `clientVisiteur` par le
 * flag de build `VITE_CIBLE_HORS_LIGNE` (voir `creation/clientActif.ts`) : en
 * HashRouter le pathname n'est jamais `/visiteur`.
 *
 * [HL-A2] Lot 2 : Règles + Encyclopédie embarquées (lectures snapshot via le
 * contrat du Lot 1). `CadreHorsLigne` = simple barre « retour accueil », les
 * pages n'ayant pas le menu du site dans cette cible.
 */

function CadreHorsLigne({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="container max-w-5xl py-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Accueil hors-ligne
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <ModeAffichageProvider>
    <HashRouter>
      <Routes>
        <Route path="/" element={<AccueilHorsLigne />} />
        <Route path="/visiteur" element={<CreationVisiteur />} />
        <Route path="/visiteur/fiche" element={<FicheVisiteur />} />
        <Route
          path="/regles"
          element={
            <CadreHorsLigne>
              <Regles />
            </CadreHorsLigne>
          }
        />
        <Route
          path="/encyclopedie"
          element={
            <CadreHorsLigne>
              <Encyclopedie />
            </CadreHorsLigne>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  </ModeAffichageProvider>,
);

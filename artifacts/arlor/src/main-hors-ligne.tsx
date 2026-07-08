import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

import { ModeAffichageProvider } from "@/contexts/ModeAffichageContext";
import AccueilHorsLigne from "@/pages/AccueilHorsLigne";
import CreationVisiteur from "@/pages/CreationVisiteur";
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
 */
createRoot(document.getElementById("root")!).render(
  <ModeAffichageProvider>
    <HashRouter>
      <Routes>
        <Route path="/" element={<AccueilHorsLigne />} />
        <Route path="/visiteur" element={<CreationVisiteur />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  </ModeAffichageProvider>,
);

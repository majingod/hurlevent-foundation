import type { PorteGenerateur } from "./portes";

/**
 * [VIS-8 lot 1] Écran d'accueil « Comment veux-tu créer ton personnage ? ».
 *
 * Présentation pure : le conteneur (`Generateur`) décide QUELLES portes sont
 * affichées (une porte n'apparaît que si elle est branchée — jamais de bouton
 * mort) et fournit leur action. Apparence = contrat maquette s346, déclinaison
 * lot 1 validée par Fred (s348).
 */

export interface PorteAffichee extends PorteGenerateur {
  onChoisir: () => void;
}

interface AccueilPortesProps {
  /** Sous-titre : diffère entre visiteur et connecté (validé Fred s348). */
  sousTitre: string;
  portes: readonly PorteAffichee[];
}

const AccueilPortes = ({ sousTitre, portes }: AccueilPortesProps) => (
  <div className="mx-auto max-w-2xl px-4 py-10">
    <h1 className="font-heading text-3xl text-gold">
      Comment veux-tu créer ton personnage ?
    </h1>
    <p className="mt-1 text-sm text-white/50">{sousTitre}</p>
    <div className="mt-5 grid gap-3">
      {portes.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={p.onChoisir}
          className="flex items-start gap-4 rounded-xl border border-white/10 bg-card p-4 text-left transition-colors hover:border-gold/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-accent"
        >
          <span aria-hidden className="text-3xl leading-none">
            {p.emoji}
          </span>
          <span>
            <span className="block font-heading text-lg text-gold-accent">
              {p.titre}
            </span>
            <span className="text-sm text-white/50">{p.description}</span>
          </span>
        </button>
      ))}
    </div>
  </div>
);

export default AccueilPortes;

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useModeAffichage } from "@/contexts/ModeAffichageContext";

// Rappel des règles de fouille — partagé fiche écran + feuilles imprimables (s299).
// Textes validés (Manuel corrigé 2026, section « Fouille d’un personnage
// inconscient ou immobile ») : ne pas reformuler.

export const FOUILLE_ABREGE =
  "Cible inconsciente, immobile ou ligotée seulement — jamais de contact réel sans consentement. Sans contact : désigner une zone (torse, dos, bras G/D, jambe G/D), mimer 30 s par zone → tout objet caché y est remis (sauf Cachette secrète, ruban rouge) ; fouille complète = 2 min (ne contre pas Cachette secrète). Avec consentement explicite : contact permis, révocable à tout moment.";

// Verbatim manuel, structuré en paragraphes. `pClassName` permet le double
// habillage : classes tailwind à l’écran, .fp-prose à l’impression.
const TexteFouilleIntegral = ({ pClassName }: { pClassName: string }) => (
  <>
    <p className={pClassName}>
      <strong>Fouille d’un personnage inconscient ou immobile</strong>
    </p>
    <p className={pClassName}>
      Lorsqu’un personnage est inconscient, immobile, ligoté ou incapable de se défendre, il peut
      être fouillé selon les règles suivantes. La fouille ne doit jamais impliquer de contact
      physique réel sans consentement.
    </p>
    <p className={pClassName}>
      <strong>Méthode 1 — Fouille sans contact réel.</strong> Le joueur effectuant la fouille
      doit : désigner clairement une zone précise du corps de la cible. Il doit mimer la fouille en
      jeu, sans contact intrusif et maintenir la fouille pendant 30 secondes complètes par zone.
    </p>
    <p className={pClassName}>
      Zones pouvant être fouillées individuellement : le torse • le dos • le bras gauche • le bras
      droit • la jambe gauche • la jambe droite.
    </p>
    <p className={pClassName}>
      À l’issue des 30 secondes, tout objet caché dans la zone désignée doit être révélé et remis,
      sans exception (sauf si le personnage utilise la compétence Cachette secrète et l’objet
      concerné aura un ruban rouge). Le personnage peut aussi faire une fouille complète, mais ça
      lui prendra 2 minutes, mais ça ne neutralise pas la compétence Cachette secrète.
    </p>
    <p className={pClassName}>
      <strong>Méthode 2 — Fouille avec consentement.</strong> Si la personne fouillée donne son
      consentement explicite et clair elle peut être fouillée avec contact, mais la personne peut
      annuler son consentement à tout moment et donner par elle-même les objets cachés sur elle.
    </p>
  </>
);

// Carte compacte repliable (patron manuel useState — PAS de Radix Accordion,
// gotcha s152). En-tête toujours visible, contenu replié par défaut ; déplié,
// il suit le mode global abrégé ⇄ intégral.
export const RappelFouille = () => {
  const { mode } = useModeAffichage();
  const [ouvert, setOuvert] = useState(false);

  return (
    <Card>
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="font-heading text-sm font-bold text-foreground">🔍 Règles de fouille</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${ouvert ? "rotate-180" : ""}`}
        />
      </button>
      {ouvert && (
        <CardContent className="space-y-2 pt-0">
          {mode === "abrege" ? (
            <p className="text-sm text-foreground/90">{FOUILLE_ABREGE}</p>
          ) : (
            <TexteFouilleIntegral pClassName="text-sm text-foreground/90" />
          )}
        </CardContent>
      )}
    </Card>
  );
};

// Bloc impression (FicheImprimable) : style sobre existant, encre économe.
export const RappelFouillePrint = ({ variante }: { variante: "abrege" | "integral" }) => (
  <>
    <h2>Règles de fouille</h2>
    <div className="fp-card">
      {variante === "abrege" ? (
        <p className="fp-prose" style={{ margin: 0 }}>{FOUILLE_ABREGE}</p>
      ) : (
        <TexteFouilleIntegral pClassName="fp-prose" />
      )}
    </div>
  </>
);

export default RappelFouille;

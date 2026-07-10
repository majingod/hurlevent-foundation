import { chargerBrouillon } from "./stockageBrouillon";

/** Étape du wizard atteinte une fois le personnage finalisé (cf. BUG C, s311). */
const ETAPE_FINALISATION = 11;

/** Pur + testable (s322) : un brouillon visiteur finalisé existe-t-il sur cet appareil ? */
export function brouillonFinaliseDisponible(): boolean {
  const brouillon = chargerBrouillon();
  return !!brouillon && brouillon.meta.etapeCourante >= ETAPE_FINALISATION;
}

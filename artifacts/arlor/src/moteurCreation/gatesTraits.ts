/**
 * Portage 1:1 de la RPC legacy public.peut_acheter_trait_racial (§3.7).
 *
 * ⚠️ Gate LEGACY : verdicts SANS champ `code`, messages avec fautes VOLONTAIRES
 * (« n est pas », « deja ») reproduites telles quelles. Fonction PURE sur le
 * snapshot race_traits + contexte local.
 *
 * Ordre des checks (verbatim serveur) :
 *   1. personnage introuvable — OMIS (le ctx EST le personnage).
 *   2. trait disponible pour la race (sémantique sous_type).
 *   3. trait déjà acquis.
 *   4. coût : 0 trait → gratuit (0 XP) ; sinon 10 XP.
 *   5. XP insuffisant (montant interpolé).
 *   6. OK.
 */

import { getSnapshot } from "./snapshot";
import type {
  ContexteTraitRacial,
  DemandeAchatTraitRacial,
  VerdictTraitRacial,
} from "./types";

interface RaceTraitRow {
  race_id: string;
  trait_id: string;
  sous_type: string | null;
}

export function peutAcheterTraitRacial(
  ctx: ContexteTraitRacial,
  demande: DemandeAchatTraitRacial
): VerdictTraitRacial {
  const raceTraits = getSnapshot().tables.race_traits as RaceTraitRow[];

  // 2. Disponibilité : EXISTS une ligne race_traits (race, trait) avec
  //    (p_sous_type IS NULL OR sous_type = p_sous_type OR sous_type IS NULL).
  const disponible = raceTraits.some(
    (rt) =>
      rt.race_id === demande.raceId &&
      rt.trait_id === demande.traitId &&
      (demande.sousType == null ||
        rt.sous_type === demande.sousType ||
        rt.sous_type == null)
  );
  if (!disponible) {
    return {
      peutAcheter: false,
      raison: "Ce trait n est pas disponible pour cette race",
    };
  }

  // 3. Déjà acquis : un élément de traits_raciaux_choisis contient {trait_id}.
  const dejaAcquis = ctx.traitsRaciauxChoisis.some(
    (t) => t != null && t.trait_id === demande.traitId
  );
  if (dejaAcquis) {
    return {
      peutAcheter: false,
      raison: "Ce trait est deja acquis",
    };
  }

  // 4. Coût : 0 trait actuel → gratuit ; sinon 10 XP.
  const nbTraits = ctx.traitsRaciauxChoisis.length;
  const coutXp = nbTraits === 0 ? 0 : 10;

  // 5. XP insuffisant (seulement si payant).
  if (coutXp > 0 && ctx.xpDispo < 10) {
    return {
      peutAcheter: false,
      raison: `XP insuffisant. Requis : 10 | Disponible : ${ctx.xpDispo}`,
    };
  }

  return {
    peutAcheter: true,
    raison: "OK",
    coutXp,
    estGratuit: coutXp === 0,
    nbTraitsActuels: nbTraits,
  };
}

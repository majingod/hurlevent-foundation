/**
 * Portage 1:1 des gates SQL public.peut_acheter_piege / _recette / _assemblage
 * (migration 20260703232626 = spec ligne à ligne).
 *
 * Règle d'or : reproduction au caractère près (guillemets « » compris) et
 * conservation des quirks serveur — notamment l'ABSENCE de contrôle de doublon
 * pour recettes/assemblages (le serveur s'appuie sur unique_violation à l'INSERT ;
 * les gates ne le voient pas). Fonctions PURES sur snapshot + contexte local.
 *
 * Différence assumée : PAS de branche `personnage_introuvable` (le ctx EST le perso).
 */

import { getSnapshot } from "./snapshot";
import {
  deriverNiveauxArtisanat,
  quotaPiegesNiveau,
  quotaRecettesPalier,
  quotaAssemblagesTotal,
} from "./deriveurs";
import type {
  ContextePiege,
  ContexteRecette,
  ContexteAssemblage,
  VerdictArtisanat,
} from "./types";

interface PiegeRow {
  id: string;
  nom: string | null;
  niveau: number | null;
  cout_xp: number | null;
}

interface RecetteRow {
  id: string;
  niveau_requis: number | null;
  cout_xp: number | null;
}

interface AssemblageRow {
  id: string;
  cout_xp: number | null;
}

function getPiege(id: string): PiegeRow | undefined {
  const pieges = getSnapshot().tables.pieges as PiegeRow[];
  return pieges.find((p) => p.id === id);
}

function getRecette(id: string): RecetteRow | undefined {
  const recettes = getSnapshot().tables.recettes_alchimie as RecetteRow[];
  return recettes.find((r) => r.id === id);
}

function getAssemblage(id: string): AssemblageRow | undefined {
  const assemblages = getSnapshot().tables.assemblages_runes as AssemblageRow[];
  return assemblages.find((a) => a.id === id);
}

export function peutAcheterPiege(
  ctx: ContextePiege,
  piegeId: string
): VerdictArtisanat {
  const piege = getPiege(piegeId);
  if (!piege) {
    return {
      peutAcheter: false,
      code: "piege_introuvable",
      raison: "Piège introuvable",
    };
  }

  const niveau = piege.niveau ?? 0;
  if (niveau < 1 || niveau > 3) {
    return {
      peutAcheter: false,
      code: "niveau_invalide_acquisition",
      raison: "Niveau de piège invalide",
    };
  }

  const { niveauPieges } = deriverNiveauxArtisanat(ctx.competencesAcquises);
  if (niveauPieges < 1) {
    return {
      peutAcheter: false,
      code: "niveau_requis_non_atteint",
      raison: "Compétence « Création et désarmement de piège » requise",
    };
  }

  // Palier déjà acquis (match nom + niveau).
  if (
    ctx.piegesAcquis.some(
      (p) => p.piegeNom === piege.nom && p.niveauAcquis === niveau
    )
  ) {
    return {
      peutAcheter: false,
      code: "piege_deja_possede",
      raison: "Ce palier de piège est déjà acquis",
    };
  }

  // Palier précédent requis (niveau > 1).
  if (
    niveau > 1 &&
    !ctx.piegesAcquis.some(
      (p) => p.piegeNom === piege.nom && p.niveauAcquis === niveau - 1
    )
  ) {
    return {
      peutAcheter: false,
      code: "palier_precedent_manquant",
      raison: "Le palier précédent doit être acquis avant celui-ci",
    };
  }

  // Gratuité : nb de gratuits déjà acquis au niveau visé vs quota.
  const quotaTotal = quotaPiegesNiveau(niveauPieges, niveau);
  const nbGratuits = ctx.piegesAcquis.filter(
    (p) => p.niveauAcquis === niveau && p.estGratuit === true
  ).length;

  let estGratuit: boolean;
  let coutXp: number;
  if (nbGratuits < quotaTotal) {
    estGratuit = true;
    coutXp = 0;
  } else {
    estGratuit = false;
    coutXp = piege.cout_xp ?? 0;
    if (ctx.xpDispo < coutXp) {
      return {
        peutAcheter: false,
        code: "xp_insuffisant",
        raison: "XP insuffisant",
      };
    }
  }

  return {
    peutAcheter: true,
    raison: "OK",
    coutXp,
    estGratuit,
  };
}

export function peutAcheterRecette(
  ctx: ContexteRecette,
  recetteId: string
): VerdictArtisanat {
  const recette = getRecette(recetteId);
  // SQL : SELECT niveau_requis, cout_xp ; niveau_requis IS NULL → introuvable.
  if (!recette || recette.niveau_requis == null) {
    return {
      peutAcheter: false,
      code: "recette_introuvable",
      raison: "Recette introuvable ou sans coût défini",
    };
  }

  const { niveauAlchimie } = deriverNiveauxArtisanat(ctx.competencesAcquises);
  if (niveauAlchimie < 1) {
    return {
      peutAcheter: false,
      code: "niveau_requis_non_atteint",
      raison: "Compétence Alchimie requise",
    };
  }

  const niveauRequis = recette.niveau_requis;
  if (niveauRequis > niveauAlchimie) {
    return {
      peutAcheter: false,
      code: "niveau_requis_non_atteint",
      raison: `Palier de recette non débloqué (niveau Alchimie ${niveauRequis} requis)`,
      champ: "niveau_requis",
    };
  }

  // Gratuité : count de TOUTES les recettes acquises du palier (gratuites OU
  // payantes) vs quota. PAS de contrôle de doublon (quirk serveur figé).
  const quotaPalier = quotaRecettesPalier(niveauAlchimie, niveauRequis);
  const countPalier = ctx.recettesAcquises.filter(
    (r) => getRecette(r.recetteId)?.niveau_requis === niveauRequis
  ).length;
  const coutPrevu =
    countPalier < quotaPalier ? 0 : recette.cout_xp ?? 0;

  if (coutPrevu > 0 && ctx.xpDispo < coutPrevu) {
    return {
      peutAcheter: false,
      code: "xp_insuffisant",
      raison: "XP insuffisant",
    };
  }

  return {
    peutAcheter: true,
    raison: "OK",
    coutXp: coutPrevu,
    estGratuit: coutPrevu === 0,
  };
}

export function peutAcheterAssemblage(
  ctx: ContexteAssemblage,
  assemblageId: string
): VerdictArtisanat {
  const assemblage = getAssemblage(assemblageId);
  // SQL : SELECT cout_xp ; cout_xp IS NULL → introuvable.
  if (!assemblage || assemblage.cout_xp == null) {
    return {
      peutAcheter: false,
      code: "assemblage_introuvable",
      raison: "Assemblage introuvable ou sans coût défini",
    };
  }

  const { niveauRunes } = deriverNiveauxArtisanat(ctx.competencesAcquises);
  if (niveauRunes < 1) {
    return {
      peutAcheter: false,
      code: "niveau_requis_non_atteint",
      raison: "Compétence Assemblage de Runes requise",
    };
  }

  // Gratuité : count TOTAL des assemblages acquis (sans filtre) vs quota total.
  // PAS de contrôle de doublon (quirk serveur figé).
  const quotaTotal = quotaAssemblagesTotal(niveauRunes);
  const count = ctx.assemblagesAcquis.length;
  const coutPrevu = count < quotaTotal ? 0 : assemblage.cout_xp ?? 0;

  if (coutPrevu > 0 && ctx.xpDispo < coutPrevu) {
    return {
      peutAcheter: false,
      code: "xp_insuffisant",
      raison: "XP insuffisant",
    };
  }

  return {
    peutAcheter: true,
    raison: "OK",
    coutXp: coutPrevu,
    estGratuit: coutPrevu === 0,
  };
}

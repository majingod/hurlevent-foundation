/**
 * Portage 1:1 des gates SQL public.peut_acheter_sort / peut_acheter_priere
 * (migration 20260703232550 = spec ligne à ligne).
 *
 * Règle d'or : on REPRODUIT le serveur au caractère près (accents inclus : sorts
 * SANS accents, prières AVEC). Fonctions PURES sur snapshot + contexte local.
 *
 * Différence assumée avec le SQL : PAS de branche `personnage_introuvable` — le
 * contexte EST le personnage local (les fixtures n'en produisent jamais).
 */

import { calculerCoutXP, calculerDureeIncantation } from "@/utils/calculsMagie";
import { getSnapshot } from "./snapshot";
import { genererFormuleMagique } from "./formuleMagique";
import {
  deriverCerclesDisponibles,
  deriverDomainesDisponibles,
} from "./deriveurs";
import type {
  ContexteMagie,
  DemandeAchatSort,
  DemandeAchatPriere,
  VerdictSort,
  VerdictPriere,
} from "./types";

interface SortRow {
  id: string;
  cercle: string | null;
  cout_xp_base: number | null;
}

interface PriereRow {
  id: string;
  domaine: string | null;
  cout_xp_base: number | null;
}

function getSort(id: string): SortRow | undefined {
  const sorts = getSnapshot().tables.sorts as SortRow[];
  return sorts.find((s) => s.id === id);
}

function getPriere(id: string): PriereRow | undefined {
  const prieres = getSnapshot().tables.prieres as PriereRow[];
  return prieres.find((p) => p.id === id);
}

export function peutAcheterSort(
  ctx: ContexteMagie,
  demande: DemandeAchatSort
): VerdictSort {
  // Lookup sort (SQL : SELECT cercle, cout_xp_base ; cercle IS NULL → introuvable).
  const sort = getSort(demande.sortId);
  if (!sort || sort.cercle == null) {
    return {
      peutAcheter: false,
      code: "sort_introuvable",
      raison: "Sort introuvable",
    };
  }

  // Coût XP (miroir calculer_cout_xp_magie) — calculé avant les gates niveau/xp.
  const coutXp = calculerCoutXP(
    demande.zoneChoisie,
    demande.porteeChoisie,
    demande.dureeChoisie,
    demande.niveauSort,
    sort.cout_xp_base ?? 0
  );

  // Formule magique (retournée uniquement dans le verdict OK).
  const formuleMagique = genererFormuleMagique(
    sort.cercle,
    demande.zoneChoisie,
    demande.porteeChoisie,
    demande.dureeChoisie,
    demande.niveauSort
  );

  // Niveau max du cercle (vue_cercles_disponibles).
  const cercles = deriverCerclesDisponibles(ctx.competencesAcquises);
  const niveauMax = cercles.get(sort.cercle);
  if (niveauMax == null || demande.niveauSort > niveauMax) {
    return {
      peutAcheter: false,
      code: "niveau_invalide",
      raison: "Niveau de sort superieur au maximum autorise pour ce cercle",
    };
  }

  if (ctx.xpDispo < coutXp) {
    return {
      peutAcheter: false,
      code: "xp_insuffisant",
      raison: "XP insuffisant",
    };
  }

  return {
    peutAcheter: true,
    raison: "OK",
    coutXp,
    formuleMagique,
    niveauMaxCercle: niveauMax,
  };
}

export function peutAcheterPriere(
  ctx: ContexteMagie,
  demande: DemandeAchatPriere
): VerdictPriere {
  // Lookup prière (SQL : SELECT * ; NOT FOUND → introuvable).
  const priere = getPriere(demande.priereId);
  if (!priere) {
    return {
      peutAcheter: false,
      code: "priere_introuvable",
      raison: "Prière introuvable",
    };
  }

  const coutXp = calculerCoutXP(
    demande.zoneChoisie,
    demande.porteeChoisie,
    demande.dureeChoisie,
    demande.niveauPriere,
    priere.cout_xp_base ?? 0
  );

  const domaines = deriverDomainesDisponibles(
    ctx.competencesAcquises,
    ctx.religionId ?? null
  );
  const niveauMax =
    priere.domaine != null ? domaines.get(priere.domaine) : undefined;
  if (niveauMax == null || demande.niveauPriere > niveauMax) {
    return {
      peutAcheter: false,
      code: "niveau_invalide",
      raison:
        "Niveau de prière supérieur au maximum autorisé pour ce domaine",
    };
  }

  if (ctx.xpDispo < coutXp) {
    return {
      peutAcheter: false,
      code: "xp_insuffisant",
      raison: "XP insuffisant",
    };
  }

  const dureeIncantationCalculee = calculerDureeIncantation(
    demande.porteeChoisie,
    demande.zoneChoisie,
    demande.dureeChoisie,
    demande.niveauPriere
  );

  return {
    peutAcheter: true,
    raison: "OK",
    coutXp,
    dureeIncantationCalculee,
    niveauMaxDomaine: niveauMax,
  };
}

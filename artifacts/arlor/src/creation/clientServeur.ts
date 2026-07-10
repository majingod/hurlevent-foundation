import { supabase } from "@/integrations/supabase/client";
import type { ClientCreation } from "./types";
import { TABLE_SOURCE_ENCYCLOPEDIE } from "./encyclopedie";

/**
 * Implémentation serveur du guichet `ClientCreation` : passe-plat strict vers
 * supabase-js. Chaque méthode reproduit l'appel du site d'origine à l'identique
 * (mêmes colonnes, mêmes filtres, même `.single()/.maybeSingle()`, même `.order()`).
 * Aucune logique métier ici — le passe-plat est bête.
 */
export const clientServeur: ClientCreation = {
  // ── Écritures (RPC) ──

  async demarrerCreationPersonnage(params) {
    return await supabase.rpc("demarrer_creation_personnage", params);
  },

  async etatEditionPersonnage(params) {
    return await supabase.rpc("etat_edition_personnage", params);
  },

  async avancerEtape(params) {
    return await supabase.rpc("avancer_etape", params);
  },

  async validerPersonnageFinal(params) {
    return await supabase.rpc("valider_personnage_final", params);
  },

  async corrigerXpPersonnage(params) {
    return await supabase.rpc("corriger_xp_personnage", params);
  },

  async sauvegarderEtape1(params) {
    return await supabase.rpc("sauvegarder_etape_1", params);
  },

  async sauvegarderEtape2(params) {
    return await supabase.rpc("sauvegarder_etape_2", params);
  },

  async sauvegarderEtape3(params) {
    return await supabase.rpc("sauvegarder_etape_3", params);
  },

  async sauvegarderEtape4(params) {
    return await supabase.rpc("sauvegarder_etape_4", params);
  },

  async changerClassePersonnage(params) {
    return await supabase.rpc("changer_classe_personnage", params);
  },

  async verifierPrerequisCompetences(params) {
    return await supabase.rpc("verifier_prerequis_competences", params);
  },

  async apercuRabaisAcquisitionCompetence(params) {
    return await supabase.rpc("apercu_rabais_acquisition_competence", params);
  },

  async acheterCompetence(params) {
    return await supabase.rpc("acheter_competence", params);
  },

  async desacheterCompetence(params) {
    return await supabase.rpc("desacheter_competence", params);
  },

  async acheterSort(params) {
    return await supabase.rpc("acheter_sort", params);
  },

  async desacheterSort(params) {
    return await supabase.rpc("desacheter_sort", params);
  },

  async modifierSort(params) {
    return await supabase.rpc("modifier_sort", params);
  },

  async acheterPriere(params) {
    return await supabase.rpc("acheter_priere", params);
  },

  async desacheterPriere(params) {
    return await supabase.rpc("desacheter_priere", params);
  },

  async modifierPriere(params) {
    return await supabase.rpc("modifier_priere", params);
  },

  async acheterRecette(params) {
    return await supabase.rpc("acheter_recette", params);
  },

  async desacheterRecette(params) {
    return await supabase.rpc("desacheter_recette", params);
  },

  async acheterPiege(params) {
    return await supabase.rpc("acheter_piege", params);
  },

  async desacheterPiege(params) {
    return await supabase.rpc("desacheter_piege", params);
  },

  async acheterAssemblage(params) {
    return await supabase.rpc("acheter_assemblage", params);
  },

  async desacheterAssemblage(params) {
    return await supabase.rpc("desacheter_assemblage", params);
  },

  // ── Lectures (catalogue + état perso) ──

  async lirePersonnage(personnageId) {
    return await supabase
      .from("personnages")
      .select("*")
      .eq("id", personnageId)
      .single();
  },

  async lirePersonnageIdentite(personnageId) {
    return await supabase
      .from("personnages")
      .select(
        "nom, gn_completes, mini_gn_completes, ouvertures_terrain, est_croyant, religion_id, historique, ame_personnage",
      )
      .eq("id", personnageId)
      .single();
  },

  async lirePersonnageRace(personnageId) {
    return await supabase
      .from("personnages")
      .select("race_id, sous_type_chimeride, traits_raciaux_choisis, xp_total")
      .eq("id", personnageId)
      .single();
  },

  async lirePersonnageClasse(personnageId) {
    return await supabase
      .from("personnages")
      .select("classe_id, race_id, religion_id, est_croyant, nom")
      .eq("id", personnageId)
      .single();
  },

  async lirePersonnageReligion(personnageId) {
    return await supabase
      .from("personnages")
      .select("id, religion_id")
      .eq("id", personnageId)
      .single();
  },

  async lirePersonnageProgression(personnageId) {
    return await supabase
      .from("personnages")
      .select("id, nom, etape_creation, xp_total, xp_depense")
      .eq("id", personnageId)
      .single();
  },

  async lireRaces() {
    return await supabase
      .from("races")
      .select(
        "id, nom, nom_latin, description, resume_condense, xp_depart, emoji, esperance_vie, exigences_costume, restrictions_classes, nb_traits_raciaux, est_jouable",
      )
      .eq("est_actif", true)
      .eq("est_jouable", true)
      .order("nom");
  },

  async lireRace(raceId) {
    return await supabase
      .from("races")
      .select("id, nom, restrictions_classes")
      .eq("id", raceId)
      .single();
  },

  async lireClasses() {
    return await supabase
      .from("classes")
      .select(
        "id, nom, description, resume_condense, emoji, role_combat, pv_depart, ps_depart, competences_gratuites",
      )
      .eq("est_actif", true)
      .order("nom");
  },

  async lireClasse(classeId) {
    return await supabase
      .from("classes")
      .select("id, nom")
      .eq("id", classeId)
      .single();
  },

  async lireCompetences() {
    return await supabase
      .from("competences")
      .select("*")
      .eq("est_actif", true)
      .order("nom");
  },

  async lireCompetencesParIds(ids) {
    return await supabase
      .from("competences")
      .select("id, nom, type_choix, type_achat, niveaux")
      .in("id", ids);
  },

  async lireSorts(cercle, niveauMax) {
    return await supabase
      .from("sorts")
      .select("*")
      .eq("cercle", cercle)
      .lte("niveau", niveauMax)
      .eq("est_actif", true)
      .order("nom");
  },

  async lireSortsCercles() {
    return await supabase
      .from("sorts")
      .select("cercle")
      .eq("est_actif", true)
      .not("cercle", "is", null);
  },

  async lirePrieres(domaine, niveauMax) {
    return await supabase
      .from("prieres")
      .select("*")
      .eq("domaine", domaine)
      .lte("niveau", niveauMax)
      .eq("est_actif", true)
      .order("nom");
  },

  async lirePrieresDomaines() {
    return await supabase
      .from("prieres")
      .select("domaine")
      .eq("est_actif", true)
      .not("domaine", "is", null);
  },

  async lireReligions() {
    return await supabase
      .from("religions")
      .select("*")
      .eq("est_actif", true)
      .order("nom");
  },

  async lireReligionsCatalogue() {
    return await supabase
      .from("religions")
      .select(
        "id, nom, description, dirigeant, fondateur, symbole_sacre, pouvoir_symbole, domaines_principaux, domaines_proscrits, lore_fiche, rituels_fiche, lore_manuel, rituels_manuel",
      )
      .eq("est_actif", true)
      .order("nom");
  },

  async lireReligionsFiches() {
    return await supabase
      .from("religions")
      .select(
        "id, nom, dirigeant, fondateur, symbole_sacre, pouvoir_symbole, domaines_principaux, domaines_proscrits, lore_fiche, rituels_fiche, lore_manuel, rituels_manuel",
      )
      .eq("est_actif", true);
  },

  async lireReligionProscrits(religionId) {
    return await supabase
      .from("religions")
      .select("domaines_proscrits")
      .eq("id", religionId)
      .single();
  },

  async lireLangues() {
    return await supabase
      .from("langues")
      .select("id, nom, est_ancienne")
      .eq("est_actif", true)
      .order("ordre");
  },

  async lireLanguesAnciennes() {
    return await supabase
      .from("langues")
      .select("id, nom, ordre")
      .eq("est_ancienne", true)
      .eq("est_actif", true)
      .order("ordre", { ascending: true })
      .order("nom");
  },

  async lireCategoriesCreatures() {
    return await supabase
      .from("categories_creatures")
      .select("id, nom, ordre")
      .eq("est_actif", true)
      .order("ordre");
  },

  async lireFamillesCriminelles() {
    return await supabase
      .from("familles_criminelles")
      .select("id, nom")
      .eq("est_actif", true)
      .order("nom");
  },

  async lirePieges() {
    return await supabase
      .from("pieges")
      .select("*")
      .eq("est_actif", true)
      .order("nom")
      .order("niveau");
  },

  async lireRecettesAlchimie(niveauMax) {
    return await supabase
      .from("recettes_alchimie")
      .select("*")
      .eq("est_actif", true)
      .lte("niveau_requis", niveauMax)
      .order("niveau_requis")
      .order("nom");
  },

  async lireObjetsForge() {
    return await supabase
      .from("objets_forge")
      .select(
        "*, reparation:reparations_forge!reparation_id(nom_affichage, temps_minutes, temps_rare_minutes, materiaux, materiaux_rares)",
      )
      .eq("est_actif", true)
      .order("temps_fabrication_minutes")
      .order("nom");
  },

  async lireObjetsJoaillerie() {
    return await supabase
      .from("objets_joaillerie")
      .select("*")
      .eq("est_actif", true)
      .order("temps_fabrication_minutes")
      .order("nom");
  },

  async lireAssemblagesRunes() {
    return await supabase
      .from("assemblages_runes")
      .select("*")
      .eq("est_actif", true)
      .order("nom");
  },

  async lireFicheSchemaChampsV2(categorie) {
    return await supabase
      .from("fiches_schemas")
      .select("champs_v2")
      .eq("categorie", categorie)
      .maybeSingle();
  },

  async lireFicheListe(categorie) {
    return await supabase
      .from("fiches_listes")
      .select("*")
      .eq("categorie", categorie)
      .maybeSingle();
  },

  async lireCatalogueEncyclopedie(categorie) {
    return (await supabase
      .from(TABLE_SOURCE_ENCYCLOPEDIE[categorie] as never)
      .select("*")
      .eq("est_actif", true)
      .order("nom")) as never;
  },

  async lireSectionsRegles(categories) {
    return await supabase
      .from("sections_regles")
      .select("*")
      .in("categorie", categories)
      .eq("est_actif", true)
      .order("categorie")
      .order("ordre");
  },

  async lireEffetsCombat() {
    return await supabase
      .from("effets_combat")
      .select("*")
      .order("nom", { ascending: true });
  },

  async lireReparationsForge() {
    return await supabase
      .from("reparations_forge")
      .select("*")
      .eq("est_actif", true);
  },

  async lireRaceTraits() {
    return await supabase.from("race_traits").select("race_id, trait_id");
  },

  async lireParametresJeu() {
    return await supabase
      .from("parametres_jeu")
      .select("lien_facebook, lien_discord, texte_envoi_photos_race")
      .limit(1)
      .maybeSingle();
  },

  async lireTraitsParRace(raceId, sousType) {
    let q = supabase
      .from("vue_traits_par_race")
      .select(
        "trait_id, sous_type, trait_nom, trait_description, trait_texte_manuel, trait_resume_condense, cout_xp",
      )
      .eq("race_id", raceId);
    if (sousType) {
      q = q.or(`sous_type.eq.${sousType},sous_type.is.null`);
    } else {
      q = q.is("sous_type", null);
    }
    return await q.order("trait_nom");
  },

  async lireDomainesDisponibles(personnageId) {
    return await supabase
      .from("vue_domaines_disponibles")
      .select("domaine, niveau_max_prieres, personnage_id")
      .eq("personnage_id", personnageId)
      .order("domaine");
  },

  async lireCerclesDisponibles(personnageId) {
    return await supabase
      .from("vue_cercles_disponibles")
      .select("cercle, niveau_max_sorts, personnage_id")
      .eq("personnage_id", personnageId)
      .order("cercle");
  },

  async lireArtisanatQuotas(personnageId) {
    return await supabase
      .from("vue_artisanat_quotas")
      .select("*")
      .eq("personnage_id", personnageId)
      .maybeSingle();
  },

  async lirePersonnageCompetences(personnageId) {
    return await supabase
      .from("personnage_competences")
      .select("*")
      .eq("personnage_id", personnageId);
  },

  async lirePersonnageCompetencesNoms(personnageId) {
    return await supabase
      .from("personnage_competences")
      .select("competences(nom)")
      .eq("personnage_id", personnageId);
  },

  async lireNiveauCompetenceParNom(personnageId, nomCompetence) {
    return await supabase
      .from("personnage_competences")
      .select("niveau_acquis, competences!inner(nom)")
      .eq("personnage_id", personnageId)
      .eq("competences.nom", nomCompetence)
      .order("niveau_acquis", { ascending: false })
      .limit(1);
  },

  async lirePersonnageSorts(personnageId) {
    return await supabase
      .from("personnage_sorts")
      .select(
        "*, sorts(nom, cercle, zone_effet, portee, duree, cout_xp_base, bonus_niveau, resume_condense, description, description_tronc, paliers, type_sort, effet_instance)",
      )
      .eq("personnage_id", personnageId)
      .order("date_acquisition");
  },

  async lirePersonnagePrieres(personnageId) {
    return await supabase
      .from("personnage_prieres")
      .select(
        "*, prieres(nom, domaine, zone_effet, portee, duree, cout_xp_base, bonus_niveau, resume_condense, description, description_tronc, paliers, type_priere, effet_instance)",
      )
      .eq("personnage_id", personnageId)
      .order("date_acquisition");
  },

  async lirePersonnagePieges(personnageId) {
    return await supabase
      .from("personnage_pieges")
      .select("*")
      .eq("personnage_id", personnageId);
  },

  async lirePersonnageRecettes(personnageId) {
    return await supabase
      .from("personnage_recettes")
      .select("*")
      .eq("personnage_id", personnageId);
  },

  async lirePersonnageAssemblages(personnageId) {
    return await supabase
      .from("personnage_assemblages")
      .select("*")
      .eq("personnage_id", personnageId);
  },

  // HL-RECAP (s313) : lectures de la fiche au format des vues d'affichage.
  // Serveur = requêtes historiques de FichePersonnageView déplacées verbatim ;
  // visiteur = adaptateur brouillon (lot 3).

  async lireFichePersonnage(personnageId) {
    return await supabase
      .from("vue_fiche_personnage")
      .select("*")
      .eq("id", personnageId)
      .single();
  },

  async lireFicheCompetences(personnageId) {
    return await supabase
      .from("vue_competences_personnage")
      .select("*")
      .eq("personnage_id", personnageId)
      .order("categorie")
      .order("nom");
  },

  async lireFicheSorts(personnageId) {
    return await supabase
      .from("vue_sorts_personnage")
      .select("*")
      .eq("personnage_id", personnageId)
      .order("cercle")
      .order("nom_personnalise");
  },

  async lireFichePrieres(personnageId) {
    return await supabase
      .from("vue_prieres_personnage")
      .select("*")
      .eq("personnage_id", personnageId)
      .order("domaine")
      .order("nom_personnalise");
  },

  async lireFicheAssemblages(personnageId) {
    return await supabase
      .from("vue_assemblages_personnage")
      .select("*")
      .eq("personnage_id", personnageId)
      .order("nom");
  },

  async lireFicheRecettes(personnageId) {
    return await supabase
      .from("personnage_recettes")
      .select(
        "id, personnage_id, xp_depense, recettes_alchimie(nom, type, niveau_requis, description, effet, formule, ingredients, description_verbatim, resume_condense)"
      )
      .eq("personnage_id", personnageId);
  },

  async lireFicheArtisanatEtat(personnageId) {
    return await supabase
      .from("vue_artisanat_etat")
      .select("niveau_alchimie, niveau_forge, niveau_joaillerie, niveau_pieges, niveau_runes")
      .eq("personnage_id", personnageId)
      .maybeSingle();
  },

  async lireFichePieges(personnageId) {
    return await supabase
      .from("personnage_pieges")
      .select("*")
      .eq("personnage_id", personnageId);
  },

  async lireFicheManipulations(niveauMax) {
    return await supabase
      .from("ingredients_alchimiques")
      .select("id, nom, niveau, manipulations")
      .lte("niveau", niveauMax)
      .order("niveau")
      .order("nom");
  },

  async lireFicheObjetsForge() {
    return await supabase
      .from("objets_forge")
      .select(
        "id, nom, description, resume_condense, type, cout_xp, temps_fabrication_minutes, materiaux_communs, materiaux_rares, non_reparable, reparation:reparations_forge!reparation_id(nom_affichage, temps_minutes, materiaux)"
      )
      .eq("est_actif", true)
      .order("temps_fabrication_minutes")
      .order("nom");
  },

  async lireFicheObjetsJoaillerie() {
    return await supabase
      .from("objets_joaillerie")
      .select("id, nom, description, resume_condense, effet, cout_xp, temps_fabrication_minutes, temps_rare_minutes, materiaux_communs, materiaux_rares")
      .eq("est_actif", true)
      .order("temps_fabrication_minutes")
      .order("nom");
  },

  async lireFichePiegesCatalogue(niveauMax) {
    return await supabase
      .from("pieges")
      .select("*")
      .eq("est_actif", true)
      .lte("niveau", niveauMax)
      .order("nom")
      .order("niveau");
  },

  async lireFicheLangues() {
    return await supabase
      .from("langues")
      .select("id, nom");
  },

  async lireFicheReligions() {
    return await supabase
      .from("religions")
      .select(
        "id, nom, dirigeant, fondateur, symbole_sacre, pouvoir_symbole, domaines_principaux, domaines_proscrits, lore_fiche, rituels_fiche, lore_manuel, rituels_manuel"
      );
  },
};

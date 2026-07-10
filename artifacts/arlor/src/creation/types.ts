import type { Database } from "@/integrations/supabase/types";
import type { CategorieEncyclopedie } from "./encyclopedie";
import type { ResultatRechercheEncyclopedie } from "./visiteur/rechercheEncyclopedieLocale";

/**
 * Guichet unique de la création de personnage (mode visiteur — P2).
 *
 * Toute la couche « écrans du wizard » (`components/createur/`) appellera cette
 * interface au lieu de `supabase` directement. Deux implémentations :
 *  - `clientServeur` (cette PR a1) : passe-plat strict vers `supabase`.
 *  - implémentation locale sur `moteurCreation/` (PR future a3) pour le visiteur.
 *
 * Règle de conception : chaque méthode reproduit EXACTEMENT la forme de retour
 * de supabase-js — `{ data, error }` — sans normalisation ni remapping, pour que
 * le recâblage en a2 se fasse en une ligne (`supabase.rpc(x)` → `client.x()`) et
 * que le code aval (`payload.succes !== true`, `payload.erreurs?.[0]`…) reste
 * intact.
 */

type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];
type Fonctions = Database["public"]["Functions"];

type RowT<K extends keyof Tables> = Tables[K]["Row"];
type RowV<K extends keyof Views> = Views[K]["Row"];
type ArgsR<K extends keyof Fonctions> = Fonctions[K]["Args"];
type RetourR<K extends keyof Fonctions> = Fonctions[K]["Returns"];

/**
 * Forme de réponse supabase-js reproduite à l'identique. `error` est réduit à
 * `{ message }` : c'est le seul champ lu par le code appelant, et `PostgrestError`
 * y est structurellement assignable.
 */
export type Reponse<D> = { data: D | null; error: { message: string } | null };

// ── Formes jointes (embeds supabase to-one, nullables) ──

/** Ligne `personnage_sorts` jointe au catalogue `sorts`. */
export type LigneSortAcquis = RowT<"personnage_sorts"> & {
  sorts: Pick<
    RowT<"sorts">,
    | "nom"
    | "cercle"
    | "zone_effet"
    | "portee"
    | "duree"
    | "cout_xp_base"
    | "bonus_niveau"
    | "resume_condense"
    | "description"
    | "description_tronc"
    | "paliers"
    | "type_sort"
    | "effet_instance"
  > | null;
};

/** Ligne `personnage_prieres` jointe au catalogue `prieres`. */
export type LignePriereAcquise = RowT<"personnage_prieres"> & {
  prieres: Pick<
    RowT<"prieres">,
    | "nom"
    | "domaine"
    | "zone_effet"
    | "portee"
    | "duree"
    | "cout_xp_base"
    | "bonus_niveau"
    | "resume_condense"
    | "description"
    | "description_tronc"
    | "paliers"
    | "type_priere"
    | "effet_instance"
  > | null;
};

/** Ligne `objets_forge` jointe à sa réparation (`reparations_forge`). */
export type LigneObjetForge = RowT<"objets_forge"> & {
  reparation: Pick<
    RowT<"reparations_forge">,
    | "nom_affichage"
    | "temps_minutes"
    | "temps_rare_minutes"
    | "materiaux"
    | "materiaux_rares"
  > | null;
};

/** Ligne `personnage_recettes` jointe au catalogue `recettes_alchimie` (fiche). */
export type LigneRecetteFiche = Pick<
  RowT<"personnage_recettes">,
  "id" | "personnage_id" | "xp_depense"
> & {
  recettes_alchimie: Pick<
    RowT<"recettes_alchimie">,
    | "nom"
    | "type"
    | "niveau_requis"
    | "description"
    | "effet"
    | "formule"
    | "ingredients"
    | "description_verbatim"
    | "resume_condense"
  > | null;
};

/** Ligne `objets_forge` (fiche) jointe à sa réparation — jeu de colonnes réduit. */
export type LigneObjetForgeFiche = Pick<
  RowT<"objets_forge">,
  | "id"
  | "nom"
  | "description"
  | "resume_condense"
  | "type"
  | "cout_xp"
  | "temps_fabrication_minutes"
  | "materiaux_communs"
  | "materiaux_rares"
  | "non_reparable"
> & {
  reparation: Pick<
    RowT<"reparations_forge">,
    "nom_affichage" | "temps_minutes" | "materiaux"
  > | null;
};

/** Niveau max d'une compétence par nom (`personnage_competences` + `competences!inner`). */
export type NiveauCompetence = {
  niveau_acquis: number;
  competences: { nom: string | null };
};

/** Nom de compétence lié (`personnage_competences` + `competences(nom)`). */
export type CompetenceNom = {
  competences: { nom: string | null } | null;
};

export interface ClientCreation {
  // ─────────────────────────────────────────────────────────────────────────
  // ── Écritures (RPC) ──
  // ─────────────────────────────────────────────────────────────────────────

  /** RPC: demarrer_creation_personnage */
  demarrerCreationPersonnage(
    params: ArgsR<"demarrer_creation_personnage">,
  ): Promise<Reponse<RetourR<"demarrer_creation_personnage">>>;

  /** RPC: etat_edition_personnage */
  etatEditionPersonnage(
    params: ArgsR<"etat_edition_personnage">,
  ): Promise<Reponse<RetourR<"etat_edition_personnage">>>;

  /** RPC: avancer_etape */
  avancerEtape(
    params: ArgsR<"avancer_etape">,
  ): Promise<Reponse<RetourR<"avancer_etape">>>;

  /** RPC: valider_personnage_final */
  validerPersonnageFinal(
    params: ArgsR<"valider_personnage_final">,
  ): Promise<Reponse<RetourR<"valider_personnage_final">>>;

  /** RPC: corriger_xp_personnage */
  corrigerXpPersonnage(
    params: ArgsR<"corriger_xp_personnage">,
  ): Promise<Reponse<RetourR<"corriger_xp_personnage">>>;

  /** RPC: sauvegarder_etape_1 */
  sauvegarderEtape1(
    params: ArgsR<"sauvegarder_etape_1">,
  ): Promise<Reponse<RetourR<"sauvegarder_etape_1">>>;

  /** RPC: sauvegarder_etape_2 */
  sauvegarderEtape2(
    params: ArgsR<"sauvegarder_etape_2">,
  ): Promise<Reponse<RetourR<"sauvegarder_etape_2">>>;

  /** RPC: sauvegarder_etape_3 */
  sauvegarderEtape3(
    params: ArgsR<"sauvegarder_etape_3">,
  ): Promise<Reponse<RetourR<"sauvegarder_etape_3">>>;

  /** RPC: sauvegarder_etape_4 */
  sauvegarderEtape4(
    params: ArgsR<"sauvegarder_etape_4">,
  ): Promise<Reponse<RetourR<"sauvegarder_etape_4">>>;

  /** RPC: changer_classe_personnage */
  changerClassePersonnage(
    params: ArgsR<"changer_classe_personnage">,
  ): Promise<Reponse<RetourR<"changer_classe_personnage">>>;

  /** RPC: verifier_prerequis_competences */
  verifierPrerequisCompetences(
    params: ArgsR<"verifier_prerequis_competences">,
  ): Promise<Reponse<RetourR<"verifier_prerequis_competences">>>;

  /** RPC: apercu_rabais_acquisition_competence */
  apercuRabaisAcquisitionCompetence(
    params: ArgsR<"apercu_rabais_acquisition_competence">,
  ): Promise<Reponse<RetourR<"apercu_rabais_acquisition_competence">>>;

  /** RPC: acheter_competence */
  acheterCompetence(
    params: ArgsR<"acheter_competence">,
  ): Promise<Reponse<RetourR<"acheter_competence">>>;

  /** RPC: desacheter_competence */
  desacheterCompetence(
    params: ArgsR<"desacheter_competence">,
  ): Promise<Reponse<RetourR<"desacheter_competence">>>;

  /** RPC: acheter_sort */
  acheterSort(
    params: ArgsR<"acheter_sort">,
  ): Promise<Reponse<RetourR<"acheter_sort">>>;

  /** RPC: desacheter_sort */
  desacheterSort(
    params: ArgsR<"desacheter_sort">,
  ): Promise<Reponse<RetourR<"desacheter_sort">>>;

  /** RPC: modifier_sort */
  modifierSort(
    params: ArgsR<"modifier_sort">,
  ): Promise<Reponse<RetourR<"modifier_sort">>>;

  /** RPC: acheter_priere */
  acheterPriere(
    params: ArgsR<"acheter_priere">,
  ): Promise<Reponse<RetourR<"acheter_priere">>>;

  /** RPC: desacheter_priere */
  desacheterPriere(
    params: ArgsR<"desacheter_priere">,
  ): Promise<Reponse<RetourR<"desacheter_priere">>>;

  /** RPC: modifier_priere */
  modifierPriere(
    params: ArgsR<"modifier_priere">,
  ): Promise<Reponse<RetourR<"modifier_priere">>>;

  /** RPC: acheter_recette */
  acheterRecette(
    params: ArgsR<"acheter_recette">,
  ): Promise<Reponse<RetourR<"acheter_recette">>>;

  /** RPC: desacheter_recette */
  desacheterRecette(
    params: ArgsR<"desacheter_recette">,
  ): Promise<Reponse<RetourR<"desacheter_recette">>>;

  /** RPC: acheter_piege */
  acheterPiege(
    params: ArgsR<"acheter_piege">,
  ): Promise<Reponse<RetourR<"acheter_piege">>>;

  /** RPC: desacheter_piege */
  desacheterPiege(
    params: ArgsR<"desacheter_piege">,
  ): Promise<Reponse<RetourR<"desacheter_piege">>>;

  /** RPC: acheter_assemblage */
  acheterAssemblage(
    params: ArgsR<"acheter_assemblage">,
  ): Promise<Reponse<RetourR<"acheter_assemblage">>>;

  /** RPC: desacheter_assemblage */
  desacheterAssemblage(
    params: ArgsR<"desacheter_assemblage">,
  ): Promise<Reponse<RetourR<"desacheter_assemblage">>>;

  // ─────────────────────────────────────────────────────────────────────────
  // ── Lectures (catalogue + état perso) ──
  // ─────────────────────────────────────────────────────────────────────────

  // Personnage (état) — formes distinctes suffixées par le jeu de colonnes lu.

  /** SELECT: personnages (*, .eq id, .single) */
  lirePersonnage(personnageId: string): Promise<Reponse<RowT<"personnages">>>;

  /** SELECT: personnages (identité étape 1, .eq id, .single) */
  lirePersonnageIdentite(
    personnageId: string,
  ): Promise<
    Reponse<
      Pick<
        RowT<"personnages">,
        | "nom"
        | "gn_completes"
        | "mini_gn_completes"
        | "ouvertures_terrain"
        | "est_croyant"
        | "religion_id"
        | "historique"
        | "ame_personnage"
      >
    >
  >;

  /** SELECT: personnages (race/traits/xp, .eq id, .single) */
  lirePersonnageRace(
    personnageId: string,
  ): Promise<
    Reponse<
      Pick<
        RowT<"personnages">,
        "race_id" | "sous_type_chimeride" | "traits_raciaux_choisis" | "xp_total"
      >
    >
  >;

  /** SELECT: personnages (classe/race/religion, .eq id, .single) */
  lirePersonnageClasse(
    personnageId: string,
  ): Promise<
    Reponse<
      Pick<
        RowT<"personnages">,
        "classe_id" | "race_id" | "religion_id" | "est_croyant" | "nom"
      >
    >
  >;

  /** SELECT: personnages (id/religion_id, .eq id, .single) */
  lirePersonnageReligion(
    personnageId: string,
  ): Promise<Reponse<Pick<RowT<"personnages">, "id" | "religion_id">>>;

  /** SELECT: personnages (progression, .eq id, .single) */
  lirePersonnageProgression(
    personnageId: string,
  ): Promise<
    Reponse<
      Pick<
        RowT<"personnages">,
        "id" | "nom" | "etape_creation" | "xp_total" | "xp_depense"
      >
    >
  >;

  // Catalogues (référentiels).

  /** SELECT: races (catalogue jouable, .eq est_actif/est_jouable, .order nom) */
  lireRaces(): Promise<
    Reponse<
      Pick<
        RowT<"races">,
        | "id"
        | "nom"
        | "nom_latin"
        | "description"
        | "resume_condense"
        | "xp_depart"
        | "emoji"
        | "esperance_vie"
        | "exigences_costume"
        | "restrictions_classes"
        | "nb_traits_raciaux"
        | "est_jouable"
      >[]
    >
  >;

  /** SELECT: races (restrictions, .eq id, .single) */
  lireRace(
    raceId: string,
  ): Promise<
    Reponse<Pick<RowT<"races">, "id" | "nom" | "restrictions_classes">>
  >;

  /** SELECT: classes (catalogue, .eq est_actif, .order nom) */
  lireClasses(): Promise<
    Reponse<
      Pick<
        RowT<"classes">,
        | "id"
        | "nom"
        | "description"
        | "resume_condense"
        | "emoji"
        | "role_combat"
        | "pv_depart"
        | "ps_depart"
        | "competences_gratuites"
      >[]
    >
  >;

  /** SELECT: classes (id/nom, .eq id, .single) */
  lireClasse(
    classeId: string,
  ): Promise<Reponse<Pick<RowT<"classes">, "id" | "nom">>>;

  /** SELECT: competences (*, .eq est_actif, .order nom) */
  lireCompetences(): Promise<Reponse<RowT<"competences">[]>>;

  /** SELECT: competences (sous-ensemble, .in id) */
  lireCompetencesParIds(
    ids: string[],
  ): Promise<
    Reponse<
      Pick<
        RowT<"competences">,
        "id" | "nom" | "type_choix" | "type_achat" | "niveaux"
      >[]
    >
  >;

  /** SELECT: sorts (*, .eq cercle, .lte niveau, .eq est_actif, .order nom) */
  lireSorts(
    cercle: string,
    niveauMax: number,
  ): Promise<Reponse<RowT<"sorts">[]>>;

  /** SELECT: sorts (cercle distinct, .eq est_actif, .not cercle is null) */
  lireSortsCercles(): Promise<Reponse<Pick<RowT<"sorts">, "cercle">[]>>;

  /** SELECT: prieres (*, .eq domaine, .lte niveau, .eq est_actif, .order nom) */
  lirePrieres(
    domaine: string,
    niveauMax: number,
  ): Promise<Reponse<RowT<"prieres">[]>>;

  /** SELECT: prieres (domaine distinct, .eq est_actif, .not domaine is null) */
  lirePrieresDomaines(): Promise<Reponse<Pick<RowT<"prieres">, "domaine">[]>>;

  /** SELECT: religions (*, .eq est_actif, .order nom) */
  lireReligions(): Promise<Reponse<RowT<"religions">[]>>;

  /** SELECT: religions (catalogue avec description, .eq est_actif, .order nom) */
  lireReligionsCatalogue(): Promise<
    Reponse<
      Pick<
        RowT<"religions">,
        | "id"
        | "nom"
        | "description"
        | "dirigeant"
        | "fondateur"
        | "symbole_sacre"
        | "pouvoir_symbole"
        | "domaines_principaux"
        | "domaines_proscrits"
        | "lore_fiche"
        | "rituels_fiche"
        | "lore_manuel"
        | "rituels_manuel"
      >[]
    >
  >;

  /** SELECT: religions (fiches sans description, .eq est_actif) */
  lireReligionsFiches(): Promise<
    Reponse<
      Pick<
        RowT<"religions">,
        | "id"
        | "nom"
        | "dirigeant"
        | "fondateur"
        | "symbole_sacre"
        | "pouvoir_symbole"
        | "domaines_principaux"
        | "domaines_proscrits"
        | "lore_fiche"
        | "rituels_fiche"
        | "lore_manuel"
        | "rituels_manuel"
      >[]
    >
  >;

  /** SELECT: religions (domaines_proscrits, .eq id, .single) */
  lireReligionProscrits(
    religionId: string,
  ): Promise<Reponse<Pick<RowT<"religions">, "domaines_proscrits">>>;

  /** SELECT: langues (id/nom/est_ancienne, .eq est_actif, .order ordre) */
  lireLangues(): Promise<
    Reponse<Pick<RowT<"langues">, "id" | "nom" | "est_ancienne">[]>
  >;

  /** SELECT: langues (anciennes, .eq est_ancienne/est_actif, .order ordre/nom) */
  lireLanguesAnciennes(): Promise<
    Reponse<Pick<RowT<"langues">, "id" | "nom" | "ordre">[]>
  >;

  /** SELECT: categories_creatures (.eq est_actif, .order ordre) */
  lireCategoriesCreatures(): Promise<
    Reponse<Pick<RowT<"categories_creatures">, "id" | "nom" | "ordre">[]>
  >;

  /** SELECT: familles_criminelles (.eq est_actif, .order nom) */
  lireFamillesCriminelles(): Promise<
    Reponse<Pick<RowT<"familles_criminelles">, "id" | "nom">[]>
  >;

  /** SELECT: pieges (*, .eq est_actif, .order nom/niveau) */
  lirePieges(): Promise<Reponse<RowT<"pieges">[]>>;

  /** SELECT: recettes_alchimie (*, .eq est_actif, .lte niveau_requis, .order) */
  lireRecettesAlchimie(
    niveauMax: number,
  ): Promise<Reponse<RowT<"recettes_alchimie">[]>>;

  /** SELECT: objets_forge (*, jointure reparation, .eq est_actif, .order) */
  lireObjetsForge(): Promise<Reponse<LigneObjetForge[]>>;

  /** SELECT: objets_joaillerie (*, .eq est_actif, .order) */
  lireObjetsJoaillerie(): Promise<Reponse<RowT<"objets_joaillerie">[]>>;

  /** SELECT: assemblages_runes (*, .eq est_actif, .order nom) */
  lireAssemblagesRunes(): Promise<Reponse<RowT<"assemblages_runes">[]>>;

  /** SELECT: fiches_schemas (champs_v2, .eq categorie, .maybeSingle) */
  lireFicheSchemaChampsV2(
    categorie: CategorieEncyclopedie,
  ): Promise<Reponse<{ champs_v2: unknown } | null>>;

  /** SELECT: fiches_listes (*, .eq categorie, .maybeSingle) */
  lireFicheListe(
    categorie: CategorieEncyclopedie,
  ): Promise<Reponse<RowT<"fiches_listes"> | null>>;

  /** SELECT: TABLE_SOURCE_ENCYCLOPEDIE[categorie] (*, .eq est_actif, .order nom) — 14 catégories */
  lireCatalogueEncyclopedie(
    categorie: CategorieEncyclopedie,
  ): Promise<Reponse<Record<string, unknown>[]>>;

  /** SELECT: sections_regles (*, .in categorie, .eq est_actif, .order categorie puis ordre) */
  lireSectionsRegles(
    categories: string[],
  ): Promise<Reponse<RowT<"sections_regles">[]>>;

  /** RPC: rechercher_encyclopedie(p_terme) — recherche plein-texte 15 branches, rang+titre, limit 50 */
  rechercherEncyclopedie(
    terme: string,
  ): Promise<Reponse<ResultatRechercheEncyclopedie[]>>;

  /** SELECT: effets_combat (*, .order nom — PAS de colonne est_actif) */
  lireEffetsCombat(): Promise<Reponse<RowT<"effets_combat">[]>>;

  /** SELECT: reparations_forge (*, .eq est_actif — sans order, miroir Encyclopedie.tsx) */
  lireReparationsForge(): Promise<Reponse<RowT<"reparations_forge">[]>>;

  /** SELECT: race_traits (race_id, trait_id — sans filtre ni order, miroir Encyclopedie.tsx) */
  lireRaceTraits(): Promise<
    Reponse<Array<{ race_id: string; trait_id: string }>>
  >;

  /** SELECT: parametres_jeu (liens/texte, .limit 1, .maybeSingle) */
  lireParametresJeu(): Promise<
    Reponse<
      Pick<
        RowT<"parametres_jeu">,
        "lien_facebook" | "lien_discord" | "texte_envoi_photos_race"
      >
    >
  >;

  // Vues (état dérivé).

  /** SELECT: vue_traits_par_race (.eq race_id, filtre sous_type dynamique, .order) */
  lireTraitsParRace(
    raceId: string,
    sousType: string | null,
  ): Promise<
    Reponse<
      Pick<
        RowV<"vue_traits_par_race">,
        | "trait_id"
        | "sous_type"
        | "trait_nom"
        | "trait_description"
        | "trait_texte_manuel"
        | "trait_resume_condense"
        | "cout_xp"
      >[]
    >
  >;

  /** SELECT: vue_domaines_disponibles (.eq personnage_id, .order domaine) */
  lireDomainesDisponibles(
    personnageId: string,
  ): Promise<
    Reponse<
      Pick<
        RowV<"vue_domaines_disponibles">,
        "domaine" | "niveau_max_prieres" | "personnage_id"
      >[]
    >
  >;

  /** SELECT: vue_cercles_disponibles (.eq personnage_id, .order cercle) */
  lireCerclesDisponibles(
    personnageId: string,
  ): Promise<
    Reponse<
      Pick<
        RowV<"vue_cercles_disponibles">,
        "cercle" | "niveau_max_sorts" | "personnage_id"
      >[]
    >
  >;

  /** SELECT: vue_artisanat_quotas (*, .eq personnage_id, .maybeSingle) */
  lireArtisanatQuotas(
    personnageId: string,
  ): Promise<Reponse<RowV<"vue_artisanat_quotas">>>;

  // État perso (achats).

  /** SELECT: personnage_competences (*, .eq personnage_id) */
  lirePersonnageCompetences(
    personnageId: string,
  ): Promise<Reponse<RowT<"personnage_competences">[]>>;

  /** SELECT: personnage_competences (competences(nom), .eq personnage_id) */
  lirePersonnageCompetencesNoms(
    personnageId: string,
  ): Promise<Reponse<CompetenceNom[]>>;

  /**
   * SELECT: personnage_competences (niveau max d'une compétence par nom).
   * `.select("niveau_acquis, competences!inner(nom)")`, `.eq personnage_id`,
   * `.eq("competences.nom", nomCompetence)`, `.order niveau_acquis desc`, `.limit(1)`.
   */
  lireNiveauCompetenceParNom(
    personnageId: string,
    nomCompetence: string,
  ): Promise<Reponse<NiveauCompetence[]>>;

  /** SELECT: personnage_sorts (*, jointure sorts, .eq personnage_id, .order) */
  lirePersonnageSorts(
    personnageId: string,
  ): Promise<Reponse<LigneSortAcquis[]>>;

  /** SELECT: personnage_prieres (*, jointure prieres, .eq personnage_id, .order) */
  lirePersonnagePrieres(
    personnageId: string,
  ): Promise<Reponse<LignePriereAcquise[]>>;

  /** SELECT: personnage_pieges (*, .eq personnage_id) */
  lirePersonnagePieges(
    personnageId: string,
  ): Promise<Reponse<RowT<"personnage_pieges">[]>>;

  /** SELECT: personnage_recettes (*, .eq personnage_id) */
  lirePersonnageRecettes(
    personnageId: string,
  ): Promise<Reponse<RowT<"personnage_recettes">[]>>;

  /** SELECT: personnage_assemblages (*, .eq personnage_id) */
  lirePersonnageAssemblages(
    personnageId: string,
  ): Promise<Reponse<RowT<"personnage_assemblages">[]>>;

  // HL-RECAP (s313) : lectures de la fiche au format des vues d'affichage.
  // Serveur = requêtes historiques de FichePersonnageView déplacées verbatim ;
  // visiteur = adaptateur brouillon (lot 3).

  /** SELECT: vue_fiche_personnage (*, .eq id, .single) */
  lireFichePersonnage(
    personnageId: string,
  ): Promise<Reponse<RowV<"vue_fiche_personnage">>>;

  /** SELECT: vue_competences_personnage (*, .eq personnage_id, .order categorie/nom) */
  lireFicheCompetences(
    personnageId: string,
  ): Promise<Reponse<RowV<"vue_competences_personnage">[]>>;

  /** SELECT: vue_sorts_personnage (*, .eq personnage_id, .order cercle/nom_personnalise) */
  lireFicheSorts(
    personnageId: string,
  ): Promise<Reponse<RowV<"vue_sorts_personnage">[]>>;

  /** SELECT: vue_prieres_personnage (*, .eq personnage_id, .order domaine/nom_personnalise) */
  lireFichePrieres(
    personnageId: string,
  ): Promise<Reponse<RowV<"vue_prieres_personnage">[]>>;

  /** SELECT: vue_assemblages_personnage (*, .eq personnage_id, .order nom) */
  lireFicheAssemblages(
    personnageId: string,
  ): Promise<Reponse<RowV<"vue_assemblages_personnage">[]>>;

  /**
   * SELECT: personnage_recettes (id/personnage_id/xp_depense, jointure
   * recettes_alchimie, .eq personnage_id). Le `.map()`/`.sort()` de mise en
   * forme restent dans le composant appelant.
   */
  lireFicheRecettes(
    personnageId: string,
  ): Promise<Reponse<LigneRecetteFiche[]>>;

  /** SELECT: vue_artisanat_etat (niveaux, .eq personnage_id, .maybeSingle) */
  lireFicheArtisanatEtat(
    personnageId: string,
  ): Promise<
    Reponse<
      Pick<
        RowV<"vue_artisanat_etat">,
        | "niveau_alchimie"
        | "niveau_forge"
        | "niveau_joaillerie"
        | "niveau_pieges"
        | "niveau_runes"
      >
    >
  >;

  /** SELECT: personnage_pieges (*, .eq personnage_id) */
  lireFichePieges(
    personnageId: string,
  ): Promise<Reponse<RowT<"personnage_pieges">[]>>;

  /** SELECT: ingredients_alchimiques (id/nom/niveau/manipulations, .lte niveau, .order niveau/nom) */
  lireFicheManipulations(
    niveauMax: number,
  ): Promise<
    Reponse<Pick<RowT<"ingredients_alchimiques">, "id" | "nom" | "niveau" | "manipulations">[]>
  >;

  /** SELECT: objets_forge (colonnes fiche, jointure reparation, .eq est_actif, .order) */
  lireFicheObjetsForge(): Promise<Reponse<LigneObjetForgeFiche[]>>;

  /** SELECT: objets_joaillerie (colonnes fiche, .eq est_actif, .order) */
  lireFicheObjetsJoaillerie(): Promise<
    Reponse<
      Pick<
        RowT<"objets_joaillerie">,
        | "id"
        | "nom"
        | "description"
        | "resume_condense"
        | "effet"
        | "cout_xp"
        | "temps_fabrication_minutes"
        | "temps_rare_minutes"
        | "materiaux_communs"
        | "materiaux_rares"
      >[]
    >
  >;

  /** SELECT: pieges (*, .eq est_actif, .lte niveau, .order nom/niveau) */
  lireFichePiegesCatalogue(
    niveauMax: number,
  ): Promise<Reponse<RowT<"pieges">[]>>;

  /** SELECT: langues (id/nom, sans filtre) */
  lireFicheLangues(): Promise<
    Reponse<Pick<RowT<"langues">, "id" | "nom">[]>
  >;

  /** SELECT: religions (colonnes fiche, sans filtre) */
  lireFicheReligions(): Promise<
    Reponse<
      Pick<
        RowT<"religions">,
        | "id"
        | "nom"
        | "dirigeant"
        | "fondateur"
        | "symbole_sacre"
        | "pouvoir_symbole"
        | "domaines_principaux"
        | "domaines_proscrits"
        | "lore_fiche"
        | "rituels_fiche"
        | "lore_manuel"
        | "rituels_manuel"
      >[]
    >
  >;
}

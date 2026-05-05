-- =====================================================================
-- Phase 1.5 — Vue d'agrégation pour le récapitulatif de création
-- =====================================================================
-- Vue unique qui rassemble toutes les infos d'un personnage pour :
--   * l'étape 11 du créateur V2 (récapitulatif avant verrouillage)
--   * la fiche personnage finalisée (après verrouillage)
--
-- Architecture data-first : les JSONB s'appuient sur les vues hydratées
-- existantes (vue_competences_personnage, vue_sorts_personnage, etc.)
-- pour ne pas dupliquer la logique d'enrichissement.
--
-- Sécurité : security_invoker = true → respecte les RLS de la table
-- personnages (un joueur ne voit que ses propres personnages).
-- =====================================================================

CREATE OR REPLACE VIEW public.vue_personnage_creation_complet
WITH (security_invoker = true)
AS
SELECT
  -- ========== Identification ==========
  p.id,
  p.joueur_id,

  -- ========== Base ==========
  p.nom,
  p.niveau,
  p.etape_creation,
  p.est_verrouille,
  p.est_actif,
  p.est_mort,

  -- Calculé : éligibilité à l'inscription événement
  COALESCE(
    p.est_verrouille = true
    AND (
      r.est_jouable = true
      OR (r.est_jouable = false AND demande_active.statut = 'approuvee')
    ),
    false
  ) AS peut_sinscrire_evenement,

  -- ========== XP ==========
  p.xp_total,
  p.xp_depense,
  COALESCE(p.xp_total, 0) - COALESCE(p.xp_depense, 0) AS xp_disponible,

  -- ========== Race ==========
  p.race_id,
  r.nom AS race_nom,
  r.nom_latin AS race_nom_latin,
  r.xp_depart AS race_xp_depart,
  r.est_jouable AS race_est_jouable,
  p.sous_type_chimeride,

  -- ========== Demande de race spéciale (la plus récente) ==========
  demande_active.statut AS demande_race_statut,
  demande_active.background AS demande_race_background,

  -- ========== Classe ==========
  p.classe_id,
  c1.nom AS classe_nom,
  c1.pv_depart AS classe_pv_depart,
  c1.ps_depart AS classe_ps_depart,
  p.classe_secondaire_id,
  c2.nom AS classe_secondaire_nom,

  -- ========== Religion ==========
  p.est_croyant,
  p.religion_id,
  rel.nom AS religion_nom,

  -- ========== PV/PS finaux ==========
  p.pv_max,
  p.ps_max,

  -- ========== Artisanat légendaire ==========
  p.a_forge_legendaire,
  p.a_joaillerie_legendaire,

  -- ========== Récit ==========
  p.historique,
  p.ame_personnage,

  -- ========== Progression événements ==========
  p.gn_completes,
  p.mini_gn_completes,
  p.ouvertures_terrain,

  -- ========== Timestamps ==========
  p.created_at,
  p.updated_at,

  -- ========== JSONB : Traits raciaux hydratés ==========
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'trait_id', (elem->>'trait_id')::uuid,
        'est_gratuit', (elem->>'est_gratuit')::boolean,
        'xp_depense', COALESCE((elem->>'xp_depense')::integer, 0),
        'trait_nom', tr.nom,
        'trait_description', tr.description,
        'cout_xp', tr.cout_xp
      )
    )
    FROM jsonb_array_elements(COALESCE(p.traits_raciaux_choisis, '[]'::jsonb)) AS elem
    LEFT JOIN traits_raciaux tr ON tr.id = (elem->>'trait_id')::uuid
    ),
    '[]'::jsonb
  ) AS traits_raciaux,

  -- ========== JSONB : Compétences ==========
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', vcp.id,
        'niveau_acquis', vcp.niveau_acquis,
        'xp_depense', vcp.xp_depense,
        'choix_achat', vcp.choix_achat,
        'appris_via_maitre', vcp.appris_via_maitre,
        'nom_maitre', vcp.nom_maitre,
        'statut_maitre', vcp.statut_maitre,
        'nom', vcp.nom,
        'categorie', vcp.categorie,
        'competence_description', vcp.competence_description
      )
    )
    FROM vue_competences_personnage vcp
    WHERE vcp.personnage_id = p.id
    ),
    '[]'::jsonb
  ) AS competences,

  -- ========== JSONB : Sorts ==========
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', vsp.id,
        'nom_personnalise', vsp.nom_personnalise,
        'formule_magique', vsp.formule_magique,
        'niveau_sort', vsp.niveau_sort,
        'zone_choisie', vsp.zone_choisie,
        'portee_choisie', vsp.portee_choisie,
        'duree_choisie', vsp.duree_choisie,
        'cercle', vsp.cercle,
        'cout_xp_base', vsp.cout_xp_base,
        'sort_nom_base', vsp.sort_nom_base,
        'sort_description', vsp.sort_description
      )
    )
    FROM vue_sorts_personnage vsp
    WHERE vsp.personnage_id = p.id
    ),
    '[]'::jsonb
  ) AS sorts,

  -- ========== JSONB : Prières ==========
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', vpp.id,
        'nom_personnalise', vpp.nom_personnalise,
        'niveau_priere', vpp.niveau_priere,
        'zone_choisie', vpp.zone_choisie,
        'portee_choisie', vpp.portee_choisie,
        'duree_choisie', vpp.duree_choisie,
        'domaine', vpp.domaine,
        'priere_description', vpp.priere_description,
        'duree_incantation', vpp.duree_incantation,
        'cout_xp_base', vpp.cout_xp_base
      )
    )
    FROM vue_prieres_personnage vpp
    WHERE vpp.personnage_id = p.id
    ),
    '[]'::jsonb
  ) AS prieres,

  -- ========== JSONB : Recettes alchimie ==========
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', vrp.id,
        'xp_depense', vrp.xp_depense,
        'nom', vrp.nom,
        'type', vrp.type,
        'niveau_requis', vrp.niveau_requis,
        'description', vrp.description,
        'effet', vrp.effet
      )
    )
    FROM vue_recettes_personnage vrp
    WHERE vrp.personnage_id = p.id
    ),
    '[]'::jsonb
  ) AS recettes,

  -- ========== JSONB : Assemblages de runes ==========
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', vap.id,
        'xp_depense', vap.xp_depense,
        'nom', vap.nom,
        'cible', vap.cible,
        'cout_ps', vap.cout_ps,
        'description', vap.description,
        'effet', vap.effet,
        'runes_requises', vap.runes_requises
      )
    )
    FROM vue_assemblages_personnage vap
    WHERE vap.personnage_id = p.id
    ),
    '[]'::jsonb
  ) AS assemblages,

  -- ========== JSONB : Objets forge ==========
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', pof.id,
        'xp_depense', pof.xp_depense,
        'nom', oforge.nom,
        'description', oforge.description,
        'type', oforge.type,
        'stats', oforge.stats,
        'difficulte', oforge.difficulte
      )
    )
    FROM personnage_objets_forge pof
    JOIN objets_forge oforge ON oforge.id = pof.objet_id
    WHERE pof.personnage_id = p.id
    ),
    '[]'::jsonb
  ) AS objets_forge,

  -- ========== JSONB : Objets joaillerie ==========
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', poj.id,
        'xp_depense', poj.xp_depense,
        'nom', ojoa.nom,
        'description', ojoa.description,
        'effet', ojoa.effet,
        'difficulte', ojoa.difficulte
      )
    )
    FROM personnage_objets_joaillerie poj
    JOIN objets_joaillerie ojoa ON ojoa.id = poj.objet_id
    WHERE poj.personnage_id = p.id
    ),
    '[]'::jsonb
  ) AS objets_joaillerie,

  -- ========== JSONB : Cercles acquis (système magique) ==========
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'cercle', vcd.cercle,
        'niveau_max_sorts', vcd.niveau_max_sorts
      )
    )
    FROM vue_cercles_disponibles vcd
    WHERE vcd.personnage_id = p.id
    ),
    '[]'::jsonb
  ) AS cercles_acquis,

  -- ========== JSONB : Domaines acquis (système religieux) ==========
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'domaine', vdd.domaine,
        'niveau_max_prieres', vdd.niveau_max_prieres
      )
    )
    FROM vue_domaines_disponibles vdd
    WHERE vdd.personnage_id = p.id
    ),
    '[]'::jsonb
  ) AS domaines_acquis,

  -- ========== JSONB : Quotas artisanat ==========
  (SELECT to_jsonb(vaq.*) - 'personnage_id'
   FROM vue_artisanat_quotas vaq
   WHERE vaq.personnage_id = p.id
  ) AS quotas_artisanat

FROM personnages p
LEFT JOIN races r ON r.id = p.race_id
LEFT JOIN classes c1 ON c1.id = p.classe_id
LEFT JOIN classes c2 ON c2.id = p.classe_secondaire_id
LEFT JOIN religions rel ON rel.id = p.religion_id
LEFT JOIN LATERAL (
  SELECT prd.statut, prd.background
  FROM personnage_races_demandes prd
  WHERE prd.personnage_id = p.id
  ORDER BY prd.created_at DESC NULLS LAST
  LIMIT 1
) demande_active ON true;

-- =====================================================================
-- Commentaires sur les colonnes non triviales
-- =====================================================================
COMMENT ON VIEW public.vue_personnage_creation_complet IS
'Vue d''agrégation complète d''un personnage pour le récap de création (étape 11) et la fiche personnage finalisée. Hybride : scalaires plats + JSONB hydratés alignés sur les vues data-first existantes. security_invoker = true (respecte RLS personnages).';

COMMENT ON COLUMN public.vue_personnage_creation_complet.peut_sinscrire_evenement IS
'true si le personnage est verrouillé ET (race jouable OU race spéciale dont la dernière demande est approuvée).';

COMMENT ON COLUMN public.vue_personnage_creation_complet.xp_disponible IS
'xp_total - xp_depense. Maintenu cohérent par le trigger de synchro XP.';

COMMENT ON COLUMN public.vue_personnage_creation_complet.race_est_jouable IS
'false = race spéciale nécessitant approbation MJ (Fée, Haut-Elfe, Orc).';

COMMENT ON COLUMN public.vue_personnage_creation_complet.demande_race_statut IS
'Statut de la dernière demande de race spéciale (en_attente / approuvee / refusee). NULL si aucune demande.';

COMMENT ON COLUMN public.vue_personnage_creation_complet.traits_raciaux IS
'Tableau JSONB hydraté : [{trait_id, est_gratuit, xp_depense, trait_nom, trait_description, cout_xp}]. Source : personnages.traits_raciaux_choisis enrichi via JOIN sur traits_raciaux.';

COMMENT ON COLUMN public.vue_personnage_creation_complet.competences IS
'Tableau JSONB issu de vue_competences_personnage (compétences hydratées avec nom, catégorie, description, choix_achat, etc.).';

COMMENT ON COLUMN public.vue_personnage_creation_complet.sorts IS
'Tableau JSONB issu de vue_sorts_personnage. Inclut nom_personnalise, formule_magique, cercle, niveau_sort, zone/portee/duree choisies.';

COMMENT ON COLUMN public.vue_personnage_creation_complet.prieres IS
'Tableau JSONB issu de vue_prieres_personnage. Symétrique de sorts pour le système religieux.';

COMMENT ON COLUMN public.vue_personnage_creation_complet.objets_forge IS
'Tableau JSONB hydraté via personnage_objets_forge JOIN objets_forge (pas de vue intermédiaire à ce jour).';

COMMENT ON COLUMN public.vue_personnage_creation_complet.objets_joaillerie IS
'Tableau JSONB hydraté via personnage_objets_joaillerie JOIN objets_joaillerie (pas de vue intermédiaire à ce jour).';

COMMENT ON COLUMN public.vue_personnage_creation_complet.cercles_acquis IS
'Tableau JSONB issu de vue_cercles_disponibles : [{cercle, niveau_max_sorts}].';

COMMENT ON COLUMN public.vue_personnage_creation_complet.domaines_acquis IS
'Tableau JSONB issu de vue_domaines_disponibles : [{domaine, niveau_max_prieres}].';

COMMENT ON COLUMN public.vue_personnage_creation_complet.quotas_artisanat IS
'Objet JSONB issu de vue_artisanat_quotas (sans personnage_id) : niveaux d''artisanat + quotas totaux + utilisations courantes pour alchimie/forge/joaillerie/runes.';

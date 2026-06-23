-- Migration: transferer_personnage_entre_profils
-- RPC pour déplacer un personnage d'un profil A vers un profil B du MÊME compte.
-- États autorisés : brouillon, remodelage_libre, campagne. Refusés : gele, mort.
-- Banque XP / inscriptions / historique : non touchés (la banque reste sur le profil d'origine).

CREATE OR REPLACE FUNCTION public.transferer_personnage(
  p_personnage_id uuid,
  p_profil_cible_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_joueur_actuel uuid;
  v_nom_perso     text;
  v_etat          text;
  v_nom_cible     text;
  v_avert         jsonb := '[]'::jsonb;
BEGIN
  SELECT joueur_id, nom INTO v_joueur_actuel, v_nom_perso
  FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  IF NOT public.compte_voit_joueur(v_joueur_actuel) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_autorise','message','Ce personnage n''appartient pas à ton compte.')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  IF NOT public.compte_voit_joueur(p_profil_cible_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','profil_cible_invalide','message','Le profil cible n''appartient pas à ton compte.','champ','p_profil_cible_id')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  IF p_profil_cible_id = v_joueur_actuel THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','meme_profil','message','Ce personnage est déjà sur ce profil.','champ','p_profil_cible_id')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  v_etat := public.etat_edition_personnage(p_personnage_id)->>'etat';
  IF v_etat = 'gele' THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_gele','message','Ce personnage est inscrit à un événement à venir. Désinscris-le d''abord.')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  ELSIF v_etat = 'mort' THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_mort','message','Un personnage mort ne peut pas être transféré.')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  ELSIF v_etat IS NULL OR v_etat NOT IN ('brouillon','remodelage_libre','campagne') THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','etat_non_transferable','message','État du personnage incompatible avec le transfert.')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  IF v_etat = 'campagne' THEN
    v_avert := jsonb_build_array(jsonb_build_object('code','historique_presence_conserve',
      'message','L''historique de présence aux événements passés reste rattaché au profil d''origine.'));
  END IF;

  UPDATE public.personnages SET joueur_id = p_profil_cible_id WHERE id = p_personnage_id;

  SELECT nom INTO v_nom_cible FROM public.profils_joueur WHERE id = p_profil_cible_id;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', v_avert,
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'nom', v_nom_perso,
      'profil_cible_id', p_profil_cible_id,
      'profil_cible_nom', v_nom_cible,
      'ancien_profil_id', v_joueur_actuel
    )
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.transferer_personnage(uuid, uuid) TO authenticated;

-- Read-RPC self-service : aperçu des personnages concernés par une suppression.
-- Single source of truth pour le composant FluxSuppressionCimetiere (front s254).
-- Calque l'ownership de creer_steles_et_supprimer (#490) : compte_voit_joueur (perso/profil),
-- auth.uid() (compte), profil principal refusé. Lecture seule, contrat STANDARD.
CREATE OR REPLACE FUNCTION public.apercu_suppression(p_cible text, p_id_cible uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_persos  uuid[];
  v_donnees jsonb;
  v_joueur  uuid;
BEGIN
  -- 1. Cible valide
  IF p_cible NOT IN ('personnage','profil','compte') THEN
    RETURN jsonb_build_object('succes',false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','CIBLE_INVALIDE','message','Cible inconnue.','champ','p_cible')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;

  -- 2. Ownership + détermination des persos concernés (calque creer_steles_et_supprimer)
  IF p_cible = 'personnage' THEN
    SELECT joueur_id INTO v_joueur FROM personnages WHERE id = p_id_cible;
    IF v_joueur IS NULL THEN
      RETURN jsonb_build_object('succes',false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Personnage introuvable.')),
        'avertissements','[]'::jsonb,'donnees',null);
    END IF;
    IF NOT compte_voit_joueur(v_joueur) THEN
      RETURN jsonb_build_object('succes',false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Ce personnage ne vous appartient pas.')),
        'avertissements','[]'::jsonb,'donnees',null);
    END IF;
    v_persos := ARRAY[p_id_cible];

  ELSIF p_cible = 'profil' THEN
    IF NOT EXISTS (SELECT 1 FROM profils_joueur WHERE id = p_id_cible) THEN
      RETURN jsonb_build_object('succes',false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Profil introuvable.')),
        'avertissements','[]'::jsonb,'donnees',null);
    END IF;
    IF NOT compte_voit_joueur(p_id_cible) THEN
      RETURN jsonb_build_object('succes',false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Ce profil ne vous appartient pas.')),
        'avertissements','[]'::jsonb,'donnees',null);
    END IF;
    IF EXISTS (SELECT 1 FROM profils_joueur WHERE id = p_id_cible AND est_principal) THEN
      RETURN jsonb_build_object('succes',false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','PROFIL_PRINCIPAL',
          'message','Le profil principal ne peut pas être supprimé seul. Supprimez plutôt le compte entier.')),
        'avertissements','[]'::jsonb,'donnees',null);
    END IF;
    SELECT array_agg(id) INTO v_persos FROM personnages WHERE joueur_id = p_id_cible;

  ELSE -- compte : uniquement le sien
    IF p_id_cible IS DISTINCT FROM auth.uid() THEN
      RETURN jsonb_build_object('succes',false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Vous ne pouvez consulter que votre propre compte.')),
        'avertissements','[]'::jsonb,'donnees',null);
    END IF;
    SELECT array_agg(p.id) INTO v_persos
      FROM personnages p JOIN profils_joueur pj ON pj.id = p.joueur_id
     WHERE pj.compte_id = p_id_cible;
  END IF;

  v_persos := COALESCE(v_persos, ARRAY[]::uuid[]);

  -- 3. Liste enrichie : flags calqués sur la logique d'admissibilité de creer_steles_et_supprimer
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'personnage_id',   p.id,
      'nom',             COALESCE(p.nom,'Sans nom'),
      'race',            r.nom,
      'profil_nom',      pj.nom,
      'admissible',      EXISTS (SELECT 1 FROM inscriptions_evenements ie
                                  WHERE ie.personnage_id = p.id AND ie.statut = 'present'),
      'deja_en_attente', EXISTS (SELECT 1 FROM cimetiere c
                                  WHERE c.personnage_id_origine = p.id AND c.statut = 'en_attente'),
      'est_mort',        p.est_mort
    ) ORDER BY pj.nom, p.nom), '[]'::jsonb)
  INTO v_donnees
  FROM personnages p
  LEFT JOIN races r        ON r.id  = p.race_id
  LEFT JOIN profils_joueur pj ON pj.id = p.joueur_id
  WHERE p.id = ANY(v_persos);

  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,'donnees',v_donnees);
END; $function$;

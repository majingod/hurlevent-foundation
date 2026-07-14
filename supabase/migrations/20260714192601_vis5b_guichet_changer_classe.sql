-- [VIS-5 volet b, s332] Guichet unique du changement de classe (ferme Gotcha A39).
-- Probleme : la cascade changer_classe_personnage (19 Ko, INFRAGMENTABLE via MCP,
-- Gotcha C30) pose les gratuites de la nouvelle classe (etape 6e) SANS choix_achat,
-- sans sync religion B2, sans validation choix_manquant. Jusqu'ici seul
-- sauvegarder_etape_4 comblait le trou (FIX s322) ; un appel DIRECT en ecriture
-- gardait le trou (theorique : aucun appelant mesure s331/s332).
-- Fix : (1) renommer la cascade en changer_classe_personnage_interne (ALTER RENAME
-- = operation de catalogue, corps intact, pas de limite 13 Ko) et la verrouiller ;
-- (2) poser un guichet du MEME nom / MEME signature qui fait cascade + attribuer
-- d'un seul geste. Zero changement front (meme RPC), zero changement de contrat.
-- Idempotent : DO gate sur la taille (>10 Ko = mastodonte pas encore renomme),
-- CREATE OR REPLACE, REVOKE/GRANT rejouables.

-- (1) Rename conditionnel : uniquement si l'interne n'existe pas ET que la
-- fonction actuelle est bien le mastodonte (taille > 10 Ko).
DO $do$
BEGIN
  IF to_regprocedure('public.changer_classe_personnage_interne(uuid,uuid,jsonb,boolean)') IS NULL
     AND to_regprocedure('public.changer_classe_personnage(uuid,uuid,jsonb,boolean)') IS NOT NULL
     AND length(pg_get_functiondef(to_regprocedure('public.changer_classe_personnage(uuid,uuid,jsonb,boolean)'))) > 10000 THEN
    ALTER FUNCTION public.changer_classe_personnage(uuid, uuid, jsonb, boolean)
      RENAME TO changer_classe_personnage_interne;
  END IF;
END
$do$;

-- (2) Guichet : meme nom, meme signature que la cascade historique.
CREATE OR REPLACE FUNCTION public.changer_classe_personnage(
  p_personnage_id uuid,
  p_classe_id uuid,
  p_choix_par_competence jsonb DEFAULT NULL::jsonb,
  p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cc   jsonb;
  v_attr jsonb;
BEGIN
  -- Toutes les gardes (auth, ownership, gate edition, classe valide) vivent dans
  -- l'interne ; le guichet ne fait que sequencer cascade -> attribuer.
  v_cc := public.changer_classe_personnage_interne(p_personnage_id, p_classe_id, p_choix_par_competence, p_dry_run);

  -- dry_run (apercu front) ou echec cascade : retour tel quel.
  IF p_dry_run OR NOT COALESCE((v_cc->>'succes')::boolean, false) THEN
    RETURN v_cc;
  END IF;

  -- Ecriture reussie : poser les choix des gratuites ajoutees en 6e
  -- (choix_achat + validation choix_manquant + sync religion B2).
  -- Idempotent : UPDATE du choix sur ligne xp=0 existante, INSERT sinon.
  v_attr := public.attribuer_competences_gratuites_classe(p_personnage_id, COALESCE(p_choix_par_competence, '{}'::jsonb));
  IF NOT (v_attr->>'succes')::boolean THEN
    -- NB (A39) : la cascade a deja committe ses ecritures ; comportement identique
    -- a l'ancien chemin sauvegarder_etape_4 (le retry repare, attribuer idempotent).
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_attr->'erreurs',
      'avertissements', COALESCE(v_cc->'avertissements', '[]'::jsonb),
      'donnees', COALESCE(v_cc->'donnees', '{}'::jsonb));
  END IF;

  RETURN v_cc;
END;
$function$;

-- (3) Verrous (Gotcha A37 : toute (re)creation remet l'ACL a PUBLIC).
-- Guichet : seul point d'entree expose, meme exposition qu'avant (authenticated).
REVOKE ALL ON FUNCTION public.changer_classe_personnage(uuid, uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.changer_classe_personnage(uuid, uuid, jsonb, boolean) TO authenticated;
-- Interne : plus appelable que par les SECURITY DEFINER du proprietaire
-- (guichet, sauvegarder_etape_4). Le trou 6e devient structurellement inatteignable.
REVOKE ALL ON FUNCTION public.changer_classe_personnage_interne(uuid, uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;

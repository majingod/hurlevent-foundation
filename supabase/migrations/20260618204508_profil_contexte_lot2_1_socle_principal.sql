-- PROFIL-CONTEXTE Lot 2.1 : socle « profil principal »
-- (1) régularisation data, (2) contrainte unicité, (3) RPC bascule atomique.
-- Neutre : ne durcit aucun droit (le durcissement des helpers = Lot 2.3).

-- (1) Régularisation : profil le plus ancien = principal pour les comptes sans principal.
WITH a_regulariser AS (
  SELECT compte_id FROM public.profils_joueur
  GROUP BY compte_id
  HAVING count(*) FILTER (WHERE est_principal) = 0
),
plus_ancien AS (
  SELECT DISTINCT ON (pj.compte_id) pj.id
  FROM public.profils_joueur pj
  JOIN a_regulariser r ON r.compte_id = pj.compte_id
  ORDER BY pj.compte_id, pj.cree_le ASC, pj.id
)
UPDATE public.profils_joueur SET est_principal = true
WHERE id IN (SELECT id FROM plus_ancien);

-- (2) Contrainte : au plus 1 profil principal par compte.
CREATE UNIQUE INDEX IF NOT EXISTS uq_un_principal_par_compte
  ON public.profils_joueur (compte_id) WHERE est_principal;

-- (3) RPC : désigner un profil comme principal (bascule atomique, réservée au propriétaire).
CREATE OR REPLACE FUNCTION public.definir_profil_principal(p_profil_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_compte uuid;
BEGIN
  SELECT compte_id INTO v_compte FROM public.profils_joueur WHERE id = p_profil_id;
  IF v_compte IS NULL THEN
    RETURN jsonb_build_object('succes',false,
      'erreurs',jsonb_build_array(jsonb_build_object('code','introuvable','message','Profil introuvable.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF v_compte <> v_uid THEN
    RETURN jsonb_build_object('succes',false,
      'erreurs',jsonb_build_array(jsonb_build_object('code','non_autorise','message','Ce profil n''appartient pas à votre compte.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  -- déchoir l'ancien principal puis promouvoir le nouveau (ordre = jamais 2 principaux)
  UPDATE public.profils_joueur SET est_principal=false
    WHERE compte_id=v_uid AND est_principal AND id<>p_profil_id;
  UPDATE public.profils_joueur SET est_principal=true
    WHERE id=p_profil_id;
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees',jsonb_build_object('profil_principal',p_profil_id));
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.definir_profil_principal(uuid) TO authenticated;

-- [s394] L'INSTRUMENT DU GÉNÉRATEUR : IL SURVIT À UNE SUPPRESSION, ET IL DIT QUI A VU LES PORTES.
--
-- POURQUOI. `journal_generation` n'enregistre que les SUCCÈS (C114) et sa FK est
-- ON DELETE CASCADE : mesuré le 11 août 2026, elle est passée de 2 à 1 ligne
-- parce qu'un personnage supprimé a emporté sa trace, sans qu'aucun événement ne
-- le signale. L'instrument est donc à la fois INCOMPLET et DESTRUCTIBLE — on ne
-- peut ni compter ce qui a été généré, ni séparer les trois causes possibles de
-- la faible adoption : (1) les portes ne s'affichent pas, (2) elles s'affichent
-- et personne ne clique, (3) on clique et on repart au wizard.
--
-- (a) LA TRACE SURVIT : `personnage_id` devient nullable, la FK passe en
--     ON DELETE SET NULL. La RPC exige un `personnage_id` NON NUL à l'insertion,
--     donc APRÈS COUP `personnage_id IS NULL` signifie EXACTEMENT « le personnage
--     a été supprimé ». Aucune colonne ni trigger supplémentaire n'est nécessaire.
--
-- (b) `journal_generateur_accueil` : UNE ligne par personnage ET par événement
--     (UNIQUE) — ce n'est PAS un journal de clics. Grain minimal qui sépare les
--     trois causes ci-dessus, sans collecter de comportement fin (Loi 25).
--     RLS active SANS policy, comme `journal_generation` : aucune lecture
--     PostgREST possible, l'écriture passe par la seule RPC.
--
-- (c) La RPC est le MIROIR de `enregistrer_generation` : même garde
--     (`peut_editer_personnage` sur le `joueur_id` du personnage), même forme de
--     retour {succes, erreurs, avertissements, donnees}. Revenir aux portes
--     n'est PAS une erreur : ON CONFLICT DO NOTHING et `donnees.nouvelle` dit si
--     la ligne a été posée.
--
-- REPLI (trois gestes, aucun effet joueur) :
--   ALTER TABLE public.journal_generation DROP CONSTRAINT journal_generation_personnage_id_fkey;
--   ALTER TABLE public.journal_generation ADD CONSTRAINT journal_generation_personnage_id_fkey
--     FOREIGN KEY (personnage_id) REFERENCES public.personnages(id) ON DELETE CASCADE;
--   DROP FUNCTION IF EXISTS public.enregistrer_accueil_generateur(uuid, text);
--   DROP TABLE IF EXISTS public.journal_generateur_accueil;

ALTER TABLE public.journal_generation ALTER COLUMN personnage_id DROP NOT NULL;

ALTER TABLE public.journal_generation
  DROP CONSTRAINT IF EXISTS journal_generation_personnage_id_fkey;

ALTER TABLE public.journal_generation
  ADD CONSTRAINT journal_generation_personnage_id_fkey
  FOREIGN KEY (personnage_id) REFERENCES public.personnages(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.journal_generateur_accueil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnage_id uuid REFERENCES public.personnages(id) ON DELETE SET NULL,
  evenement text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_generateur_accueil_evenement_check
    CHECK (evenement IN ('portes_vues', 'porte_batir', 'porte_guide', 'porte_tirage')),
  CONSTRAINT journal_generateur_accueil_perso_evt_key UNIQUE (personnage_id, evenement)
);

ALTER TABLE public.journal_generateur_accueil ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.journal_generateur_accueil FROM PUBLIC;
REVOKE ALL ON TABLE public.journal_generateur_accueil FROM anon;
REVOKE ALL ON TABLE public.journal_generateur_accueil FROM authenticated;
GRANT ALL ON TABLE public.journal_generateur_accueil TO service_role;

CREATE OR REPLACE FUNCTION public.enregistrer_accueil_generateur(
  p_personnage_id uuid,
  p_evenement text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_nouvelle boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'non_authentifie', 'message', 'Authentification requise.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF p_evenement IS NULL OR p_evenement NOT IN ('portes_vues', 'porte_batir', 'porte_guide', 'porte_tirage') THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'evenement_invalide', 'message', 'Evenement d''accueil inconnu.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_introuvable', 'message', 'Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'ownership_refuse', 'message', 'Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  INSERT INTO public.journal_generateur_accueil (personnage_id, evenement)
  VALUES (p_personnage_id, p_evenement)
  ON CONFLICT (personnage_id, evenement) DO NOTHING;
  v_nouvelle := FOUND;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'evenement', p_evenement, 'nouvelle', v_nouvelle));
END;
$fn$;

REVOKE ALL ON FUNCTION public.enregistrer_accueil_generateur(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enregistrer_accueil_generateur(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.enregistrer_accueil_generateur(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enregistrer_accueil_generateur(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enregistrer_accueil_generateur(uuid, text) TO service_role;

COMMENT ON TABLE public.journal_generateur_accueil IS
  '[s394] Une ligne par personnage ET par evenement d''accueil du generateur (UNIQUE) : portes_vues, porte_batir, porte_guide, porte_tirage. Ce n''est pas un journal de clics. RLS active sans policy : ecriture par enregistrer_accueil_generateur seule, aucune lecture PostgREST. personnage_id IS NULL apres coup = le personnage a ete supprime.';

COMMENT ON FUNCTION public.enregistrer_accueil_generateur(uuid, text) IS
  '[s394] Miroir de enregistrer_generation pour l''accueil du generateur. Garde : peut_editer_personnage(joueur_id). Idempotente (ON CONFLICT DO NOTHING) : donnees.nouvelle dit si la ligne a ete posee. Repli : DROP FUNCTION + DROP TABLE journal_generateur_accueil.';

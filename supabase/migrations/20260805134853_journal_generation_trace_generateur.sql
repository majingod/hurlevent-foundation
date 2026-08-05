-- [VIS-8 s376] journal_generation — trace des personnages issus du générateur.
-- Décision Fred s376 (option B) : une ligne par personnage généré portant le MODE
-- (🎲 'de' / 🧭 'boussole'), la COMPOSITION tirée (jsonb), le STATUT du rejeu,
-- l'étape atteinte et le nombre d'échecs d'achat — « qu'a produit le générateur
-- en vrai ? » devient 1 SELECT, et « tiré vs gardé » se compare à volonté.
-- UNIQUE(personnage_id) = la garde C91 au niveau base (jamais deux traces —
-- miroir DB de refuse_non_vierge côté front).
-- Écriture UNIQUEMENT via la RPC enregistrer_generation (SECURITY DEFINER,
-- propriété via peut_editer_personnage — traverse profils_joueur.compte_id,
-- jamais un naïf joueur_id = auth.uid()). Aucune lecture PostgREST : RLS
-- activée SANS policy, la table sert aux mesures MCP/admin seulement.

CREATE TABLE IF NOT EXISTS public.journal_generation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnage_id uuid NOT NULL UNIQUE REFERENCES public.personnages(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('de', 'boussole')),
  statut text NOT NULL,
  etape_apres integer,
  nb_echecs integer NOT NULL DEFAULT 0,
  composition jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_generation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.journal_generation FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enregistrer_generation(
  p_personnage_id uuid,
  p_mode text,
  p_statut text,
  p_etape_apres integer,
  p_nb_echecs integer,
  p_composition jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_perso public.personnages%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'non_authentifie', 'message', 'Authentification requise.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('de', 'boussole') THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'mode_invalide', 'message', 'Mode de génération inconnu.')),
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
  INSERT INTO public.journal_generation
    (personnage_id, mode, statut, etape_apres, nb_echecs, composition)
  VALUES
    (p_personnage_id, p_mode, coalesce(p_statut, 'inconnu'), p_etape_apres,
     coalesce(p_nb_echecs, 0), coalesce(p_composition, '{}'::jsonb))
  ON CONFLICT (personnage_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'deja_trace', 'message', 'Ce personnage porte déjà sa trace de génération.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enregistrer_generation(uuid, text, text, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enregistrer_generation(uuid, text, text, integer, integer, jsonb) TO authenticated;

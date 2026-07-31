-- [INAPTE-MAGIE-MODELE-INSTANCE] — s369, volet 2 : le refus d'achat.
-- Arbitrage Fred : un porteur d'« Inapte à la magie » ne peut acheter aucune
-- compétence qui repose sur les points de spiritualité. Liste établie AU
-- MANUEL (2026-06-18), pas de tête — et volontairement PAS par catégorie :
-- `Alchimie`, `Décryptage`, `Premiers Soins`, `Réveil Expéditif` sont de
-- catégorie mage/prêtre et ne coûtent aucun PS ; bloquer par catégorie
-- tuerait ⚗️ l'alchimiste, qui se joue justement sans magie.
-- NE SONT PAS bloquées, mesuré au manuel : `Méditation` (« 10 points de
-- spiritualité OU 5 points de vie » — l'inapte s'en sert pour les PV),
-- `Imposition des Mains` (la réserve de soin est en PV), et Bénédiction /
-- Consécration / Grande Messe / Rêves (arbitrage Fred, aucun coût en PS au
-- manuel).
--
-- ⚠️ POURQUOI UNE ENVELOPPE ET PAS UNE ÉDITION DIRECTE : le corps de
-- `peut_acheter_competence` fait 13 978 octets, au-delà du seuil où le canal
-- de migration tronque en silence. Le RENAME ne fait pas voyager le corps ;
-- l'enveloppe qui le remplace porte la règle puis délègue. La gate garde son
-- nom, sa signature et ses appelants (règle VIS-5 : une règle d'achat vit
-- dans sa gate `peut_acheter_*`).

-- 1. La liste vit EN BASE, une seule maison pour le serveur ET pour le
-- miroir hors-ligne (le snapshot transporte la ligne complète de
-- `competences`). Une 11ᵉ compétence à PS se déclarera en cochant la case,
-- pas en cherchant trois listes dans trois langages.
ALTER TABLE public.competences
  ADD COLUMN IF NOT EXISTS exige_ps boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.competences.exige_ps IS
  'La compétence repose sur les points de spiritualité : un personnage portant le trait « Inapte à la magie » ne peut pas l''acheter. Source : manuel 2026-06-18, arbitrage Fred s369.';

-- Affectation EXHAUSTIVE (et non additive) : rejouable à froid, et retirer un
-- nom de la liste le remet à false sans geste séparé.
UPDATE public.competences
   SET exige_ps = (nom IN (
     'Développement Spirituel',
     'Développement Spirituel Supérieur',
     'Frénésie magique',
     'Acquisition de Cercle',
     'Acquisition de Sort',
     'Acquisition de Domaine',
     'Acquisition de Prière',
     'Canalisation',
     'Assemblage de Runes',
     'Bâton de Sorcier'
   ))
 WHERE exige_ps IS DISTINCT FROM (nom IN (
     'Développement Spirituel',
     'Développement Spirituel Supérieur',
     'Frénésie magique',
     'Acquisition de Cercle',
     'Acquisition de Sort',
     'Acquisition de Domaine',
     'Acquisition de Prière',
     'Canalisation',
     'Assemblage de Runes',
     'Bâton de Sorcier'
   ));

-- 2. Le noyau garde son corps intact ; seul son nom change.
-- Garde de rejouabilité : si le noyau existe déjà, l'enveloppe est en place
-- et la renommer à son tour serait catastrophique.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'peut_acheter_competence_noyau'
  ) THEN
    ALTER FUNCTION public.peut_acheter_competence(uuid, uuid, integer, text)
      RENAME TO peut_acheter_competence_noyau;
  END IF;
END
$do$;

-- 3. L'enveloppe : la règle, puis la délégation.
CREATE OR REPLACE FUNCTION public.peut_acheter_competence(
  p_personnage_id uuid,
  p_competence_id uuid,
  p_niveau_desire integer,
  p_choix_achat text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nom text;
BEGIN
  IF personnage_inapte_magie(p_personnage_id) THEN
    SELECT c.nom INTO v_nom
      FROM competences c
     WHERE c.id = p_competence_id
       AND c.exige_ps = true;

    IF v_nom IS NOT NULL THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', 'Inapte à la magie : ' || v_nom ||
                  ' repose sur les points de spiritualité, que ce personnage ne pourra jamais posséder.'
      );
    END IF;
  END IF;

  RETURN peut_acheter_competence_noyau(
    p_personnage_id, p_competence_id, p_niveau_desire, p_choix_achat
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.peut_acheter_competence(uuid, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.peut_acheter_competence(uuid, uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.peut_acheter_competence(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.peut_acheter_competence(uuid, uuid, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.peut_acheter_competence_noyau(uuid, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.peut_acheter_competence_noyau(uuid, uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.peut_acheter_competence_noyau(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.peut_acheter_competence_noyau(uuid, uuid, integer, text) TO service_role;

-- [INAPTE-MAGIE-MODELE-INSTANCE] — s369, 2026-07-30
-- Le trait CHOISI fait foi ; le pool de la race ne dit plus que ce qui est
-- PERMIS. Manuel (2026-06-18) : « Le demi-orc débute avec 60 points
-- d'expérience ainsi qu'UN trait racial permis par sa race », et « les
-- demi-orcs, ayant du sang humain, ont accès à la magie ».
-- Mesuré le 2026-07-30 : 3 demi-orcs en base sur 105 personnages, 1 seul
-- porteur réel du trait (ce personnage, acheté 10 XP). Le verdict change donc
-- pour 2 fiches, pas davantage.
-- Rejouable à froid : CREATE OR REPLACE + DROP IF EXISTS + rattrapage borné
-- aux seules fiches en dérive.

-- 1. Le verdict lit l'INSTANCE, plus le MODÈLE.
CREATE OR REPLACE FUNCTION public.personnage_inapte_magie(p_personnage_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM personnages p
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(p.traits_raciaux_choisis) = 'array'
        THEN p.traits_raciaux_choisis
        ELSE '[]'::jsonb
      END
    ) AS j(choix)
    JOIN traits_raciaux t ON t.id = (j.choix->>'trait_id')::uuid
    WHERE p.id = p_personnage_id
      AND t.nom = 'Inapte à la magie'
      AND t.est_actif = true
  );
$function$;

REVOKE ALL ON FUNCTION public.personnage_inapte_magie(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.personnage_inapte_magie(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.personnage_inapte_magie(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.personnage_inapte_magie(uuid) TO service_role;

-- 2. Le recalcul PV/PS suivait la classe, la compétence et la race — jamais
-- les traits, puisque les traits ne changeaient rien. Ils changent tout
-- maintenant : sans ce déclencheur, prendre « Inapte à la magie » laisserait
-- la fiche à ses anciens PS et mettrait les invariants au rouge.
CREATE OR REPLACE FUNCTION public.trg_recalculer_stats_sur_traits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM recalculer_pv_max(NEW.id);
  PERFORM recalculer_ps_max(NEW.id);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.trg_recalculer_stats_sur_traits() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_recalculer_stats_sur_traits() FROM anon;
REVOKE ALL ON FUNCTION public.trg_recalculer_stats_sur_traits() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.trg_recalculer_stats_sur_traits() TO service_role;

DROP TRIGGER IF EXISTS trg_recalculer_stats_traits ON public.personnages;
CREATE TRIGGER trg_recalculer_stats_traits
AFTER UPDATE OF traits_raciaux_choisis ON public.personnages
FOR EACH ROW
WHEN (new.traits_raciaux_choisis IS DISTINCT FROM old.traits_raciaux_choisis)
EXECUTE FUNCTION trg_recalculer_stats_sur_traits();

-- 3. Rattrapage BORNÉ : on ne touche que les fiches que les invariants
-- eux-mêmes déclarent en dérive. Zéro écriture sur les 103 autres, donc zéro
-- `updated_at` remué pour rien.
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT personnage_id FROM verifier_invariant_pv()
    UNION
    SELECT personnage_id FROM verifier_invariant_ps()
  LOOP
    PERFORM recalculer_pv_max(r.personnage_id);
    PERFORM recalculer_ps_max(r.personnage_id);
  END LOOP;
END
$do$;

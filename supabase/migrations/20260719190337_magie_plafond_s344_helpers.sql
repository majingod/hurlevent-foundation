-- [MAGIE-PLAFOND] s344 — plafond de coût d'un sort / d'une prière.
-- Manuel (Acquisition de Sort ET Acquisition de Prière, verbatim) :
--   « Un sort ne peut jamais coûter plus cher que 10 points d'expérience
--     plus 10 fois le niveau du personnage (10+(10*niv.)). »
-- Source UNIQUE de la formule et du message : ces deux fonctions.
-- Les 4 portes (peut_acheter_sort/priere, modifier_sort/priere) les APPELLENT.

CREATE OR REPLACE FUNCTION public.plafond_cout_magie(p_niveau integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $plafond$
  SELECT 10 + 10 * GREATEST(COALESCE(p_niveau, 1), 1);
$plafond$;

CREATE OR REPLACE FUNCTION public.refus_plafond_magie(p_type text, p_niveau integer, p_cout_xp integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $refus$
  SELECT CASE
    WHEN p_cout_xp IS NULL THEN NULL
    WHEN p_cout_xp <= public.plafond_cout_magie(p_niveau) THEN NULL
    ELSE (CASE WHEN p_type = 'priere' THEN 'Cette prière coûterait ' ELSE 'Ce sort coûterait ' END)
      || p_cout_xp || ' XP. À ton niveau (' || GREATEST(COALESCE(p_niveau, 1), 1) || '), '
      || (CASE WHEN p_type = 'priere' THEN 'une prière' ELSE 'un sort' END)
      || ' ne peut pas dépasser ' || public.plafond_cout_magie(p_niveau)
      || ' XP. Baisse le niveau, la portée, la durée ou le nombre de cibles.'
  END;
$refus$;

REVOKE EXECUTE ON FUNCTION public.plafond_cout_magie(integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.plafond_cout_magie(integer) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.refus_plafond_magie(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refus_plafond_magie(text, integer, integer) TO authenticated, service_role;

-- Phase 5.8 — Acquisition de Sort / Prière + gating opt-in étapes 6/7
-- Idempotent : INSERT ... WHERE NOT EXISTS + CREATE OR REPLACE.

-- 1. Nouvelle compétence enabler MAGE : Acquisition de Sort (0 XP, opt-in)
INSERT INTO public.competences
  (nom, description, categorie, niveaux, est_general, est_actif, type_achat,
   type_choix, verrouillage_croise, classes_requises, prerequis_competences)
SELECT
  'Acquisition de Sort',
  $d$Permet d'acquérir et de créer des sorts de mage.$d$,
  'mage',
  jsonb_build_array(jsonb_build_object(
    'niveau', 1, 'cout_xp', 0, 'prerequis', 'Acquisition de Cercle 1',
    'description', $d$Cette compétence travaille en conjonction avec la section des sorts de mage dans la création des personnages. Elle permet d'acquérir des sorts parmi la liste d'effets disponibles. Toutes les variables telles que l'école de magie, les cibles et rayons d'effet, la durée maximale, la portée et le niveau du sort sont ajustables lors de la création du sort. Un sort ne peut jamais coûter plus cher que 10 points d'expérience plus 10 fois le niveau du personnage (10+(10×niv.)). Le calcul du coût en points de spiritualité se trouve également dans la section des sorts de mage.$d$
  )),
  false, true, 'simple', NULL, false, NULL,
  '{"1":[{"niveau_min":1,"competence_nom":"Acquisition de Cercle"}]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.competences WHERE nom='Acquisition de Sort');

-- 2. Nouvelle compétence enabler PRÊTRE : Acquisition de Prière (0 XP, opt-in)
INSERT INTO public.competences
  (nom, description, categorie, niveaux, est_general, est_actif, type_achat,
   type_choix, verrouillage_croise, classes_requises, prerequis_competences)
SELECT
  'Acquisition de Prière',
  $d$Permet d'acquérir et de créer des prières divines.$d$,
  'pretre',
  jsonb_build_array(jsonb_build_object(
    'niveau', 1, 'cout_xp', 0, 'prerequis', 'Acquisition de Domaine 1',
    'description', $d$Cette compétence travaille en conjonction avec la section des prières de prêtre dans la création des personnages. Elle permet d'acquérir des prières parmi la liste d'effets disponibles. Toutes les variables telles que le domaine de magie, les cibles et rayons d'effet, la durée, la portée et le niveau de la prière sont ajustables lors de la création de la prière. Une prière ne peut jamais coûter plus cher que 10 points d'expérience plus 10 fois le niveau du personnage (10+(10×niv.)). Le calcul du coût en points de spiritualité se trouve également dans la section des prières de prêtre.$d$
  )),
  false, true, 'simple', NULL, false, NULL,
  '{"1":[{"niveau_min":1,"competence_nom":"Acquisition de Domaine"}]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.competences WHERE nom='Acquisition de Prière');

-- 3. Gating opt-in : étape 6 pilotée par Acquisition de Sort (et non plus Acquisition de Cercle)
CREATE OR REPLACE FUNCTION public.personnage_a_des_sorts(p_personnage_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'pg_catalog','public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM personnage_competences pc
    JOIN competences c ON c.id = pc.competence_id
    WHERE pc.personnage_id = p_personnage_id
      AND c.nom = 'Acquisition de Sort'
  );
$function$;

-- 4. Gating opt-in : étape 7 pilotée par Acquisition de Prière (et non plus Acquisition de Domaine)
CREATE OR REPLACE FUNCTION public.personnage_a_des_prieres(p_personnage_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'pg_catalog','public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM personnage_competences pc
    JOIN competences c ON c.id = pc.competence_id
    WHERE pc.personnage_id = p_personnage_id
      AND c.nom = 'Acquisition de Prière'
  );
$function$;

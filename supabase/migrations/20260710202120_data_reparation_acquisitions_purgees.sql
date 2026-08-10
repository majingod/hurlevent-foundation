-- DATA s322 : reparation de 2 victimes probables de la purge non scopee
-- d'attribuer_competences_gratuites_classe (fermee par 20260710163901).
-- Un personnage possede des sorts sans « Acquisition de Sort » ;
-- Un personnage possede des prieres sans « Acquisition de Priere ».
-- Re-insertion de la ligne niveau 1 a 0 XP (cout catalogue = 0, aucun impact XP).
-- Confirme par Fred en s322. Idempotent, rejouable a froid.

INSERT INTO public.personnage_competences
  (personnage_id, competence_id, niveau_acquis, xp_depense, appris_via_maitre, statut_maitre)
SELECT v.personnage_id, v.competence_id, 1, 0, false, 'non_requis'
FROM (VALUES
  ('d283bb4e-54be-4915-bcf8-0e5338417a8e'::uuid, 'd9a446cc-abdd-40d1-be68-42240b7c9bae'::uuid), -- ce personnage / Acquisition de Sort
  ('4e51752d-ab68-4c26-9ca7-a5f8c7e04566'::uuid, '61eb2c1f-522e-468c-a4ad-f45261e683cc'::uuid)  -- ce personnage / Acquisition de Priere
) AS v(personnage_id, competence_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.personnage_competences pc
  WHERE pc.personnage_id = v.personnage_id
    AND pc.competence_id = v.competence_id
);

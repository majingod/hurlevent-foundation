-- Correction verbatim manuel 2026 : prières Régénération (Bénédiction) et Interrogatoire (Ordre).
-- Niveau minimal 1 -> 6 ; grilles de paliers recalées (6,8,10,12,14,(16),20).
-- Tronc narratif inchangé (réutilisé depuis description_tronc). Coût ×1.5 inchangé.
-- Idempotent : UPDATE déterministe par id. N'affecte ni historique_xp ni xp_depense (invariant XP intact).
DO $$
DECLARE
  v_p_regen jsonb := '[
    {"texte":"Régénération totale de 2 points de vie.","niveau":6,"libelle":"Niv. 6"},
    {"texte":"Régénération totale de 3 points de vie.","niveau":8,"libelle":"Niv. 8"},
    {"texte":"Régénération totale de 4 points de vie.","niveau":10,"libelle":"Niv. 10"},
    {"texte":"Régénération totale de 5 points de vie.","niveau":12,"libelle":"Niv. 12"},
    {"texte":"Régénération totale de 6 points de vie.","niveau":14,"libelle":"Niv. 14"},
    {"texte":"Régénération totale de 7 points de vie.","niveau":16,"libelle":"Niv. 16"},
    {"texte":"Régénération totale de 8 points de vie OU rattache le membre.","niveau":20,"libelle":"Niv. 20"}
  ]'::jsonb;
  v_p_interro jsonb := '[
    {"texte":"Les cibles répondent à 1 seule question.","niveau":6,"libelle":"Niv. 6"},
    {"texte":"Les cibles répondent à 2 questions.","niveau":8,"libelle":"Niv. 8"},
    {"texte":"Les cibles répondent à 3 questions.","niveau":10,"libelle":"Niv. 10"},
    {"texte":"Les cibles répondent à 4 questions.","niveau":12,"libelle":"Niv. 12"},
    {"texte":"Les cibles répondent à 5 questions.","niveau":14,"libelle":"Niv. 14"},
    {"texte":"Les cibles répondent à 6 questions.","niveau":20,"libelle":"Niv. 20"}
  ]'::jsonb;
BEGIN
  UPDATE public.prieres SET niveau=6, paliers=v_p_regen,
    description = description_tronc || E'\n\n' || (SELECT string_agg(e->>'libelle' || ' : ' || (e->>'texte'), E'\n' ORDER BY (e->>'niveau')::int) FROM jsonb_array_elements(v_p_regen) e)
   WHERE id='1c964182-0207-4224-b517-acb4486e491e';

  UPDATE public.prieres SET niveau=6, paliers=v_p_interro,
    description = description_tronc || E'\n\n' || (SELECT string_agg(e->>'libelle' || ' : ' || (e->>'texte'), E'\n' ORDER BY (e->>'niveau')::int) FROM jsonb_array_elements(v_p_interro) e)
   WHERE id='12c62ef2-e23c-485b-ac7f-a0a9d1fa850c';
END $$;

-- Corrections de verbatim, alignées sur manuel_corrige_2026-06-10_phase2_FINAL.
-- Idempotent : chaque UPDATE est gardé par un LIKE sur la chaîne fautive
-- (re-run = 0 ligne touchée). Apostrophes droites U+0027 (convention projet).

-- 1) Assemblage de préservation : accord « son » -> « ses » (le « 10 minutes »
--    est correct = durée du coma ; le manuel FINAL dit « ses 10 minutes »).
UPDATE public.assemblages_runes
SET texte_manuel = replace(texte_manuel, 'de son 10 minutes', 'de ses 10 minutes')
WHERE nom = 'Assemblage de préservation'
  AND texte_manuel LIKE '%de son 10 minutes%';

-- 2) Acquisition de Domaine, niveau 1 : dernière phrase alignée au manuel FINAL
--    « de niveau 5 d'un cercle supplémentaire. » -> « des niveaux 1 à 5 d'un domaine au choix. »
--    (corrige cercle->domaine ET niveau 5->niveaux 1 à 5 ; cohérent avec description_courte).
UPDATE public.competences
SET niveaux = jsonb_set(
  niveaux,
  '{0,description}',
  to_jsonb(
    replace(
      niveaux->0->>'description',
      'donne accès aux sorts de niveau 5 d''un cercle supplémentaire.',
      'donne accès aux sorts des niveaux 1 à 5 d''un domaine au choix.'
    )
  )
)
WHERE nom = 'Acquisition de Domaine'
  AND niveaux->0->>'description' LIKE '%de niveau 5 d''un cercle supplémentaire.%';

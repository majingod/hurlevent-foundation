-- Sprint 5.7 batch 5 : compétences générales — descriptions verbatim manuel 2026
-- + libellés prérequis décoratifs manquants (le fonctionnel est déjà OK via competences.prerequis_competences).
-- Idempotent : jsonb_set pose le texte final complet ; le replace est no-op si déjà corrigé.

-- 1. Connaissances des Créatures niv1 : catégorie "nature" -> "Forêt"
--    (cohérence avec la table categories_creatures ET le manuel 2026)
UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1
    THEN jsonb_set(e, '{description}', to_jsonb(replace(e->>'description', 'les suivent : nature,', 'les suivent : Forêt,')))
    ELSE e END)
  FROM jsonb_array_elements(niveaux) e)
WHERE nom = 'Connaissances des Créatures';

-- 2. Herbalisme niv3 : ajout phrase prospection/mines (verbatim manuel)
UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 3
    THEN jsonb_set(e, '{description}', to_jsonb('Le personnage maximise sa récolte d''herbes communes et pige cinq cartes au début de chaque événement. Il conserve l''accès aux expéditions d''herbes rares selon les règles établies. Pour la description complète du système de récolte, se référer à la section récoltes. Il peut renoncer à sa récolte et à toute expédition entre deux événements afin de tenter une prospection et revendiquer des mines.'::text))
    ELSE e END)
  FROM jsonb_array_elements(niveaux) e)
WHERE nom = 'Herbalisme';

-- 3. Mineur niv3 : ajout phrase prospection/mines (verbatim manuel)
UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 3
    THEN jsonb_set(e, '{description}', to_jsonb('Le personnage maximise sa récolte de métaux communs et pige quatre cartes au début de chaque grandeur nature. Il conserve l''accès aux expéditions de métaux rares selon les règles établies. Pour les détails complets du système de récolte et d''expédition, se référer à la section récoltes. Il peut renoncer à sa récolte et à toute expédition entre deux événements afin de tenter une prospection et revendiquer des mines.'::text))
    ELSE e END)
  FROM jsonb_array_elements(niveaux) e)
WHERE nom = 'Mineur';

-- 4. Connaissances des Herbes Rares niv1 : libellé prérequis décoratif
--    (fonctionnel déjà appliqué via prerequis_competences au batch 4)
UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1
    THEN jsonb_set(e, '{prerequis}', to_jsonb('Connaissances des Herbes Communes'::text))
    ELSE e END)
  FROM jsonb_array_elements(niveaux) e)
WHERE nom = 'Connaissances des Herbes Rares';

-- 5. Connaissances des Métaux Rares niv1 : libellé prérequis décoratif
UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1
    THEN jsonb_set(e, '{prerequis}', to_jsonb('Connaissances des Métaux Communs'::text))
    ELSE e END)
  FROM jsonb_array_elements(niveaux) e)
WHERE nom = 'Connaissances des Métaux Rares';

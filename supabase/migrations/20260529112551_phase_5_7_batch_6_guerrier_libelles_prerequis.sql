-- Sprint 5.7 batch 6 (Guerrier) : ajout des libellés prérequis décoratifs manquants.
-- Descriptions Guerrier déjà verbatim-conformes (0 écart). Ici : texte décoratif niveaux[].prerequis.
-- Fonctionnel déjà en place (classes_requises / prerequis_competences) -> zéro impact gameplay.
-- Idempotent : jsonb_set pose la valeur finale.

-- Compétence d'arme à deux mains niv1 : Classe Guerrier
UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1
    THEN jsonb_set(e, '{prerequis}', to_jsonb('Classe Guerrier'::text)) ELSE e END)
  FROM jsonb_array_elements(niveaux) e)
WHERE nom = 'Compétence d''arme à deux mains' AND categorie = 'guerrier';

-- Compétence d'arme à la hache niv1/2/3 : Botte Secrète (niveaux 1-3)
UPDATE competences SET niveaux = (
  SELECT jsonb_agg(
    CASE (e->>'niveau')::int
      WHEN 1 THEN jsonb_set(e, '{prerequis}', to_jsonb('Botte Secrète niveau 1'::text))
      WHEN 2 THEN jsonb_set(e, '{prerequis}', to_jsonb('Botte Secrète niveau 2'::text))
      WHEN 3 THEN jsonb_set(e, '{prerequis}', to_jsonb('Botte Secrète niveau 3'::text))
      ELSE e END)
  FROM jsonb_array_elements(niveaux) e)
WHERE nom = 'Compétence d''arme à la hache' AND categorie = 'guerrier';

-- Charge niv1 : fix casse "secrète" -> "Secrète" + format niveau
UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1
    THEN jsonb_set(e, '{prerequis}', to_jsonb('Classe Guerrier, Botte Secrète niveau 1'::text)) ELSE e END)
  FROM jsonb_array_elements(niveaux) e)
WHERE nom = 'Charge' AND categorie = 'guerrier';

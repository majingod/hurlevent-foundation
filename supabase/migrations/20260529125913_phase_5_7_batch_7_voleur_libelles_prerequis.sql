-- Sprint 5.7 batch 7 (Voleur) : alignement libellé prérequis décoratif sur le nom canonique.
-- Descriptions Voleur déjà verbatim-conformes (0 écart ; seuls guillemets doublés du manuel, non répliqués).
-- Prérequis déjà canoniques sauf 1 casse : "Expertise en Toxicologie" -> "Expertise en toxicologie".
-- Pistage laissé sans libellé (classes_requises=null, accessible hors-classe, intentionnel).
-- Fonctionnel inchangé (classes_requises / prerequis_competences) -> zéro impact gameplay.
-- Idempotent : jsonb_set pose la valeur finale.

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1
    THEN jsonb_set(e, '{prerequis}', to_jsonb('Classe Voleur, Expertise en toxicologie'::text)) ELSE e END)
  FROM jsonb_array_elements(niveaux) e)
WHERE nom = 'Empoisonnement de projectile' AND categorie = 'voleur';

-- Ajout du sort Asphyxie (Cercle de l'Air, niveau 6)
-- Absent de la table sorts (oubli de saisie, confirmé session 73).
-- recherche_tsv est une colonne GÉNÉRÉE : ne pas l'insérer.

INSERT INTO sorts (
  nom, cercle, niveau, description, type_sort,
  zone_effet, portee, duree, cout_xp_base, est_actif
)
SELECT
  'Asphyxie', 'Air', 6,
  'Le lanceur draine l''air des poumons de la cible. Celle-ci doit tomber à genoux ou au sol et jouer qu''elle suffoque, incapable de parler ou d''incanter pendant toute la durée du sort. La cible peut encore se déplacer lentement, mais ne peut pas attaquer, incanter, ni utiliser de compétences. Quand la durée est terminée, la cible reprend son souffle et retrouve ses capacités normales.',
  'effet', 'Nombre de cibles', 'À vue', '1 Minute', 1.50, true
WHERE NOT EXISTS (
  SELECT 1 FROM sorts WHERE cercle = 'Air' AND niveau = 6
);

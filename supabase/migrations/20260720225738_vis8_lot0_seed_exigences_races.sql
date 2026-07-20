-- VIS-8 lot 0 (s347) : costume → races (7 lignes ; Humain n'exige rien).
-- Source : VIS-8 §2.3 (règles corrigées Fred s340) — même mécanique que
-- les compétences, même maison pour la phrase joueur (décision 12 : le
-- rattrapage « ✓ Je l'ai maintenant » vaut aussi aux races).
-- L'approbation d'organisation (Chiméride, Non-Races) n'est PAS un objet :
-- elle reste portée par le flux de demande de race existant.
-- Idempotent : ON CONFLICT (race_id) met à jour libellé + variantes.

WITH donnees(nom_race, libelle_manque, variantes) AS (VALUES
  ('Demi-Elfe', 'des oreilles pointues',
   '[{"objets":["oreilles_pointues"],"niveau_min":1}]'::jsonb),
  ('Demi-Orc', 'un masque, ou du maquillage vert',
   '[{"objets":["masque"],"niveau_min":1},{"objets":["maquillage_vert"],"niveau_min":1}]'::jsonb),
  ('Drow', 'un masque, ou des oreilles pointues avec un maquillage noir, gris ou mauve foncé',
   '[{"objets":["masque"],"niveau_min":1},{"objets":["oreilles_pointues","maquillage_fonce"],"niveau_min":1}]'::jsonb),
  ('Gobelin', 'un masque, ou des oreilles pointues avec un maquillage vert',
   '[{"objets":["masque"],"niveau_min":1},{"objets":["oreilles_pointues","maquillage_vert"],"niveau_min":1}]'::jsonb),
  ('Myrvalk', 'une barbe (obligatoire chez les hommes)',
   '[{"objets":["barbe"],"niveau_min":1}]'::jsonb),
  ('Chiméride', 'un costume d''animal',
   '[{"objets":["costume_animal"],"niveau_min":1}]'::jsonb),
  ('Les Non-Races', 'un costume de créature',
   '[{"objets":["costume_creature"],"niveau_min":1}]'::jsonb)
)
INSERT INTO public.objets_requis (race_id, libelle_manque, variantes)
SELECT r.id, d.libelle_manque, d.variantes
FROM donnees d
JOIN public.races r ON r.nom = d.nom_race
ON CONFLICT (race_id) DO UPDATE SET
  libelle_manque = EXCLUDED.libelle_manque,
  variantes = EXCLUDED.variantes;

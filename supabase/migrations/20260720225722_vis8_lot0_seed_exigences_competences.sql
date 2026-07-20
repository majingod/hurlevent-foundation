-- VIS-8 lot 0 (s347) : les 29 correspondances compétence → objet requis.
-- Source : carte_competence_equipement.md v2 (validée Fred s340, corrigée
-- s341) + décision s347 : le bâton (contondant, décision s339) ouvre
-- Assommer au niveau 1.
-- Jointure sur competences.nom → couvre les HOMONYMES mage/prêtre
-- (Assemblage de Runes ×2, VIS-8 §2.12) : 29 noms → 30 lignes.
-- Idempotent : ON CONFLICT (competence_id) met à jour libellé + variantes.

WITH donnees(nom_competence, libelle_manque, variantes) AS (VALUES
  ('Compétence d''arme à la lame', 'une lame, de n''importe quelle taille',
   '[{"objets":["lame_courte"],"niveau_min":1},{"objets":["lame_moyenne"],"niveau_min":1},{"objets":["lame_longue"],"niveau_min":1},{"objets":["lame_deux_mains"],"niveau_min":1}]'::jsonb),
  ('Compétence d''arme à la hache', 'une hache',
   '[{"objets":["hache"],"niveau_min":1}]'::jsonb),
  ('Compétence d''arme d''hast', 'une arme d''hast ou un bâton',
   '[{"objets":["baton_hast"],"niveau_min":1}]'::jsonb),
  ('Compétence d''arme d''impact', 'une masse ou un marteau (arme contondante)',
   '[{"objets":["contondante_courte"],"niveau_min":1},{"objets":["contondante_moyenne"],"niveau_min":1},{"objets":["contondante_longue"],"niveau_min":1}]'::jsonb),
  ('Compétence d''arme à deux mains', 'une arme à deux mains (110–160 cm)',
   '[{"objets":["lame_deux_mains"],"niveau_min":1}]'::jsonb),
  ('Compétence d''arme à distance', 'un arc, une arbalète ou une arme de jet',
   '[{"objets":["arme_distance"],"niveau_min":1}]'::jsonb),
  ('Combat à deux armes', 'deux armes identiques — courtes dès le niveau 1, moyennes au niveau 2, longues au niveau 3',
   '[{"objets":["deux_armes_identiques"],"niveau_min":1}]'::jsonb),
  ('Botte Secrète', 'une arme de mêlée, n''importe laquelle',
   '[{"objets":["lame_courte"],"niveau_min":1},{"objets":["lame_moyenne"],"niveau_min":1},{"objets":["lame_longue"],"niveau_min":1},{"objets":["lame_deux_mains"],"niveau_min":1},{"objets":["hache"],"niveau_min":1},{"objets":["contondante_courte"],"niveau_min":1},{"objets":["contondante_moyenne"],"niveau_min":1},{"objets":["contondante_longue"],"niveau_min":1},{"objets":["baton_hast"],"niveau_min":1}]'::jsonb),
  ('Charge', 'une arme à deux mains',
   '[{"objets":["lame_deux_mains"],"niveau_min":1}]'::jsonb),
  ('Assommer', 'une arme contondante longue ou un bâton dès le niveau 1, une contondante courte au niveau 2 — mains nues au niveau 3',
   '[{"objets":["contondante_longue"],"niveau_min":1},{"objets":["baton_hast"],"niveau_min":1},{"objets":["contondante_courte"],"niveau_min":2},{"objets":[],"niveau_min":3}]'::jsonb),
  ('Attaque sournoise', 'une lame courte (≤45 cm) — mains nues dès le niveau 2',
   '[{"objets":["lame_courte"],"niveau_min":1},{"objets":[],"niveau_min":2}]'::jsonb),
  ('Expertise en toxicologie', 'une arme de corps à corps non contondante (lame ou hache)',
   '[{"objets":["lame_courte"],"niveau_min":1},{"objets":["lame_moyenne"],"niveau_min":1},{"objets":["lame_longue"],"niveau_min":1},{"objets":["hache"],"niveau_min":1}]'::jsonb),
  ('Empoisonnement de projectile', 'une arme à distance et ses projectiles',
   '[{"objets":["arme_distance"],"niveau_min":1}]'::jsonb),
  ('Maniement du petit bouclier', 'une targe ou une rondache (≤40 cm)',
   '[{"objets":["targe"],"niveau_min":1}]'::jsonb),
  ('Maniement du bouclier moyen', 'un écu (≤100 cm)',
   '[{"objets":["ecu"],"niveau_min":1}]'::jsonb),
  ('Maniement du grand bouclier', 'un pavois (≤160 cm)',
   '[{"objets":["pavois"],"niveau_min":1}]'::jsonb),
  ('Désengagement', 'un bouclier, n''importe lequel',
   '[{"objets":["targe"],"niveau_min":1},{"objets":["ecu"],"niveau_min":1},{"objets":["pavois"],"niveau_min":1}]'::jsonb),
  ('Défense Inflexible', 'un bouclier, n''importe lequel',
   '[{"objets":["targe"],"niveau_min":1},{"objets":["ecu"],"niveau_min":1},{"objets":["pavois"],"niveau_min":1}]'::jsonb),
  ('Port d''armure légère', 'une armure de cuir',
   '[{"objets":["armure_cuir"],"niveau_min":1}]'::jsonb),
  ('Port d''armure intermédiaire', 'une armure de mailles',
   '[{"objets":["armure_maille"],"niveau_min":1}]'::jsonb),
  ('Port d''armure lourde', 'une armure de plaques',
   '[{"objets":["armure_plaques"],"niveau_min":1}]'::jsonb),
  ('Alchimie', 'des fioles',
   '[{"objets":["fioles"],"niveau_min":1}]'::jsonb),
  ('Herbalisme', 'des fioles',
   '[{"objets":["fioles"],"niveau_min":1}]'::jsonb),
  ('Assemblage de Runes', 'un crayon de maquillage, ou un pinceau et de la peinture lavable',
   '[{"objets":["crayon_maquillage"],"niveau_min":1}]'::jsonb),
  ('Bâton de Sorcier', 'un bâton, un sceptre ou une baguette',
   '[{"objets":["baton_sceptre_baguette"],"niveau_min":1}]'::jsonb),
  ('Premiers Soins', 'des bandages',
   '[{"objets":["bandages"],"niveau_min":1}]'::jsonb),
  ('Chirurgien', 'des outils de chirurgie, montrés à l''organisation avant la fin de semaine',
   '[{"objets":["outils_chirurgie"],"niveau_min":1}]'::jsonb),
  ('Cachette secrète', 'une bourse, pas plus grosse qu''un poing',
   '[{"objets":["bourse"],"niveau_min":1}]'::jsonb),
  ('Falsification', 'une feuille et un crayon (ou une plume)',
   '[{"objets":["feuille_crayon"],"niveau_min":1}]'::jsonb)
)
INSERT INTO public.objets_requis (competence_id, libelle_manque, variantes)
SELECT c.id, d.libelle_manque, d.variantes
FROM donnees d
JOIN public.competences c ON c.nom = d.nom_competence
ON CONFLICT (competence_id) DO UPDATE SET
  libelle_manque = EXCLUDED.libelle_manque,
  variantes = EXCLUDED.variantes;

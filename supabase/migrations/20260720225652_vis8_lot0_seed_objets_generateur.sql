-- VIS-8 lot 0 (s347) : les 31 cases de l'inventaire du générateur.
-- Vocabulaire = maquette phase 2 éprouvée par Fred (s346) ; ordre des
-- contondantes harmonisé courte→moyenne→longue (comme les lames).
-- Idempotent : rejouable, ON CONFLICT met à jour libellé/groupe/ordre.

INSERT INTO public.objets_generateur (id, libelle, groupe, ordre, est_actif) VALUES
  ('lame_courte', 'Lame courte (dague, ≤45 cm)', 'armes', 1, true),
  ('lame_moyenne', 'Lame moyenne (épée courte, cimeterre court)', 'armes', 2, true),
  ('lame_longue', 'Lame longue (80–110 cm)', 'armes', 3, true),
  ('lame_deux_mains', 'Lame à deux mains (110–160 cm)', 'armes', 4, true),
  ('hache', 'Hache (hachette, hache d''armes)', 'armes', 5, true),
  ('contondante_courte', 'Contondante courte (matraque, gourdin)', 'armes', 6, true),
  ('contondante_moyenne', 'Contondante moyenne (masse, marteau)', 'armes', 7, true),
  ('contondante_longue', 'Contondante longue (masse d''armes, marteau de guerre)', 'armes', 8, true),
  ('baton_hast', 'Bâton / arme d''hast', 'armes', 9, true),
  ('arme_distance', 'Arc, arbalète ou arme de jet', 'armes', 10, true),
  ('deux_armes_identiques', 'Deux armes identiques', 'armes', 11, true),
  ('targe', 'Targe / rondache (≤40 cm)', 'protections', 1, true),
  ('ecu', 'Écu (≤100 cm)', 'protections', 2, true),
  ('pavois', 'Pavois (≤160 cm)', 'protections', 3, true),
  ('armure_cuir', 'Armure de cuir', 'protections', 4, true),
  ('armure_maille', 'Armure de mailles', 'protections', 5, true),
  ('armure_plaques', 'Armure de plaques', 'protections', 6, true),
  ('fioles', 'Fioles (alchimie, herboristerie)', 'accessoires', 1, true),
  ('crayon_maquillage', 'Crayon de maquillage ou pinceau + peinture lavable', 'accessoires', 2, true),
  ('baton_sceptre_baguette', 'Bâton, sceptre ou baguette', 'accessoires', 3, true),
  ('bandages', 'Bandages', 'accessoires', 4, true),
  ('bourse', 'Bourse (≤ un poing)', 'accessoires', 5, true),
  ('feuille_crayon', 'Feuille et crayon (ou plume)', 'accessoires', 6, true),
  ('outils_chirurgie', 'Outils de chirurgie', 'accessoires', 7, true),
  ('oreilles_pointues', 'Oreilles pointues', 'costume', 1, true),
  ('masque', 'Masque', 'costume', 2, true),
  ('maquillage_vert', 'Maquillage vert', 'costume', 3, true),
  ('maquillage_fonce', 'Maquillage noir, gris ou mauve foncé', 'costume', 4, true),
  ('barbe', 'Barbe', 'costume', 5, true),
  ('costume_animal', 'Costume d''un animal', 'costume', 6, true),
  ('costume_creature', 'Costume de créature', 'costume', 7, true)
ON CONFLICT (id) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  groupe = EXCLUDED.groupe,
  ordre = EXCLUDED.ordre,
  est_actif = EXCLUDED.est_actif;

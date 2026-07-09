-- banque_xp_mouvements
CREATE INDEX IF NOT EXISTS
idx_banque_xp_mouvements_acteur_id ON
public.banque_xp_mouvements (acteur_id);
CREATE INDEX IF NOT EXISTS
idx_banque_xp_mouvements_evenement_id ON
public.banque_xp_mouvements (evenement_id);
CREATE INDEX IF NOT EXISTS
idx_banque_xp_mouvements_personnage_cible_id ON
public.banque_xp_mouvements (personnage_cible_id);
-- evenements
CREATE INDEX IF NOT EXISTS idx_evenements_created_by ON
public.evenements (created_by);
-- historique_xp (la plus grosse table : 14 FK)
CREATE INDEX IF NOT EXISTS idx_historique_xp_acteur_id ON
public.historique_xp (acteur_id);
CREATE INDEX IF NOT EXISTS
idx_historique_xp_assemblage_id ON public.historique_xp
(assemblage_id);
CREATE INDEX IF NOT EXISTS
idx_historique_xp_banque_mouvement_id ON
public.historique_xp (banque_mouvement_id);
CREATE INDEX IF NOT EXISTS
idx_historique_xp_competence_id ON public.historique_xp
(competence_id);
CREATE INDEX IF NOT EXISTS idx_historique_xp_evenement_id
ON public.historique_xp (evenement_id);
CREATE INDEX IF NOT EXISTS
idx_historique_xp_inscription_id ON public.historique_xp
(inscription_id);
CREATE INDEX IF NOT EXISTS
idx_historique_xp_objet_forge_id ON public.historique_xp
(objet_forge_id);
CREATE INDEX IF NOT EXISTS
idx_historique_xp_objet_joaillerie_id ON
public.historique_xp (objet_joaillerie_id);
CREATE INDEX IF NOT EXISTS
idx_historique_xp_personnage_source_id ON
public.historique_xp (personnage_source_id);
CREATE INDEX IF NOT EXISTS idx_historique_xp_piege_id ON
public.historique_xp (piege_id);
CREATE INDEX IF NOT EXISTS idx_historique_xp_priere_id ON
public.historique_xp (priere_id);
CREATE INDEX IF NOT EXISTS idx_historique_xp_recette_id
ON public.historique_xp (recette_id);
CREATE INDEX IF NOT EXISTS idx_historique_xp_sort_id ON
public.historique_xp (sort_id);
CREATE INDEX IF NOT EXISTS idx_historique_xp_trait_id ON
public.historique_xp (trait_id);
-- menu_navigation
CREATE INDEX IF NOT EXISTS idx_menu_navigation_section ON
public.menu_navigation (section);
-- objets_forge
CREATE INDEX IF NOT EXISTS idx_objets_forge_reparation_id
ON public.objets_forge (reparation_id);
-- personnage_* (tables de liaison)
CREATE INDEX IF NOT EXISTS
idx_personnage_assemblages_assemblage_id ON
public.personnage_assemblages (assemblage_id);
CREATE INDEX IF NOT EXISTS
idx_personnage_compo_photos_evenement_id ON
public.personnage_compo_photos (evenement_id);
CREATE INDEX IF NOT EXISTS
idx_personnage_compo_photos_inscription_id ON
public.personnage_compo_photos (inscription_id);
CREATE INDEX IF NOT EXISTS
idx_personnage_objets_forge_objet_id ON
public.personnage_objets_forge (objet_id);
CREATE INDEX IF NOT EXISTS
idx_personnage_objets_joaillerie_objet_id ON
public.personnage_objets_joaillerie (objet_id);
CREATE INDEX IF NOT EXISTS idx_personnage_pieges_piege_id
ON public.personnage_pieges (piege_id);
CREATE INDEX IF NOT EXISTS
idx_personnage_prieres_priere_id ON
public.personnage_prieres (priere_id);
CREATE INDEX IF NOT EXISTS
idx_personnage_races_demandes_approuve_par ON
public.personnage_races_demandes (approuve_par);
CREATE INDEX IF NOT EXISTS
idx_personnage_recettes_recette_id ON
public.personnage_recettes (recette_id);
CREATE INDEX IF NOT EXISTS idx_personnage_sorts_sort_id
ON public.personnage_sorts (sort_id);
-- personnages
CREATE INDEX IF NOT EXISTS
idx_personnages_classe_secondaire_id ON
public.personnages (classe_secondaire_id);
CREATE INDEX IF NOT EXISTS
idx_personnages_famille_criminelle_id ON
public.personnages (famille_criminelle_id);
CREATE INDEX IF NOT EXISTS idx_personnages_religion_id ON
public.personnages (religion_id);
-- prieres
CREATE INDEX IF NOT EXISTS idx_prieres_religion_id ON
public.prieres (religion_id);
-- race_traits
CREATE INDEX IF NOT EXISTS idx_race_traits_trait_id ON
public.race_traits (trait_id);

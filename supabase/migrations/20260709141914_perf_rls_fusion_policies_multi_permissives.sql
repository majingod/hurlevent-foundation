-- perf_rls_fusion_policies_multi_permissives
-- Fusion des policies PERMISSIVES multiples (advisor multiple_permissive_policies).
-- 30 tables catalogue : ALL(admin)+SELECT(lecture) -> SELECT unique (lecture OR admin) + 3 policies d'ecriture admin (INSERT/UPDATE/DELETE).
-- journal_audit : 2 SELECT (proprietaire || staff) -> 1 SELECT (proprio OR staff).
-- Semantique STRICTEMENT preservee (permissif = OR ; admin replie dans le SELECT pour garder la vue admin des lignes est_actif=false).
-- Idempotent : DROP POLICY IF EXISTS (anciens + nouveaux noms) avant CREATE.

-- === assemblages_runes ===
DROP POLICY IF EXISTS "Gestion assemblages" ON public.assemblages_runes;
DROP POLICY IF EXISTS "Lecture assemblages" ON public.assemblages_runes;
DROP POLICY IF EXISTS "assemblages_runes_lecture" ON public.assemblages_runes;
DROP POLICY IF EXISTS "assemblages_runes_admin_ins" ON public.assemblages_runes;
DROP POLICY IF EXISTS "assemblages_runes_admin_upd" ON public.assemblages_runes;
DROP POLICY IF EXISTS "assemblages_runes_admin_del" ON public.assemblages_runes;
CREATE POLICY "assemblages_runes_lecture" ON public.assemblages_runes FOR SELECT TO public USING (true);
CREATE POLICY "assemblages_runes_admin_ins" ON public.assemblages_runes FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "assemblages_runes_admin_upd" ON public.assemblages_runes FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "assemblages_runes_admin_del" ON public.assemblages_runes FOR DELETE TO public USING (est_animateur_ou_admin());

-- === bestiaire ===
DROP POLICY IF EXISTS "bestiaire_ecriture_admin" ON public.bestiaire;
DROP POLICY IF EXISTS "bestiaire_lecture_publique" ON public.bestiaire;
DROP POLICY IF EXISTS "bestiaire_lecture" ON public.bestiaire;
DROP POLICY IF EXISTS "bestiaire_admin_ins" ON public.bestiaire;
DROP POLICY IF EXISTS "bestiaire_admin_upd" ON public.bestiaire;
DROP POLICY IF EXISTS "bestiaire_admin_del" ON public.bestiaire;
CREATE POLICY "bestiaire_lecture" ON public.bestiaire FOR SELECT TO public USING (((est_actif = true)) OR est_animateur_ou_admin());
CREATE POLICY "bestiaire_admin_ins" ON public.bestiaire FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "bestiaire_admin_upd" ON public.bestiaire FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "bestiaire_admin_del" ON public.bestiaire FOR DELETE TO public USING (est_animateur_ou_admin());

-- === cartes_accueil ===
DROP POLICY IF EXISTS "cartes_accueil_ecriture_admin" ON public.cartes_accueil;
DROP POLICY IF EXISTS "cartes_accueil_lecture_publique" ON public.cartes_accueil;
DROP POLICY IF EXISTS "cartes_accueil_lecture" ON public.cartes_accueil;
DROP POLICY IF EXISTS "cartes_accueil_admin_ins" ON public.cartes_accueil;
DROP POLICY IF EXISTS "cartes_accueil_admin_upd" ON public.cartes_accueil;
DROP POLICY IF EXISTS "cartes_accueil_admin_del" ON public.cartes_accueil;
CREATE POLICY "cartes_accueil_lecture" ON public.cartes_accueil FOR SELECT TO public USING (((est_actif = true)) OR est_animateur_ou_admin());
CREATE POLICY "cartes_accueil_admin_ins" ON public.cartes_accueil FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "cartes_accueil_admin_upd" ON public.cartes_accueil FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "cartes_accueil_admin_del" ON public.cartes_accueil FOR DELETE TO public USING (est_animateur_ou_admin());

-- === categories_creatures ===
DROP POLICY IF EXISTS "categories_creatures_ecriture_admin" ON public.categories_creatures;
DROP POLICY IF EXISTS "categories_creatures_lecture_publique" ON public.categories_creatures;
DROP POLICY IF EXISTS "categories_creatures_lecture" ON public.categories_creatures;
DROP POLICY IF EXISTS "categories_creatures_admin_ins" ON public.categories_creatures;
DROP POLICY IF EXISTS "categories_creatures_admin_upd" ON public.categories_creatures;
DROP POLICY IF EXISTS "categories_creatures_admin_del" ON public.categories_creatures;
CREATE POLICY "categories_creatures_lecture" ON public.categories_creatures FOR SELECT TO public USING (((est_actif = true)) OR est_animateur_ou_admin());
CREATE POLICY "categories_creatures_admin_ins" ON public.categories_creatures FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "categories_creatures_admin_upd" ON public.categories_creatures FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "categories_creatures_admin_del" ON public.categories_creatures FOR DELETE TO public USING (est_animateur_ou_admin());

-- === classes ===
DROP POLICY IF EXISTS "Gestion classes" ON public.classes;
DROP POLICY IF EXISTS "Lecture classes" ON public.classes;
DROP POLICY IF EXISTS "classes_lecture" ON public.classes;
DROP POLICY IF EXISTS "classes_admin_ins" ON public.classes;
DROP POLICY IF EXISTS "classes_admin_upd" ON public.classes;
DROP POLICY IF EXISTS "classes_admin_del" ON public.classes;
CREATE POLICY "classes_lecture" ON public.classes FOR SELECT TO public USING (true);
CREATE POLICY "classes_admin_ins" ON public.classes FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "classes_admin_upd" ON public.classes FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "classes_admin_del" ON public.classes FOR DELETE TO public USING (est_animateur_ou_admin());

-- === competences ===
DROP POLICY IF EXISTS "Gestion compétences" ON public.competences;
DROP POLICY IF EXISTS "Lecture compétences" ON public.competences;
DROP POLICY IF EXISTS "competences_lecture" ON public.competences;
DROP POLICY IF EXISTS "competences_admin_ins" ON public.competences;
DROP POLICY IF EXISTS "competences_admin_upd" ON public.competences;
DROP POLICY IF EXISTS "competences_admin_del" ON public.competences;
CREATE POLICY "competences_lecture" ON public.competences FOR SELECT TO public USING (true);
CREATE POLICY "competences_admin_ins" ON public.competences FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "competences_admin_upd" ON public.competences FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "competences_admin_del" ON public.competences FOR DELETE TO public USING (est_animateur_ou_admin());

-- === config_jeu ===
DROP POLICY IF EXISTS "Gestion config" ON public.config_jeu;
DROP POLICY IF EXISTS "Lecture config" ON public.config_jeu;
DROP POLICY IF EXISTS "config_jeu_lecture" ON public.config_jeu;
DROP POLICY IF EXISTS "config_jeu_admin_ins" ON public.config_jeu;
DROP POLICY IF EXISTS "config_jeu_admin_upd" ON public.config_jeu;
DROP POLICY IF EXISTS "config_jeu_admin_del" ON public.config_jeu;
CREATE POLICY "config_jeu_lecture" ON public.config_jeu FOR SELECT TO public USING (true);
CREATE POLICY "config_jeu_admin_ins" ON public.config_jeu FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "config_jeu_admin_upd" ON public.config_jeu FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "config_jeu_admin_del" ON public.config_jeu FOR DELETE TO public USING (est_animateur_ou_admin());

-- === effets_combat ===
DROP POLICY IF EXISTS "Gestion effets" ON public.effets_combat;
DROP POLICY IF EXISTS "Lecture effets" ON public.effets_combat;
DROP POLICY IF EXISTS "effets_combat_lecture" ON public.effets_combat;
DROP POLICY IF EXISTS "effets_combat_admin_ins" ON public.effets_combat;
DROP POLICY IF EXISTS "effets_combat_admin_upd" ON public.effets_combat;
DROP POLICY IF EXISTS "effets_combat_admin_del" ON public.effets_combat;
CREATE POLICY "effets_combat_lecture" ON public.effets_combat FOR SELECT TO public USING (true);
CREATE POLICY "effets_combat_admin_ins" ON public.effets_combat FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "effets_combat_admin_upd" ON public.effets_combat FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "effets_combat_admin_del" ON public.effets_combat FOR DELETE TO public USING (est_animateur_ou_admin());

-- === evenements ===
DROP POLICY IF EXISTS "Gestion événements" ON public.evenements;
DROP POLICY IF EXISTS "Lecture événements" ON public.evenements;
DROP POLICY IF EXISTS "evenements_lecture" ON public.evenements;
DROP POLICY IF EXISTS "evenements_admin_ins" ON public.evenements;
DROP POLICY IF EXISTS "evenements_admin_upd" ON public.evenements;
DROP POLICY IF EXISTS "evenements_admin_del" ON public.evenements;
CREATE POLICY "evenements_lecture" ON public.evenements FOR SELECT TO public USING (((est_publie = true) OR est_animateur_ou_admin()));
CREATE POLICY "evenements_admin_ins" ON public.evenements FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "evenements_admin_upd" ON public.evenements FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "evenements_admin_del" ON public.evenements FOR DELETE TO public USING (est_animateur_ou_admin());

-- === familles_criminelles ===
DROP POLICY IF EXISTS "Gestion familles" ON public.familles_criminelles;
DROP POLICY IF EXISTS "Lecture familles" ON public.familles_criminelles;
DROP POLICY IF EXISTS "familles_criminelles_lecture" ON public.familles_criminelles;
DROP POLICY IF EXISTS "familles_criminelles_admin_ins" ON public.familles_criminelles;
DROP POLICY IF EXISTS "familles_criminelles_admin_upd" ON public.familles_criminelles;
DROP POLICY IF EXISTS "familles_criminelles_admin_del" ON public.familles_criminelles;
CREATE POLICY "familles_criminelles_lecture" ON public.familles_criminelles FOR SELECT TO public USING (true);
CREATE POLICY "familles_criminelles_admin_ins" ON public.familles_criminelles FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "familles_criminelles_admin_upd" ON public.familles_criminelles FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "familles_criminelles_admin_del" ON public.familles_criminelles FOR DELETE TO public USING (est_animateur_ou_admin());

-- === fiches_listes ===
DROP POLICY IF EXISTS "fiches_listes_ecriture_admin" ON public.fiches_listes;
DROP POLICY IF EXISTS "fiches_listes_lecture_publique" ON public.fiches_listes;
DROP POLICY IF EXISTS "fiches_listes_lecture" ON public.fiches_listes;
DROP POLICY IF EXISTS "fiches_listes_admin_ins" ON public.fiches_listes;
DROP POLICY IF EXISTS "fiches_listes_admin_upd" ON public.fiches_listes;
DROP POLICY IF EXISTS "fiches_listes_admin_del" ON public.fiches_listes;
CREATE POLICY "fiches_listes_lecture" ON public.fiches_listes FOR SELECT TO public USING (true);
CREATE POLICY "fiches_listes_admin_ins" ON public.fiches_listes FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "fiches_listes_admin_upd" ON public.fiches_listes FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "fiches_listes_admin_del" ON public.fiches_listes FOR DELETE TO public USING (est_animateur_ou_admin());

-- === fiches_schemas ===
DROP POLICY IF EXISTS "fiches_schemas_ecriture_admin" ON public.fiches_schemas;
DROP POLICY IF EXISTS "fiches_schemas_lecture_publique" ON public.fiches_schemas;
DROP POLICY IF EXISTS "fiches_schemas_lecture" ON public.fiches_schemas;
DROP POLICY IF EXISTS "fiches_schemas_admin_ins" ON public.fiches_schemas;
DROP POLICY IF EXISTS "fiches_schemas_admin_upd" ON public.fiches_schemas;
DROP POLICY IF EXISTS "fiches_schemas_admin_del" ON public.fiches_schemas;
CREATE POLICY "fiches_schemas_lecture" ON public.fiches_schemas FOR SELECT TO public USING (true);
CREATE POLICY "fiches_schemas_admin_ins" ON public.fiches_schemas FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "fiches_schemas_admin_upd" ON public.fiches_schemas FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "fiches_schemas_admin_del" ON public.fiches_schemas FOR DELETE TO public USING (est_animateur_ou_admin());

-- === ingredients_alchimiques ===
DROP POLICY IF EXISTS "Gestion ingredients" ON public.ingredients_alchimiques;
DROP POLICY IF EXISTS "Lecture ingredients" ON public.ingredients_alchimiques;
DROP POLICY IF EXISTS "ingredients_alchimiques_lecture" ON public.ingredients_alchimiques;
DROP POLICY IF EXISTS "ingredients_alchimiques_admin_ins" ON public.ingredients_alchimiques;
DROP POLICY IF EXISTS "ingredients_alchimiques_admin_upd" ON public.ingredients_alchimiques;
DROP POLICY IF EXISTS "ingredients_alchimiques_admin_del" ON public.ingredients_alchimiques;
CREATE POLICY "ingredients_alchimiques_lecture" ON public.ingredients_alchimiques FOR SELECT TO public USING (true);
CREATE POLICY "ingredients_alchimiques_admin_ins" ON public.ingredients_alchimiques FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "ingredients_alchimiques_admin_upd" ON public.ingredients_alchimiques FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "ingredients_alchimiques_admin_del" ON public.ingredients_alchimiques FOR DELETE TO public USING (est_animateur_ou_admin());

-- === journal_audit ===
DROP POLICY IF EXISTS "journal_audit_select_proprietaire" ON public.journal_audit;
DROP POLICY IF EXISTS "journal_audit_select_staff" ON public.journal_audit;
DROP POLICY IF EXISTS "journal_audit_lecture" ON public.journal_audit;
CREATE POLICY "journal_audit_lecture" ON public.journal_audit FOR SELECT TO authenticated USING ((((( SELECT auth.uid() AS uid) IS NOT NULL) AND (cible_type = 'personnage'::text) AND (EXISTS ( SELECT 1 FROM personnages p WHERE ((p.id = journal_audit.cible_id) AND compte_voit_joueur(p.joueur_id)))))) OR (est_animateur_ou_admin()));

-- === langues ===
DROP POLICY IF EXISTS "langues_ecriture_admin" ON public.langues;
DROP POLICY IF EXISTS "langues_lecture_publique" ON public.langues;
DROP POLICY IF EXISTS "langues_lecture" ON public.langues;
DROP POLICY IF EXISTS "langues_admin_ins" ON public.langues;
DROP POLICY IF EXISTS "langues_admin_upd" ON public.langues;
DROP POLICY IF EXISTS "langues_admin_del" ON public.langues;
CREATE POLICY "langues_lecture" ON public.langues FOR SELECT TO public USING (((est_actif = true)) OR est_animateur_ou_admin());
CREATE POLICY "langues_admin_ins" ON public.langues FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "langues_admin_upd" ON public.langues FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "langues_admin_del" ON public.langues FOR DELETE TO public USING (est_animateur_ou_admin());

-- === lore ===
DROP POLICY IF EXISTS "lore_ecriture_admin" ON public.lore;
DROP POLICY IF EXISTS "lore_lecture_publique" ON public.lore;
DROP POLICY IF EXISTS "lore_lecture" ON public.lore;
DROP POLICY IF EXISTS "lore_admin_ins" ON public.lore;
DROP POLICY IF EXISTS "lore_admin_upd" ON public.lore;
DROP POLICY IF EXISTS "lore_admin_del" ON public.lore;
CREATE POLICY "lore_lecture" ON public.lore FOR SELECT TO public USING (((est_actif = true)) OR est_animateur_ou_admin());
CREATE POLICY "lore_admin_ins" ON public.lore FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "lore_admin_upd" ON public.lore FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "lore_admin_del" ON public.lore FOR DELETE TO public USING (est_animateur_ou_admin());

-- === menu_navigation ===
DROP POLICY IF EXISTS "menu_navigation_ecriture_admin" ON public.menu_navigation;
DROP POLICY IF EXISTS "menu_navigation_lecture_publique" ON public.menu_navigation;
DROP POLICY IF EXISTS "menu_navigation_lecture" ON public.menu_navigation;
DROP POLICY IF EXISTS "menu_navigation_admin_ins" ON public.menu_navigation;
DROP POLICY IF EXISTS "menu_navigation_admin_upd" ON public.menu_navigation;
DROP POLICY IF EXISTS "menu_navigation_admin_del" ON public.menu_navigation;
CREATE POLICY "menu_navigation_lecture" ON public.menu_navigation FOR SELECT TO public USING (((est_actif = true)) OR est_animateur_ou_admin());
CREATE POLICY "menu_navigation_admin_ins" ON public.menu_navigation FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "menu_navigation_admin_upd" ON public.menu_navigation FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "menu_navigation_admin_del" ON public.menu_navigation FOR DELETE TO public USING (est_animateur_ou_admin());

-- === objets_forge ===
DROP POLICY IF EXISTS "Gestion objets forge" ON public.objets_forge;
DROP POLICY IF EXISTS "Lecture objets forge" ON public.objets_forge;
DROP POLICY IF EXISTS "objets_forge_lecture" ON public.objets_forge;
DROP POLICY IF EXISTS "objets_forge_admin_ins" ON public.objets_forge;
DROP POLICY IF EXISTS "objets_forge_admin_upd" ON public.objets_forge;
DROP POLICY IF EXISTS "objets_forge_admin_del" ON public.objets_forge;
CREATE POLICY "objets_forge_lecture" ON public.objets_forge FOR SELECT TO public USING (true);
CREATE POLICY "objets_forge_admin_ins" ON public.objets_forge FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "objets_forge_admin_upd" ON public.objets_forge FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "objets_forge_admin_del" ON public.objets_forge FOR DELETE TO public USING (est_animateur_ou_admin());

-- === objets_joaillerie ===
DROP POLICY IF EXISTS "Gestion objets joaillerie" ON public.objets_joaillerie;
DROP POLICY IF EXISTS "Lecture objets joaillerie" ON public.objets_joaillerie;
DROP POLICY IF EXISTS "objets_joaillerie_lecture" ON public.objets_joaillerie;
DROP POLICY IF EXISTS "objets_joaillerie_admin_ins" ON public.objets_joaillerie;
DROP POLICY IF EXISTS "objets_joaillerie_admin_upd" ON public.objets_joaillerie;
DROP POLICY IF EXISTS "objets_joaillerie_admin_del" ON public.objets_joaillerie;
CREATE POLICY "objets_joaillerie_lecture" ON public.objets_joaillerie FOR SELECT TO public USING (true);
CREATE POLICY "objets_joaillerie_admin_ins" ON public.objets_joaillerie FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "objets_joaillerie_admin_upd" ON public.objets_joaillerie FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "objets_joaillerie_admin_del" ON public.objets_joaillerie FOR DELETE TO public USING (est_animateur_ou_admin());

-- === pieges ===
DROP POLICY IF EXISTS "Écriture admin pièges" ON public.pieges;
DROP POLICY IF EXISTS "Lecture publique pièges" ON public.pieges;
DROP POLICY IF EXISTS "pieges_lecture" ON public.pieges;
DROP POLICY IF EXISTS "pieges_admin_ins" ON public.pieges;
DROP POLICY IF EXISTS "pieges_admin_upd" ON public.pieges;
DROP POLICY IF EXISTS "pieges_admin_del" ON public.pieges;
CREATE POLICY "pieges_lecture" ON public.pieges FOR SELECT TO public USING (true);
CREATE POLICY "pieges_admin_ins" ON public.pieges FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::text, 'animateur'::text]))))));
CREATE POLICY "pieges_admin_upd" ON public.pieges FOR UPDATE TO public USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::text, 'animateur'::text])))))) WITH CHECK ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::text, 'animateur'::text]))))));
CREATE POLICY "pieges_admin_del" ON public.pieges FOR DELETE TO public USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::text, 'animateur'::text]))))));

-- === prieres ===
DROP POLICY IF EXISTS "Gestion prières" ON public.prieres;
DROP POLICY IF EXISTS "Lecture prières" ON public.prieres;
DROP POLICY IF EXISTS "prieres_lecture" ON public.prieres;
DROP POLICY IF EXISTS "prieres_admin_ins" ON public.prieres;
DROP POLICY IF EXISTS "prieres_admin_upd" ON public.prieres;
DROP POLICY IF EXISTS "prieres_admin_del" ON public.prieres;
CREATE POLICY "prieres_lecture" ON public.prieres FOR SELECT TO public USING (true);
CREATE POLICY "prieres_admin_ins" ON public.prieres FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "prieres_admin_upd" ON public.prieres FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "prieres_admin_del" ON public.prieres FOR DELETE TO public USING (est_animateur_ou_admin());

-- === race_traits ===
DROP POLICY IF EXISTS "Gestion race_traits" ON public.race_traits;
DROP POLICY IF EXISTS "Lecture race_traits" ON public.race_traits;
DROP POLICY IF EXISTS "race_traits_lecture" ON public.race_traits;
DROP POLICY IF EXISTS "race_traits_admin_ins" ON public.race_traits;
DROP POLICY IF EXISTS "race_traits_admin_upd" ON public.race_traits;
DROP POLICY IF EXISTS "race_traits_admin_del" ON public.race_traits;
CREATE POLICY "race_traits_lecture" ON public.race_traits FOR SELECT TO public USING (true);
CREATE POLICY "race_traits_admin_ins" ON public.race_traits FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "race_traits_admin_upd" ON public.race_traits FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "race_traits_admin_del" ON public.race_traits FOR DELETE TO public USING (est_animateur_ou_admin());

-- === races ===
DROP POLICY IF EXISTS "Gestion races" ON public.races;
DROP POLICY IF EXISTS "Lecture races" ON public.races;
DROP POLICY IF EXISTS "races_lecture" ON public.races;
DROP POLICY IF EXISTS "races_admin_ins" ON public.races;
DROP POLICY IF EXISTS "races_admin_upd" ON public.races;
DROP POLICY IF EXISTS "races_admin_del" ON public.races;
CREATE POLICY "races_lecture" ON public.races FOR SELECT TO public USING (true);
CREATE POLICY "races_admin_ins" ON public.races FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "races_admin_upd" ON public.races FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "races_admin_del" ON public.races FOR DELETE TO public USING (est_animateur_ou_admin());

-- === recettes_alchimie ===
DROP POLICY IF EXISTS "Gestion recettes" ON public.recettes_alchimie;
DROP POLICY IF EXISTS "Lecture recettes" ON public.recettes_alchimie;
DROP POLICY IF EXISTS "recettes_alchimie_lecture" ON public.recettes_alchimie;
DROP POLICY IF EXISTS "recettes_alchimie_admin_ins" ON public.recettes_alchimie;
DROP POLICY IF EXISTS "recettes_alchimie_admin_upd" ON public.recettes_alchimie;
DROP POLICY IF EXISTS "recettes_alchimie_admin_del" ON public.recettes_alchimie;
CREATE POLICY "recettes_alchimie_lecture" ON public.recettes_alchimie FOR SELECT TO public USING (true);
CREATE POLICY "recettes_alchimie_admin_ins" ON public.recettes_alchimie FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "recettes_alchimie_admin_upd" ON public.recettes_alchimie FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "recettes_alchimie_admin_del" ON public.recettes_alchimie FOR DELETE TO public USING (est_animateur_ou_admin());

-- === religions ===
DROP POLICY IF EXISTS "Gestion religions" ON public.religions;
DROP POLICY IF EXISTS "Lecture religions" ON public.religions;
DROP POLICY IF EXISTS "religions_lecture" ON public.religions;
DROP POLICY IF EXISTS "religions_admin_ins" ON public.religions;
DROP POLICY IF EXISTS "religions_admin_upd" ON public.religions;
DROP POLICY IF EXISTS "religions_admin_del" ON public.religions;
CREATE POLICY "religions_lecture" ON public.religions FOR SELECT TO public USING (true);
CREATE POLICY "religions_admin_ins" ON public.religions FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "religions_admin_upd" ON public.religions FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "religions_admin_del" ON public.religions FOR DELETE TO public USING (est_animateur_ou_admin());

-- === reparations_forge ===
DROP POLICY IF EXISTS "Écriture admin reparations_forge" ON public.reparations_forge;
DROP POLICY IF EXISTS "Lecture publique reparations_forge" ON public.reparations_forge;
DROP POLICY IF EXISTS "reparations_forge_lecture" ON public.reparations_forge;
DROP POLICY IF EXISTS "reparations_forge_admin_ins" ON public.reparations_forge;
DROP POLICY IF EXISTS "reparations_forge_admin_upd" ON public.reparations_forge;
DROP POLICY IF EXISTS "reparations_forge_admin_del" ON public.reparations_forge;
CREATE POLICY "reparations_forge_lecture" ON public.reparations_forge FOR SELECT TO public USING (true);
CREATE POLICY "reparations_forge_admin_ins" ON public.reparations_forge FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::text, 'animateur'::text]))))));
CREATE POLICY "reparations_forge_admin_upd" ON public.reparations_forge FOR UPDATE TO public USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::text, 'animateur'::text])))))) WITH CHECK ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::text, 'animateur'::text]))))));
CREATE POLICY "reparations_forge_admin_del" ON public.reparations_forge FOR DELETE TO public USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::text, 'animateur'::text]))))));

-- === sections_encyclopedie ===
DROP POLICY IF EXISTS "sections_encyclopedie_ecriture_admin" ON public.sections_encyclopedie;
DROP POLICY IF EXISTS "sections_encyclopedie_lecture_publique" ON public.sections_encyclopedie;
DROP POLICY IF EXISTS "sections_encyclopedie_lecture" ON public.sections_encyclopedie;
DROP POLICY IF EXISTS "sections_encyclopedie_admin_ins" ON public.sections_encyclopedie;
DROP POLICY IF EXISTS "sections_encyclopedie_admin_upd" ON public.sections_encyclopedie;
DROP POLICY IF EXISTS "sections_encyclopedie_admin_del" ON public.sections_encyclopedie;
CREATE POLICY "sections_encyclopedie_lecture" ON public.sections_encyclopedie FOR SELECT TO public USING (((est_actif = true)) OR est_animateur_ou_admin());
CREATE POLICY "sections_encyclopedie_admin_ins" ON public.sections_encyclopedie FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "sections_encyclopedie_admin_upd" ON public.sections_encyclopedie FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "sections_encyclopedie_admin_del" ON public.sections_encyclopedie FOR DELETE TO public USING (est_animateur_ou_admin());

-- === sections_menu ===
DROP POLICY IF EXISTS "sections_menu_ecriture_admin" ON public.sections_menu;
DROP POLICY IF EXISTS "sections_menu_lecture_publique" ON public.sections_menu;
DROP POLICY IF EXISTS "sections_menu_lecture" ON public.sections_menu;
DROP POLICY IF EXISTS "sections_menu_admin_ins" ON public.sections_menu;
DROP POLICY IF EXISTS "sections_menu_admin_upd" ON public.sections_menu;
DROP POLICY IF EXISTS "sections_menu_admin_del" ON public.sections_menu;
CREATE POLICY "sections_menu_lecture" ON public.sections_menu FOR SELECT TO public USING (true);
CREATE POLICY "sections_menu_admin_ins" ON public.sections_menu FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "sections_menu_admin_upd" ON public.sections_menu FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "sections_menu_admin_del" ON public.sections_menu FOR DELETE TO public USING (est_animateur_ou_admin());

-- === sections_regles ===
DROP POLICY IF EXISTS "sections_regles_ecriture_admin" ON public.sections_regles;
DROP POLICY IF EXISTS "sections_regles_lecture_publique" ON public.sections_regles;
DROP POLICY IF EXISTS "sections_regles_lecture" ON public.sections_regles;
DROP POLICY IF EXISTS "sections_regles_admin_ins" ON public.sections_regles;
DROP POLICY IF EXISTS "sections_regles_admin_upd" ON public.sections_regles;
DROP POLICY IF EXISTS "sections_regles_admin_del" ON public.sections_regles;
CREATE POLICY "sections_regles_lecture" ON public.sections_regles FOR SELECT TO public USING (((est_actif = true)) OR est_animateur_ou_admin());
CREATE POLICY "sections_regles_admin_ins" ON public.sections_regles FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "sections_regles_admin_upd" ON public.sections_regles FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "sections_regles_admin_del" ON public.sections_regles FOR DELETE TO public USING (est_animateur_ou_admin());

-- === sorts ===
DROP POLICY IF EXISTS "Gestion sorts" ON public.sorts;
DROP POLICY IF EXISTS "Lecture sorts" ON public.sorts;
DROP POLICY IF EXISTS "sorts_lecture" ON public.sorts;
DROP POLICY IF EXISTS "sorts_admin_ins" ON public.sorts;
DROP POLICY IF EXISTS "sorts_admin_upd" ON public.sorts;
DROP POLICY IF EXISTS "sorts_admin_del" ON public.sorts;
CREATE POLICY "sorts_lecture" ON public.sorts FOR SELECT TO public USING (true);
CREATE POLICY "sorts_admin_ins" ON public.sorts FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "sorts_admin_upd" ON public.sorts FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "sorts_admin_del" ON public.sorts FOR DELETE TO public USING (est_animateur_ou_admin());

-- === traits_raciaux ===
DROP POLICY IF EXISTS "Gestion traits_raciaux" ON public.traits_raciaux;
DROP POLICY IF EXISTS "Lecture traits_raciaux" ON public.traits_raciaux;
DROP POLICY IF EXISTS "traits_raciaux_lecture" ON public.traits_raciaux;
DROP POLICY IF EXISTS "traits_raciaux_admin_ins" ON public.traits_raciaux;
DROP POLICY IF EXISTS "traits_raciaux_admin_upd" ON public.traits_raciaux;
DROP POLICY IF EXISTS "traits_raciaux_admin_del" ON public.traits_raciaux;
CREATE POLICY "traits_raciaux_lecture" ON public.traits_raciaux FOR SELECT TO public USING (true);
CREATE POLICY "traits_raciaux_admin_ins" ON public.traits_raciaux FOR INSERT TO public WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "traits_raciaux_admin_upd" ON public.traits_raciaux FOR UPDATE TO public USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
CREATE POLICY "traits_raciaux_admin_del" ON public.traits_raciaux FOR DELETE TO public USING (est_animateur_ou_admin());

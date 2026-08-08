-- D54 (s382) — LA PORTE MAGIQUE SE POSE AVEC SON ACCÈS.
--
-- INTENTION (#30, manuel l. 2854 et 3146) : « Acquisition de Sort » et
-- « Acquisition de Prière » ne sont PAS des achats. Le manuel les décrit comme
-- le mécanisme même d'acquisition — « Coût d'acquisition : Variable », « travaille
-- en conjonction avec la section des sorts ». Leur « coût variable », c'est le prix
-- de chaque sort. La case à 0 XP dans la liste de l'étape 5 était un artefact
-- d'implémentation, jamais une règle de jeu (C95 : le manuel gouverne le verbe
-- ACQUÉRIR UN SORT, pas COCHER UNE CASE).
--
-- Désormais : acheter « Acquisition de Cercle »  pose « Acquisition de Sort ».
--             acheter « Acquisition de Domaine » pose « Acquisition de Prière ».
--
-- POURQUOI UN TRIGGER ET NON acheter_competence (C97) : le contrôle est logé au
-- point de passage IRRÉVERSIBLE, donc il couvre TOUTES les portes d'écriture
-- (acheter_competence, générateur, changer_classe_personnage_interne, brouillon)
-- et non la seule RPC d'achat.
--
-- MESURÉ EN BASE AVANT ÉCRITURE (s382) :
--  · AUCUNE contrainte UNIQUE sur personnage_competences → idempotence EXPLICITE.
--  · trg_recalculer_ps_max_sur_competence ne recalcule que pour « Développement
--    Spirituel »/« Supérieur » → ps_max INCHANGÉ, invariant PS préservé.
--  · tg_refuser_domaine_proscrit sort si choix_achat IS NULL → inerte ici.
--  · verifier_verrous_competences : 4 noms hors périmètre → inerte ici.
--  · classes.competences_gratuites ne contient AUCUNE des 4 compétences → la purge
--    de attribuer_competences_gratuites_classe NE PEUT PAS balayer la ligne posée
--    (c'était le bug s322, désamorcé par mesure et non par espoir).
--  · Coût catalogue = 0 XP → aucun historique_xp, aucun budget d'archétype ne bouge.
--  · Pas de récursion : la ligne posée n'est ni Cercle ni Domaine.
--
-- PAS DE RÉTROACTIF (arbitrage Fred s382). Mesuré sur 114 personnages :
--  0 « Cercle sans Sort » · 0 « Sort sans Cercle » · 0 « des sorts sans la
--  compétence » · 1 seul « Domaine sans Prière » = Azaëlle Malter, finalisée,
--  0 prière — précisément le cas que D51 avertit déjà. Rien à réparer.
--
-- D51 INTACTE (vérifié dans le corps, pas déduit) : valider_etape_6 calcule
-- info_cercle_sans_sort AVANT la garde personnage_a_des_sorts, et compte les
-- VRAIES LIGNES de sorts, pas la compétence. Son avertissement ne bouge pas.
--
-- ⛔ REPLI : DROP TRIGGER trg_poser_porte_magique ON public.personnage_competences;
--    Les lignes déjà posées restent (0 XP, aucun effet de bord).

CREATE OR REPLACE FUNCTION public.tg_poser_porte_magique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_nom_acces text;
  v_categorie text;
  v_nom_porte text;
  v_porte_id  uuid;
BEGIN
  SELECT c.nom, c.categorie
    INTO v_nom_acces, v_categorie
  FROM public.competences c
  WHERE c.id = NEW.competence_id;

  v_nom_porte := CASE v_nom_acces
    WHEN 'Acquisition de Cercle'  THEN 'Acquisition de Sort'
    WHEN 'Acquisition de Domaine' THEN 'Acquisition de Prière'
    ELSE NULL
  END;

  IF v_nom_porte IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT c.id INTO v_porte_id
  FROM public.competences c
  WHERE c.nom = v_nom_porte
    AND c.categorie = v_categorie
  LIMIT 1;

  IF v_porte_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.personnage_competences
    WHERE personnage_id = NEW.personnage_id
      AND competence_id = v_porte_id
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.personnage_competences
    (personnage_id, competence_id, niveau_acquis, xp_depense,
     appris_via_maitre, statut_maitre, choix_achat)
  VALUES
    (NEW.personnage_id, v_porte_id, 1, 0, false, 'non_requis', NULL);

  RETURN NULL;
END;
$fn$;

COMMENT ON FUNCTION public.tg_poser_porte_magique() IS
'D54 (s382) — pose « Acquisition de Sort »/« Acquisition de Prière » (0 XP) dès que le personnage acquiert « Acquisition de Cercle »/« de Domaine ». Le manuel (l. 2854/3146) décrit ces deux compétences comme le mécanisme d''acquisition des sorts, pas comme un achat séparé. Idempotence explicite : aucune contrainte UNIQUE sur la table. REPLI : DROP TRIGGER trg_poser_porte_magique ON public.personnage_competences;';

REVOKE ALL ON FUNCTION public.tg_poser_porte_magique() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_poser_porte_magique ON public.personnage_competences;

CREATE TRIGGER trg_poser_porte_magique
AFTER INSERT ON public.personnage_competences
FOR EACH ROW
EXECUTE FUNCTION public.tg_poser_porte_magique();

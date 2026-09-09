-- s409 · La file des compétences-maître lit l'ÉTAT, et D2 a son sens inverse
--
-- Constat (Fred, 2026-09-04) : la tuile « Compét.-maître » du tableau de bord
-- disait 3, la file d'approbations en montrait 1. Deux instruments :
--   · vue_stats_admin compte statut_maitre = 'en_attente' ;
--   · vue_competences_maitre_admin filtrait appris_via_maitre = true.
-- Or changer_classe_personnage_interne (règle D2 : hors-classe au niveau 2
-- → en_attente de maître) écrit statut_maitre SANS toucher appris_via_maitre.
-- Toute attente née d'un changement de classe était donc invisible pour l'orga.
-- Et D2 n'avait pas de sens inverse : au retour dans la classe, l'attente restait.
--
-- Trois gestes, une seule maison (le même prédicat gouverne l'avenir et répare
-- le passé) :
--   1. changer_classe_personnage_interne : retouche ANCRÉE (3 ancres, chacune
--      exigée exactement une fois), sans retaper le corps — Postgres lit sa
--      propre définition, la modifie, la ré-exécute. md5 du corps attendu gravé.
--   2. Réparation : toute attente non-maître qui n'est plus hors-classe au
--      niveau 2 sous la classe COURANTE revient à non_requis (1 ligne mesurée
--      en prod le 2026-09-04 ; la requête est replayable sur une base vide).
--   3. vue_competences_maitre_admin : filtre sur statut_maitre <> 'non_requis'
--      (l'état) au lieu de appris_via_maitre (le chemin d'arrivée). La tuile et
--      la file disent le même chiffre par construction.
--
-- Repli : DROP FUNCTION + re-CREATE depuis 20260606052624 (corps antérieur, non
-- byte-exact avec la prod d'avant — voir CLOTURE_s409), ou ré-appliquer la
-- version d'avant depuis pg_get_functiondef sauvegardée en session.

-- ── 1. changer_classe_personnage_interne : D2 inverse ──────────────────────
DO $s409$
DECLARE
  v_def  text;
  v_n    int;
  v_md5  text;
  k_anc1 constant text := E'  v_maitre_ids  uuid[] := ARRAY[]::uuid[];   -- pc -> statut_maitre ''en_attente''\n';
  k_anc2 constant text := E'      AND pc.statut_maitre = ''non_requis'');\n';
  k_anc3 constant text := E'  UPDATE personnage_competences SET statut_maitre=''en_attente'' WHERE id = ANY(v_maitre_ids);\n';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'changer_classe_personnage_interne';
  IF v_def IS NULL THEN RAISE EXCEPTION 's409: fonction introuvable'; END IF;

  -- déjà retouchée ? (replay idempotent)
  IF position('v_retour_ids' IN v_def) > 0 THEN
    RAISE NOTICE 's409: D2 inverse déjà en place, rien à faire';
  ELSE
    v_n := (length(v_def) - length(replace(v_def, k_anc1, ''))) / length(k_anc1);
    IF v_n <> 1 THEN RAISE EXCEPTION 's409: ancre 1 trouvée % fois (attendu 1)', v_n; END IF;
    v_n := (length(v_def) - length(replace(v_def, k_anc2, ''))) / length(k_anc2);
    IF v_n <> 1 THEN RAISE EXCEPTION 's409: ancre 2 trouvée % fois (attendu 1)', v_n; END IF;
    v_n := (length(v_def) - length(replace(v_def, k_anc3, ''))) / length(k_anc3);
    IF v_n <> 1 THEN RAISE EXCEPTION 's409: ancre 3 trouvée % fois (attendu 1)', v_n; END IF;

    v_def := replace(v_def, k_anc1,
      k_anc1 || E'  v_retour_ids  uuid[] := ARRAY[]::uuid[];   -- pc -> retour a ''non_requis'' (D2 inverse, s409)\n');
    v_def := replace(v_def, k_anc2,
      k_anc2 || E'\n  -- D2 inverse (s409) : une attente nee d''un changement de classe (appris_via_maitre=false)\n  -- se leve quand la competence n''est plus hors-classe au niveau 2 sous la nouvelle classe.\n  v_retour_ids := ARRAY(\n    SELECT pc.id FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id\n    WHERE pc.personnage_id=p_personnage_id\n      AND pc.id <> ALL(v_removal_ids)\n      AND pc.statut_maitre = ''en_attente'' AND NOT pc.appris_via_maitre\n      AND NOT (NOT c.est_general AND c.categorie <> v_norm_new AND c.classes_requises IS NULL\n               AND pc.niveau_acquis = 2));\n');
    v_def := replace(v_def, k_anc3,
      k_anc3 || E'  -- 6c-bis. D2 inverse (s409)\n  UPDATE personnage_competences SET statut_maitre=''non_requis'' WHERE id = ANY(v_retour_ids);\n');

    EXECUTE v_def;

    SELECT md5(p.prosrc) INTO v_md5
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'changer_classe_personnage_interne';
    -- gate : corps attendu (mesuré en répétition annulée, 2026-09-04)
    IF v_md5 <> 'dfe5294509b88115f32af9dd13bd9aee' THEN
      RAISE EXCEPTION 's409: md5 du corps = % (attendu dfe5294509b88115f32af9dd13bd9aee)', v_md5;
    END IF;
  END IF;
END
$s409$;

-- ── 2. Réparation des attentes orphelines (même prédicat que la règle inverse) ──
UPDATE personnage_competences pc
SET statut_maitre = 'non_requis'
FROM personnages p
JOIN classes cl ON cl.id = p.classe_id,
     competences c
WHERE p.id = pc.personnage_id
  AND c.id = pc.competence_id
  AND pc.statut_maitre = 'en_attente'
  AND NOT pc.appris_via_maitre
  AND NOT (NOT c.est_general
           AND c.categorie <> (CASE cl.nom
                                 WHEN 'Guerrier' THEN 'guerrier' WHEN 'Voleur' THEN 'voleur'
                                 WHEN 'Mage' THEN 'mage' WHEN 'Prêtre' THEN 'pretre' ELSE NULL END)
           AND c.classes_requises IS NULL
           AND pc.niveau_acquis = 2);

-- ── 3. La file lit l'état, pas le chemin d'arrivée ─────────────────────────
CREATE OR REPLACE VIEW public.vue_competences_maitre_admin AS
 SELECT pc.id,
    COALESCE(p.nom, 'Personnage inconnu'::text) AS personnage_nom,
    COALESCE(pj.nom, cpt.email, 'Joueur inconnu'::text) AS joueur_nom,
    COALESCE(c.nom, 'Compétence inconnue'::text) AS competence_nom,
    pc.niveau_acquis,
    COALESCE(pc.nom_maitre, ''::text) AS nom_maitre,
    COALESCE(pc.statut_maitre, 'non_requis'::text) AS statut_maitre,
    pc.date_acquisition AS date_demande,
    pc.choix_achat
   FROM personnage_competences pc
     JOIN personnages p ON p.id = pc.personnage_id
     LEFT JOIN profils_joueur pj ON pj.id = p.joueur_id
     LEFT JOIN profiles cpt ON cpt.id = pj.compte_id
     LEFT JOIN competences c ON c.id = pc.competence_id
  WHERE est_animateur_ou_admin() AND COALESCE(pc.statut_maitre, 'non_requis') <> 'non_requis';

ALTER VIEW public.vue_competences_maitre_admin SET (security_invoker = on);

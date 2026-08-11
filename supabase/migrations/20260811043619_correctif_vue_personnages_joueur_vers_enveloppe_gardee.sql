-- s392 · La vue du tableau de bord repasse par l'enveloppe gardee.
--
-- INCIDENT : depuis la migration 20260810233540 (#767), tout compte authentifie
-- recevait « permission denied for function etat_edition_personnage_noyau » sur
-- le Tableau de bord et le Hub joueur. Cause : #767 a applique RENAME + ENVELOPPE
-- a etat_edition_personnage. Les dependances sont stockees par OID, donc
-- vue_personnages_joueur — qui appelait etat_edition_personnage — s'est retrouvee
-- a appeler le NOYAU sans que personne ne la touche. Le noyau ayant ete pose en
-- service_role seul, et la vue etant security_invoker=on (donc evaluee sous le
-- role du joueur), l'appel etait refuse.
--
-- CORRECTIF : la vue appelle de nouveau l'enveloppe etat_edition_personnage, qui
-- porte la garde compte_voit_joueur(joueur_id) OR est_animateur_ou_admin() — le
-- predicat exact de la policy de lecture de personnages (C116). La garde ne peut
-- donc refuser aucune ligne que la RLS laisse deja passer.
--
-- La definition de la vue n'est PAS retapee : elle est relue par pg_get_viewdef
-- et le seul identifiant vise est remplace mecaniquement, sous une gate de compte.
--
-- IDEMPOTENT : 0 occurrence => deja corrigee, ne rien faire. >1 => arret.
-- REPLI, un geste : re-executer ce bloc en inversant les deux identifiants.

DO $$
DECLARE
  v_def    text;
  v_ancien constant text := 'etat_edition_personnage_noyau(';
  v_neuf   constant text := 'etat_edition_personnage(';
  v_nb     integer;
BEGIN
  SELECT pg_get_viewdef('public.vue_personnages_joueur'::regclass, true) INTO v_def;

  v_nb := (length(v_def) - length(replace(v_def, v_ancien, ''))) / length(v_ancien);

  IF v_nb = 0 THEN
    RAISE NOTICE 'vue_personnages_joueur : deja repointee sur l enveloppe, rien a faire.';
    RETURN;
  ELSIF v_nb > 1 THEN
    RAISE EXCEPTION 'GATE : attendu exactement 1 occurrence de %, trouve % — arret.', v_ancien, v_nb;
  END IF;

  EXECUTE 'CREATE OR REPLACE VIEW public.vue_personnages_joueur WITH (security_invoker=on) AS '
          || replace(v_def, v_ancien, v_neuf);

  RAISE NOTICE 'vue_personnages_joueur : 1 appel repointe vers l enveloppe gardee.';
END $$;

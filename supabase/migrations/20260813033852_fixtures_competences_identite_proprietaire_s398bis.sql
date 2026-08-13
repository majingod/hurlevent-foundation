-- s398-bis · la fixture des competences parle avec l'identite du proprietaire
--
-- DEFAUT FERME : `fixtures_parite_visiteur` produisait **110 refus muets** (`raison: null`),
-- soit un fichier de parite entierement VERT A VIDE. La cause n'est PAS un oracle garde :
-- c'est le meme defaut que ⓪ de la migration 20260812214337, un cran plus bas.
-- `peut_acheter_competence_noyau` appelle `gate_edition_personnage()` a sa ligne 32 ; sans
-- `auth.uid()`, cette gate rend « personnage introuvable » pour les 116 fiches.
--
-- ⛔ CE QUI A ETE ECARTE, ET POURQUOI : poser un drapeau dans `peut_acheter_competence_noyau`
-- aurait touche **13 763 octets de logique de jeu vivante** pour un besoin de fixtures. Et un
-- remplacement de la gate par le noyau d'etat aurait eu DEUX effets mesures et indesirables :
--   · un admin editant une fiche gelee perdait l'override `est_admin()` (regression pour l'orga)
--   · un joueur ne voyant pas une fiche aurait recu un vrai verdict au lieu d'un refus muet,
--     ce qui aurait cree un oracle la ou il n'y en avait pas.
-- Le present correctif ne touche AUCUNE regle d'achat.
--
-- FACE B, MESUREE : les 6 autres fixtures rendent des md5 **rigoureusement identiques** avec et
-- sans identite. Elles n'empruntent pas ce chemin. ⛔ Ne pas leur porter ce geste.
--
-- Corps NON RETAPE : extrait verbatim de 20260703182920, puis 5 substitutions assertees
-- (les 3 de 20260812214337 rejouees a l'identique, plus les 2 de ce lot).
-- ACL : inchangee — service_role SEUL, anon et authenticated revoques NOMMEMENT (C102).
--
-- REPLI, un geste : re-appliquer 20260812214337.

CREATE OR REPLACE FUNCTION public.fixtures_parite_visiteur()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_contextes jsonb := '[]'::jsonb;
  v_cas jsonb := '[]'::jsonb;
  v_ref integer := 0;
  p record;
  d record;
  v_jwt_avant text;
  v_compte uuid;
BEGIN
  -- ⚠️ SANS IDENTITE, LES VERDICTS SONT MUETS ET FAUX.
  -- peut_acheter_competence_noyau ligne 32 appelle gate_edition_personnage(), qui rend
  -- « personnage introuvable » quand auth.uid() est NULL — le cas de service_role.
  -- Le noyau retourne alors {peut_acheter:false, raison:null} sur les 110 cas : un refus
  -- MUET. Le front, lui, calcule pour le proprietaire et dirait « niveau 2 requis ».
  -- La suite de parite serait donc VERTE A VIDE sur la totalite du fichier (C99).
  -- Mesure : sans identite 0 oui / 110 non · avec identite 27 oui / 83 non.
  -- ⭐ On pose l'identite du PROPRIETAIRE REEL des fiches, LU EN BASE (aucun uuid grave),
  -- ce qui est exactement la position que le front simule : le joueur edite sa fiche.
  -- ⛔ Portee : set_config(..., is_local => true) = la transaction seule, et l'etat d'avant
  -- est repose avant le RETURN. Cette fonction est grantee a service_role SEUL.
  -- ⛔ NE PAS porter ce geste dans les 6 autres fixtures : mesure en s398, leurs 6 md5 sont
  -- RIGOUREUSEMENT IDENTIQUES avec et sans identite — elles n'appellent pas cette gate.
  v_jwt_avant := current_setting('request.jwt.claims', true);
  SELECT pj.compte_id INTO v_compte
    FROM public.profils_joueur pj WHERE pj.id = public.profil_fixtures_id();
  IF v_compte IS NULL THEN
    RAISE EXCEPTION 'fixtures_parite_visiteur: profil ZZ-Fixtures sans compte porteur';
  END IF;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_compte, 'role', 'authenticated')::text, true);
  FOR p IN
    WITH candidats AS (
      SELECT pe.id, cl.nom AS classe_nom, pe.race_id,
             public.personnage_inapte_magie(pe.id) AS inapte,
             (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)) AS xp_dispo,
             COALESCE(pe.ps_max,0) AS ps_max,
             count(pc.id) AS nb_comp
      FROM personnages pe
      JOIN classes cl ON cl.id = pe.classe_id
      LEFT JOIN personnage_competences pc ON pc.personnage_id = pe.id
      WHERE pe.est_actif = true AND pe.est_mort = false
        AND pe.joueur_id = public.profil_fixtures_id()
      GROUP BY pe.id, cl.nom, pe.race_id, pe.xp_total, pe.xp_depense, pe.ps_max
    )
    SELECT DISTINCT ON (classe_nom, inapte) *
    FROM candidats
    WHERE (public.etat_edition_personnage_noyau(id)->>'peut_ajouter')::boolean
    ORDER BY classe_nom, inapte, nb_comp DESC, id
  LOOP
    v_ref := v_ref + 1;
    v_contextes := v_contextes || jsonb_build_array(jsonb_build_object(
      'ref', v_ref,
      'classe_nom', p.classe_nom,
      'race_id', p.race_id,
      'race_inapte_magie', p.inapte,
      'xp_dispo', p.xp_dispo,
      'ps_max', p.ps_max,
      'competences_acquises', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'competence_id', pc.competence_id,
          'competence_nom', c.nom,
          'categorie', c.categorie,
          'niveau_acquis', pc.niveau_acquis,
          'choix_achat', pc.choix_achat)
          ORDER BY c.nom, pc.niveau_acquis, pc.choix_achat), '[]'::jsonb)
        FROM personnage_competences pc
        JOIN competences c ON c.id = pc.competence_id
        WHERE pc.personnage_id = p.id)
    ));
    FOR d IN
      (SELECT c.id, c.nom, 1 AS niv, NULL::text AS choix, 1 AS ordre
       FROM (SELECT DISTINCT ON (type_achat) id, nom FROM competences WHERE est_actif = true ORDER BY type_achat, nom, id) c)
      UNION ALL
      (SELECT c.id, c.nom, 1, 'FIXTURE-CHOIX'::text, 2
       FROM (SELECT DISTINCT ON (type_achat) id, nom FROM competences WHERE est_actif = true ORDER BY type_achat, nom, id) c)
      UNION ALL
      (SELECT c2.id, c2.nom, pc2.niveau_acquis, pc2.choix_achat, 3
       FROM (SELECT pc.competence_id, pc.niveau_acquis, pc.choix_achat
             FROM personnage_competences pc WHERE pc.personnage_id = p.id
             ORDER BY pc.competence_id, pc.niveau_acquis LIMIT 3) pc2
       JOIN competences c2 ON c2.id = pc2.competence_id)
      UNION ALL
      (SELECT c2.id, c2.nom, LEAST(pc2.niveau_acquis + 1, 3), pc2.choix_achat, 4
       FROM (SELECT pc.competence_id, pc.niveau_acquis, pc.choix_achat
             FROM personnage_competences pc WHERE pc.personnage_id = p.id
             ORDER BY pc.competence_id, pc.niveau_acquis LIMIT 3) pc2
       JOIN competences c2 ON c2.id = pc2.competence_id)
      UNION ALL
      (SELECT c.id, c.nom, 3, NULL::text, 5
       FROM competences c
       WHERE c.est_actif = true AND c.est_general = false
         AND c.categorie IS DISTINCT FROM (CASE p.classe_nom
              WHEN 'Guerrier' THEN 'guerrier' WHEN 'Voleur' THEN 'voleur'
              WHEN 'Mage' THEN 'mage' WHEN 'Prêtre' THEN 'pretre' END)
       ORDER BY c.nom, c.id LIMIT 1)
      UNION ALL
      (SELECT c.id, c.nom, 1, NULL::text, 6
       FROM competences c
       WHERE c.nom IN ('Développement Spirituel','Développement Spirituel Supérieur') AND c.est_actif = true)
      UNION ALL
      (SELECT c.id, c.nom, n.n, NULL::text, 7
       FROM competences c CROSS JOIN (VALUES (1),(2)) n(n)
       WHERE c.nom = 'Dépeçage' AND c.est_actif = true)
      UNION ALL
      (SELECT ch.id, ch.nom, ch.nivmax, NULL::text, 8
       FROM (SELECT c.id, c.nom,
                    max((e->>'niveau')::int) AS nivmax,
                    max((e->>'cout_xp')::int) AS coutmax
             FROM competences c, jsonb_array_elements(c.niveaux) e
             WHERE c.est_actif = true
             GROUP BY c.id, c.nom
             ORDER BY coutmax DESC, c.nom LIMIT 1) ch)
      ORDER BY ordre, nom, niv
    LOOP
      v_cas := v_cas || jsonb_build_array(jsonb_build_object(
        'ctx', v_ref,
        'demande', jsonb_build_object(
          'competence_id', d.id, 'competence_nom', d.nom,
          'niveau_desire', d.niv, 'choix_achat', d.choix),
        'verdict', public.peut_acheter_competence(p.id, d.id, d.niv, d.choix)));
    END LOOP;
  END LOOP;
  IF v_ref = 0 THEN
    RAISE EXCEPTION 'fixtures_parite_visiteur: aucun personnage editable (profil ZZ-Fixtures vide ou fiches non editables ?)';
  END IF;
  PERFORM set_config('request.jwt.claims', COALESCE(v_jwt_avant, ''), true);
  RETURN jsonb_build_object(
    'genere_le', now(),
    'nb_contextes', v_ref,
    'nb_cas', jsonb_array_length(v_cas),
    'contextes', v_contextes,
    'cas', v_cas);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fixtures_parite_visiteur() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_parite_visiteur() TO service_role;
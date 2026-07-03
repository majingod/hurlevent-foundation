-- MODE-VISITEUR-OFFLINE : fixtures de parité {contexte anonymisé, demande, verdict serveur}.
-- Capture les verdicts EXACTS de peut_acheter_competence sur de vrais persos ÉDITABLES
-- (gate_edition NULL => aucun verdict pollué par gel/verrou). Anonymisé : aucun id/nom de perso.
-- STABLE => GET PostgREST. SECURITY DEFINER => lit personnage_competences sous RLS admin-neutre.
CREATE OR REPLACE FUNCTION public.fixtures_parite_visiteur()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_contextes jsonb := '[]'::jsonb;
  v_cas jsonb := '[]'::jsonb;
  v_ref integer := 0;
  p record;
  d record;
BEGIN
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
      GROUP BY pe.id, cl.nom, pe.race_id, pe.xp_total, pe.xp_depense, pe.ps_max
    )
    SELECT DISTINCT ON (classe_nom, inapte) *
    FROM candidats
    WHERE public.gate_edition_personnage(id, 'ajout') IS NULL
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
    RAISE EXCEPTION 'fixtures_parite_visiteur: aucun personnage editable (fenetre de gel ?) — regenerer hors gel';
  END IF;
  RETURN jsonb_build_object(
    'genere_le', now(),
    'nb_contextes', v_ref,
    'nb_cas', jsonb_array_length(v_cas),
    'contextes', v_contextes,
    'cas', v_cas);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fixtures_parite_visiteur() FROM public;
GRANT EXECUTE ON FUNCTION public.fixtures_parite_visiteur() TO anon, authenticated;

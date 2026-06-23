-- Vue enrichie pour l'outil de filtrage admin des personnages.
-- Expose scalaires + collections agrégées (nom distinct + niveau max) par personnage.
-- Sécurité calquée sur vue_personnages_admin : WHERE est_animateur_ou_admin().
CREATE OR REPLACE VIEW public.vue_personnages_admin_complet AS
SELECT
  p.id,
  p.nom,
  p.joueur_id,
  COALESCE(pr.nom_affichage, pr.email, 'Joueur inconnu') AS joueur_nom,
  COALESCE(r.nom, 'Race inconnue') AS race_nom,
  COALESCE(c.nom, 'Classe inconnue') AS classe_nom,
  cs.nom AS classe_secondaire_nom,
  rel.nom AS religion_nom,
  fc.nom AS famille_nom,
  COALESCE(p.niveau, 1) AS niveau,
  p.xp_total,
  p.xp_depense,
  p.est_actif,
  p.est_mort,
  p.est_finalise,
  p.est_verrouille,
  p.etape_creation,
  p.created_at,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('nom', tr.nom) ORDER BY tr.nom)
    FROM jsonb_array_elements(p.traits_raciaux_choisis) t(elem)
    JOIN traits_raciaux tr ON tr.id = (t.elem->>'trait_id')::uuid
  ), '[]'::jsonb) AS traits_raciaux,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('nom', x.nom, 'niveau', x.niv) ORDER BY x.nom)
    FROM (SELECT co.nom, max(pc.niveau_acquis) AS niv
          FROM personnage_competences pc JOIN competences co ON co.id = pc.competence_id
          WHERE pc.personnage_id = p.id GROUP BY co.nom) x
  ), '[]'::jsonb) AS competences,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('nom', x.nom, 'niveau', x.niv) ORDER BY x.nom)
    FROM (SELECT s.nom, max(ps.niveau_sort) AS niv
          FROM personnage_sorts ps JOIN sorts s ON s.id = ps.sort_id
          WHERE ps.personnage_id = p.id GROUP BY s.nom) x
  ), '[]'::jsonb) AS sorts,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('nom', x.nom, 'niveau', x.niv) ORDER BY x.nom)
    FROM (SELECT pi.nom, max(pp.niveau_priere) AS niv
          FROM personnage_prieres pp JOIN prieres pi ON pi.id = pp.priere_id
          WHERE pp.personnage_id = p.id GROUP BY pi.nom) x
  ), '[]'::jsonb) AS prieres,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('nom', x.nom) ORDER BY x.nom)
    FROM (SELECT DISTINCT ar.nom
          FROM personnage_assemblages pa JOIN assemblages_runes ar ON ar.id = pa.assemblage_id
          WHERE pa.personnage_id = p.id) x
  ), '[]'::jsonb) AS assemblages,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('nom', x.nom) ORDER BY x.nom)
    FROM (SELECT DISTINCT ra.nom
          FROM personnage_recettes prc JOIN recettes_alchimie ra ON ra.id = prc.recette_id
          WHERE prc.personnage_id = p.id) x
  ), '[]'::jsonb) AS recettes,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('nom', x.nom, 'niveau', x.niv) ORDER BY x.nom)
    FROM (SELECT pp2.piege_nom AS nom, max(pp2.niveau_acquis) AS niv
          FROM personnage_pieges pp2 WHERE pp2.personnage_id = p.id GROUP BY pp2.piege_nom) x
  ), '[]'::jsonb) AS pieges
FROM personnages p
LEFT JOIN profiles pr ON pr.id = p.joueur_id
LEFT JOIN races r ON r.id = p.race_id
LEFT JOIN classes c ON c.id = p.classe_id
LEFT JOIN classes cs ON cs.id = p.classe_secondaire_id
LEFT JOIN religions rel ON rel.id = p.religion_id
LEFT JOIN familles_criminelles fc ON fc.id = p.famille_criminelle_id
WHERE est_animateur_ou_admin();

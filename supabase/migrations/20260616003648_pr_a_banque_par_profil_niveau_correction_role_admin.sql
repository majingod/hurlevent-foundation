-- PR-1 (chantier rework AdminJoueurs) :
--  1) vue_banque_joueur : clé par PROFIL (corrige le solde des profils secondaires)
--  2) vue_personnages_admin_complet : expose niveau_correction (marqueur ✎)
--  3) RPC admin-only changer_role_compte (+ audit + notif)
--  4) RLS profiles : changement de rôle réservé aux admins (branche staff = est_admin)

-- 1) ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vue_banque_joueur AS
SELECT p.id AS joueur_id,
   COALESCE(sum(m.montant), 0)::integer AS solde,
   COALESCE(sum(m.montant) FILTER (WHERE m.montant > 0), 0)::integer AS total_gagne,
   COALESCE(sum(-m.montant) FILTER (WHERE m.montant < 0), 0)::integer AS total_transfere
FROM profils_joueur p
   LEFT JOIN banque_xp_mouvements m ON m.joueur_id = p.id
WHERE auth.uid() IS NOT NULL AND (p.compte_id = auth.uid() OR est_animateur_ou_admin())
GROUP BY p.id;
GRANT SELECT ON public.vue_banque_joueur TO anon, authenticated;

-- 2) ---------------------------------------------------------------------------
-- Reproduction fidèle de la vue + niveau_correction AJOUTÉ EN FIN (règle CREATE OR REPLACE : colonnes ajoutées à la fin uniquement).
CREATE OR REPLACE VIEW public.vue_personnages_admin_complet AS
 SELECT p.id,
    p.nom,
    p.joueur_id,
    COALESCE(pj.nom, cpt.email, 'Joueur inconnu'::text) AS joueur_nom,
    COALESCE(r.nom, 'Race inconnue'::text) AS race_nom,
    COALESCE(c.nom, 'Classe inconnue'::text) AS classe_nom,
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
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('nom', tr.nom) ORDER BY tr.nom) AS jsonb_agg
           FROM jsonb_array_elements(p.traits_raciaux_choisis) t(elem)
             JOIN traits_raciaux tr ON tr.id = ((t.elem ->> 'trait_id'::text)::uuid)), '[]'::jsonb) AS traits_raciaux,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('nom', x.nom, 'niveau', x.niv) ORDER BY x.nom) AS jsonb_agg
           FROM ( SELECT co.nom,
                    max(pc.niveau_acquis) AS niv
                   FROM personnage_competences pc
                     JOIN competences co ON co.id = pc.competence_id
                  WHERE pc.personnage_id = p.id
                  GROUP BY co.nom) x), '[]'::jsonb) AS competences,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('nom', x.nom, 'niveau', x.niv) ORDER BY x.nom) AS jsonb_agg
           FROM ( SELECT s.nom,
                    max(ps.niveau_sort) AS niv
                   FROM personnage_sorts ps
                     JOIN sorts s ON s.id = ps.sort_id
                  WHERE ps.personnage_id = p.id
                  GROUP BY s.nom) x), '[]'::jsonb) AS sorts,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('nom', x.nom, 'niveau', x.niv) ORDER BY x.nom) AS jsonb_agg
           FROM ( SELECT pi.nom,
                    max(pp.niveau_priere) AS niv
                   FROM personnage_prieres pp
                     JOIN prieres pi ON pi.id = pp.priere_id
                  WHERE pp.personnage_id = p.id
                  GROUP BY pi.nom) x), '[]'::jsonb) AS prieres,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('nom', x.nom) ORDER BY x.nom) AS jsonb_agg
           FROM ( SELECT DISTINCT ar.nom
                   FROM personnage_assemblages pa
                     JOIN assemblages_runes ar ON ar.id = pa.assemblage_id
                  WHERE pa.personnage_id = p.id) x), '[]'::jsonb) AS assemblages,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('nom', x.nom) ORDER BY x.nom) AS jsonb_agg
           FROM ( SELECT DISTINCT ra.nom
                   FROM personnage_recettes prc
                     JOIN recettes_alchimie ra ON ra.id = prc.recette_id
                  WHERE prc.personnage_id = p.id) x), '[]'::jsonb) AS recettes,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('nom', x.nom, 'niveau', x.niv) ORDER BY x.nom) AS jsonb_agg
           FROM ( SELECT pp2.piege_nom AS nom,
                    max(pp2.niveau_acquis) AS niv
                   FROM personnage_pieges pp2
                  WHERE pp2.personnage_id = p.id
                  GROUP BY pp2.piege_nom) x), '[]'::jsonb) AS pieges,
    COALESCE(p.niveau_correction, 0) AS niveau_correction
   FROM personnages p
     LEFT JOIN profils_joueur pj ON pj.id = p.joueur_id
     LEFT JOIN profiles cpt ON cpt.id = pj.compte_id
     LEFT JOIN races r ON r.id = p.race_id
     LEFT JOIN classes c ON c.id = p.classe_id
     LEFT JOIN classes cs ON cs.id = p.classe_secondaire_id
     LEFT JOIN religions rel ON rel.id = p.religion_id
     LEFT JOIN familles_criminelles fc ON fc.id = p.famille_criminelle_id
  WHERE est_animateur_ou_admin();

-- 3) ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.changer_role_compte(p_compte_id uuid, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ancien text;
  v_nom    text;
BEGIN
  IF NOT public.est_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','acces_refuse','message','Action réservée aux administrateurs.')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('joueur','animateur','admin') THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','role_invalide','message','Rôle invalide (joueur, animateur ou admin).','champ','role')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  SELECT role, COALESCE(nom_affichage, email) INTO v_ancien, v_nom
  FROM public.profiles WHERE id = p_compte_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','compte_introuvable','message','Compte introuvable.')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  IF v_ancien = p_role THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','role_inchange','message','Le compte a déjà ce rôle.')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  UPDATE public.profiles SET role = p_role WHERE id = p_compte_id;

  PERFORM public.log_audit('compte', p_compte_id, 'changement_role',
    jsonb_build_object('ancien', v_ancien, 'nouveau', p_role, 'nom', v_nom));

  INSERT INTO public.notifications (user_id, message)
  VALUES (p_compte_id, format('Votre rôle est passé de %s à %s.', v_ancien, p_role));

  RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('compte_id', p_compte_id, 'ancien', v_ancien, 'nouveau', p_role));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.changer_role_compte(uuid, text) TO authenticated;

-- 4) ---------------------------------------------------------------------------
-- Changement de rôle réservé aux admins : la branche staff passe de
-- est_animateur_ou_admin() à est_admin(). L'owner garde son auto-update
-- mais ne peut pas changer son propre rôle.
DROP POLICY IF EXISTS "Modification profil" ON public.profiles;
CREATE POLICY "Modification profil" ON public.profiles
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND (auth.uid() = id OR public.est_admin()))
  WITH CHECK (auth.uid() IS NOT NULL AND (((auth.uid() = id) AND (role = public.role_du_profil(auth.uid()))) OR public.est_admin()));

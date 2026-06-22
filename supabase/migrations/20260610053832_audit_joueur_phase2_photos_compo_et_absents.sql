-- AUDIT-JOUEUR-PHASE2 (s151) — Photos immuables de composition + mention absents
-- 1) Table append-only personnage_compo_photos
-- 2) capturer_compo_personnage : JSONB compo (noms + niveaux + variables + xp figés)
-- 3) attribuer_xp_evenement : prend la photo à la confirmation de présence
-- 4) cloturer_evenement : marque les non-confirmés 'absent' + log_audit (aucune récompense)

-- ---------- 1) Table ----------
CREATE TABLE IF NOT EXISTS public.personnage_compo_photos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnage_id   uuid NOT NULL REFERENCES public.personnages(id) ON DELETE CASCADE,
  evenement_id    uuid REFERENCES public.evenements(id) ON DELETE SET NULL,
  inscription_id  uuid REFERENCES public.inscriptions_evenements(id) ON DELETE SET NULL,
  compo           jsonb NOT NULL,
  acteur_id       uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compo_photos_perso_date
  ON public.personnage_compo_photos (personnage_id, created_at);

ALTER TABLE public.personnage_compo_photos ENABLE ROW LEVEL SECURITY;

-- Lecture : propriétaire (via compte) ou staff. Aucune écriture directe (SECURITY DEFINER only).
DROP POLICY IF EXISTS compo_photos_select ON public.personnage_compo_photos;
CREATE POLICY compo_photos_select ON public.personnage_compo_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.personnages p
      WHERE p.id = personnage_id
        AND (public.compte_voit_joueur(p.joueur_id) OR public.est_animateur_ou_admin())
    )
  );

-- ---------- 2) Capture de composition ----------
CREATE OR REPLACE FUNCTION public.capturer_compo_personnage(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_compo jsonb;
BEGIN
  SELECT jsonb_build_object(
    'meta', (
      SELECT jsonb_build_object(
        'niveau', pe.niveau,
        'xp_total', pe.xp_total,
        'xp_depense', pe.xp_depense
      )
      FROM public.personnages pe WHERE pe.id = p_personnage_id
    ),
    'competences', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pc.competence_id,
        'nom', c.nom,
        'niveau', pc.niveau_acquis,
        'xp', pc.xp_depense
      ) ORDER BY c.nom)
      FROM public.personnage_competences pc
      JOIN public.competences c ON c.id = pc.competence_id
      WHERE pc.personnage_id = p_personnage_id
    ), '[]'::jsonb),
    'sorts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ps.sort_id,
        'nom', s.nom,
        'nom_personnalise', ps.nom_personnalise,
        'niveau', ps.niveau_sort,
        'zone', ps.zone_choisie,
        'portee', ps.portee_choisie,
        'duree', ps.duree_choisie,
        'statut', ps.statut,
        'xp', ps.xp_depense
      ) ORDER BY s.nom)
      FROM public.personnage_sorts ps
      JOIN public.sorts s ON s.id = ps.sort_id
      WHERE ps.personnage_id = p_personnage_id
    ), '[]'::jsonb),
    'prieres', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pp.priere_id,
        'nom', pr.nom,
        'nom_personnalise', pp.nom_personnalise,
        'niveau', pp.niveau_priere,
        'zone', pp.zone_choisie,
        'portee', pp.portee_choisie,
        'duree', pp.duree_choisie,
        'statut', pp.statut,
        'xp', pp.xp_depense
      ) ORDER BY pr.nom)
      FROM public.personnage_prieres pp
      JOIN public.prieres pr ON pr.id = pp.priere_id
      WHERE pp.personnage_id = p_personnage_id
    ), '[]'::jsonb),
    'pieges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pg.piege_id,
        'nom', COALESCE(pi.nom, pg.piege_nom),
        'niveau', pg.niveau_acquis,
        'xp', pg.xp_depense
      ) ORDER BY COALESCE(pi.nom, pg.piege_nom))
      FROM public.personnage_pieges pg
      LEFT JOIN public.pieges pi ON pi.id = pg.piege_id
      WHERE pg.personnage_id = p_personnage_id
    ), '[]'::jsonb),
    'recettes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pr2.recette_id, 'nom', ra.nom, 'xp', pr2.xp_depense
      ) ORDER BY ra.nom)
      FROM public.personnage_recettes pr2
      JOIN public.recettes_alchimie ra ON ra.id = pr2.recette_id
      WHERE pr2.personnage_id = p_personnage_id
    ), '[]'::jsonb),
    'assemblages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pa.assemblage_id, 'nom', ar.nom, 'xp', pa.xp_depense
      ) ORDER BY ar.nom)
      FROM public.personnage_assemblages pa
      JOIN public.assemblages_runes ar ON ar.id = pa.assemblage_id
      WHERE pa.personnage_id = p_personnage_id
    ), '[]'::jsonb),
    'objets_forge', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pof.objet_id, 'nom', oof.nom, 'xp', pof.xp_depense
      ) ORDER BY oof.nom)
      FROM public.personnage_objets_forge pof
      JOIN public.objets_forge oof ON oof.id = pof.objet_id
      WHERE pof.personnage_id = p_personnage_id
    ), '[]'::jsonb),
    'objets_joaillerie', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', poj.objet_id, 'nom', ooj.nom, 'xp', poj.xp_depense
      ) ORDER BY ooj.nom)
      FROM public.personnage_objets_joaillerie poj
      JOIN public.objets_joaillerie ooj ON ooj.id = poj.objet_id
      WHERE poj.personnage_id = p_personnage_id
    ), '[]'::jsonb)
  ) INTO v_compo;

  RETURN v_compo;
END;
$function$;

-- ---------- 3) attribuer_xp_evenement : + photo ----------
CREATE OR REPLACE FUNCTION public.attribuer_xp_evenement(p_inscription_id uuid, p_xp_montant integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_inscription  RECORD;
  v_evenement    RECORD;
  v_niveau_up    boolean;
  v_description  text;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
  END IF;

  IF p_xp_montant IS NULL OR p_xp_montant <= 0 THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Montant invalide (doit être > 0)');
  END IF;

  SELECT * INTO v_inscription
  FROM public.inscriptions_evenements
  WHERE id = p_inscription_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Inscription introuvable');
  END IF;

  IF v_inscription.personnage_id IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Inscription sans personnage attaché');
  END IF;

  SELECT * INTO v_evenement
  FROM public.evenements
  WHERE id = v_inscription.evenement_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Événement introuvable');
  END IF;

  v_niveau_up := (v_evenement.type_evenement = 'gn_regulier');

  -- Met à jour l'inscription : XP attribué + statut 'present'
  UPDATE public.inscriptions_evenements
  SET xp_attribue = p_xp_montant,
      statut      = 'present'
  WHERE id = p_inscription_id;

  -- Met à jour le personnage : niveau et compteurs uniquement
  -- (xp_total est désormais géré par le trigger via historique_xp)
  UPDATE public.personnages
  SET niveau              = COALESCE(niveau, 1)              + CASE WHEN v_niveau_up                                       THEN 1 ELSE 0 END,
      gn_completes        = COALESCE(gn_completes, 0)        + CASE WHEN v_evenement.type_evenement = 'gn_regulier'        THEN 1 ELSE 0 END,
      mini_gn_completes   = COALESCE(mini_gn_completes, 0)   + CASE WHEN v_evenement.type_evenement = 'mini_gn'            THEN 1 ELSE 0 END,
      ouvertures_terrain  = COALESCE(ouvertures_terrain, 0)  + CASE WHEN v_evenement.type_evenement = 'entretien_terrain'  THEN 1 ELSE 0 END
  WHERE id = v_inscription.personnage_id;

  -- Description auto-générée
  v_description := format('XP gagné lors de l''événement « %s »%s',
    COALESCE(v_evenement.titre, 'Sans titre'),
    CASE WHEN v_evenement.date_evenement IS NOT NULL
      THEN ' du ' || to_char(v_evenement.date_evenement, 'DD/MM/YYYY')
      ELSE '' END
  );

  -- Le trigger trg_sync_xp_personnage met à jour xp_total automatiquement
  INSERT INTO public.historique_xp (
    personnage_id, type_mouvement, montant, description,
    evenement_id, inscription_id, acteur_id
  ) VALUES (
    v_inscription.personnage_id, 'gain_evenement', p_xp_montant, v_description,
    v_inscription.evenement_id, p_inscription_id, auth.uid()
  );

  -- AUDIT-JOUEUR-PHASE2 : photo immuable de composition à la confirmation de présence
  INSERT INTO public.personnage_compo_photos (
    personnage_id, evenement_id, inscription_id, compo, acteur_id
  ) VALUES (
    v_inscription.personnage_id,
    v_inscription.evenement_id,
    p_inscription_id,
    public.capturer_compo_personnage(v_inscription.personnage_id),
    auth.uid()
  );

  -- Notification au joueur
  INSERT INTO public.notifications (user_id, message)
  VALUES (
    v_inscription.joueur_id,
    'Vous avez reçu ' || p_xp_montant || ' XP pour « ' || v_evenement.titre || ' »' ||
    CASE WHEN v_niveau_up THEN ' (+1 niveau)' ELSE '' END || '.'
  );

  RETURN jsonb_build_object(
    'succes',    true,
    'xp_ajoute', p_xp_montant,
    'niveau_up', v_niveau_up
  );
END;
$function$;

-- ---------- 4) cloturer_evenement : + absents ----------
CREATE OR REPLACE FUNCTION public.cloturer_evenement(p_evenement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_evt public.evenements%ROWTYPE;
  v_inscription record;
  v_absent record;
  v_xp_montant integer;
  v_niveaux integer;
  v_count_present integer := 0;
  v_count_absent integer := 0;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'acces_refuse', 'message', 'Accès refusé.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_evt FROM public.evenements WHERE id = p_evenement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'evenement_introuvable', 'message', 'Événement introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF v_evt.est_termine THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'evenement_deja_termine', 'message', 'Événement déjà terminé.')),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('evenement_id', p_evenement_id));
  END IF;
  v_xp_montant := COALESCE(v_evt.xp_recompense, 0);
  v_niveaux := COALESCE(v_evt.niveaux_recompense, 0);
  FOR v_inscription IN
    SELECT id, personnage_id FROM public.inscriptions_evenements
     WHERE evenement_id = p_evenement_id AND statut = 'present' AND personnage_id IS NOT NULL
  LOOP
    PERFORM public.attribuer_xp_evenement(v_inscription.id, v_xp_montant);
    IF v_niveaux > 0 THEN
      UPDATE public.personnages SET niveau = COALESCE(niveau, 1) + v_niveaux, updated_at = now()
       WHERE id = v_inscription.personnage_id;
    END IF;
    v_count_present := v_count_present + 1;
  END LOOP;

  -- AUDIT-JOUEUR-PHASE2 : inscriptions jamais confirmées → 'absent' + mention au journal,
  -- aucune récompense. Le personnage se dégèle de lui-même (est_termine=true ci-dessous).
  FOR v_absent IN
    SELECT i.id, i.personnage_id, p.nom AS personnage_nom
      FROM public.inscriptions_evenements i
      JOIN public.personnages p ON p.id = i.personnage_id
     WHERE i.evenement_id = p_evenement_id AND i.statut = 'en_attente' AND i.personnage_id IS NOT NULL
  LOOP
    UPDATE public.inscriptions_evenements
       SET statut = 'absent', updated_at = now()
     WHERE id = v_absent.id;
    PERFORM public.log_audit(
      'personnage', v_absent.personnage_id, 'absence_evenement',
      jsonb_build_object(
        'personnage_nom', v_absent.personnage_nom,
        'evenement_id', p_evenement_id,
        'evenement_titre', v_evt.titre,
        'inscription_id', v_absent.id,
        'recompense', 'aucune'
      )
    );
    v_count_absent := v_count_absent + 1;
  END LOOP;

  UPDATE public.evenements SET est_termine = true, updated_at = now() WHERE id = p_evenement_id;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'evenement_id', p_evenement_id,
      'nb_presences_recompensees', v_count_present,
      'nb_absents', v_count_absent,
      'xp_par_presence', v_xp_montant,
      'niveaux_par_presence', v_niveaux));
END;
$function$;

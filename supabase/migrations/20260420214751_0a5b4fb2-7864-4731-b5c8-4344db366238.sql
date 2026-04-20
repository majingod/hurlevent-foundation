-- Sécuriser les profils contre l'usurpation et l'élévation de privilèges
CREATE OR REPLACE FUNCTION public.proteger_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_catalog
AS $$
DECLARE
  v_actor_role text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL OR NEW.id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Création de profil non autorisée' USING ERRCODE = '42501';
    END IF;

    NEW.role := 'joueur';
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Modification de l''identifiant profil non autorisée' USING ERRCODE = '42501';
    END IF;

    SELECT role INTO v_actor_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF auth.uid() = OLD.id AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Modification de votre propre rôle non autorisée' USING ERRCODE = '42501';
    END IF;

    IF COALESCE(v_actor_role, 'joueur') NOT IN ('admin', 'animateur')
       AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Modification du rôle non autorisée' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proteger_profile_role_trigger ON public.profiles;
CREATE TRIGGER proteger_profile_role_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.proteger_profile_role();

DROP POLICY IF EXISTS "Création profil sécurisée" ON public.profiles;
CREATE POLICY "Création profil sécurisée"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id AND COALESCE(role, 'joueur') = 'joueur');

DROP POLICY IF EXISTS "Modification profil" ON public.profiles;
CREATE POLICY "Modification profil"
ON public.profiles
FOR UPDATE
TO authenticated
USING ((auth.uid() = id) OR public.est_animateur_ou_admin())
WITH CHECK ((auth.uid() = id) OR public.est_animateur_ou_admin());

-- RPC sécurisée pour la liste des joueurs administrable
CREATE OR REPLACE FUNCTION public.get_joueurs_avec_count()
RETURNS TABLE (
  id uuid,
  nom_affichage text,
  email text,
  role text,
  created_at timestamp without time zone,
  nb_personnages bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_catalog
AS $$
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.nom_affichage,
    p.email,
    p.role,
    p.created_at,
    COUNT(pe.id)::bigint AS nb_personnages
  FROM public.profiles p
  LEFT JOIN public.personnages pe ON pe.joueur_id = p.id
  GROUP BY p.id, p.nom_affichage, p.email, p.role, p.created_at
  ORDER BY p.created_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.get_joueurs_avec_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_joueurs_avec_count() TO authenticated;

-- Vues administratives sécurisées côté base de données
CREATE OR REPLACE VIEW public.vue_stats_admin
WITH (security_invoker = true)
AS
SELECT
  (SELECT COUNT(*) FROM public.profiles WHERE role = 'joueur') AS nb_joueurs,
  (SELECT COUNT(*) FROM public.personnages WHERE est_actif = true AND est_mort = false) AS nb_personnages_actifs,
  (SELECT COUNT(*) FROM public.inscriptions_evenements WHERE statut = 'en_attente') AS nb_presences_attente,
  (SELECT COUNT(*) FROM public.personnage_competences WHERE statut_maitre = 'en_attente') AS nb_competences_attente,
  (SELECT titre FROM public.evenements WHERE est_publie = true AND date_evenement > now() ORDER BY date_evenement LIMIT 1) AS prochain_evenement_titre,
  (SELECT date_evenement FROM public.evenements WHERE est_publie = true AND date_evenement > now() ORDER BY date_evenement LIMIT 1) AS prochain_evenement_date
FROM (SELECT 1 WHERE public.est_animateur_ou_admin()) AS garde;

CREATE OR REPLACE VIEW public.vue_personnages_admin
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.nom,
  COALESCE(pr.nom_affichage, pr.email, 'Joueur inconnu') AS joueur_nom,
  COALESCE(r.nom, 'Race inconnue') AS race_nom,
  COALESCE(c.nom, 'Classe inconnue') AS classe_nom,
  COALESCE(p.niveau, 1) AS niveau,
  p.est_actif,
  p.etape_creation,
  p.created_at
FROM public.personnages p
LEFT JOIN public.profiles pr ON pr.id = p.joueur_id
LEFT JOIN public.races r ON r.id = p.race_id
LEFT JOIN public.classes c ON c.id = p.classe_id
WHERE public.est_animateur_ou_admin();

CREATE OR REPLACE VIEW public.vue_evenements_admin
WITH (security_invoker = true)
AS
SELECT
  e.id,
  e.titre,
  e.description,
  e.date_evenement AS date_debut,
  e.date_fin,
  e.lieu,
  COUNT(i.id)::integer AS nb_participants,
  COALESCE(e.est_publie, false) AS est_publie
FROM public.evenements e
LEFT JOIN public.inscriptions_evenements i ON i.evenement_id = e.id
WHERE public.est_animateur_ou_admin()
GROUP BY e.id, e.titre, e.description, e.date_evenement, e.date_fin, e.lieu, e.est_publie;

CREATE OR REPLACE VIEW public.vue_competences_maitre_admin
WITH (security_invoker = true)
AS
SELECT
  pc.id,
  COALESCE(p.nom, 'Personnage inconnu') AS personnage_nom,
  COALESCE(pr.nom_affichage, pr.email, 'Joueur inconnu') AS joueur_nom,
  COALESCE(c.nom, 'Compétence inconnue') AS competence_nom,
  pc.niveau_acquis,
  COALESCE(pc.nom_maitre, '') AS nom_maitre,
  COALESCE(pc.statut_maitre, 'non_requis') AS statut_maitre,
  pc.date_acquisition AS date_demande
FROM public.personnage_competences pc
JOIN public.personnages p ON p.id = pc.personnage_id
LEFT JOIN public.profiles pr ON pr.id = p.joueur_id
LEFT JOIN public.competences c ON c.id = pc.competence_id
WHERE public.est_animateur_ou_admin()
  AND pc.appris_via_maitre = true;

GRANT SELECT ON public.vue_stats_admin TO authenticated;
GRANT SELECT ON public.vue_personnages_admin TO authenticated;
GRANT SELECT ON public.vue_evenements_admin TO authenticated;
GRANT SELECT ON public.vue_competences_maitre_admin TO authenticated;

-- Limiter l'exécution des RPC sensibles aux sessions authentifiées ; chaque fonction garde son contrôle de rôle interne.
REVOKE ALL ON FUNCTION public.attribuer_xp_evenement(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.donner_xp_bonus(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verrouiller_personnage(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deverrouiller_personnage(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archiver_personnage(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approuver_maitre_competence(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marquer_absent(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.attribuer_xp_evenement(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.donner_xp_bonus(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verrouiller_personnage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deverrouiller_personnage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archiver_personnage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approuver_maitre_competence(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marquer_absent(uuid) TO authenticated;
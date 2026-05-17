-- ============================================================================
-- PHASE 1.3 — Création de la table historique_xp
-- ============================================================================
-- Date     : 2026-05-04
-- Objectif : Tracer chaque mouvement d'XP (gain/dépense) avec type, montant,
--            description, référence à l'objet acheté, et acteur.
-- Logique  : La table devient la SOURCE DE VÉRITÉ pour personnages.xp_total
--            et personnages.xp_depense, via un trigger AFTER INSERT/UPDATE/DELETE
--            qui recalcule les valeurs à partir de races.xp_depart + somme des
--            mouvements.
-- Décisions actées :
--   • XP de départ implicite (race.xp_depart, jamais tracé)
--   • 12 types_mouvement (4 positifs : gain_evenement, gain_bonus,
--     gain_correction, remboursement ; 8 négatifs : depense_*)
--   • 8 colonnes FK dédiées vers les objets achetables (CHECK exactement 1
--     non-nulle pour dépenses/remboursement)
--   • Trigger AFTER en mode recalcul total (auto-correctif)
--   • RAISE WARNING si xp_depense_calc > xp_total_calc
--   • ON DELETE CASCADE depuis personnages
--   • personnage_source_id réservé pour les transferts inter-personnages
--     (Mini-GN d'hiver, fonction de transfert à venir)
--   • RLS : SELECT propriétaire + animateur/admin ; INSERT/UPDATE/DELETE
--     uniquement via RPC SECURITY DEFINER
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table historique_xp
-- ---------------------------------------------------------------------------

CREATE TABLE public.historique_xp (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  personnage_id        uuid        NOT NULL REFERENCES public.personnages(id) ON DELETE CASCADE,
  type_mouvement       text        NOT NULL,
  montant              integer     NOT NULL,
  description          text        NOT NULL,

  -- 8 FK vers les objets achetables (exactement 1 non-nulle pour dépenses/remboursement)
  competence_id        uuid        REFERENCES public.competences(id)        ON DELETE SET NULL,
  trait_id             uuid        REFERENCES public.traits_raciaux(id)     ON DELETE SET NULL,
  sort_id              uuid        REFERENCES public.sorts(id)              ON DELETE SET NULL,
  priere_id            uuid        REFERENCES public.prieres(id)            ON DELETE SET NULL,
  recette_id           uuid        REFERENCES public.recettes_alchimie(id)  ON DELETE SET NULL,
  assemblage_id        uuid        REFERENCES public.assemblages_runes(id)  ON DELETE SET NULL,
  objet_forge_id       uuid        REFERENCES public.objets_forge(id)       ON DELETE SET NULL,
  objet_joaillerie_id  uuid        REFERENCES public.objets_joaillerie(id)  ON DELETE SET NULL,

  -- Contexte événement (gain_evenement)
  evenement_id         uuid        REFERENCES public.evenements(id)            ON DELETE SET NULL,
  inscription_id       uuid        REFERENCES public.inscriptions_evenements(id) ON DELETE SET NULL,

  -- Acteur (admin/animateur qui a déclenché l'opération)
  acteur_id            uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Réservé pour les transferts inter-personnages (Mini-GN d'hiver, etc.)
  personnage_source_id uuid        REFERENCES public.personnages(id) ON DELETE SET NULL,

  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.historique_xp IS
  'Source de vérité des mouvements d''XP par personnage. xp_total et xp_depense des personnages sont recalculés par le trigger trg_sync_xp_personnage à chaque modification.';

COMMENT ON COLUMN public.historique_xp.type_mouvement IS
  'Type de mouvement parmi 12 valeurs : gain_evenement, gain_bonus, gain_correction, remboursement (positifs) ; depense_competence, depense_trait, depense_sort, depense_priere, depense_recette, depense_assemblage, depense_objet_forge, depense_objet_joaillerie (négatifs).';

COMMENT ON COLUMN public.historique_xp.personnage_source_id IS
  'Réservé pour les transferts d''XP entre personnages (ex. : XP Mini-GN d''hiver gardé en banque pour un futur personnage). Pas utilisé pour l''instant.';

-- ---------------------------------------------------------------------------
-- 2. Contraintes CHECK
-- ---------------------------------------------------------------------------

-- Liste blanche des types
ALTER TABLE public.historique_xp
  ADD CONSTRAINT chk_historique_xp_type_valide
  CHECK (type_mouvement IN (
    'gain_evenement', 'gain_bonus', 'gain_correction', 'remboursement',
    'depense_competence', 'depense_trait', 'depense_sort', 'depense_priere',
    'depense_recette', 'depense_assemblage', 'depense_objet_forge', 'depense_objet_joaillerie'
  ));

-- Pas de mouvement à zéro
ALTER TABLE public.historique_xp
  ADD CONSTRAINT chk_historique_xp_montant_non_nul
  CHECK (montant <> 0);

-- Cohérence signe / type
ALTER TABLE public.historique_xp
  ADD CONSTRAINT chk_historique_xp_signe_coherent
  CHECK (
    (type_mouvement IN ('gain_evenement', 'gain_bonus', 'gain_correction', 'remboursement') AND montant > 0)
    OR
    (type_mouvement LIKE 'depense_%' AND montant < 0)
  );

-- Description non vide
ALTER TABLE public.historique_xp
  ADD CONSTRAINT chk_historique_xp_description_non_vide
  CHECK (char_length(trim(description)) >= 1);

-- Cardinalité des FK objet :
--   • dépense ou remboursement : exactement 1 FK objet non-nulle
--   • gain_evenement / gain_bonus / gain_correction : aucune FK objet
ALTER TABLE public.historique_xp
  ADD CONSTRAINT chk_historique_xp_reference_objet
  CHECK (
    CASE
      WHEN type_mouvement LIKE 'depense_%' OR type_mouvement = 'remboursement' THEN
        (
          (CASE WHEN competence_id        IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN trait_id             IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN sort_id              IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN priere_id            IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN recette_id           IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN assemblage_id        IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN objet_forge_id       IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN objet_joaillerie_id  IS NOT NULL THEN 1 ELSE 0 END)
        ) = 1
      WHEN type_mouvement IN ('gain_evenement', 'gain_bonus', 'gain_correction') THEN
        competence_id IS NULL AND trait_id IS NULL AND sort_id IS NULL
        AND priere_id IS NULL AND recette_id IS NULL AND assemblage_id IS NULL
        AND objet_forge_id IS NULL AND objet_joaillerie_id IS NULL
      ELSE FALSE
    END
  );

-- Alignement type_mouvement / colonne FK utilisée pour les dépenses spécifiques
-- (un depense_competence ne peut pas pointer vers un sort_id, etc.)
ALTER TABLE public.historique_xp
  ADD CONSTRAINT chk_historique_xp_type_alignement_fk
  CHECK (
       (type_mouvement = 'depense_competence'        AND competence_id        IS NOT NULL)
    OR (type_mouvement = 'depense_trait'             AND trait_id             IS NOT NULL)
    OR (type_mouvement = 'depense_sort'              AND sort_id              IS NOT NULL)
    OR (type_mouvement = 'depense_priere'            AND priere_id            IS NOT NULL)
    OR (type_mouvement = 'depense_recette'           AND recette_id           IS NOT NULL)
    OR (type_mouvement = 'depense_assemblage'        AND assemblage_id        IS NOT NULL)
    OR (type_mouvement = 'depense_objet_forge'       AND objet_forge_id       IS NOT NULL)
    OR (type_mouvement = 'depense_objet_joaillerie'  AND objet_joaillerie_id  IS NOT NULL)
    OR (type_mouvement = 'remboursement')
    OR (type_mouvement IN ('gain_evenement', 'gain_bonus', 'gain_correction'))
  );

-- ---------------------------------------------------------------------------
-- 3. Index
-- ---------------------------------------------------------------------------

CREATE INDEX idx_historique_xp_personnage_id_created_at
  ON public.historique_xp (personnage_id, created_at DESC);

CREATE INDEX idx_historique_xp_type_mouvement
  ON public.historique_xp (type_mouvement);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.historique_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historique_xp_select_proprietaire_ou_admin"
  ON public.historique_xp
  FOR SELECT
  USING (
    public.est_animateur_ou_admin()
    OR EXISTS (
      SELECT 1 FROM public.personnages p
      WHERE p.id = historique_xp.personnage_id
        AND p.joueur_id = auth.uid()
    )
  );

-- Aucune policy INSERT/UPDATE/DELETE : tout passe par RPC SECURITY DEFINER

-- ---------------------------------------------------------------------------
-- 5. Fonction trigger sync_xp_personnage
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_xp_personnage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_personnage_id    uuid;
  v_xp_initial      integer;
  v_xp_gains        integer;
  v_xp_depenses     integer;
  v_xp_total_calc   integer;
  v_xp_depense_calc integer;
BEGIN
  v_personnage_id := COALESCE(NEW.personnage_id, OLD.personnage_id);

  -- Si le personnage est en cours de suppression (CASCADE), on n'essaie pas
  -- de mettre à jour : la ligne aura disparu de toute façon.
  PERFORM 1 FROM public.personnages WHERE id = v_personnage_id;
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- XP de départ via la race (0 si race pas encore choisie en étape 1)
  SELECT COALESCE(r.xp_depart, 0)
    INTO v_xp_initial
  FROM public.personnages p
  LEFT JOIN public.races r ON r.id = p.race_id
  WHERE p.id = v_personnage_id;

  -- Sommes des mouvements positifs et négatifs
  SELECT
    COALESCE(SUM(CASE WHEN montant > 0 THEN montant  ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN montant < 0 THEN -montant ELSE 0 END), 0)
    INTO v_xp_gains, v_xp_depenses
  FROM public.historique_xp
  WHERE personnage_id = v_personnage_id;

  v_xp_total_calc   := v_xp_initial + v_xp_gains;
  v_xp_depense_calc := v_xp_depenses;

  -- Garde-fou : warning si dépense > total. La contrainte CHECK
  -- personnages_xp_depense_max bloquera de toute façon le commit, mais le
  -- warning donne un message lisible avec le contexte exact.
  IF v_xp_depense_calc > v_xp_total_calc THEN
    RAISE WARNING 'sync_xp_personnage: anomalie pour personnage % — xp_depense_calc=% > xp_total_calc=% (xp_initial=%, gains=%, depenses=%)',
      v_personnage_id, v_xp_depense_calc, v_xp_total_calc,
      v_xp_initial, v_xp_gains, v_xp_depenses;
  END IF;

  UPDATE public.personnages
  SET xp_total   = v_xp_total_calc,
      xp_depense = v_xp_depense_calc
  WHERE id = v_personnage_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.sync_xp_personnage() IS
  'Trigger AFTER INSERT/UPDATE/DELETE sur historique_xp. Recalcule personnages.xp_total et xp_depense en mode total (race.xp_depart + somme des mouvements). Auto-correctif.';

CREATE TRIGGER trg_sync_xp_personnage
  AFTER INSERT OR UPDATE OR DELETE ON public.historique_xp
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_xp_personnage();

-- ---------------------------------------------------------------------------
-- 6. Mise à jour donner_xp_bonus
--    Plus de UPDATE direct sur xp_total : on insère dans historique_xp,
--    le trigger fait le recalcul.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.donner_xp_bonus(
  p_personnage_id uuid,
  p_montant       integer,
  p_raison        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_personnage   RECORD;
  v_description  text;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
  END IF;

  -- Le bonus doit être strictement positif (cohérent avec le type gain_bonus).
  -- Pour retirer de l'XP, utiliser une fonction de correction dédiée (à venir).
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Montant invalide (doit être > 0)');
  END IF;

  SELECT id, nom, joueur_id
    INTO v_personnage
  FROM public.personnages
  WHERE id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable');
  END IF;

  v_description := CASE
    WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0
      THEN 'Bonus : ' || trim(p_raison)
    ELSE 'Bonus XP attribué par un animateur/admin'
  END;

  -- Le trigger trg_sync_xp_personnage met à jour xp_total automatiquement
  INSERT INTO public.historique_xp (
    personnage_id, type_mouvement, montant, description, acteur_id
  ) VALUES (
    p_personnage_id, 'gain_bonus', p_montant, v_description, auth.uid()
  );

  INSERT INTO public.notifications (user_id, message)
  VALUES (
    v_personnage.joueur_id,
    format('Vous avez reçu %s XP bonus pour « %s ».%s',
      p_montant,
      COALESCE(v_personnage.nom, 'Sans nom'),
      CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0
        THEN ' ' || p_raison
        ELSE '' END)
  );

  RETURN jsonb_build_object('succes', true, 'xp_ajoute', p_montant);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Mise à jour attribuer_xp_evenement
--    Plus de UPDATE direct sur xp_total : on insère dans historique_xp.
--    Les compteurs niveau / gn_completes / mini_gn_completes / ouvertures_terrain
--    restent gérés directement (ce ne sont pas de l'XP).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.attribuer_xp_evenement(
  p_inscription_id uuid,
  p_xp_montant     integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
$$;

-- ============================================================================
-- BOOTSTRAP — Création initiale des tables du schéma public
-- ============================================================================
-- Date     : 2026-04-19 (migration historique, contenu réécrit le 2026-05-04)
-- Objectif : Garantir que les 39 tables du schéma public existent avant
--            que les migrations suivantes ne les manipulent.
--
-- Contexte : Cette migration était à l'origine un placeholder (SELECT 1;).
--   En production, les tables ont été créées par Lovable AI au démarrage
--   du projet, avant que le système de migrations versionnées ne soit en
--   place. Du coup, les migrations suivantes (à partir du 20 avril 2026)
--   plantent sur Supabase Preview qui rejoue tout depuis zéro.
--
--   Ce fichier comble cette dette : il crée les 39 tables avec leurs
--   colonnes, types, NOT NULL, DEFAULT et PK uniquement. Les FK et CHECK
--   sont laissés au baseline du 3 mai et aux migrations Phase 1.x.
--
--   Note : la table `historique_xp` n'est PAS incluse ici car elle est
--   créée par la migration Phase 1.3 (`20260504151633_phase1_3_historique_xp`).
--
-- Sécurité :
--   - Tout est `IF NOT EXISTS` → idempotent, no-op en prod (où les tables
--     existent déjà).
--   - En prod, la migration est marquée comme appliquée par sa version
--     dans `supabase_migrations.schema_migrations`. Supabase ne re-vérifie
--     pas le contenu d'une migration déjà appliquée → aucun impact prod.
--   - Sur Supabase Preview, ce contenu est rejoué et crée les tables
--     manquantes avant que les migrations suivantes ne tournent.
-- ============================================================================

-- Extensions nécessaires aux DEFAULT (gen_random_uuid, uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Référentiels jeu (immuables sauf admin)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.assemblages_runes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text,
  description text,
  runes_requises text[],
  effet text,
  cout_xp integer,
  est_actif boolean,
  description_longue text,
  cible text,
  cout_ps integer DEFAULT 5,
  effet_maitrise text,
  cout_ps_maitrise integer,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.bestiaire (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  categorie text NOT NULL,
  pv_formule text,
  description text NOT NULL,
  immunites text,
  capacites_speciales text,
  est_actif boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.cartes_accueil (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  emoji text NOT NULL,
  titre text NOT NULL,
  description text NOT NULL,
  tab_cible text NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  est_actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.categories_creatures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  est_actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.classes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text,
  description text,
  role_combat text,
  pv_depart integer,
  ps_depart integer,
  competences_gratuites jsonb,
  est_actif boolean,
  peut_utiliser_armes_deux_mains boolean DEFAULT false,
  emoji text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.competences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text,
  description text,
  categorie text,
  niveaux jsonb,
  est_general boolean,
  est_actif boolean,
  type_achat text NOT NULL DEFAULT 'simple'::text,
  type_choix text,
  verrouillage_croise boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.config_jeu (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cle text,
  valeur jsonb,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.effets_combat (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text,
  description text,
  duree text,
  conditions text,
  type text,
  source text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.familles_criminelles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text,
  description text,
  avantages text,
  est_actif boolean,
  description_longue text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.ingredients_alchimiques (
  id uuid NOT NULL,
  nom text,
  manipulations text,
  niveau integer,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.langues (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  est_ancienne boolean NOT NULL DEFAULT false,
  ordre integer NOT NULL DEFAULT 0,
  est_actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.lore (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  categorie text NOT NULL,
  nom text NOT NULL,
  sous_titre text,
  embleme text,
  description text NOT NULL,
  ordre integer DEFAULT 0,
  est_actif boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.objets_forge (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text,
  description text,
  type text,
  stats jsonb,
  difficulte integer,
  cout_xp integer,
  est_actif boolean,
  materiaux_communs text,
  materiaux_rares text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.objets_joaillerie (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text,
  description text,
  effet text,
  difficulte integer,
  cout_xp integer,
  est_actif boolean,
  materiaux_communs text,
  materiaux_rares text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.pieges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  niveau integer NOT NULL,
  cout_xp integer NOT NULL,
  cible text NOT NULL,
  duree text NOT NULL,
  effets text NOT NULL,
  niveau_effet integer,
  type_piege text NOT NULL DEFAULT 'physique'::text,
  est_actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  construction text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.prieres (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nom text NOT NULL,
  domaine text NOT NULL,
  niveau integer NOT NULL DEFAULT 1,
  description text,
  type_priere text,
  zone_effet text,
  portee text,
  duree text,
  duree_incantation text,
  cout_xp_base numeric(4,2),
  religion_id uuid,
  est_actif boolean NOT NULL DEFAULT true,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.race_traits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  race_id uuid NOT NULL,
  trait_id uuid NOT NULL,
  sous_type text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.races (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text,
  description text,
  restrictions_classes text[],
  image_url text,
  est_actif boolean,
  nom_latin text,
  xp_depart integer NOT NULL DEFAULT 60,
  esperance_vie text,
  exigences_costume text,
  nb_traits_raciaux integer NOT NULL DEFAULT 1,
  est_jouable boolean NOT NULL DEFAULT true,
  emoji character varying(10),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.recettes_alchimie (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text,
  description text,
  formule text,
  effet text,
  ingredients jsonb,
  niveau_requis integer,
  cout_xp integer,
  est_actif boolean,
  type text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.religions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text,
  dirigeant text,
  fondateur text,
  description text,
  domaines_principaux text[],
  domaines_proscrits text[],
  symbole_sacre text,
  pouvoir_symbole text,
  est_actif boolean,
  description_longue text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.reparations_forge (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  categorie text NOT NULL,
  nom_affichage text NOT NULL,
  temps_minutes integer NOT NULL,
  temps_rare_minutes integer NOT NULL,
  materiaux text NOT NULL,
  materiaux_rares text NOT NULL,
  notes text,
  est_actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.sorts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nom text NOT NULL,
  cercle text NOT NULL,
  niveau integer NOT NULL DEFAULT 1,
  description text,
  type_sort text,
  zone_effet text,
  portee text,
  duree text,
  cout_xp_base numeric(4,2),
  est_actif boolean NOT NULL DEFAULT true,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.traits_raciaux (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  description text NOT NULL,
  cout_xp integer NOT NULL DEFAULT 0,
  est_actif boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- Tables système et navigation
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.menu_navigation (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  libelle text NOT NULL,
  url text NOT NULL,
  roles_autorises text[],
  afficher_navbar boolean NOT NULL DEFAULT true,
  afficher_footer boolean NOT NULL DEFAULT false,
  ordre integer NOT NULL DEFAULT 0,
  est_actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.sections_encyclopedie (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cle text NOT NULL,
  label text NOT NULL,
  icon_nom text NOT NULL,
  url_key text NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  est_actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.sections_regles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  categorie text NOT NULL,
  titre text NOT NULL,
  contenu text NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  est_actif boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- Profils, événements, notifications
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  username text,
  email text,
  role text DEFAULT 'joueur'::text,
  created_at timestamp without time zone,
  is_active boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT now(),
  nom_affichage text,
  avatar_url text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.evenements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  titre text,
  description text,
  date_evenement timestamp without time zone,
  lieu text,
  xp_recompense integer,
  max_participants integer,
  est_publie boolean DEFAULT false,
  created_by uuid,
  created_at timestamp without time zone,
  updated_at timestamp with time zone DEFAULT now(),
  date_fin timestamp with time zone,
  type_evenement text DEFAULT 'gn_regulier'::text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.inscriptions_evenements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  evenement_id uuid,
  personnage_id uuid,
  joueur_id uuid,
  statut text DEFAULT 'en_attente'::text,
  date_inscription timestamp without time zone,
  date_confirmation timestamp without time zone,
  updated_at timestamp with time zone DEFAULT now(),
  xp_attribue integer DEFAULT 0,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  message text,
  lu boolean DEFAULT false,
  created_at timestamp without time zone,
  updated_at timestamp with time zone DEFAULT now(),
  type text NOT NULL DEFAULT 'info'::text,
  reference_id uuid,
  statut text NOT NULL DEFAULT 'non_traite'::text,
  PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- Personnages et tables de liaison
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.personnages (
  id uuid NOT NULL,
  joueur_id uuid NOT NULL,
  nom text,
  race_id uuid,
  classe_id uuid,
  niveau integer DEFAULT 1,
  xp_total integer DEFAULT 0,
  xp_depense integer DEFAULT 0,
  traits_raciaux_choisis jsonb,
  famille_criminelle_id uuid,
  religion_id uuid,
  historique text,
  ame_personnage text,
  est_verrouille boolean DEFAULT false,
  etape_creation integer NOT NULL DEFAULT 1,
  date_creation timestamp without time zone,
  date_modification timestamp without time zone DEFAULT now(),
  gn_completes integer DEFAULT 0,
  mini_gn_completes integer DEFAULT 0,
  ouvertures_terrain integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  pv_max integer NOT NULL DEFAULT 4,
  ps_max integer NOT NULL DEFAULT 5,
  est_actif boolean NOT NULL DEFAULT true,
  est_mort boolean NOT NULL DEFAULT false,
  classe_secondaire_id uuid,
  a_forge_legendaire boolean NOT NULL DEFAULT false,
  a_joaillerie_legendaire boolean NOT NULL DEFAULT false,
  sous_type_chimeride text,
  est_croyant boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personnage_assemblages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  personnage_id uuid NOT NULL,
  assemblage_id uuid NOT NULL,
  xp_depense integer NOT NULL DEFAULT 0,
  date_acquisition timestamp with time zone NOT NULL DEFAULT now(),
  est_gratuit boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personnage_competences (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  personnage_id uuid NOT NULL,
  competence_id uuid NOT NULL,
  niveau_acquis integer NOT NULL DEFAULT 1,
  appris_via_maitre boolean NOT NULL DEFAULT false,
  xp_depense integer NOT NULL DEFAULT 0,
  date_acquisition timestamp with time zone NOT NULL DEFAULT now(),
  nom_maitre text,
  statut_maitre text DEFAULT 'non_requis'::text,
  choix_achat text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personnage_objets_forge (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  personnage_id uuid NOT NULL,
  objet_id uuid NOT NULL,
  xp_depense integer NOT NULL DEFAULT 0,
  date_acquisition timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personnage_objets_joaillerie (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  personnage_id uuid NOT NULL,
  objet_id uuid NOT NULL,
  xp_depense integer NOT NULL DEFAULT 0,
  date_acquisition timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personnage_prieres (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  personnage_id uuid NOT NULL,
  priere_id uuid NOT NULL,
  niveau_priere integer NOT NULL DEFAULT 1,
  xp_depense integer NOT NULL DEFAULT 0,
  date_acquisition timestamp with time zone NOT NULL DEFAULT now(),
  nom_personnalise text,
  zone_choisie text,
  portee_choisie text,
  duree_choisie text,
  duree_incantation_calculee integer,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personnage_races_demandes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  personnage_id uuid NOT NULL,
  race_id uuid NOT NULL,
  background text NOT NULL,
  statut text NOT NULL DEFAULT 'en_attente'::text,
  raison_refus text,
  approuve_par uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  date_approbation timestamp with time zone,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personnage_recettes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  personnage_id uuid NOT NULL,
  recette_id uuid NOT NULL,
  xp_depense integer NOT NULL DEFAULT 0,
  date_acquisition timestamp with time zone NOT NULL DEFAULT now(),
  est_gratuit boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.personnage_sorts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  personnage_id uuid NOT NULL,
  sort_id uuid NOT NULL,
  niveau_sort integer NOT NULL DEFAULT 1,
  xp_depense integer NOT NULL DEFAULT 0,
  date_acquisition timestamp with time zone NOT NULL DEFAULT now(),
  nom_personnalise text,
  zone_choisie text,
  portee_choisie text,
  duree_choisie text,
  formule_magique text,
  PRIMARY KEY (id)
);

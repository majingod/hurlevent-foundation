-- ============================================================
-- RECHERCHE-ACCENTS : recherche encyclopedie insensible aux accents
-- Extension unaccent + wrapper IMMUTABLE f_unaccent + 15 colonnes
-- recherche_tsv reconstruites + RPC rechercher_encyclopedie (cote requete).
-- Idempotent / rejouable. Retro-compatible (signature RPC inchangee).
-- ============================================================

-- 1) Extension unaccent (schema extensions, convention Supabase)
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- 2) Wrapper IMMUTABLE (obligatoire : unaccent(text) est STABLE, interdit en colonne generee)
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

-- 3) Reconstruire les 15 colonnes generees + index GIN
-- assemblages_runes
DROP INDEX IF EXISTS public.idx_assemblages_runes_recherche_tsv;
ALTER TABLE public.assemblages_runes DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.assemblages_runes ADD COLUMN recherche_tsv tsvector
  GENERATED ALWAYS AS (((setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(nom, ''::text))), 'A'::"char") || setweight(to_tsvector('french'::regconfig, public.f_unaccent(((COALESCE(description, ''::text) || ' '::text) || COALESCE(effet, ''::text)))), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(cible, ''::text))), 'C'::"char"))) STORED;
CREATE INDEX idx_assemblages_runes_recherche_tsv ON public.assemblages_runes USING gin (recherche_tsv);

-- bestiaire
DROP INDEX IF EXISTS public.bestiaire_recherche_tsv_idx;
ALTER TABLE public.bestiaire DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.bestiaire ADD COLUMN recherche_tsv tsvector
  GENERATED ALWAYS AS (((((setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(nom, ''::text))), 'A'::"char") || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(categorie, ''::text))), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(description, ''::text))), 'C'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(immunites, ''::text))), 'D'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(capacites_speciales, ''::text))), 'D'::"char"))) STORED;
CREATE INDEX bestiaire_recherche_tsv_idx ON public.bestiaire USING gin (recherche_tsv);

-- classes
DROP INDEX IF EXISTS public.idx_classes_recherche_tsv;
ALTER TABLE public.classes DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.classes ADD COLUMN recherche_tsv tsvector
  GENERATED ALWAYS AS (((setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(nom, ''::text))), 'A'::"char") || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(description, ''::text))), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(role_combat, ''::text))), 'C'::"char"))) STORED;
CREATE INDEX idx_classes_recherche_tsv ON public.classes USING gin (recherche_tsv);

-- competences (vue vue_competences_encyclopedie depend de recherche_tsv → drop/recreate)
DROP VIEW IF EXISTS public.vue_competences_encyclopedie;
DROP INDEX IF EXISTS public.competences_recherche_tsv_idx;
ALTER TABLE public.competences DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.competences ADD COLUMN recherche_tsv tsvector
  GENERATED ALWAYS AS (((setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(nom, ''::text))), 'A'::"char") || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(categorie, ''::text))), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(description, ''::text))), 'C'::"char"))) STORED;
CREATE INDEX competences_recherche_tsv_idx ON public.competences USING gin (recherche_tsv);
-- Recreation identique de la vue (mêmes colonnes, même ordre) + grants Supabase
CREATE VIEW public.vue_competences_encyclopedie AS
 SELECT id, nom, description, categorie, niveaux, est_general, est_actif,
        type_achat, type_choix, verrouillage_croise, classes_requises,
        prerequis_competences, recherche_tsv, desachat_force,
        assembler_prerequis_labels(id) AS prerequis_labels
   FROM competences c;
GRANT ALL ON public.vue_competences_encyclopedie TO anon, authenticated, postgres, service_role;

-- lore
DROP INDEX IF EXISTS public.idx_lore_recherche_tsv;
ALTER TABLE public.lore DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.lore ADD COLUMN recherche_tsv tsvector
  GENERATED ALWAYS AS (((setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(nom, ''::text))), 'A'::"char") || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(sous_titre, ''::text))), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(description, ''::text))), 'C'::"char"))) STORED;
CREATE INDEX idx_lore_recherche_tsv ON public.lore USING gin (recherche_tsv);

-- objets_forge
DROP INDEX IF EXISTS public.idx_objets_forge_recherche_tsv;
ALTER TABLE public.objets_forge DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.objets_forge ADD COLUMN recherche_tsv tsvector
  GENERATED ALWAYS AS (((setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(nom, ''::text))), 'A'::"char") || setweight(to_tsvector('french'::regconfig, public.f_unaccent(((COALESCE(description, ''::text) || ' '::text) || COALESCE(effet, ''::text)))), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(type, ''::text))), 'C'::"char"))) STORED;
CREATE INDEX idx_objets_forge_recherche_tsv ON public.objets_forge USING gin (recherche_tsv);

-- objets_joaillerie
DROP INDEX IF EXISTS public.idx_objets_joaillerie_recherche_tsv;
ALTER TABLE public.objets_joaillerie DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.objets_joaillerie ADD COLUMN recherche_tsv tsvector
  GENERATED ALWAYS AS ((setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(nom, ''::text))), 'A'::"char") || setweight(to_tsvector('french'::regconfig, public.f_unaccent(((COALESCE(description, ''::text) || ' '::text) || COALESCE(effet, ''::text)))), 'B'::"char"))) STORED;
CREATE INDEX idx_objets_joaillerie_recherche_tsv ON public.objets_joaillerie USING gin (recherche_tsv);

-- pieges
DROP INDEX IF EXISTS public.idx_pieges_recherche_tsv;
ALTER TABLE public.pieges DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.pieges ADD COLUMN recherche_tsv tsvector
  GENERATED ALWAYS AS (((setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(nom, ''::text))), 'A'::"char") || setweight(to_tsvector('french'::regconfig, public.f_unaccent(((COALESCE(effets, ''::text) || ' '::text) || COALESCE(effet_generique, ''::text)))), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(((COALESCE(type_piege, ''::text) || ' '::text) || COALESCE(cible, ''::text)))), 'C'::"char"))) STORED;
CREATE INDEX idx_pieges_recherche_tsv ON public.pieges USING gin (recherche_tsv);

-- prieres
DROP INDEX IF EXISTS public.prieres_recherche_tsv_idx;
ALTER TABLE public.prieres DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.prieres ADD COLUMN recherche_tsv tsvector
  GENERATED ALWAYS AS ((((setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(nom, ''::text))), 'A'::"char") || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(domaine, ''::text))), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(type_priere, ''::text))), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(description, ''::text))), 'C'::"char"))) STORED;
CREATE INDEX prieres_recherche_tsv_idx ON public.prieres USING gin (recherche_tsv);

-- races
DROP INDEX IF EXISTS public.idx_races_recherche_tsv;
ALTER TABLE public.races DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.races ADD COLUMN recherche_tsv tsvector
  GENERATED ALWAYS AS ((setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(nom, ''::text))), 'A'::"char") || setweight(to_tsvector('french'::regconfig, public.f_unaccent(((COALESCE(description, ''::text) || ' '::text) || COALESCE(description_courte, ''::text)))), 'B'::"char"))) STORED;
CREATE INDEX idx_races_recherche_tsv ON public.races USING gin (recherche_tsv);

-- recettes_alchimie
DROP INDEX IF EXISTS public.idx_recettes_alchimie_recherche_tsv;
ALTER TABLE public.recettes_alchimie DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.recettes_alchimie ADD COLUMN recherche_tsv tsvector
  GENERATED ALWAYS AS (((setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(nom, ''::text))), 'A'::"char") || setweight(to_tsvector('french'::regconfig, public.f_unaccent(((COALESCE(description, ''::text) || ' '::text) || COALESCE(effet, ''::text)))), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(formule, ''::text))), 'C'::"char"))) STORED;
CREATE INDEX idx_recettes_alchimie_recherche_tsv ON public.recettes_alchimie USING gin (recherche_tsv);

-- religions
DROP INDEX IF EXISTS public.religions_recherche_tsv_idx;
ALTER TABLE public.religions DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.religions ADD COLUMN recherche_tsv tsvector
  GENERATED ALWAYS AS ((((setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(nom, ''::text))), 'A'::"char") || setweight(to_tsvector('french'::regconfig, public.f_unaccent(((COALESCE(dirigeant, ''::text) || ' '::text) || COALESCE(fondateur, ''::text)))), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(((((COALESCE(description, ''::text) || ' '::text) || COALESCE(lore_fiche, ''::text)) || ' '::text) || COALESCE(description_longue, ''::text)))), 'C'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(((((COALESCE(lore_manuel, ''::text) || ' '::text) || COALESCE(immutable_array_to_string(rituels_manuel), ''::text)) || ' '::text) || COALESCE(pouvoir_symbole, ''::text)))), 'D'::"char"))) STORED;
CREATE INDEX religions_recherche_tsv_idx ON public.religions USING gin (recherche_tsv);

-- sections_regles
DROP INDEX IF EXISTS public.sections_regles_recherche_tsv_idx;
ALTER TABLE public.sections_regles DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.sections_regles ADD COLUMN recherche_tsv tsvector
  GENERATED ALWAYS AS (((setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(titre, ''::text))), 'A'::"char") || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(categorie, ''::text))), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(contenu, ''::text))), 'C'::"char"))) STORED;
CREATE INDEX sections_regles_recherche_tsv_idx ON public.sections_regles USING gin (recherche_tsv);

-- sorts
DROP INDEX IF EXISTS public.sorts_recherche_tsv_idx;
ALTER TABLE public.sorts DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.sorts ADD COLUMN recherche_tsv tsvector
  GENERATED ALWAYS AS ((((setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(nom, ''::text))), 'A'::"char") || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(cercle, ''::text))), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(type_sort, ''::text))), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(description, ''::text))), 'C'::"char"))) STORED;
CREATE INDEX sorts_recherche_tsv_idx ON public.sorts USING gin (recherche_tsv);

-- traits_raciaux
DROP INDEX IF EXISTS public.idx_traits_raciaux_recherche_tsv;
ALTER TABLE public.traits_raciaux DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.traits_raciaux ADD COLUMN recherche_tsv tsvector
  GENERATED ALWAYS AS ((setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(nom, ''::text))), 'A'::"char") || setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(description, ''::text))), 'B'::"char"))) STORED;
CREATE INDEX idx_traits_raciaux_recherche_tsv ON public.traits_raciaux USING gin (recherche_tsv);

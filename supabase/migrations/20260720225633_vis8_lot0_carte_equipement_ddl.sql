-- VIS-8 lot 0 (s347) : la carte équipement ↔ compétences/races descend en base.
-- Décision Fred s346 (VIS-8 §2.8 + §3 décisions 12/16) : la règle ET la phrase
-- joueur ont UNE SEULE MAISON (patron refus_plafond_magie, PR #710).
--   objets_generateur : les cases de l'inventaire du générateur (31).
--   objets_requis     : une ligne par compétence/race exigeant un objet.
--     variantes = [{objets:[slug…] (ET), niveau_min}] — OU entre variantes ;
--     objets=[] = « mains nues », satisfaite dès niveau_min.
-- Aucune gate d'achat touchée : filtre du GÉNÉRATEUR seulement (pas de miroir
-- de règle d'achat, pas de fixtures de parité — l'équipement n'est pas suivi
-- sur les personnages).
-- ⚠️ On n'ajoute PAS de colonne « genre » à objets_forge (une ligne = une
-- taille, VIS-8 §2.8) : la correspondance vit ici.

CREATE TABLE IF NOT EXISTS public.objets_generateur (
  id text PRIMARY KEY,
  libelle text NOT NULL,
  groupe text NOT NULL CHECK (groupe IN ('armes','protections','accessoires','costume')),
  ordre integer NOT NULL,
  est_actif boolean NOT NULL DEFAULT true,
  CONSTRAINT objets_generateur_groupe_ordre UNIQUE (groupe, ordre)
);

COMMENT ON TABLE public.objets_generateur IS
  'Cases de l''inventaire du générateur de personnage (VIS-8 lot 0). Slugs stables référencés par objets_requis.variantes.';

CREATE TABLE IF NOT EXISTS public.objets_requis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competence_id uuid REFERENCES public.competences(id) ON DELETE CASCADE,
  race_id uuid REFERENCES public.races(id) ON DELETE CASCADE,
  libelle_manque text NOT NULL,
  variantes jsonb NOT NULL CHECK (jsonb_typeof(variantes) = 'array'),
  commentaire text,
  CONSTRAINT objets_requis_une_cible CHECK (num_nonnulls(competence_id, race_id) = 1),
  CONSTRAINT objets_requis_competence_unique UNIQUE (competence_id),
  CONSTRAINT objets_requis_race_unique UNIQUE (race_id)
);

COMMENT ON TABLE public.objets_requis IS
  'Carte équipement ↔ compétences/races (VIS-8 lot 0). libelle_manque = la phrase montrée au joueur (seule maison). variantes = OU de ET, niveau_min par variante.';

-- Garde-fou d'écriture : forme des variantes + slugs existants + niveaux 1..9.
CREATE OR REPLACE FUNCTION public.valider_objets_requis()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_variante jsonb;
  v_objet text;
  v_niveau numeric;
BEGIN
  IF jsonb_typeof(NEW.variantes) <> 'array' OR jsonb_array_length(NEW.variantes) = 0 THEN
    RAISE EXCEPTION 'objets_requis.variantes doit être un tableau JSON non vide';
  END IF;
  FOR v_variante IN SELECT jsonb_array_elements(NEW.variantes) LOOP
    IF jsonb_typeof(v_variante) <> 'object'
       OR jsonb_typeof(v_variante->'objets') <> 'array'
       OR jsonb_typeof(v_variante->'niveau_min') <> 'number' THEN
      RAISE EXCEPTION 'variante invalide (attendu {"objets":[…],"niveau_min":n}) : %', v_variante;
    END IF;
    v_niveau := (v_variante->>'niveau_min')::numeric;
    IF v_niveau < 1 OR v_niveau > 9 OR v_niveau <> floor(v_niveau) THEN
      RAISE EXCEPTION 'niveau_min hors bornes (entier 1..9) : %', v_variante;
    END IF;
    FOR v_objet IN SELECT jsonb_array_elements_text(v_variante->'objets') LOOP
      IF NOT EXISTS (SELECT 1 FROM objets_generateur og WHERE og.id = v_objet) THEN
        RAISE EXCEPTION 'variante référence un objet inconnu dans objets_generateur : %', v_objet;
      END IF;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_valider_objets_requis ON public.objets_requis;
CREATE TRIGGER trg_valider_objets_requis
  BEFORE INSERT OR UPDATE ON public.objets_requis
  FOR EACH ROW EXECUTE FUNCTION public.valider_objets_requis();

-- RLS : même patron qu'objets_forge (lecture publique, écriture animateur/admin).
ALTER TABLE public.objets_generateur ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objets_requis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS objets_generateur_lecture ON public.objets_generateur;
CREATE POLICY objets_generateur_lecture ON public.objets_generateur
  FOR SELECT USING (true);
DROP POLICY IF EXISTS objets_generateur_admin_ins ON public.objets_generateur;
CREATE POLICY objets_generateur_admin_ins ON public.objets_generateur
  FOR INSERT WITH CHECK (est_animateur_ou_admin());
DROP POLICY IF EXISTS objets_generateur_admin_upd ON public.objets_generateur;
CREATE POLICY objets_generateur_admin_upd ON public.objets_generateur
  FOR UPDATE USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
DROP POLICY IF EXISTS objets_generateur_admin_del ON public.objets_generateur;
CREATE POLICY objets_generateur_admin_del ON public.objets_generateur
  FOR DELETE USING (est_animateur_ou_admin());

DROP POLICY IF EXISTS objets_requis_lecture ON public.objets_requis;
CREATE POLICY objets_requis_lecture ON public.objets_requis
  FOR SELECT USING (true);
DROP POLICY IF EXISTS objets_requis_admin_ins ON public.objets_requis;
CREATE POLICY objets_requis_admin_ins ON public.objets_requis
  FOR INSERT WITH CHECK (est_animateur_ou_admin());
DROP POLICY IF EXISTS objets_requis_admin_upd ON public.objets_requis;
CREATE POLICY objets_requis_admin_upd ON public.objets_requis
  FOR UPDATE USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());
DROP POLICY IF EXISTS objets_requis_admin_del ON public.objets_requis;
CREATE POLICY objets_requis_admin_del ON public.objets_requis
  FOR DELETE USING (est_animateur_ou_admin());

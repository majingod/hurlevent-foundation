-- Lot B #MOTEUR-V2 (3b-6 CONTRACT cleanup) : drop colonnes/lignes mortes v1 après swap encyclo v2 (Lot A live).
-- Idempotent. fiche_condensee = 0 ligne remplie sur 11 tables (jamais peuplee, remplacee par modele v2 resume_condense/description_courte).
-- champs v1 = superseded par champs_v2 ; 0 lecteur depuis Lot A. reparation = ligne vestige (hors 14 listes, 0 RPC/vue).
ALTER TABLE public.assemblages_runes   DROP COLUMN IF EXISTS fiche_condensee;
ALTER TABLE public.classes             DROP COLUMN IF EXISTS fiche_condensee;
ALTER TABLE public.competences         DROP COLUMN IF EXISTS fiche_condensee;
ALTER TABLE public.objets_forge        DROP COLUMN IF EXISTS fiche_condensee;
ALTER TABLE public.objets_joaillerie   DROP COLUMN IF EXISTS fiche_condensee;
ALTER TABLE public.pieges              DROP COLUMN IF EXISTS fiche_condensee;
ALTER TABLE public.prieres             DROP COLUMN IF EXISTS fiche_condensee;
ALTER TABLE public.races               DROP COLUMN IF EXISTS fiche_condensee;
ALTER TABLE public.recettes_alchimie   DROP COLUMN IF EXISTS fiche_condensee;
ALTER TABLE public.sorts               DROP COLUMN IF EXISTS fiche_condensee;
ALTER TABLE public.traits_raciaux      DROP COLUMN IF EXISTS fiche_condensee;

DELETE FROM public.fiches_schemas WHERE categorie = 'reparation';

ALTER TABLE public.fiches_schemas DROP COLUMN IF EXISTS champs;

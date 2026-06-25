-- FORGE/JOAILLERIE REFONTE — phase 1 (EXPAND) — s280
-- Colonnes méta + merge boucliers + corrections data. Idempotent. stats CONSERVÉ INTACT.
ALTER TABLE public.objets_forge
  ADD COLUMN IF NOT EXISTS exemples       text,
  ADD COLUMN IF NOT EXISTS prise          text,
  ADD COLUMN IF NOT EXISTS emplacement    text,
  ADD COLUMN IF NOT EXISTS portee         text,
  ADD COLUMN IF NOT EXISTS degats_membre  smallint,
  ADD COLUMN IF NOT EXISTS degats_torse   smallint,
  ADD COLUMN IF NOT EXISTS points_armure  smallint,
  ADD COLUMN IF NOT EXISTS combats        smallint,
  ADD COLUMN IF NOT EXISTS effet          text,
  ADD COLUMN IF NOT EXISTS taille_min     smallint,
  ADD COLUMN IF NOT EXISTS taille_max     smallint,
  ADD COLUMN IF NOT EXISTS pression_max   smallint,
  ADD COLUMN IF NOT EXISTS fab_a_preciser boolean NOT NULL DEFAULT false;

UPDATE public.objets_forge SET nom = 'Arme courte' WHERE nom = 'Arme légère';

UPDATE public.objets_forge
   SET materiaux_communs = '2 lingots métal + 1 lingot fer',
       materiaux_rares   = '2 lingots métal rare + 1 lingot orichalcum'
 WHERE id = '9c7b95d9-9d4a-4f6a-8915-42f914415325';

UPDATE public.objets_forge
   SET nom               = 'Grand bouclier / Pavois',
       materiaux_communs = '4 lingots métal + 1 lingot fer',
       materiaux_rares   = '4 lingots métal rare + 1 lingot orichalcum'
 WHERE id = 'e54482ca-0650-49d3-a336-ee051d27b04f';

DELETE FROM public.objets_forge
 WHERE id IN ('35b1374f-6ab9-4e72-aeb7-d7b9fd621206',
              '9b18bdf8-0a25-4b62-b955-52cd23d13838',
              '41f75718-c32b-4c10-97d0-c55fba832a8b');

UPDATE public.objets_forge SET
  taille_min    = NULLIF(stats->>'taille_min','')::smallint,
  taille_max    = COALESCE(NULLIF(stats->>'taille_max','')::smallint, NULLIF(stats->>'max_longueur','')::smallint),
  degats_membre = NULLIF(stats->>'degats_membre','')::smallint,
  degats_torse  = NULLIF(stats->>'degats_torse','')::smallint,
  points_armure = NULLIF(stats->>'points','')::smallint,
  combats       = NULLIF(stats->>'combats','')::smallint,
  pression_max  = NULLIF(stats->>'pression_max','')::smallint;

UPDATE public.objets_forge SET taille_max = 110 WHERE nom = 'Arme longue';
UPDATE public.objets_forge SET stats = jsonb_set(stats, '{taille_max}', '110') WHERE nom = 'Arme longue';
UPDATE public.objets_forge SET degats_membre = 1, degats_torse = 1 WHERE nom = 'Arme de jet';
UPDATE public.objets_forge SET stats = stats || '{"degats_membre":1,"degats_torse":1}'::jsonb WHERE nom = 'Arme de jet';
UPDATE public.objets_forge SET degats_membre = 2, degats_torse = 2, pression_max = 20 WHERE nom = 'Arc / Arbalète';
UPDATE public.objets_forge SET stats = stats || '{"degats_membre":2,"degats_torse":2}'::jsonb WHERE nom = 'Arc / Arbalète';

UPDATE public.objets_forge SET portee='Mêlée',      prise='1 main',  exemples='dague · poignard · couteau · main-gauche'                 WHERE nom='Arme courte';
UPDATE public.objets_forge SET portee='Mêlée',      prise='1 main',  exemples='épée courte (gladius) · hachette · masse · cimeterre court' WHERE nom='Arme moyenne';
UPDATE public.objets_forge SET portee='Mêlée',      prise='1 main',  exemples='épée longue · bâtarde · sabre · hache d''armes'             WHERE nom='Arme longue';
UPDATE public.objets_forge SET portee='Mêlée',      prise='2 mains', exemples='espadon · claymore · grande hache · fléau lourd'           WHERE nom='Arme lourde';
UPDATE public.objets_forge SET portee='Mêlée',      prise='2 mains', exemples='lance · hallebarde · pique · bâton', fab_a_preciser=true    WHERE nom='Arme d''hast';
UPDATE public.objets_forge SET portee='À distance', prise='1 main',  exemples='couteau de lancer · hachette de lancer · dague de jet', fab_a_preciser=true WHERE nom='Arme de jet';
UPDATE public.objets_forge SET portee='À distance', prise='2 mains', exemples='arc court · arc long · arbalète'                            WHERE nom='Arc / Arbalète';
UPDATE public.objets_forge SET portee='Munition',                    exemples='flèche · carreau · bille'                                  WHERE nom='Projectile';

UPDATE public.objets_forge SET emplacement='Torse'      WHERE nom IN ('Armure de cuir','Armure de maille','Armure de plaques');
UPDATE public.objets_forge SET emplacement='Tête',       effet='Immunise contre Assommer 1 et 2'                  WHERE nom='Casque';
UPDATE public.objets_forge SET emplacement='Cou',        effet='Immunise contre Égorgement (Attaque sournoise 1)' WHERE nom='Gorgerin';
UPDATE public.objets_forge SET emplacement='Avant-bras'  WHERE nom='Brassards';
UPDATE public.objets_forge SET emplacement='Jambes'      WHERE nom='Jambières';
UPDATE public.objets_forge SET emplacement='Épaules'     WHERE nom='Épaulettes';
UPDATE public.objets_forge SET emplacement='Hanches'     WHERE nom='Tassettes';

UPDATE public.objets_forge SET prise='1 main' WHERE type='bouclier';

-- UX-SORTS-PRIERES volet 3 (PR-data) : découpage automatique des descriptions verbatim
-- en paliers / tronc / bonus_niveau. description (verbatim Manuel) reste INTACTE.
-- Parser prouvé sans perte en s160 : 126/126 fiches reconstruites à l'identique.

-- === SORTS : paliers + tronc + note ===
WITH pre AS (
  SELECT id, description,
    (regexp_match(description, '\(\*\)[^\n]*'))[1] AS note,
    trim(regexp_replace(description, '\n*\(\*\)[^\n]*', '', 'g')) AS desc_sans_note
  FROM public.sorts
  WHERE description ~ '(^|\n)(Niv\.|Niveau|À partir du niveau) \d+ ?:' OR description LIKE '%(*)%'
), seg AS (
  SELECT p.id, p.note, s.seg, s.ord
  FROM pre p, LATERAL regexp_split_to_table(p.desc_sans_note, '\n+(?=(?:Niv\.|Niveau|À partir du niveau) \d+ ?:)') WITH ORDINALITY s(seg, ord)
), parsed AS (
  SELECT id, max(note) AS note,
    trim(max(seg) FILTER (WHERE ord = 1)) AS tronc,
    jsonb_agg(jsonb_build_object(
      'niveau', ((regexp_match(seg, '^(?:Niv\.|Niveau|À partir du niveau) (\d+) ?:'))[1])::int,
      'libelle', (regexp_match(seg, '^((?:Niv\.|Niveau|À partir du niveau) \d+)'))[1],
      'texte', trim(regexp_replace(seg, '^(?:Niv\.|Niveau|À partir du niveau) \d+ ?:\s*', ''))
    ) ORDER BY ord) FILTER (WHERE ord > 1) AS paliers
  FROM seg GROUP BY id
)
UPDATE public.sorts t SET
  description_tronc = parsed.tronc,
  paliers = parsed.paliers,
  bonus_niveau = CASE WHEN parsed.note IS NOT NULL
    THEN jsonb_build_object('texte', parsed.note, 'formule', NULL) END
FROM parsed WHERE t.id = parsed.id;

-- === PRIERES : même parser ===
WITH pre AS (
  SELECT id, description,
    (regexp_match(description, '\(\*\)[^\n]*'))[1] AS note,
    trim(regexp_replace(description, '\n*\(\*\)[^\n]*', '', 'g')) AS desc_sans_note
  FROM public.prieres
  WHERE description ~ '(^|\n)(Niv\.|Niveau|À partir du niveau) \d+ ?:' OR description LIKE '%(*)%'
), seg AS (
  SELECT p.id, p.note, s.seg, s.ord
  FROM pre p, LATERAL regexp_split_to_table(p.desc_sans_note, '\n+(?=(?:Niv\.|Niveau|À partir du niveau) \d+ ?:)') WITH ORDINALITY s(seg, ord)
), parsed AS (
  SELECT id, max(note) AS note,
    trim(max(seg) FILTER (WHERE ord = 1)) AS tronc,
    jsonb_agg(jsonb_build_object(
      'niveau', ((regexp_match(seg, '^(?:Niv\.|Niveau|À partir du niveau) (\d+) ?:'))[1])::int,
      'libelle', (regexp_match(seg, '^((?:Niv\.|Niveau|À partir du niveau) \d+)'))[1],
      'texte', trim(regexp_replace(seg, '^(?:Niv\.|Niveau|À partir du niveau) \d+ ?:\s*', ''))
    ) ORDER BY ord) FILTER (WHERE ord > 1) AS paliers
  FROM seg GROUP BY id
)
UPDATE public.prieres t SET
  description_tronc = parsed.tronc,
  paliers = parsed.paliers,
  bonus_niveau = CASE WHEN parsed.note IS NOT NULL
    THEN jsonb_build_object('texte', parsed.note, 'formule', NULL) END
FROM parsed WHERE t.id = parsed.id;

-- === FORMULES bonus_niveau : SORTS (revue manuelle s160, fidèle au Manuel) ===
UPDATE public.sorts t
SET bonus_niveau = jsonb_set(t.bonus_niveau, '{formule}', m.formule)
FROM (VALUES
  ('Combat Aveugle',                $j${"variable":"duree","seuil":6,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Forme de Brume',                $j${"variable":"duree","seuil":6,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Gardien Cabalistique',          $j${"variable":"duree","seuil":6,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Indestructibilité',             $j${"variable":"duree","seuil":6,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Intangibilité',                 $j${"variable":"duree","seuil":6,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Protection contre la Paralysie',$j${"variable":"duree","seuil":6,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Ténèbres',                      $j${"variable":"duree","seuil":6,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Don des Langues',               $j${"variable":"duree","seuil":1,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Liberté de Mouvement',          $j${"variable":"duree","seuil":1,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Tornade Martiale',              $j${"variable":"duree","seuil":0,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb)
) AS m(nom, formule)
WHERE t.nom = m.nom AND t.bonus_niveau IS NOT NULL;

-- === FORMULES bonus_niveau : PRIERES ===
-- NB : Combat Aveugle seuil 1 en prière vs 6 en sort = fidèle au Manuel (incohérence documentée).
-- Communion : gratuit=false (le Manuel ne dit pas "gratuitement").
-- Marque de la menace et Retour à la Vie : texte seul, formule reste NULL.
UPDATE public.prieres t
SET bonus_niveau = jsonb_set(t.bonus_niveau, '{formule}', m.formule)
FROM (VALUES
  ('Fureur Divine',            $j${"variable":"duree","seuil":6,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Gardien Dévot',            $j${"variable":"duree","seuil":6,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Combat Aveugle',           $j${"variable":"duree","seuil":1,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Don des Langues',          $j${"variable":"duree","seuil":1,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Liberté de Mouvement',     $j${"variable":"duree","seuil":1,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Renforcement Saint',       $j${"variable":"duree","seuil":1,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Tornade Martiale',         $j${"variable":"duree","seuil":0,"increment":1,"unite":"minute","gratuit":true,"condition":null}$j$::jsonb),
  ('Baies de Guérison',        $j${"variable":"cibles","seuil":1,"increment":1,"unite":"cible","gratuit":true,"condition":null}$j$::jsonb),
  ('Cocotte Magique',          $j${"variable":"cibles","seuil":1,"increment":1,"unite":"cible","gratuit":true,"condition":null}$j$::jsonb),
  ('Communion avec la Nature', $j${"variable":"questions","seuil":1,"increment":1,"unite":"question","gratuit":false,"condition":null}$j$::jsonb),
  ('Confusion de la Loi',      $j${"variable":"rayon","seuil":6,"increment":1,"unite":"pied","gratuit":true,"condition":null}$j$::jsonb),
  ('Enchevêtrement',           $j${"variable":"rayon","seuil":1,"increment":1,"unite":"pied","gratuit":true,"condition":"Lorsque ce sort possède un type de cible à rayon"}$j$::jsonb)
) AS m(nom, formule)
WHERE t.nom = m.nom AND t.bonus_niveau IS NOT NULL;

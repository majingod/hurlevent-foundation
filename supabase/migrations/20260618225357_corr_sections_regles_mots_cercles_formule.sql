-- Corrige 6 mots de cercles erronés + 1 coquille markdown dans le tableau
-- de référence des formules magiques (Règles → Construction des sorts).
-- Source canonique : images manuel + fonction generer_formule_magique (déjà correcte).
-- Idempotent : replace ciblés (chaînes uniques) → no-op si déjà corrigé.
UPDATE public.sections_regles
SET contenu = replace(replace(replace(replace(replace(replace(replace(
    contenu,
    '|Air|Elithar|0|',        '|Air|Xoth|0|'),
    '|Altération|Lithorak|0|','|Altération|Bedorm|0|'),
    '|Combat|Arnorak|0|',     '|Combat|Alagh|0|'),
    '|Divination|Soltiran|0|','|Divination|Shatur|0|'),
    '|Eau|Morvak|0|',         '|Eau|Zaram|0|'),
    '|Feu|Pyrothan|0|',       '|Feu|Zarr|0|'),
    'Nustamarnaroth|8'||chr(10), 'Nustamarnaroth|8|'||chr(10)),
    updated_at = now()
WHERE id = '0f5f6957-d998-4086-8da6-ca06179c9468';

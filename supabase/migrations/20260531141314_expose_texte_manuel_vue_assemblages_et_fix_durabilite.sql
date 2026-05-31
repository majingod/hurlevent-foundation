-- Expose texte_manuel sur la vue des assemblages possedes par le personnage
-- (la vue listait ses colonnes explicitement ; on ajoute la colonne en fin = non rupteur)
CREATE OR REPLACE VIEW public.vue_assemblages_personnage AS
 SELECT pa.id,
    pa.personnage_id,
    pa.xp_depense,
    ar.nom,
    ar.cible,
    ar.cout_ps,
    ar.description,
    ar.effet,
    ar.runes_requises,
    ar.texte_manuel
   FROM personnage_assemblages pa
     JOIN assemblages_runes ar ON ar.id = pa.assemblage_id;

-- Normalise l'anomalie << durabilite >> : description = resume court comme les 14 autres
-- (le pave verbatim reste disponible dans texte_manuel) ; idempotent (re-set identique)
UPDATE public.assemblages_runes
SET description = 'Rend le bouclier ou l''arme indestructible pendant 30 min. Maîtrise (7 PS) : permet aussi un désengagement (repoussé 1 m).'
WHERE nom = 'Assemblage de durabilité';

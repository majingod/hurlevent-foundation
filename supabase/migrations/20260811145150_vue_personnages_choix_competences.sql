-- s392 · L'ecran admin de filtre peut dire QUEL sous-choix a ete pris.
--
-- BESOIN (table de jeu) : la page « Filtre des personnages » affiche « Decryptage 1 »
-- sans dire QUELLE langue. L'orga doit ouvrir les 39 fiches une par une pour
-- repondre a « qui parle quoi ». 333 lignes de personnage_competences portent un
-- choix_achat, sur 85 personnages et 7 competences ; 118 sont des uuid (langues,
-- religions), 215 du texte. Un meme personnage peut porter jusqu'a 6 choix
-- differents sur UNE SEULE competence.
--
-- CHOIX DE CONCEPTION : vue NEUVE et dediee, plutot qu'un enrichissement de
-- vue_personnages_admin_complet — celle-ci est lue par 3 ecrans (AdminPersonnages,
-- AdminJoueurs, AdminCimetiere) et porte 26 colonnes. Une vue neuve ne touche a
-- rien et se retire d'un DROP.
--
-- VISIBILITE : security_invoker=on, et la visibilite est DERIVEE DE personnages
-- via un EXISTS — donc soumise a la policy de personnages,
-- compte_voit_joueur(joueur_id) OR est_animateur_ou_admin() (C116). On ne parie
-- pas sur la RLS de personnage_competences : on s'appuie sur celle qu'on a mesuree.
--
-- ACL : anon et PUBLIC revoques NOMMEMENT (C102 — un REVOKE FROM PUBLIC seul ne
-- retire rien a anon sur Supabase).
--
-- REPLI, un geste : DROP VIEW public.vue_personnages_choix_competences;

CREATE OR REPLACE VIEW public.vue_personnages_choix_competences
WITH (security_invoker = on) AS
SELECT
  pc.personnage_id,
  co.nom AS competence_nom,
  array_agg(
    DISTINCT COALESCE(l.nom, r.nom, pc.choix_achat)
    ORDER BY COALESCE(l.nom, r.nom, pc.choix_achat)
  ) AS choix
FROM personnage_competences pc
JOIN competences co ON co.id = pc.competence_id
LEFT JOIN langues l ON l.id::text = pc.choix_achat
LEFT JOIN religions r ON r.id::text = pc.choix_achat
WHERE pc.choix_achat IS NOT NULL
  AND EXISTS (SELECT 1 FROM personnages p WHERE p.id = pc.personnage_id)
GROUP BY pc.personnage_id, co.nom;

REVOKE ALL ON public.vue_personnages_choix_competences FROM PUBLIC;
REVOKE ALL ON public.vue_personnages_choix_competences FROM anon;
GRANT SELECT ON public.vue_personnages_choix_competences TO authenticated;
GRANT SELECT ON public.vue_personnages_choix_competences TO service_role;

COMMENT ON VIEW public.vue_personnages_choix_competences IS
  's392 · Sous-choix d''achat resolus (langue/religion/texte) par personnage et par competence. '
  'Visibilite derivee de personnages via EXISTS, sous security_invoker. '
  'Repli : DROP VIEW public.vue_personnages_choix_competences;';

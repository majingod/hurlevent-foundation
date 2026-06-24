-- Correctif liv3 : regrouper les notifs rabais PAR PROFIL (joueur_id), au lieu de
-- par compte. user_id reste le COMPTE (schéma actuel : notifications n'a pas de
-- colonne profil — refonte notifications→profil prévue s222).
-- Idempotent : DELETE des notifs rabais puis réinsertion groupée par profil.
-- Appliquée en prod via MCP (s221, 2026-06-17).

DELETE FROM notifications WHERE type = 'rabais_acquisition';

INSERT INTO notifications (user_id, type, message)
SELECT
  pj.compte_id,
  'rabais_acquisition',
  $h$🎉 Le calcul du rabais sur l'Acquisition de Cercle/Domaine a été corrigé. Ces acquisitions, achetées avant la mise à jour, ont été payées plein tarif :
$h$
  || string_agg(
       '• ' || p.nom || ' — ' || replace(c.nom, 'Acquisition de ', '') || ' '
            || pc.choix_achat || ' (niv ' || pc.niveau_acquis || ')',
       E'\n' ORDER BY p.nom, c.nom, pc.niveau_acquis)
  || $f$

Si tu veux profiter du rabais (−1 XP par sort/prière déjà connu du cercle/domaine), tu peux désacheter puis racheter l'acquisition concernée : le rabais s'appliquera tout seul. Besoin d'aide ? Demande à un admin.$f$
FROM personnage_competences pc
JOIN competences c ON c.id = pc.competence_id
JOIN personnages p ON p.id = pc.personnage_id
JOIN profils_joueur pj ON pj.id = p.joueur_id
WHERE pc.competence_id IN ('9fc3a181-4e29-4d94-8639-65b9a9a7c787','069a0cd4-a368-4134-96ff-467c6a98b2ad')
  AND pc.niveau_acquis IN (2,3)
  AND pc.rabais_items IS NULL
GROUP BY pj.compte_id, p.joueur_id;

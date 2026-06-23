-- liv 3 : notification one-shot aux comptes ayant une Acquisition de Cercle/Domaine
-- niv 2/3 ACHETÉE AVANT le rabais (#445), càd sans étiquette (rabais_items IS NULL).
-- 1 notif par compte, listant les persos/cercles concernés. Idempotent.
-- Appliquée en prod via MCP (s221, 2026-06-17).

-- 1. Étendre le CHECK type pour accepter 'rabais_acquisition' (idempotent).
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['info','validation_race','validation_maitre','xp',
    'evenement','demande_race_nouvelle','race_approuvee','race_refusee',
    'banque','rabais_acquisition']));

-- 2. Insérer 1 notif par compte affecté (one-shot via NOT EXISTS).
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
  AND NOT EXISTS (SELECT 1 FROM notifications nn
                  WHERE nn.user_id = pj.compte_id AND nn.type = 'rabais_acquisition')
GROUP BY pj.compte_id;

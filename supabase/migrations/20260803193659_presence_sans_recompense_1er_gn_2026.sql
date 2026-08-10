-- s373 (session parallele) - 1er GN regulier de 2026 (feba0bdc-65cd-4fa9-a4e6-f5efdd28c29b)
-- Ce personnage (personnage 45afb616-054f-499c-8802-13a3e0630950,
-- inscription a191c083-90da-4260-8808-f78061ab2b91) : presence confirmee SANS recompense.
-- Motif (arbitrage Fred, 2026-08-03) : sa fiche integre DEJA l'acquis de ce GN
-- (niveau 7 = 1 + 6 gn_completes, 165 XP - inscription retroactive creee le 22/07/2026,
-- soit 6 semaines apres l'evenement). L'evenement etant est_termine = true, le bouton
-- "Present" (changer_statut_inscription) aurait declenche attribuer_xp_evenement :
-- +15 XP et +1 niveau EN DOUBLE.
-- recompense_distribuee = true documente "rien a distribuer" et neutralise toute
-- redistribution future (garde de attribuer_xp_evenement et du CAS 2 de
-- changer_statut_inscription). xp_attribue = 0 reste la verite : aucun XP verse
-- par cette inscription.
-- ATTENTION si un jour cette presence est ANNULEE (present -> absent) : le CAS 3 de
-- changer_statut_inscription reprendrait 15 XP jamais verses par cette inscription.
-- Traiter manuellement, ne pas passer par l'annulation automatique.
-- niveau et gn_completes volontairement intouches (deja comptes dans la fiche).
-- Idempotente (garde sur statut) et rejouable a froid (0 ligne si absente).
UPDATE public.inscriptions_evenements
   SET statut = 'present',
       date_confirmation = COALESCE(date_confirmation, now()),
       xp_attribue = 0,
       recompense_distribuee = true,
       updated_at = now()
 WHERE id = 'a191c083-90da-4260-8808-f78061ab2b91'
   AND statut = 'en_attente';

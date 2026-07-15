-- s335 [SEC-ANON-FIX] Re-grant anon EXECUTE sur etat_edition_personnage.
-- Mesuré s335 : la vue security_invoker `vue_personnages_joueur` (anon a SELECT) appelle
-- etat_edition_personnage → anon DOIT pouvoir l'exécuter, sinon la lecture de la vue casserait
-- dès qu'une ligne serait visible à anon (mine latente). La migration 20260715140012 l'avait
-- retirée par erreur ; on restaure l'état voulu par s317. Fuite négligeable (état de jeu, 0 PII).
-- Les 3 autres fonctions (nom_profil_principal, role_du_profil, verifier_prerequis_competences)
-- RESTENT révoquées d'anon : aucune vue security_invoker ni policy de LECTURE anon ne les appelle.
GRANT EXECUTE ON FUNCTION public.etat_edition_personnage(uuid) TO anon;

-- s404 · [INSCRIPTION-REFUS-MUET] — les trois refus de race portent un code distinct
--
-- Le front doit savoir QUEL cas le serveur a refusé pour mener le joueur au bon
-- endroit (modale + « Aller au créateur », arbitrage Fred s404). Détecter par le
-- texte du message casserait en silence ; re-tester l'état côté front créerait une
-- deuxième maison pour le même verbe (C146). Le trigger pose donc un SQLSTATE
-- distinct par cas :
--   RC001 = aucune demande de race    → le front mène au créateur
--   RC002 = demande en attente        → rien à modifier, « Compris »
--   RC003 = demande refusée           → le front mène au créateur
-- Les trois MESSAGES sont inchangés au caractère près (prouvé au diff : 3 lignes,
-- seuls les USING ERRCODE ajoutés). Corps avant : 2562 o / md5 abe853272804ca6066cab849071ced57.
-- Corps après : 2634 o. Inerte pour le front actuel (codes non 23505 → toast générique).
-- Repli d'un geste : re-poser le corps de la baseline (00000000000000, l. 4634).

CREATE OR REPLACE FUNCTION public.verifier_race_approuvee_avant_inscription() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $function$
                  DECLARE
                    v_race_nom text;
                      v_demande_statut text;
                      BEGIN
                        -- Récupérer le nom de la race du personnage
                          SELECT r.nom INTO v_race_nom
                            FROM public.personnages p
                              JOIN public.races r ON r.id = p.race_id
                                WHERE p.id = NEW.personnage_id;

                                  -- Si race nécessite approbation
                                    IF v_race_nom IN ('Chiméride', 'Les Non-Races') THEN
                                        -- Vérifier le statut de la demande
                                            SELECT statut INTO v_demande_statut
                                                FROM public.personnage_races_demandes
                                                    WHERE personnage_id = NEW.personnage_id;

                                                        IF v_demande_statut IS NULL THEN
                                                              RAISE EXCEPTION 'Aucune demande de race trouvée pour ce personnage. Veuillez créer une demande dans le créateur de personnage.' USING ERRCODE = 'RC001';
                                                                  ELSIF v_demande_statut = 'en_attente' THEN
                                                                        RAISE EXCEPTION 'Votre demande de race est en attente d''approbation. Vous pourrez vous inscrire une fois approuvée.' USING ERRCODE = 'RC002';
                                                                            ELSIF v_demande_statut = 'refusee' THEN
                                                                                  RAISE EXCEPTION 'Votre demande de race a été refusée. Vous devez changer de race pour vous inscrire.' USING ERRCODE = 'RC003';
                                                                                      END IF;
                                                                                          -- Si 'approuvee', on continue normalement
                                                                                            END IF;
                                                                                              
                                                                                                RETURN NEW;
                                                                                                END;
                                                                                                $function$;

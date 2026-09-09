-- s409-bis · Une attente de maître suit le besoin, quelle que soit son origine
--
-- Question de Fred (2026-09-04) : « si un joueur demande un maître puis change
-- de classe ou retire la compétence, la demande devrait suivre ». Mesuré :
--   · retirer la compétence supprime la ligne (desacheter_competence_noyau),
--     et la demande EST la ligne : rien à faire ;
--   · la règle inverse posée en 20260904161513 était trop étroite : elle
--     épargnait les demandes déclarées par maître (appris_via_maitre = true).
--
-- Critère retenu = celui du front (needsMaster, Etape5) : générale ou classe
-- propre → maître dès le niveau 3 ; hors-classe → dès le niveau 2. Une attente
-- se lève ssi la nouvelle classe ne demande plus de maître à ce niveau. Une
-- approbation déjà donnée n'est jamais touchée. Niveau 3 hors-classe : la
-- compétence est retirée par D1, la demande part avec elle.
--
-- Prouvé en répétition annulée (5 faces) : maître déclaré hors-classe niv 2
-- devenant classe propre → levée · générale niv 3 → reste · D2 direct → reste
-- actif · maître déclaré restant hors-classe → reste · approuvé → intact.
--
-- Même méthode que 20260904161513 : retouche ancrée, zéro octet transporté,
-- md5 du corps gravé.

DO $s409b$
DECLARE
  v_def text;
  v_n   int;
  v_md5 text;
  k_old constant text := E'      AND pc.statut_maitre = ''en_attente'' AND NOT pc.appris_via_maitre\n      AND NOT (NOT c.est_general AND c.categorie <> v_norm_new AND c.classes_requises IS NULL\n               AND pc.niveau_acquis = 2));\n';
  k_new constant text := E'      AND pc.statut_maitre = ''en_attente''\n      -- plus aucun maitre requis sous la nouvelle classe (critere needsMaster du front) :\n      -- generale ou classe propre -> maitre des le niveau 3 ; hors-classe -> des le niveau 2\n      AND NOT (CASE WHEN c.est_general OR c.categorie = v_norm_new\n                    THEN pc.niveau_acquis >= 3 ELSE pc.niveau_acquis >= 2 END));\n';
  k_c_old constant text := E'  -- D2 inverse (s409) : une attente nee d''un changement de classe (appris_via_maitre=false)\n  -- se leve quand la competence n''est plus hors-classe au niveau 2 sous la nouvelle classe.\n';
  k_c_new constant text := E'  -- D2 inverse (s409) : une attente de maitre, quelle que soit son origine (changement de\n  -- classe ou maitre declare), se leve quand la nouvelle classe ne demande plus de maitre.\n';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'changer_classe_personnage_interne';
  IF v_def IS NULL THEN RAISE EXCEPTION 's409b: fonction introuvable'; END IF;

  IF position('critere needsMaster du front' IN v_def) > 0 THEN
    RAISE NOTICE 's409b: déjà en place, rien à faire';
  ELSE
    v_n := (length(v_def) - length(replace(v_def, k_old, ''))) / length(k_old);
    IF v_n <> 1 THEN RAISE EXCEPTION 's409b: ancre bloc trouvée % fois (attendu 1)', v_n; END IF;
    v_n := (length(v_def) - length(replace(v_def, k_c_old, ''))) / length(k_c_old);
    IF v_n <> 1 THEN RAISE EXCEPTION 's409b: ancre commentaire trouvée % fois (attendu 1)', v_n; END IF;

    v_def := replace(replace(v_def, k_old, k_new), k_c_old, k_c_new);
    EXECUTE v_def;

    SELECT md5(p.prosrc) INTO v_md5
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'changer_classe_personnage_interne';
    IF v_md5 <> '2da78b9930f25cf1b4313ea4e3db0b72' THEN
      RAISE EXCEPTION 's409b: md5 du corps = % (attendu 2da78b9930f25cf1b4313ea4e3db0b72)', v_md5;
    END IF;
  END IF;
END
$s409b$;

-- Réparation avec le même critère, sous la classe COURANTE (0 ligne attendue
-- en prod le 2026-09-04 ; replayable).
UPDATE personnage_competences pc
SET statut_maitre = 'non_requis'
FROM personnages p
JOIN classes cl ON cl.id = p.classe_id,
     competences c
WHERE p.id = pc.personnage_id
  AND c.id = pc.competence_id
  AND pc.statut_maitre = 'en_attente'
  AND NOT (CASE WHEN c.est_general
                  OR c.categorie = (CASE cl.nom
                                      WHEN 'Guerrier' THEN 'guerrier' WHEN 'Voleur' THEN 'voleur'
                                      WHEN 'Mage' THEN 'mage' WHEN 'Prêtre' THEN 'pretre' ELSE NULL END)
                THEN pc.niveau_acquis >= 3 ELSE pc.niveau_acquis >= 2 END);

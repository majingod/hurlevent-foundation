-- Resync verbatim ciblé (audit s268) : 3 corrections de sens manuel corrigé -> DB.
-- Idempotent : remplacements ancrés + garde LIKE (rejouable à froid = no-op).

-- 1) Antipathie : "la cible" (non-sens) -> "le lanceur"
UPDATE sorts SET description = replace(description,
  $a$obligées d'attaquer la cible, elles$a$,
  $a$obligées d'attaquer le lanceur, elles$a$)
WHERE nom = 'Antipathie' AND cercle = 'Charmes'
  AND description LIKE $a$%obligées d'attaquer la cible, elles%$a$;

-- 2) Retour de flamme : c'est la CIBLE (porteur de l'aura) qui reçoit/annonce, pas le lanceur
UPDATE sorts SET description = replace(
    replace(description,
      $a$Le lanceur du sort reçoit tout de même les dégâts des attaques reçues.$a$,
      $a$La cible reçoit tout de même les dégâts des attaques reçues.$a$),
    $a$doivent être annoncés par le lanceur de sort.$a$,
    $a$doivent être annoncés par la cible.$a$)
WHERE nom = 'Retour de flamme' AND cercle = 'Feu'
  AND description LIKE $a$%Le lanceur du sort reçoit tout de même%$a$;

-- 3) Miroir : prose agnostique "La ou les cibles" + correction "une prière"
UPDATE sorts SET description = replace(description,
  $a$Les cibles affectées par ce sort peuvent renvoyer un sort ou prière les prenant comme cible$a$,
  $a$La ou les cibles affectées par ce sort peuvent renvoyer un sort ou une prière les prenant comme cible$a$)
WHERE nom = 'Miroir' AND cercle = 'Magie Pure'
  AND description LIKE $a$%Les cibles affectées par ce sort peuvent renvoyer un sort ou prière%$a$;

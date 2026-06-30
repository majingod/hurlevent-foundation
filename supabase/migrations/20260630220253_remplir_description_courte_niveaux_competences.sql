-- Remplit description_courte sur les 47 niveaux de compétences qui en manquaient.
-- Idempotent : rejouable à froid (réécrit la même valeur). Ciblage par id (les
-- paires Développement Spirituel / Supérieur mage+prêtre partagent le nom).
-- Préserve l'ordre du tableau niveaux (WITH ORDINALITY) et ne modifie que la
-- clé description_courte du niveau visé. Affichage seulement : aucun impact
-- XP/PV/PS ni sur les compos de persos existants.
DO $migration$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('61eb2c1f-522e-468c-a4ad-f45261e683cc'::uuid, 1, $c$Acquérir des prières sur mesure (domaine, cibles, durée, portée). Coût plafonné à 10 + 10× le niveau du perso.$c$),
      ('d9a446cc-abdd-40d1-be68-42240b7c9bae'::uuid, 1, $c$Acquérir des sorts sur mesure (école, cibles, durée, portée, niveau). Coût plafonné à 10 + 10× le niveau du perso.$c$),
      ('649d3974-0e37-4b15-a26f-4db78dc541a9'::uuid, 1, $c$Lancer un sort « au toucher » via bâton/baguette, sans main libre. 1 min pour le transmettre, un seul à la fois, perdu sinon.$c$),
      ('3dfaeb28-defe-4e80-a8d5-3e5a686b98d5'::uuid, 1, $c$Récupère +1 PV à chaque soin reçu (physique, magique ou alchimique), sans exception.$c$),
      ('70680316-bd7f-4bed-b711-050a2c54161a'::uuid, 1, $c$Contre les effets de peur : double son niveau de perso pour y résister.$c$),
      ('083212ef-02b7-46d3-86b5-fb0e2aa885af'::uuid, 1, $c$Cacher un objet (max un poing) sur soi. Il porte un ruban rouge hors-jeu : invisible en jeu, non volable ni échangeable.$c$),
      ('c7a18f18-48d6-4d4a-aa30-cdc1d9eb6f2c'::uuid, 1, $c$Avec élan de 10 pieds et arme à deux mains : exécute une Botte Secrète en une seule frappe au lieu de deux.$c$),
      ('9f0c30b3-3440-47d3-a965-68859acc6417'::uuid, 1, $c$Opérations invasives (membre, greffe, parasite) : outils + calme, 5 min prépa + 10 min, jamais en combat. Éléments frais, greffe même race.$c$),
      ('7c379b31-0983-49d3-bf35-7cc0225210f5'::uuid, 1, $c$Utiliser les armes à deux mains : elles infligent toujours 2 dégâts aux membres au lieu d'un.$c$),
      ('7e56dffe-8e26-4942-939e-34914b17cd0e'::uuid, 1, $c$Identifier les pierres communes et connaître leurs propriétés.$c$),
      ('7f2e09a9-df96-45b4-a55d-56a37c66a8a4'::uuid, 1, $c$Identifier les pierres rares et connaître leurs propriétés.$c$),
      ('c601901b-2a26-46e0-a42e-2e3077fe99e2'::uuid, 1, $c$Connaître maturité, abondance saisonnière et propriétés des plantes alchimiques communes (code remis en début d'événement).$c$),
      ('72a3db25-ed40-49c1-96f0-ec9f60f62fa3'::uuid, 1, $c$Connaître maturité, abondance saisonnière et propriétés des plantes alchimiques rares (code remis en début d'événement).$c$),
      ('6fddb377-09bf-4448-9aee-11fd43ade998'::uuid, 1, $c$Identifier les métaux et alliages communs (pépites, lingots) et leurs propriétés.$c$),
      ('b4048343-f713-4bd0-8459-7732a459d563'::uuid, 1, $c$Identifier les métaux et alliages rares ou légendaires (pépites, lingots) et leurs propriétés.$c$),
      ('c821b270-d314-4092-9899-2fd80925e873'::uuid, 1, $c$Connaître mœurs, rites, dogmes, domaines et intentions d'une religion au choix (rachetable). Connaissance seule : consacré à une seule religion.$c$),
      ('1135db5a-9161-4cc3-bc50-e0e0bed3ce5a'::uuid, 1, $c$Connaître les runes : les reconnaître, les tracer et leurs propriétés (canalisation magique des rituels et objets).$c$),
      ('73e2ea2e-0668-4db9-bbdc-702e6ea3e719'::uuid, 1, $c$Connaître les maisons nobles des Badlands (emblèmes, habitudes) + l'étiquette. Donne droit à des infos d'animation.$c$),
      ('0b0fba09-77d5-4078-946f-9add150f695d'::uuid, 1, $c$Connaître une langue ancienne au choix (rachetable), alphabet remis. Sans la compétence, impossible de traduire même avec l'alphabet.$c$),
      ('8e583714-0b29-4071-9142-56d92324d7ba'::uuid, 1, $c$Coup reçu sur le bouclier → annonce « Repoussé 3 pieds » à l'adversaire. 2 fois par cycle.$c$),
      ('506f7bc1-af9d-403b-a495-fee5cb5f751d'::uuid, 1, $c$Augmente les PS maximum (jusqu'à 20). Rachetable : +1 PS par achat.$c$),
      ('0db39587-68ad-4025-afe4-bbcbff67ad8a'::uuid, 1, $c$Augmente les PS maximum (jusqu'à 20). Rachetable : +1 PS par achat.$c$),
      ('0eeecf81-7953-45b1-9928-13ed02eaaa69'::uuid, 1, $c$Augmente les PS maximum jusqu'à 30. Rachetable : +1 PS par achat.$c$),
      ('868141a8-ecb5-4e6b-9ccc-09a0bebd9a0b'::uuid, 1, $c$Augmente les PS maximum jusqu'à 30. Rachetable : +1 PS par achat.$c$),
      ('356b26b4-92c2-4912-baa1-1d11bd254288'::uuid, 1, $c$Appliquer ses poisons de corps-à-corps sur les projectiles (flèches, carreaux, lancer) ; pas besoin de toucher une zone non protégée.$c$),
      ('2b668197-abf4-4dd9-bf9b-9704cedde17a'::uuid, 1, $c$Appliquer les poisons mineurs et intermédiaires sur une arme non contondante ; transformer les mineurs en poudre volatile.$c$),
      ('dbbfd20a-73e4-411a-a5b5-757dc394450c'::uuid, 1, $c$Modifier un document (en main) : 15 min par page. Sa crédibilité dépend des infos réunies (papier, étampes, signatures, écriture).$c$),
      ('847ce9b2-a3be-4600-a2b0-31e932e45dd0'::uuid, 1, $c$Enseignements reçus au baptême : l'animation donne un résumé poussé sur la création de l'univers OU des secrets de la religion.$c$),
      ('cc4fc008-70dd-4f57-b060-e316f2028824'::uuid, 1, $c$Fouiller plus vite une cible sans défense : courte 15 s (au lieu de 30), longue 1 min (au lieu de 2).$c$),
      ('ecba79a7-e57a-4fd0-a4f7-4f09567cfbd8'::uuid, 1, $c$Lancer des sorts en payant 1 PV par PS (PV naturels). Dégâts non soignables par Premiers Soins ; potion/magie/cycle requis. Pas d'auto-soin.$c$),
      ('7f2981cb-5c55-46e3-b21d-3ffd8ddce50a'::uuid, 1, $c$Au toucher, prière de 5 s : guérit des PV depuis la réserve du prêtre (= son niveau), réveille un inconscient. Réserve régénérée entre événements.$c$),
      ('cc02fb93-3204-4c81-a0d1-3b1701db9ae9'::uuid, 1, $c$Parler une langue au choix (rachetable). Lire/écrire exige Linguistique + Mathématique.$c$),
      ('c9d9a7b0-145e-48f6-b6fb-0d6811480221'::uuid, 1, $c$Maîtrise rudimentaire du commun (lire/écrire) et des calculs mathématiques.$c$),
      ('05529f8e-0743-4573-bbb9-bad8358e9bd8'::uuid, 1, $c$Porter le bouclier moyen : l'écu (≤100 cm, en main libre).$c$),
      ('4b726be1-0771-4641-9f65-28eb744dda9b'::uuid, 1, $c$Porter le grand bouclier : le pavois (≤160 cm, en main libre).$c$),
      ('cc082d1a-72ed-47fb-b0c2-2e400e5b717a'::uuid, 1, $c$Porter les petits boucliers : targe (≤20 cm, à l'avant-bras) et rondache (≤40 cm, en main).$c$),
      ('545e574e-14be-4946-a191-119b88fdf992'::uuid, 1, $c$Emprisonner un sort de mage (niv 1-5, étendu par Canalisation 2/3) dans un piège de coffre. Désamorçable via Canalisation, un par contenant, non récupérable.$c$),
      ('1427677e-98fd-4ba5-86ca-3145fc4aa178'::uuid, 1, $c$Ajoute un accès secret à ses pièges : qui connaît la méthode les désactive/réactive sans compétence. Le créateur ouvre sans déclencher. Vaut aussi pour les pièges magiques.$c$),
      ('de5715d0-4f65-4494-9788-914244b90173'::uuid, 1, $c$Suivre des traces de moins de 4 h (race, nombre, vitesse, direction). Homme-bête : +2 h et de nuit. Surtout pour retrouver des PNJ.$c$),
      ('92e89b57-9e4d-4405-ad12-5301592914eb'::uuid, 1, $c$Ignore le premier repoussement de chaque combat (physique ou magique) : annonce « Résiste ! » et reste en place.$c$),
      ('1e9d8d12-0ead-4724-a4c8-3a92d87e8426'::uuid, 1, $c$Porter une armure de mailles : plastron = 2 PA, tient 3 combats subis.$c$),
      ('c5f9869b-b824-4368-aa8c-4b3b0d149eb9'::uuid, 1, $c$Porter une armure de cuir : plastron = 1 PA, tient 2 combats subis puis brisée (brisée = aucun bonus, accessoires compris).$c$),
      ('4fd3014c-0baa-45cc-a78f-b7923275f500'::uuid, 1, $c$Porter une armure de plaques : torse = 4 PA, tient 4 combats subis.$c$),
      ('17cc577e-6ea5-4def-850b-c7f6112ab8fb'::uuid, 1, $c$Permet à Premiers Soins de réveiller un personnage inconscient (sans elle, soigner ne réveille pas).$c$),
      ('fe42b034-42a3-4f98-8f4d-2c3d05b0da59'::uuid, 1, $c$Donne 10 écus au début de chaque événement (travail effectué entre les événements).$c$),
      ('af0725d0-61e9-4b1c-9d44-d4c8c31bf42d'::uuid, 1, $c$Pose une question (sous forme de prière) à un MJ la veille au soir ; la réponse vient au réveil — jamais claire, jamais mensongère.$c$),
      ('f9fac4c3-5a46-48cd-9ee3-d628f0f8a39d'::uuid, 1, $c$Lancer une rumeur sur le territoire de son choix, via un animateur qui la répand en jeu.$c$)
    ) AS v(comp_id, niv, courte)
  LOOP
    UPDATE competences c
    SET niveaux = (
      SELECT jsonb_agg(
               CASE WHEN (e.elem->>'niveau')::int = r.niv
                    THEN e.elem || jsonb_build_object('description_courte', r.courte)
                    ELSE e.elem END
               ORDER BY e.ord)
      FROM jsonb_array_elements(c.niveaux) WITH ORDINALITY AS e(elem, ord)
    )
    WHERE c.id = r.comp_id
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.niveaux) x
                  WHERE (x->>'niveau')::int = r.niv);
  END LOOP;
END
$migration$;

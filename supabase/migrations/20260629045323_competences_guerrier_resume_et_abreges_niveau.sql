-- Lot 2 GUERRIER : 27 resume_condense (vue d'ensemble) + 43 description_courte par niveau (15 multi).
-- Idempotent : UPDATE par (categorie,nom) ; reconstruction niveaux avec `||` qui remplace tout legacy.

-- A. resume_condense (27)
UPDATE competences c
SET resume_condense = v.r
FROM (VALUES
 ('Berserk', $r$Entre dans une rage barbare offrant des PV temporaires et une résistance accrue aux sorts à effet, mais force à attaquer tout ce qui l'entoure.$r$),
 ('Bonne santé', $r$Chaque soin reçu (physique, magique ou alchimique) restaure un point de vie supplémentaire.$r$),
 ('Botte Secrète', $r$Après deux coups portés sur la cible visée, permet de désarmer l'adversaire, puis de briser son bouclier, puis son arme.$r$),
 ('Bravoure', $r$Double les niveaux de personnage pour résister aux effets de peur.$r$),
 ('Charge', $r$Avec un élan de 10 pieds et une arme à deux mains, déclenche une Botte Secrète en une seule frappe au lieu de deux.$r$),
 ('Combat à deux armes', $r$Permet de combattre avec une arme dans chaque main, la taille maximale autorisée augmentant à chaque niveau.$r$),
 ('Compétence d''arme à deux mains', $r$Permet de manier les armes à deux mains, qui infligent 2 dégâts aux membres au lieu d'un seul.$r$),
 ('Compétence d''arme à la hache', $r$Avec une hache, améliore les Bottes Secrètes : un seul coup suffit et l'effet passe à trois fois par cycle.$r$),
 ('Compétence d''arme à la lame', $r$Avec une épée ou une dague, débloque la résistance au désarmement puis des frappes spéciales (coup vicieux, coup puissant).$r$),
 ('Compétence d''arme d''hast', $r$Avec une arme d'hast ou un bâton, débloque repoussement, coup puissant, puis charge brutale.$r$),
 ('Compétence d''arme d''impact', $r$Avec une masse ou un marteau, débloque coup puissant, repoussement, puis un repoussement permanent en état de Berserk.$r$),
 ('Corps Sain', $r$Augmente le nombre de potions ingérables par cycle avant d'atteindre la saturation alchimique.$r$),
 ('Défense Inflexible', $r$Une fois par combat, réduit les dégâts d'un sort à dégâts directs selon la taille du bouclier tenu.$r$),
 ('Désengagement', $r$Quand un coup atterrit sur son bouclier, repousse l'adversaire de 3 pieds, deux fois par cycle.$r$),
 ('Discours du Commandement', $r$Après un discours d'avant-combat, confère à plusieurs alliés la capacité d'ignorer une attaque physique.$r$),
 ('Forge', $r$Permet de fondre les métaux en lingots et de fabriquer ou réparer armes, armures et boucliers, la rareté travaillée augmentant avec le niveau.$r$),
 ('Maniement du bouclier moyen', $r$Permet de porter un bouclier de taille moyenne (écu, jusqu'à 100 cm).$r$),
 ('Maniement du grand bouclier', $r$Permet de porter un bouclier de grande taille (pavois, jusqu'à 160 cm).$r$),
 ('Maniement du petit bouclier', $r$Permet de porter les petits boucliers (targe à l'avant-bras, rondache en main libre).$r$),
 ('Poids Lourd', $r$Permet d'ignorer le premier repoussement subi à chaque combat en annonçant « Résiste ».$r$),
 ('Port d''armure intermédiaire', $r$Permet de porter l'armure de maille (2 points d'armure, sur trois combats avant d'être brisée).$r$),
 ('Port d''armure légère', $r$Permet de porter l'armure de cuir (1 point d'armure, sur deux combats avant d'être brisée).$r$),
 ('Port d''armure lourde', $r$Permet de porter l'armure de plaques (4 points d'armure, sur quatre combats avant d'être brisée).$r$),
 ('Renforcement défensif', $r$Permet à un forgeron de renforcer bouclier ou armure : anti brise-bouclier, durabilité doublée, puis point d'armure en plus.$r$),
 ('Résistance à la magie', $r$Permet de résister à un sort à effet sans le niveau requis, un nombre de fois par événement croissant avec le niveau.$r$),
 ('Résistance à la torture', $r$Permet de mentir lors d'une séance de torture, à un nombre de questions croissant avec le niveau.$r$),
 ('Résolution Guerrière', $r$Endurcit le guerrier : agir encore à 1 PV, résister à un poison/maladie, puis gagner un PV permanent.$r$)
) AS v(nom, r)
WHERE c.categorie='guerrier' AND c.nom = v.nom;

-- B. description_courte par niveau (43, sur les 15 multi)
WITH abreges(nom, niveau_num, abrege) AS (VALUES
 ('Berserk',1,$a$2 PV temporaires et +2 en résistance aux sorts à effet (sauf calme), en attaquant tout autour de soi.$a$),
 ('Berserk',2,$a$4 PV temporaires, +3 en résistance, et combat possible à 1 PV en ignorant l'Acte héroïque.$a$),
 ('Berserk',3,$a$6 PV temporaires et +4 en résistance aux sorts à effet.$a$),
 ('Botte Secrète',1,$a$Après deux coups sur l'arme adverse, annoncer « Désarmement » (2 fois par cycle).$a$),
 ('Botte Secrète',2,$a$Après deux coups sur le bouclier adverse, annoncer « Brise-bouclier » (2 fois par cycle).$a$),
 ('Botte Secrète',3,$a$Après deux coups sur l'arme adverse, annoncer « Bris d'arme » qui la détruit (2 fois par cycle).$a$),
 ('Combat à deux armes',1,$a$Porter deux armes courtes (45 cm ou moins).$a$),
 ('Combat à deux armes',2,$a$Porter deux armes moyennes (45 à 80 cm).$a$),
 ('Combat à deux armes',3,$a$Porter deux armes longues (80 à 110 cm).$a$),
 ('Compétence d''arme à la hache',1,$a$Désarmement (Botte Secrète 1) à la hache en un seul coup, jusqu'à 3 fois par cycle.$a$),
 ('Compétence d''arme à la hache',2,$a$Brise-bouclier (Botte Secrète 2) à la hache en un seul coup, jusqu'à 3 fois par cycle.$a$),
 ('Compétence d''arme à la hache',3,$a$Bris d'arme (Botte Secrète 3) à la hache en un seul coup, jusqu'à 3 fois par cycle.$a$),
 ('Compétence d''arme à la lame',1,$a$Résister à un désarmement par cycle avec une lame.$a$),
 ('Compétence d''arme à la lame',2,$a$Annoncer « Coup vicieux » qui annule la prochaine guérison de la cible (2 fois par cycle).$a$),
 ('Compétence d''arme à la lame',3,$a$Annoncer « Coup puissant » infligeant 1 dégât supplémentaire (2 fois par cycle).$a$),
 ('Compétence d''arme d''hast',1,$a$Annoncer « Repoussé 3 pieds » (2 fois par cycle).$a$),
 ('Compétence d''arme d''hast',2,$a$Annoncer « Coup puissant » infligeant 1 dégât supplémentaire (2 fois par cycle).$a$),
 ('Compétence d''arme d''hast',3,$a$Avec un élan de 10 pieds, « Charge brutale » détruisant l'armure touchée au torse (2 fois par cycle).$a$),
 ('Compétence d''arme d''impact',1,$a$Annoncer « Coup puissant » infligeant 1 dégât supplémentaire (2 fois par cycle).$a$),
 ('Compétence d''arme d''impact',2,$a$Annoncer « Repoussé 3 pieds » (2 fois par cycle).$a$),
 ('Compétence d''arme d''impact',3,$a$En rage Berserk, « Repoussé 3 pieds » sur chaque coup (masse ou marteau requis).$a$),
 ('Corps Sain',1,$a$1 potion de plus par cycle avant saturation alchimique.$a$),
 ('Corps Sain',2,$a$2 potions de plus par cycle avant saturation.$a$),
 ('Corps Sain',3,$a$3 potions de plus par cycle avant saturation.$a$),
 ('Défense Inflexible',1,$a$Réduit un sort direct de 1/2/3 selon petit/moyen/grand bouclier (hors sorts de zone), une fois par combat.$a$),
 ('Défense Inflexible',2,$a$Réduction portée à 2/4/6 selon petit/moyen/grand bouclier.$a$),
 ('Discours du Commandement',1,$a$Discours de 5 min : 2 à 6 alliés ignorent une attaque physique par combat (2 fois par cycle).$a$),
 ('Discours du Commandement',2,$a$Porte à deux le nombre d'attaques bloquées par combat.$a$),
 ('Forge',1,$a$Travailler les métaux communs (fonte, fabrication, réparation).$a$),
 ('Forge',2,$a$Travailler aussi les métaux rares.$a$),
 ('Forge',3,$a$Travailler tous les alliages, y compris légendaires.$a$),
 ('Renforcement défensif',1,$a$Renforce un bouclier pour résister au prochain brise-bouclier (20 min de travail).$a$),
 ('Renforcement défensif',2,$a$Renforce une armure pour doubler son nombre de combats avant réparation.$a$),
 ('Renforcement défensif',3,$a$Ajoute un point d'armure à une armure renforcée.$a$),
 ('Résistance à la magie',1,$a$Résister à un sort à effet une fois par événement.$a$),
 ('Résistance à la magie',2,$a$Résister à un sort à effet jusqu'à deux fois par événement.$a$),
 ('Résistance à la magie',3,$a$Résister à un sort à effet jusqu'à trois fois par événement.$a$),
 ('Résistance à la torture',1,$a$Mentir à une question sous la torture.$a$),
 ('Résistance à la torture',2,$a$Mentir à deux questions sous la torture.$a$),
 ('Résistance à la torture',3,$a$Mentir à trois questions sous la torture.$a$),
 ('Résolution Guerrière',1,$a$Agir normalement à 1 point de vie (ignore l'Acte héroïque).$a$),
 ('Résolution Guerrière',2,$a$Résister au premier poison mineur ou à la première maladie du jour.$a$),
 ('Résolution Guerrière',3,$a$Gagne 1 point de vie maximum permanent.$a$)
)
UPDATE competences c
SET niveaux = sub.nouveaux
FROM (
  SELECT c2.id,
    jsonb_agg(
      CASE WHEN a.abrege IS NOT NULL
        THEN elem || jsonb_build_object('description_courte', a.abrege)
        ELSE elem END
      ORDER BY ord
    ) AS nouveaux
  FROM competences c2
  CROSS JOIN LATERAL jsonb_array_elements(c2.niveaux) WITH ORDINALITY AS t(elem, ord)
  LEFT JOIN abreges a ON a.nom = c2.nom AND a.niveau_num = (elem->>'niveau')::int
  WHERE c2.categorie='guerrier'
  GROUP BY c2.id
) sub
WHERE c.id = sub.id;

-- Sprint 5.7 batch 1 — Enrichissement verbatim manuel 2026 (6 mai)
-- Périmètre : effets_combat type = 'controle' (14 entrées)
-- Conventions : bullets du manuel converties en -
--               apostrophes typographiques converties en apostrophes droites (cohérence DB)
-- Idempotence : UPDATE ... WHERE nom = '...' (naturellement idempotent)

UPDATE effets_combat SET description = 'Un personnage assommé tombe inconscient pour une durée maximale de dix minutes. Durant cet état, il ne peut agir, parler et ni se déplacer. Il peut toutefois être réveillé avant la fin de la durée s''il est secoué de manière évidente en jeu ou s''il reçoit des dégâts, quelle qu''en soit la source.' WHERE nom = 'Assommé';

UPDATE effets_combat SET description = 'Le personnage affecté par l''aveuglement doit fermer ses yeux pour la durée annoncée.' WHERE nom = 'Aveuglé';

UPDATE effets_combat SET description = 'Lorsqu''une arme est brisée, elle doit être immédiatement laissée au sol et ne peut plus être utilisée. Elle demeure inutilisable jusqu''à ce qu''elle soit réparée par un forgeron ou par une compétence appropriée.' WHERE nom = 'Bris d''arme';

UPDATE effets_combat SET description = 'Un bouclier brisé ne peut plus être utilisé et doit être immédiatement laissé au sol. Il ne pourra être utilisé de nouveau qu''après avoir été réparé par un forgeron ou une compétence adéquate.' WHERE nom = 'Brise-bouclier';

UPDATE effets_combat SET description = 'Comateux est une personne qui tombe à zéro PV.' WHERE nom = 'Comateux';

UPDATE effets_combat SET description = 'La cible doit mettre un genou au sol pendant 5 secondes, incapacité à se déplacer ou à courir durant ce temps.' WHERE nom = 'Coupe-jarret';

UPDATE effets_combat SET description = 'La cible doit lancer son arme à au moins 6 pieds (environ 2 mètres) de distance.' WHERE nom = 'Désarmement';

UPDATE effets_combat SET description = 'Un personnage affecté par la folie perd sa capacité à distinguer le réel de l''imaginaire. Il peut percevoir des sons inexistants, voir des personnes ou des événements qui ne sont pas réels et doit jouer cet état de confusion de manière crédible et continue.' WHERE nom = 'Folie';

UPDATE effets_combat SET description = 'Une personne inconsciente est une personne qui s''écroule et qui n''a pas conscience de ce qui se passe autour de lui. Différent de comateux qui n''a plus de point de vie.' WHERE nom = 'Inconscient';

UPDATE effets_combat SET description = 'Un personnage intangible ne peut interagir physiquement avec le monde matériel et il ne peut ni attaquer, ni lancer de sorts, y compris des sorts de magie pure, ni manipuler des objets physiques. Tout objet qu''il lâche devient intangible pour tous la durée de l''effet.' WHERE nom = 'Intangible';

UPDATE effets_combat SET description = E'Les cibles affectées par paralysie sont incapables de bouger pendant toute la durée du sort.\n- Elles conservent leurs sens (vue, ouïe, odorat).\n- Elles ne peuvent pas parler, ni effectuer de gestes, ni utiliser d''objets ou de compétences.' WHERE nom = 'Paralysie';

UPDATE effets_combat SET description = E'Un personnage pétrifié :\n- ne peut ni bouger, ni parler, ni attaquer\n- conserve ses sens (vue, ouïe, odorat)\n- ne peut pas être blessé tant qu''il est pétrifié.\n- Il est considéré comme un objet inerte (mais vivant), immunisé aux dégâts et au sort qui touche uniquement les objets.' WHERE nom = 'Pétrifié';

UPDATE effets_combat SET description = 'La cible doit immédiatement reculer de 3 pieds (environ 1 mètre) dans la direction opposée à l''attaque.' WHERE nom = 'Repoussé (3 pieds)';

UPDATE effets_combat SET description = 'La cible doit reculer immédiatement de 10 pieds (environ 3 mètres) dans la direction opposée à l''effet (coup, sort, etc.).' WHERE nom = 'Repoussé (10 pieds)';

-- Sprint 5.7 batch 2 — Enrichissement verbatim manuel 2026 (6 mai)
-- Périmètre : effets_combat type IN ('debuff', 'degats', 'utilitaire') = 18 entrées
-- Conventions : bullets du manuel converties en -
--               apostrophes typographiques converties en apostrophes droites
-- Décisions session 43 :
--   * Point 1 (3 descriptions degats identiques manuel) : paraphrase minimale
--     en ajoutant le nom de la technique en sujet (Backstab, Brise-cou, Égorgement)
--   * Point 2 (Rappel sur points d'armure sous Charge brutale) : double couverture
--     dans Charge brutale (verbatim) + Points d'armure (version adaptée sans redondance)
-- Idempotence : UPDATE WHERE nom = '...' (naturellement idempotent)

-- ============ debuff (7) ============

UPDATE effets_combat SET description = 'Un coup vicieux est annoncé au moment de l''élan de la frappe. La cible subit les dégâts normalement infligés, mais la prochaine tentative de guérison (magique ou physique) sur elle sera annulée. Cet effet disparaît lorsque la cible tombe inconsciente.' WHERE nom = 'Coup vicieux';

UPDATE effets_combat SET description = 'Une cible enflammée doit passer au moins 5 secondes à tenter de s''éteindre (roulade au sol, gestes explicites, etc.). La cible affectée doit immédiatement consacrer une action claire à s''éteindre. Si elle ne le fait pas, elle perd 50 % de ses points de vie totaux (points d''armures et points de vie).' WHERE nom = 'Enflammé';

UPDATE effets_combat SET description = E'Un personnage affecté par lenteur :\n- se déplace la moitié de sa vitesse normale (ralenti de manière extrême) ;\n- ne peut infliger aucun dégât avec ses attaques\n- parle au ralenti, de façon incompréhensible.\n- Il doit jouer l''effet de façon évidente : gestes lents, voix déformée, réactions tardives, etc.' WHERE nom = 'Lenteur';

UPDATE effets_combat SET description = 'Un personnage pestiféré voit ses points de vie maximum réduits à deux et doit jouer un état de maladie grave, incluant par exemple des vomissements, des frissons, des étourdissements, de la toux ou un malaise général. Une fois soigné, son maximum de points de vie demeure à deux, mais il peut ensuite être soigné normalement.' WHERE nom = 'Pestiféré';

UPDATE effets_combat SET description = E'Un personnage souffrant de saignement subit 1 dégât par minute, jusqu''à :\n- Utilisation d''une potion de soin,\n- Lancement d''un sort de guérison\n- Ou application de la compétence Premiers soins.' WHERE nom = 'Saignement';

UPDATE effets_combat SET description = 'Le saignement magique applique les mêmes effets que le saignement normal, mais ne peut être stoppé que par des effets de dissipation de la magie ou par la fin de la durée du sort.' WHERE nom = 'Saignement magique';

UPDATE effets_combat SET description = 'La saturation alchimique se produit lorsque le personnage ingère plus de potions que la moitié de ses points de vie maximal, arrondis à l''unité inférieure. Chaque potion ingérée dépassant la saturation alchimique du personnage ne produit pas l''effet.' WHERE nom = 'Saturation alchimique';

-- ============ degats (6) ============

UPDATE effets_combat SET description = 'Une attaque de Backstab fait tomber la cible immédiatement à 0 point de vie.' WHERE nom = 'Backstab';

UPDATE effets_combat SET description = 'Une blessure magique est considérée comme capable d''affecter les entités intangibles telles que les esprits, fantômes ou créatures similaires. Les personnes sous l''effet d''intangibilité sont aussi concernés par cette règle.' WHERE nom = 'Blessure magique';

UPDATE effets_combat SET description = 'Un Brise-cou fait tomber la cible immédiatement à 0 point de vie.' WHERE nom = 'Brise-cou';

UPDATE effets_combat SET description = E'Une charge brutale inflige les dégâts habituels aux membres.\nSi le torse est touché :\n- Tous les points d''armure du personnage sont détruits.\n- Si le personnage n''a aucun point d''armure, il tombe automatiquement à 1 point de vie.\nRappel important : les points d''armure ne sont pas des points de vie temporaires. Ils absorbent les coups sans réduire les PV, mais une fois détruits, ils ne protègent plus et doivent être réparés avant de les récupérer à nouveau.' WHERE nom = 'Charge brutale';

UPDATE effets_combat SET description = 'Un coup puissant est annoncé au moment de l''élan de la frappe. Il inflige toujours +1 dégât supplémentaire en plus des dégâts normaux.' WHERE nom = 'Coup puissant';

UPDATE effets_combat SET description = 'Un Égorgement fait tomber la cible immédiatement à 0 point de vie.' WHERE nom = 'Égorgement';

-- ============ utilitaire (5) ============

UPDATE effets_combat SET description = 'Un objet béni a des effets néfastes contre certaines créatures faibles à cet élément et ne fait rien de plus contre les personnes ou créatures normales.' WHERE nom = 'Bénédiction';

UPDATE effets_combat SET description = 'Les points d''armure représentent la protection offerte par une armure, un bouclier ou tout autre équipement défensif porté par un personnage. Ils absorbent les coups reçus sans réduire les points de vie tant qu''ils sont présents. Lorsqu''un personnage subit des dégâts, ceux-ci sont d''abord appliqués aux points d''armure avant d''affecter les points de vie. Rappel important : les points d''armure ne sont pas des points de vie temporaires. Une fois détruits, ils ne protègent plus et doivent être réparés avant de les récupérer à nouveau.' WHERE nom = 'Points d''armure';

UPDATE effets_combat SET description = 'Un personnage qui annonce résiste ou annule ignore entièrement l''effet qui lui a été annoncé. Il doit toutefois disposer du niveau, de la compétence ou de l''objet requis pour bloquer cet effet.' WHERE nom = 'Résiste/Annule';

UPDATE effets_combat SET description = 'Un ruban jaune apposé sur un objet indique que celui-ci est protégé par le sort Ange gardien. Cet effet n''est pas visible en jeu et ne peut pas être détecté sans moyen approprié.' WHERE nom = 'Ruban jaune';

UPDATE effets_combat SET description = 'Un ruban rouge apposé sur un objet indique que celui-ci est protégé par la compétence Cachette secrète. Cet effet ne s''applique que tant que l''objet est porté sur la personne.' WHERE nom = 'Ruban rouge';

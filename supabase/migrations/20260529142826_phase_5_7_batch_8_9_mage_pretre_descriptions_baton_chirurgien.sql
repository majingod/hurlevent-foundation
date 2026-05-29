-- Sprint 5.7 batches 8+9 (Mage + Prêtre) — Option A
-- Volet libellés prérequis : 0 changement (déjà 100% canoniques).
-- Volet descriptions : 2 vraies divergences alignées au manuel (édition 6 mai 2026).
--   (1) mage   / Bâton de Sorcier niv 1 : ajout du 2e paragraphe (conservation 1 min du sort au toucher)
--   (2) pretre / Chirurgien       niv 1 : réécriture manuel (renvoi page 6, formulation à jour)
-- Typographie maison conservée (apostrophes/guillemets droits). Typo manuel « fois.Si » corrigé en « fois. Si ».
-- Idempotent : jsonb_set sur l'élément niveau 1 (index 0). Métadonnées niveau/cout_xp/prerequis préservées.

UPDATE competences
SET niveaux = jsonb_set(
  niveaux, '{0,description}',
  to_jsonb($d$Cette compétence permet au mage d'utiliser un bâton de mage ou une baguette comme une extension de son propre corps. Il peut ainsi lancer un sort dont la portée est "au toucher" en utilisant son bâton ou sa baguette comme s'il s'agissait de sa main. Dans ce cas, l'obligation d'avoir une main libre pour lancer le sort ne s'applique pas. Une fois le sort lancé, le mage dispose d'une minute pour le transmettre par l'intermédiaire de son bâton ou de sa baguette. Un seul sort peut être conservé de cette manière à la fois. Si le sort n'est pas déclenché avant la fin de ce délai, il est perdu et les points de spiritualité dépensés ne sont pas récupérés.$d$::text)
)
WHERE categorie = 'mage' AND nom = 'Bâton de Sorcier'
  AND (niveaux->0->>'niveau') = '1';

UPDATE competences
SET niveaux = jsonb_set(
  niveaux, '{0,description}',
  to_jsonb($d$Le personnage possède les connaissances médicales nécessaires pour pratiquer des interventions chirurgicales complexes. Cette compétence permet de rattacher un membre sectionné, effectuer une greffe, retirer un parasite, extraire un corps étranger ou réaliser toute autre opération invasive nécessitant précision et matériel adéquat. Toute chirurgie exige des outils appropriés qui doivent avoir été vus avant le début de la fin de semaine, un éclairage convenable ainsi qu'un environnement calme et sécuritaire. L'intervention demande 5 minutes de préparation suivies de 10 minutes complètes d'opération en jeu, jouées de manière crédible. Cette compétence ne peut jamais être utilisée en situation de combat. Les éléments utilisés en chirurgie doivent être frais, c'est-à-dire séparés du corps depuis moins d'un cycle. Les greffes ne peuvent être réalisées qu'entre individus de la même race, sauf mention contraire. Pour les règles complètes concernant les membres sectionnés, leur récupération et leur conservation, voir page 6.$d$::text)
)
WHERE categorie = 'pretre' AND nom = 'Chirurgien'
  AND (niveaux->0->>'niveau') = '1';

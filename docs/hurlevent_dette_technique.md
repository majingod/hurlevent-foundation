# Hurlevent — Dette technique

> **Dernière mise à jour** : 22 mai 2026 (clôture session 26).

Document vivant qui liste les bugs connus, les dettes techniques, les
choses à revoir, les vestiges acceptables, et les apprentissages
méthodologie.

---

## 🐛 Bugs ouverts session 26 (3 nouveaux)

### Session 26 — `formule_magique` NULL en BD [HAUTE]

**Découvert** : session 26 (suivi de PR #137).

**Symptôme** : champ `personnage_sorts.formule_magique` est NULL en base pour tous les sorts achetés (testé sur Valerius). Affichage écran OK car conditionnel `{ps.formule_magique && ...}`, mais joueur ne voit jamais la formule à incanter.

**Cause racine** : RPC `acheter_sort` ne prend pas paramètre `p_formule_magique`, et le wizard Etape6 ne propose pas non plus d'input pour la saisir.

**Solution** :
1. Ajouter paramètre `p_formule_magique TEXT` à `acheter_sort` (avec validation longueur min/max)
2. Ajouter input texte au wizard `Etape6_Sorts_V2.tsx` (champ libre, exemple manuel)
3. Régénérer types Supabase

**Effort** : M (1 migration RPC + 1 input wizard + types).

**Cible** : session 27, priorité 1.

---

### Session 26 — Asymétrie écran/impression Prières [MOYENNE]

**Découvert** : session 26 (audit calcul PS dans PR #137).

**Symptôme** : dans `PersonnageFiche.tsx`, le `TabsContent` "Prières" n'affiche PAS le coût PS, contrairement à `handlePrint` qui le calcule via `calculerCoutPS(calculerCoutXP(...))`.

**Solution** : ajouter badge PS dans la card de chaque prière du TabsContent (pattern identique à TabsContent Sorts).

**Cible** : `artifacts/arlor/src/pages/PersonnageFiche.tsx`.

**Effort** : S (1 fichier, ~5 lignes).

**Cible** : session 27, priorité 2.

---

### Session 26 — Naming `cout_xp_base` trompeur [FAIBLE]

**Découvert** : session 26 (analyse PR #138).

**Constat** : le champ `sorts.cout_xp_base` et `prieres.cout_xp_base` est en fait un **coefficient multiplicateur** (×0.5, ×1.0, ×1.5 selon manuel 2026), pas un "coût". Source de confusion historique qui a contribué aux bugs C et E de PR #138.

**Solution** : renommer en `coefficient_multiplicateur`. Migration cross-tables (sorts, prieres) + RPC (`acheter_sort`, `acheter_priere`, helper `calculer_cout_xp_magie`) + vues exposant le champ.

**Effort** : L (grosse migration coordonnée + types).

**Cible** : session 28+, à programmer hors urgence.

**Tolérable** car helper SQL `calculer_cout_xp_magie` créée session 26 clarifie l'usage côté backend.

---

## ✅ DETTES RÉSOLUES SESSION 26

### Bug #4 — Étape sorts divins sautée ✅ RÉSOLUE

**Découvert** : session 24.

**Cause racine identifiée session 26** : 5 bugs interconnectés.
- (A) Frontend `Etape7_Prieres_V2.tsx` : condition `&& estCroyant` bloquait skip silencieux pour Non croyants
- (B) RPC `acheter_priere` : check `religion_id` bloquait TOUS les achats (121/121 prières ont `religion_id` NULL)
- (C) RPC `acheter_priere` : calcul XP via `CEIL(cout_xp_base brut)` au lieu de la formule complète
- (D) RPC `valider_etape_7` : check religion identique à B
- (E) RPC `acheter_sort` : même bug calcul XP que C

**Fix** : migration `20260523000824_fix_magie_helper_calcul_xp_check_religion` (PR #138) + frontend Etape7 (retrait `&& estCroyant`).

**Bonus découvert** : race condition useEffect skip dans Etape7 (cause indirecte du skip silencieux). Fixé par PR #139.

**Validation** : Acquisition de Domaine selon manuel 2026 = "Linguistique et Mathématique" UNIQUEMENT (pas de religion). Cohérent avec le fix.

---

### Audit calcul PS conforme manuel ✅ RÉSOLUE (partiellement)

**Découvert** : session 25.

**Cause racine** : `calculerCoutPS(sort.cout_xp_base)` utilisait le coefficient brut au lieu d'appliquer la formule `(zone+portée+durée+niveau)·base`.

**Fix** : PR #137 wrapping `calculerCoutPS(calculerCoutXP(...))` dans `PersonnageFiche.tsx` (TabsContent Sorts écran + handlePrint).

**Validation prod** Valerius : Altération du Corps niv 5 → 3 PS correct (avant : 1 PS).

**Reste ouvert** : asymétrie écran/impression Prières (badge PS manquant côté TabsContent) — voir nouvelle dette ci-dessus.

---

## ✅ DETTES RÉSOLUES SESSION 25

### Bug #8 — TabsList scrollable mobile ✅ RÉSOLUE

**Découvert** : session 24.

**Fix** : PR #135 (wrapper `overflow-x-auto -mx-2 px-2` + retrait override `grid grid-cols-8`).

**Validation prod** Valerius : 8 onglets lisibles mobile, swipe horizontal OK.

---

### Bug Traits raciaux vides ✅ RÉSOLUE

**Découvert** : session 25 (durant test PR #135).

**Cause racine** : `vue_fiche_personnage.traits_raciaux_choisis` retournait le JSONB brut `[{trait_id, xp_depense, est_gratuit}]`. Le frontend castait en `Trait[]` et accédait à `trait.nom` (undefined) → cards vides.

**Fix** : PR #136 (migration `20260522211910_enrichir_vue_fiche_personnage_traits_raciaux`) — enrichissement de la vue via `LEFT JOIN traits_raciaux`. Format retourné `[{id, nom, description, cout_xp, xp_depense, est_gratuit}]`.

**Asymétrie acceptée** : table = brut (write), vue = enrichi (read).

---

## 🐛 Bugs ouverts session 25 (1 restant)

### Compétences gratuites : tri non-prioritaire + badge sans source [MOYENNE]

**Découvert** : session 25.

**Symptôme** : Sur `PersonnageFiche` et `Etape11`, les compétences gratuites sont mélangées dans la liste. Le badge "Gratuit" n'indique pas la source (classe ? race ? religion ?).

**Solution** : `ORDER BY est_gratuit DESC, categorie, nom` + badge enrichi "Gratuit (classe Mage)" / "Gratuit (race Drow)".

**Fichiers** : possiblement `vue_competences_personnage` (ajouter source), `PersonnageFiche.tsx`, `Etape11_Recapitulatif_V2.tsx`, `Etape5_Competences_V2.tsx`.

**Effort** : M.

**Cible** : session 27.

---

### #2 — Langues "L'Ancien*" mal placées dans menu Langue supplémentaire [HAUTE]

**Découvert** : session 24, par test fonctionnel.

**Symptôme** : le menu déroulant de la compétence "Langue supplémentaire" affiche actuellement :
- Le Drow ✓ (correct)
- L'Elfique ✓
- Le Nain ✓
- L'Orc ✓
- **L'Ancien** ❌ (n'existe pas du tout — à supprimer)
- **L'Ancien Commun** ❌ (déplacer vers Décryptage)
- **L'Ancien Démoniaque** ❌
- **L'Ancien Drow** ❌
- **L'Ancien Elfique** ❌
- **L'Ancien Nain** ❌

Les langues anciennes sont pour la compétence "Décryptage", pas "Langue supplémentaire".

**Solution** : data fix DB. Soit DELETE des 6 entrées mal placées, soit UPDATE d'un champ catégorie/scope. À investiguer (table `langues` probable + relation avec compétences).

**Effort** : S (data fix), mais nécessite inspection préalable du modèle.

**Cible** : session 25, priorité 3.

---

### #1 — Alchimie étape 8 : cases payantes pas grisées [MOYENNE]

**Découvert** : session 24.

**Symptôme** : sur étape 8 (artisanat), le quota de recettes gratuites est affiché (ex. 4/5 restant). Mais les boutons "Acheter (X XP)" sont actifs même quand le quota gratuit n'est pas épuisé. Devraient être grisés tant que quota gratuit > 0.

**Aussi** : empêcher décocher un choix gratuit si quota plein et déjà des payants sélectionnés (sinon état incohérent).

**Pattern à reprendre** : Traits raciaux (déjà implémenté précédemment).

**Cible** : `Etape8_Artisanat_V2.tsx`.

**Effort** : M.

---

### #3 — Assemblages runes étape 9 : cases payantes pas grisées [MOYENNE]

**Découvert** : session 24.

**Symptôme** : identique à #1, sur étape 9 (assemblages de runes). Quota gratuit 2/2 affiché, mais boutons "Acheter" actifs.

**Solution** : même pattern que #1 et que Traits raciaux.

**Cible** : `Etape9_Assemblages_V2.tsx`.

**Effort** : M.

---

### #5 — UUID affichés au lieu de noms en étape 11 [MOYENNE]

**Découvert** : session 24.

**Symptôme** : dans `Etape11_Recapitulatif_V2.tsx` section Compétences, on voit par exemple :
- "Langue supplémentaire (0dca7806-6956-4b56-9693-9a72311fe6c3)" au lieu de "Langue supplémentaire (Le Drow)"
- "Décryptage (073762ec-4a6a-4767-85ba-2adf33c9679d)" au lieu de "Décryptage (L'Ancien Drow)"

**Hypothèse** : la colonne `personnage_competences.choix_achat` stocke un UUID (référence vers `langues.id`) qui n'est pas dénormalisé en nom dans `vue_personnage_creation_complet`.

**Solution** :
- Soit modifier la vue agrégée pour joindre et résoudre les UUID → nom
- Soit faire le lookup côté frontend (mais lourd)

**Cible** : `vue_personnage_creation_complet` (JSONB `competences` hydraté).

**Effort** : S-M.

---

### #6 — Dev Spirituel × N : grouper sur 1 ligne en étape 11 [FAIBLE]

**Découvert** : session 24.

**Symptôme** : en étape 11, si le joueur a acheté 5x "Développement Spirituel" (2 XP chacun), c'est affiché sur 5 lignes distinctes. Idem pour "Développement Spirituel Supérieur" (4 XP chacun).

**Comportement souhaité** : 1 seule ligne par compétence multiniveau, avec count + XP unitaire + XP total.

Exemple :
```
Développement Spirituel        × 5    2 XP / 10 XP total
Développement Spirituel Supérieur  × 5    4 XP / 20 XP total
```

**Cible** : `Etape11_Recapitulatif_V2.tsx` section Compétences.

**Effort** : S.

---

### #7 — Étape 11 + version imprimable : descriptions complètes manuel [MOYENNE]

**Découvert** : session 24.

**Demande Fred** : "chaque composant que ce soit la race, les traits raciaux, les competences, les recettes, les sorts Arcane ou divin, les assemblages de rune, les pièges, etc, bref tout, cest qu'il montre toute les informations les concernant comme dans le manuel des règles".

**Périmètre** :
- Étape 11 (`Etape11_Recapitulatif_V2.tsx`) doit afficher descriptions complètes
- Version imprimable (`PersonnageFiche.handlePrint()`) → déjà très complète mais à vérifier
- `PersonnageFiche` Tabs onglets : §2 a couvert Sorts/Prières/Artisanat ; **MANQUE descriptions des compétences elles-mêmes** (oubli §2 — à compléter)

**Travail** :
- Vérifier que `vue_personnage_creation_complet` JSONB hydratés contiennent les descriptions (probablement non actuellement)
- Migration de vue pour ajouter `description` aux JSONB de competences, sorts, prieres, etc.
- Régénérer types Supabase dans la même PR
- Mise à jour UI Etape11
- Mise à jour UI PersonnageFiche onglet Compétences (descriptions oubliées en §2)

**Effort** : L (gros chantier multi-fichiers + migration vue).

**Cible** : Sprint 5.6 §4 ou Sprint 5.7.

---

## 🔧 Dettes ouvertes pré-session 24 (inchangées)

### Bouton "Continuer/Modifier" basé sur `etape_creation` au lieu de `est_finalise`

**Découvert** : session 22.

(Voir notes session 22 pour détails.)

### Pas de script `lint` dans `artifacts/arlor/package.json`

**Découvert** : session 22.

### Mention obsolète "16 erreurs TS" dans `CLAUDE.md` (mini-PR docs)

**Découvert** : session 21.

### Cache CDN GitHub raw stale même avec `refs/heads/`

**Découvert** : session 22.

### FK `inscriptions_evenements.personnage_id` en `NO ACTION`

**Découvert** : session 22.

### Champ `est_actif` de `personnages` plus utilisé

**Découvert** : session 22.

### Bug onglet Artisanat de PersonnageFiche : Forge et Joaillerie absents

**Découvert** : session 24, signalé proactivement.

**À combiner** avec Sprint 5.6 §3 (même fichier `PersonnageFiche.tsx`).

### Mort code potentiel : `prieres.religion_id` (NEW session 26)

**Découvert** : session 26.

**Constat** : 100% NULL sur 121 lignes. Plus utilisée par aucune RPC depuis session 26 (PR #138 retire les checks religion). Candidate à `ALTER TABLE prieres DROP COLUMN religion_id`.

**Effort** : S (1 migration + régénération types).

---

## 🎓 Apprentissages méthodologie session 26

### NOUVEAU — Helper SQL miroir du frontend

Quand une formule de calcul existe en frontend (`@/utils/calculsMagie.ts`) ET doit être appliquée par RPC backend, créer une **helper SQL miroir** plutôt que dupliquer inline. Pattern `calculer_cout_xp_magie(zone, portée, durée, niveau, base)` avec CASE statements hardcodés.

Avantages : single source of truth backend, tests BEGIN/ROLLBACK simples (7/7 cas validés), refactor futur simplifié.

### NOUVEAU — Race condition useEffect skip vs query enabled conditionnel

Quand `enabled: !!personnageId && conditionsRemplies`, le useEffect skip peut déclencher AVANT que les queries prérequis (calculant `conditionsRemplies`) ne finissent. La query conditionnelle est désactivée → `isLoading = false` → garde ineffective.

**Solution** : `if (loadingPrerequis1 || loadingPrerequis2) return;` AVANT `if (loadingQueryConditionnelle) return;`.

Manqué dans PR #138, fixé par PR #139.

### CONFIRMATION — Prod first pour bugs DB urgents

PR #138 : migration appliquée en prod via MCP avant commit .sql, après tests BEGIN/ROLLBACK 7/7 + run prod manuel. Documentation rattrapée immédiatement. Pratique reste safe quand validation rigoureuse.

---

## 📊 Sessions consécutives Vercel auto-trigger : ABANDONNÉ session 25

(Plus de tracking depuis session 25.)

---

*Fin de hurlevent_dette_technique.md (clôture session 26).*

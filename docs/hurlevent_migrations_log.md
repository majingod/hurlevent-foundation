# Hurlevent — Migrations log

> **Dernière mise à jour** : 22 mai 2026 (clôture session 26).

Document qui trace toutes les migrations DB appliquées, leur contexte, et les apprentissages.

---

## Session 26 — Fix système magie (22 mai 2026)

**3 PRs frontend mergées** : #137 (calcul PS), #138 (système magie complet), #139 (race condition Etape7).

**1 migration DB** appliquée + **1 data fix** prod.

### Migration appliquée via MCP

**`20260523000824_fix_magie_helper_calcul_xp_check_religion.sql`** (PR #138)

#### Contexte

5 bugs interconnectés dans le système magie (sorts et prières) :
- (A) Frontend `Etape7_Prieres_V2.tsx` : condition `&& estCroyant` bloquait skip silencieux pour Non croyants
- (B) RPC `acheter_priere` : check `religion_id` bloquait TOUS les achats — toutes les 121 prières ont `religion_id` NULL en BD
- (C) RPC `acheter_priere` : calcul XP via `CEIL(cout_xp_base brut)` au lieu de la formule complète `(zone+portée+durée+niveau)·base`
- (D) RPC `valider_etape_7` : check religion identique à B
- (E) RPC `acheter_sort` : même bug calcul XP que C

**Constat data brut** : 0 prière jamais achetée en BD sur 121 disponibles. Système magie cassé depuis le début.

**Cohérence manuel 2026** : "Acquisition de Domaine" requiert "Linguistique et Mathématique" UNIQUEMENT (pas de religion). Confirme que les checks religion étaient erronés.

#### Diagnostic

1. Test fonctionnel Valerius (Mage, Drow) : badge "1 PS" affiché pour sort Altération du Corps niv 5 → suspicion calcul incorrect
2. Inspection `calculerCoutPS` frontend + RPC `acheter_sort` : confirmation que la base brute était utilisée au lieu du XP total
3. Test BEGIN/ROLLBACK acheter_priere sur perso Non croyant : erreur "personnage_non_croyant"
4. Inspection 121 prières : 100% `religion_id` NULL → check religion = bug systémique
5. Comparaison manuel 2026 : pas de religion requise pour Acquisition de Domaine
6. Tests BEGIN/ROLLBACK helper SQL : 7/7 cas validés
7. Run prod manuel avec session simulée (joueur Fred) : achat acheter_priere Non croyant réussi (2 XP pour Alerte du Danger niv 1)

#### Migration appliquée

**Nouvelle helper SQL** `calculer_cout_xp_magie(zone, portée, durée, niveau, base)` mirror exact du frontend `@/utils/calculsMagie.ts` et `@/constants/magie.ts`. CASE statements hardcodés pour COUT_ZONE/PORTEES/DUREES.

**Signature** :
```sql
CREATE OR REPLACE FUNCTION public.calculer_cout_xp_magie(
  p_zone TEXT,
  p_portee TEXT,
  p_duree TEXT,
  p_niveau INTEGER,
  p_base NUMERIC
) RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_cout_zone INTEGER;
  v_cout_portee INTEGER;
  v_cout_duree INTEGER;
BEGIN
  -- CASE p_zone, p_portee, p_duree (valeurs hardcodées mirror constants/magie.ts)
  RETURN CEIL((v_cout_zone + v_cout_portee + v_cout_duree + p_niveau) * p_base);
END;
$$;
```

**RPCs corrigées** :
1. `acheter_sort` : utilise helper, retire calcul inline incorrect
2. `acheter_priere` : utilise helper + retire check religion
3. `valider_etape_7` : retire check religion (était un blocage parallèle)

#### Tests BEGIN/ROLLBACK

7 cas validés via MCP :
- Test 1 : zone Personnelle, portée Toucher, durée Instant, niv 1, base 1.0 → 4 XP ✅
- Test 2 : zone Personnelle, portée Toucher, durée 5 Min, niv 5, base 1.0 → 9 XP ✅
- Test 3-6 : variations zone/portée/durée croisées → conformes manuel ✅
- Test 7 : acheter_priere Non croyant + Acquisition de Domaine → réussi, 2 XP ✅

#### Data fix Valerius (hors migration)

Sort "Altération du Corps" de Valerius avait été acheté avec calcul incorrect (1 XP au lieu de 9). Data fix appliqué via MCP execute_sql :
- `historique_xp.montant` : -1 → -9 (id `78a2f80e-cf2c-4735-aa4a-7df86e18491d`)
- `personnage_sorts.xp_depense` : 1 → 9 (id `203b84b3-6379-4f34-97c2-3411dc2ba405`)
- Trigger `trg_sync_xp_personnage` recalcule auto `personnages.xp_depense` : 181 → 189
- `xp_dispo` Valerius : 1529 → 1521

### PR #139 — Race condition useEffect Etape7 (frontend pur)

**Pas de migration DB**. Mais bug subtil découvert APRÈS merge PR #138 lors du test de Fred avec un nouveau perso "Test" (Mage + Acquisition de Domaine).

**Symptôme** : au click "Continuer la création" depuis tableau de bord, l'étape 7 est sautée silencieusement avec toast d'avertissement `info_domaine_sans_priere`. L'utilisateur arrive directement à l'étape 9.

**Cause racine** : race condition useEffect skip. Au premier mount (arrivée via "Continuer la création", queries fraîches sans cache) :
1. `loadingPersonnage = true` + `loadingAcquisition = true` (queries en cours)
2. `niveauAcquisition = 0` par défaut → `conditionsRemplies = false`
3. Query `domainesDisponibles` désactivée (`enabled: conditionsRemplies` = false)
4. `loadingDomaines = false` (non-enabled ≠ loading)
5. `domainesAffiches.length = 0` (donnée pas encore arrivée)
6. useEffect skip déclenche `avancerMutation` 💥

**Fix** : ajouter 2 gardes dans le useEffect :
```ts
if (loadingPersonnage || loadingAcquisition) return;
if (!conditionsRemplies) return;
```
+ ajout de ces variables dans deps array.

**Pourquoi Etape6/Etape8 ne souffrent pas** : leurs queries principales utilisent `enabled: !!personnageId` (simple, toujours enabled au mount), donc `loadingCercles`/`loadingQuotas = true` au premier render → la garde `if (loading) return;` couvre le cas.

### Apprentissages session 26

1. **Helper SQL miroir frontend** : pattern validé, single source of truth backend. À reproduire pour autres formules dupliquées (xp recettes, xp assemblages).

2. **Race condition useEffect vs query enabled conditionnel** : nouvelle règle implicite. Quand `enabled: ... && X`, ajouter gardes sur les queries calculant X.

3. **Prod first valide pour bugs DB urgents** : MCP `apply_migration` en prod + tests BEGIN/ROLLBACK + 1 run prod manuel = workflow safe quand validation rigoureuse en amont.

4. **Data fix idempotent dans la même session** : Valerius corrigé immédiatement après PR #138. Trigger `sync_xp_personnage` cascade auto = pas besoin de fix manuel sur `personnages.xp_depense`.

5. **Bug subtil peut survivre à un fix partiel** : PR #138 a fixé la condition `&& estCroyant` mais pas la race. PR #139 nécessaire après test fonctionnel. Confirme l'importance du test post-merge (règle #10 diagnostic).

### Dette ouverte / fermée

- **Fermée** :
  - Bug #4 — Étape sorts divins sautée (cause racine = 5 bugs interconnectés)
  - Audit calcul PS (partiellement — TabsContent Prières reste asymétrique)

- **Ajoutée** (3 nouveaux findings) :
  - `formule_magique` NULL en BD (HAUTE)
  - Asymétrie écran/impression Prières (MOYENNE)
  - Naming `cout_xp_base` trompeur (FAIBLE)
  - Mort code potentiel `prieres.religion_id` (à évaluer)

---

## Session 25 — Vue traits enrichie (22 mai 2026)

**2 PRs mergées** : PR #135 (Bug #8 TabsList), PR #136 (Bug Traits vides).

### Migration appliquée via MCP

**`20260522211910_enrichir_vue_fiche_personnage_traits_raciaux.sql`** (PR #136)

### Migration : `20260522211910_enrichir_vue_fiche_personnage_traits_raciaux`

**Objectif** : résoudre le bug session 25 finding 1 — onglet Traits vide sur PersonnageFiche.tsx.

**Cause racine** : `vue_fiche_personnage.traits_raciaux_choisis` retournait le JSONB brut `[{trait_id, xp_depense, est_gratuit}]`. Le frontend castait `as Trait[]` et accédait à `trait.nom` (undefined) → cards vides.

**Solution** : `CREATE OR REPLACE VIEW vue_fiche_personnage` avec enrichissement via `LEFT JOIN traits_raciaux` dans un sous-SELECT `jsonb_agg(jsonb_build_object(...))`. Format retourné : `[{id, nom, description, cout_xp, xp_depense, est_gratuit}]`.

---

## Session 24 — Bugfix XP de GN initiaux (22 mai 2026)

**1 PR à pousser** : `chore-update-docs-session-24` (combinée avec ajout fichier .sql + update docs/dette + update docs/log).

**1 PR frontend mergée** : PR #133 — Sprint 5.6 §2 (`PersonnageFiche.tsx` descriptions feuille finale). Pure UI, **pas de migration DB**.

### Migration appliquée via MCP

**`20260522174852_bugfix_calcul_xp_niveau_gn_initiaux.sql`**

#### Contexte

Bug systémique ancien révélé par test fonctionnel du PR #133. La fonction `sauvegarder_etape_1` enregistrait `gn_completes`, `mini_gn_completes`, `ouvertures_terrain` mais aucun mécanisme DB ne convertissait ça en XP. La fonction `recalculer_xp_personnage` calculait `xp_total = race.xp_depart + Σ(historique_xp +)` en ignorant complètement les colonnes GN. Au choix de race à l'étape 2, le trigger `set_xp_initial_on_race_change` écrasait `xp_total` avec `race.xp_depart` seul → tous les XP de GN initiaux disparaissaient.

C'est exactement la cause de la dette session 22 "Valerius sans `historique_xp`" : pas une absence d'entrées historiques, mais une **conséquence cascade** d'un xp_total faussement bas qui rendait l'historique XP de Valerius cohérent uniquement avec son `xp_depart` de race.

#### Diagnostic

Étapes session 24 :
1. Test fonctionnel : Fred crée perso "Valerius", entre 111 GN → étape 1 affiche XP 1665. Passe à étape 2 → XP retombe à 0.
2. `SELECT` en BD → `gn_completes=111, xp_total=0, niveau=1` (devraient être 1665+ et 112)
3. Inspection RPC `sauvegarder_etape_1` : update gn_completes mais aucune autre logique XP
4. Inspection RPC `recalculer_xp_personnage` : formule = `race.xp_depart + Σ(historique +)` (ignore les colonnes GN)
5. Inspection trigger `set_xp_initial_on_race_change` : pareil
6. Inspection CHECK constraint `historique_xp.type_mouvement` : aucun type "gain_gn_initial" → confirme que le design n'a jamais prévu d'écrire les XP de GN dans historique_xp

#### Solutions évaluées

- **Sol A (choisie)** : calcul dérivé direct des colonnes `personnages` dans toutes les RPC/triggers. Simple, 1 migration, aucun changement de schema.
- **Sol B** : ajouter un nouveau type `gain_gn_initial` au CHECK + écriture dans historique_xp via `sauvegarder_etape_1`. Plus cohérent doctrinalement mais plus complexe (gestion UPDATE).
- **Sol C** : réutiliser type `gain_correction`. Mélange sémantique malheureux.

#### Migration appliquée

5 changements en un seul fichier .sql :

1. **`recalculer_xp_personnage`** refactorée : ajoute `+ 15·gn + 15·mini + 10·ouv` au calcul, retourne aussi `niveau = 1 + gn_completes`
2. **Nouvelle fonction trigger `recalculer_xp_complet_trigger`** : BEFORE INSERT OR UPDATE, calcule directement NEW.xp_total/xp_depense/niveau via les mêmes formules
3. **Remplacement triggers** : DROP `trg_set_xp_initial` → CREATE `trg_recalculer_xp_complet` BEFORE INSERT OR UPDATE OF (race_id, gn_completes, mini_gn_completes, ouvertures_terrain). Élargit la couverture des cas.
4. **`sync_xp_personnage`** modifiée : persiste aussi `niveau` (en plus de xp_total/xp_depense) quand un changement historique_xp survient
5. **DROP `set_xp_initial_on_race_change()`** : fonction obsolète
6. **Data fix idempotent** : `UPDATE personnages SET gn_completes = gn_completes` pour déclencher le nouveau trigger sur tous les persos existants

#### Tests BEGIN/ROLLBACK

3 scénarios validés avant apply :
- Test 1 : touch gn_completes (race=NULL) → xp_total=1665 ✅
- Test 2 : assignation race Humain (xp_depart=80) → xp_total=80+1665=1745 ✅
- Test 3 : modification gn_completes (111→5) → xp_total=80+75=155 ✅, niveau=6 ✅

#### Validation prod post-apply

Valerius (avant migration : xp_total=0, niveau=1) → après migration + data fix : **xp_total=1665, niveau=112** ✅. Choix de race Drow ultérieur (xp_depart=60) → **xp_total=1725, niveau=112** ✅, dont 262 dépensés via achats ultérieurs.

#### Formules finales

- `xp_total = race.xp_depart + 15·gn_completes + 15·mini_gn_completes + 10·ouvertures_terrain + Σ(historique_xp positifs)`
- `niveau = 1 + gn_completes`

### Découvertes-clés (apprentissages méthodologie)

1. **Le frontend mentait au joueur** : étape 1 affichait "XP DISPONIBLE 1665" comme un calcul provisoire frontend, mais aucune logique backend ne supportait cette promesse. À l'étape 2, l'affichage retombait à 0 → joueur perdait confiance. **→ Toujours faire correspondre les promesses UI aux mécanismes backend**.

2. **CHECK constraints comme indicateurs d'intention design** : l'absence d'un type `gain_gn_initial` dans la contrainte CHECK de `historique_xp` était la preuve que le design n'avait jamais prévu d'écrire les XP de GN initiaux dedans. **À utiliser comme méthode d'investigation** quand on hésite sur l'architecture intentionnelle.

3. **Dette technique vague = bug critique masqué** : "Valerius sans historique_xp - à investiguer" a dormi 2 sessions. Avec hypothèse explicite + impact estimé (data corruption silencieuse), aurait probablement été traité plus tôt.

4. **Test fonctionnel complet révèle ce que les revues de code ne voient pas** : aucune revue de PR n'aurait pu révéler ce bug. Il fallait créer un perso de A à Z. **À ajouter en règle méthodologie** : après chaque PR non-trivial, scénario de test complet en environnement de prod/staging.

### Dette ouverte / fermée

- **Fermée** :
  - "Valerius sans historique_xp" (la dette était vague, en réalité c'était ce bug systémique calcul XP)

- **Ajoutées** (8 nouveaux bugs détectés en testant) :
  - #1-#8 voir `hurlevent_dette_technique.md`

- **Bumpée** : Vercel auto-trigger preview branches → **20 sessions consécutives**. Toujours priorité haute.

---

## Session 23 — Sprint 5.6 §1 Voie C (21-22 mai 2026)

**5 PRs frontend mergées (#128 à #132)**. Pas de migration DB.

(Voir notes session 23 antérieures pour détails.)

---

## Session 22 — Clôture Sprint 5.5 + Hard delete personnages (22 mai 2026)

**2 PRs mergées** :
- PR #126 — Badge "Finalisé" tableau de bord (frontend + régénération types)
- PR #127 — Hard delete personnages → migration `20260522050242_hard_delete_persos_nettoyage_soft_deleted`

(Voir notes session 22 antérieures pour détails.)

---

## Sessions antérieures (résumé)

- Session 21 : Sprint 5.5 quick wins UX wizard (6 PRs)
- Session 20 : Sprint 5.4 audit `classes_requises` (PRs #115, #116)
- Session 19 : Sprint 5.3 re-migration Religions (PRs #112, #113)
- Session 18 : Sprint 5.2 sweep corrections data critiques (PR #111)
- Session 17 : Sprint 5.1 règle modif post-finalisation (PR #109)

---

*Fin de hurlevent_migrations_log.md (clôture session 26).*

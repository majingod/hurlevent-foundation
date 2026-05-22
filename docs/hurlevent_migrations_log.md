# Hurlevent — Migrations log

> **Dernière mise à jour** : 22 mai 2026 (clôture session 24).

Document qui trace toutes les migrations DB appliquées, leur contexte, et les apprentissages.

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

*Fin de hurlevent_migrations_log.md (clôture session 24).*

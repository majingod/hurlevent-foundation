# Hurlevent — Journal des migrations

Historique des sessions d'alignement et chantiers touchant `supabase/migrations/`.

### Session 6 — Chantier F4 closé (16 mai 2026)

- **Objectif** : aligner supabase/migrations/ avec les 33 entrées de schema_migrations
- **Résultat** : 34 fichiers dans le repo, 33 timestamps uniques + baseline, identiques à la base prod
- **Méthode** : reconstitution des SQL depuis schema_migrations.statements via MCP Supabase
- **Mergé via** : PR #92 avec bypass temporaire du check Supabase Preview
- **Dette créée** : `baseline_schema-regen` (voir hurlevent_dette_technique.md)
- **Branche archivée** : `chore-f4-aligner-migrations-repo-base` (poussée, non supprimée)

### Session 7 — Bug #21 retravaillé puis rollback DB (17 mai 2026)

- **Objectif initial** : aligner la DB avec le Manuel 2026 qui dit "Connaissances des Religions achetable plusieurs fois"
- **Migration appliquée via MCP** (`20260517182730_bug21_connaissances_religions_achetable_multiple`) :
  - Bascule `type_achat` : `unique_avec_choix` → `multiple_langue`
  - Génération de 2 messages dans la branche `multiple_langue` de `peut_acheter_competence` (étaient hardcodés "langue")
- **Pivot métier en cours de session** : Fred confirme que la règle réelle est "1 achat max + religion forcée si croyant", différente du Manuel
- **Migration de rollback appliquée via MCP** (`20260517191621_rollback_bug21_connaissances_religions_unique`) :
  - Rétablit `type_achat = 'unique_avec_choix'`
  - **Conserve volontairement** les 2 messages génériquées (valides pour `Langue supplémentaire` et `Décryptage`)
- **Résultat final DB** : `Connaissances des Religions` en `unique_avec_choix`, fonction `peut_acheter_competence` avec messages génériques
- **Dette créée** : MAJ Manuel 2026 + UUID brut dans message anti-doublon (voir `hurlevent_dette_technique.md`)
- **Branche abandonnée** : `claude/fix-bug21-religions-multiple-K5Hsk` (créée par Claude Code sur une base périmée, jamais mergée)

### Session 8 — Alignement repo/base post Bug #21 (17 mai 2026)

- **Objectif** : aligner `supabase/migrations/` avec les 2 nouvelles entrées en base (session 7)
- **Résultat** : 36 fichiers dans le repo (35 versionnés + baseline), identiques à la base prod
- **Méthode** : reconstitution des SQL depuis `schema_migrations.statements` via MCP Supabase (cf F4)
- **Constat phase B (fix frontend croyant → sa religion)** : déjà mergée via PR #91 (16 mai), aucun commit code nécessaire
- **Branche** : `claude/fix-bug21-religions-croyant-force` (alignement migrations + docs uniquement)

### Session 9 — UUID resolved + Phase 3.3a recherche lore (18 mai 2026)

- **Objectif** : améliorer un message d'erreur + ajouter recherche plein texte (phase 3.3a du plan directeur)
- **3 migrations appliquées via MCP** :
  - `20260518160244_peut_acheter_competence_uuid_resolved` (PR #97) — résolution UUID en nom lisible dans branches `multiple_langue` + `unique_avec_choix` (Langues, Décryptage)
  - `20260518192800_phase3_3a_recherche_lore_tsv_index` (PR #98) — generated column `lore.recherche_tsv` (pondération nom A > sous_titre B > description C > categorie D) + index GIN
  - `20260518192824_phase3_3a_rpc_rechercher_encyclopedie` (PR #98) — RPC avec `plainto_tsquery` + `ts_rank` + `ts_headline` (highlighting `<mark>`)
- **PRs mergées** : #96 (docs Vercel dette), #97 (UUID), #98 (recherche lore)
- **Migrations en base** : 38 entrées (37 versionnées + baseline)
- **Tests** : `rechercher_encyclopedie('hurlevent')` retournait correctement les lores matchants

### Session 10 — Phase 3.3b multi-tables (18 mai 2026)

- **Objectif** : étendre la recherche à bestiaire + religions + competences
- **2 migrations appliquées via MCP** :
  - `20260518193926_phase3_3b_recherche_encyclopedie_etend_3_tables` (PR #99) — generated columns `recherche_tsv` + index GIN sur `bestiaire`, `religions`, `competences`
  - `20260518193944_phase3_3b_recherche_encyclopedie_rpc_multi_tables` (PR #99) — refacto du RPC en UNION ALL pour 4 sources, signature de retour inchangée, type discriminant ajouté
- **PRs mergées** : #99 (Phase 3.3b), #100 (docs session 10)
- **Migrations en base** : 40 entrées (39 versionnées + baseline)
- **Dette créée** : routing frontend `RechercheSection` ne couvre que `lore` (à étendre aux 4 types)
- **Pattern confirmé** : ajouter une table = 1 ALTER + 1 INDEX + 1 SELECT dans UNION

### Session 11 — Phase 3.3c sorts+prieres + 2 fixes frontend (19 mai 2026)

- **Objectif** : compléter la Phase 3.3 (sorts + prières) + fermer la dette frontend de routing
- **3 migrations appliquées via MCP** :
  - `20260519183304_phase_3_3c_tsv_sorts_prieres` (PR #102) — generated columns `recherche_tsv` + index GIN sur `sorts` (135 actifs) et `prieres` (121 actifs)
  - `20260519183333_phase_3_3c_rpc_sorts_prieres` (PR #102) — RPC étendu UNION ALL à 6 sources, **version cassée** (alias `AS` manquants après UNION ALL → `ORDER BY rang` plante au runtime)
  - `20260519183412_phase_3_3c_rpc_sorts_prieres_fix_alias` (PR #102) — RPC v2 fonctionnelle, alias explicites partout
- **3 PRs mergées** :
  - **PR #101** — `fix(encyclopedie)` : table `RPC_TYPE_TO_TARGET` dans `Encyclopedie.tsx` route les 4 types (lore + bestiaire + religion + competence). Source unique de vérité pour section + URL tab + label badge.
  - **PR #102** — `feat(encyclopedie)` Phase 3.3c : 3 migrations + 2 entrées dans `RPC_TYPE_TO_TARGET` (sort + priere). RPC final retourne 6 types.
  - **PR #103** — `fix(encyclopedie)` : suppression du `useEffect [active] { setSearch("") }` qui vidait le filtre après navigation depuis recherche. Régression silencieuse latente depuis PR #98, invisible pour lore (peu d'items) mais évidente pour sorts/prières.
- **Migrations en base** : 43 entrées (42 versionnées + baseline)
- **Tests prod** : 5/5 — foudre → sorts+prières filtrés correctement, hurlevent → lore (régression check), clic manuel onglet → search clear.
- **Phase 3.3 complète** : recherche plein texte fonctionnelle sur 6 types.
- **Leçon clé pattern SQL** : pour `UNION ALL` avec `ORDER BY <colonne>` après, les alias `AS <colonne>` sont OBLIGATOIRES dans chaque SELECT, sinon plante au runtime (cf migration 42).
- **Leçon clé frontend** : Avant tout fix élaboré, confirmer l'environnement de test (preview vs prod) et le statut de merge de la PR.

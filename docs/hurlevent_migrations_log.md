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

### Session 9 — Dette UUID brut résolue (18 mai 2026)

- **Objectif** : résoudre la dette technique "peut_acheter_competence : UUID brut dans message anti-doublon" (priorité basse, ajoutée session 7)
- **Migration appliquée via MCP** (`20260518160244_fix_peut_acheter_competence_resoudre_uuid_choix_achat`) :
  - Variables locales ajoutées : `v_nom_lisible text`, `v_choix_existant text`
  - Branche `multiple_langue` : résolution UUID → nom lisible via tables `langues` et `religions` selon `v_competence.type_choix` ∈ {langue, langue_ancienne, religion}
  - Branche `unique_avec_choix` : mini-fix bonus, message "Déjà acquis" inclut le nom du choix existant si résolvable
  - Pattern CASE avec fallback sur la valeur brute
  - Comparaison `id::text = choix_achat` pour éviter le cast UUID (plus safe sur valeurs non-UUID)
- **Tests validés en prod via MCP `execute_sql`** :
  - Vilo + Connaissances des Religions déjà acquise → `"Déjà acquis : Les Éternels de Shen-Gon"`
  - Lyla + Décryptage avec L'Ancien Démoniaque déjà acquis → `"Vous avez déjà acquis \"L'Ancien Démoniaque\""`
- **Dette retirée** : `peut_acheter_competence : UUID brut dans message anti-doublon` (`docs/hurlevent_dette_technique.md`)
- **Branche** : `fix-uuid-resolution-peut-acheter-competence`

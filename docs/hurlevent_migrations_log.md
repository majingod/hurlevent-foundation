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

### Session 12 — Phase 3.3d sections_regles + régénération docs (19 mai 2026)

- **Objectif** : étendre la recherche plein texte à `sections_regles` (page Règles autonome) et régénérer les docs DB déphasées
- **1 migration appliquée via MCP** :
  - `20260519234138_phase_3_3d_sections_regles_recherche` — generated column `sections_regles.recherche_tsv` (pondération titre A > categorie B > contenu C) + index GIN + refactor RPC `rechercher_encyclopedie` en UNION ALL pour 7 sources, signature de retour inchangée, type discriminant `'regle'` ajouté
- **Mapping `'regle'`** : `titre = sr.titre`, `sous_titre = sr.categorie` (pour groupage UI), `categorie = 'regle'` (type uniforme, pattern aligné sur `religion`)
- **Frontend** — `Regles.tsx` : remplacement de la recherche `.includes()` locale par appel RPC plein texte en Mode 2 (recherche globale toutes catégories). Quand `recherche.length >= 2` : affichage des résultats avec snippet highlighting et badge catégorie. Clic = bascule onglet + scroll vers article.
- **Page Règles autonome** : pas de modification de `Encyclopedie.tsx` (Voie C — recherche locale isolée).
- **Migrations en base** : 44 entrées (43 versionnées + baseline)
- **Tests prod** : ÉCRIRE AU MOMENT DU MERGE (résultats des tests Fred)
- **Régénération docs project knowledge** : `hurlevent_schema_tables.md` + `hurlevent_fonctions_et_vues.md` régénérés depuis la base, dernière migration `20260519234138` couverte. Fichiers uploadés en project knowledge en clôture de session.
- **Dette technique ajoutée** : `bestiaire_categorie_check` trop restrictive (priorité basse).
- **Décisions de scope** : Phase 3.1 (messagerie), 3.2 (réputation) et 4.3 (tests utilisateurs externes) **supprimées** du plan directeur.

### Session 13 — Dette bestiaire + cleanup dette obsolète (20 mai 2026)

- **Objectif** : fermer 2 dettes basses identifiées en sessions 7 et 12
- **1 migration appliquée via MCP** :
  - `20260520020312_dette_bestiaire_categorie_check_elargie` (PR #106) — élargit la contrainte CHECK de `bestiaire.categorie` de `'mort_vivant'` seul à une liste de 7 catégories (`mort_vivant`, `animal`, `creature_magique`, `humanoide`, `demon`, `esprit`, `feerique`). Permet l'extension future du bestiaire sans nouvelle migration.
- **Cleanup dette obsolète** (PR #106) :
  - Découverte : l'entrée *peut_acheter_competence UUID brut* dans `docs/hurlevent_dette_technique.md` était **déjà résolue par PR #97** (session 9, migration `20260518160244`) mais l'entrée n'avait jamais été retirée. Dette fantôme depuis 4 sessions.
  - Entrée retirée du fichier dette dans la même PR.
- **PRs mergées** : #106 (dette bestiaire + cleanup), puis PR de cette clôture documentaire
- **Migrations en base** : 46 entrées (45 versionnées + baseline)
- **Nouvelle règle de collaboration** : règle #10 *Clôture dette en même commit* (méthodologie v6). Quand un PR ferme une dette, retirer l'entrée du fichier dette dans le même commit pour éviter les dettes fantômes.
- **Observation Vercel** : auto-trigger encore raté pour la branche `fix-dette-bestiaire-check-elargie`. 6e session consécutive (6, 7, 8, 10, 11, 13). Cause toujours inconnue.

### Session 14 — Régénération baseline + suppression migrations versionnées (20 mai 2026)

- **Objectif** : éliminer la dette `baseline_schema-regen` créée en session 6 pour permettre `supabase db reset` et réactiver le check Supabase Preview obligatoire
- **Méthode** :
  - Nouveau `pg_dump --schema-only` propre de la prod via `pg_dump 17.10` (compatible prod 17.6)
  - Cleanup du dump : retrait des directives `\restrict` / `\unrestrict` (psql 17 only), `CREATE SCHEMA public` → `CREATE SCHEMA IF NOT EXISTS public`
  - Remplacement de `00000000000000_baseline_schema.sql` par le nouveau dump (8889 lignes, 422 KB)
  - Suppression des 45 fichiers de migrations versionnées (`202604*` + `202605*`) — historique préservé via `git log`
- **Stats dump** : 41 tables, 71 fonctions, 32 vues, 43 indexes, 21 triggers, 85 policies, 41 RLS enabled
- **Cleanup prod** (à faire post-merge via MCP Supabase) : `DELETE FROM supabase_migrations.schema_migrations WHERE version != '00000000000000';` — réduit la table de 46 → 1 entrée pour aligner avec le repo
- **Dette fermée** : `baseline_schema-regen` (créée session 6)
- **Branche** : `chore-baseline-schema-regen-session14`

---

## Session 17 — Sprint 5.1 Voie Z modification post-finalisation (20 mai 2026)

**PR #109** — `feat-sprint-5-1-modif-post-finalisation` → `main`, mergée en squash (commit `9c1751b`).

### Contexte

Implémentation de la règle métier "modif post-finalisation" actée session 15 (architecture Voie Z). Permet à un joueur de modifier son personnage finalisé tant qu'aucun événement n'a confirmé son inscription, sans casser l'override admin manuel.

### Migration appliquée

`20260520213653_phase_5_1_modif_post_finalisation.sql` (1910 lignes, 87 KB, 18 objets DB) :

- **Colonne ajoutée** : `personnages.est_finalise boolean NOT NULL DEFAULT false`
- **Backfill** : `UPDATE personnages SET est_finalise = est_verrouille` (5 persos finalisés en base)
- **Fonction créée** : `personnage_est_modifiable(uuid) → boolean`
  - Logique : `NOT est_verrouille OR (est_finalise AND NOT EXISTS inscription confirmée)`
  - "Inscription confirmée" = `inscriptions_evenements.date_confirmation IS NOT NULL` (la colonne `statut` ne contient pas `'confirmee'`)
- **17 RPC refactorées** pour consulter `personnage_est_modifiable` :
  - 5 `sauvegarder_etape_{1,2,3,4,10}`
  - 8 `acheter_{assemblage, competence, objet_forge, objet_joaillerie, priere, recette, sort, trait_racial}`
  - `desacheter_competence`, `avancer_etape`, `peut_acheter_competence`
  - `valider_personnage_final` (set aussi `est_finalise = true`)
- Code d'erreur `personnage_verrouille` conservé (compat front), message amélioré.

### Validation

Tests prod en BEGIN/ROLLBACK + JWT simulé (6 scénarios, 3 RPCs représentatifs × cas positifs + 2 négatifs) :

| # | Scénario | RPC | Résultat |
|---|---|---|---|
| 1 | Finalisé + 0 inscription | `acheter_competence` | ✅ succès, 4 XP dépensés |
| 2 | Admin lock (verrouille sans finalise) | `acheter_competence` | ✅ bloqué `personnage_verrouille` |
| 3 | Finalisé + inscription confirmée | `acheter_competence` | ✅ bloqué `personnage_verrouille` |
| 4 | Finalisé + 0 inscription | `sauvegarder_etape_1` | ✅ succès, modif appliquée |
| 5 | Finalisé + inscription confirmée | `sauvegarder_etape_1` | ✅ bloqué `personnage_verrouille` |
| 6 | Finalisé + 0 inscription | `desacheter_competence` | ✅ succès, 12 XP remboursés |

Toutes transactions roll-backées — aucune donnée modifiée en prod.

Tests frontend sur preview Vercel (manuel — auto-trigger toujours cassé) : OK.

### Frontend

**Aucune modification.** Le bouton "Modifier le personnage" du tableau de bord (`TableauDeBord.tsx`) est un pur `<Link>`, sans appel DB. Le fix du bug section 7 du backlog wizard est entièrement causé par le refactor des gardes côté DB.

### Effets de bord positifs

- **Supabase Preview vert sur PR #109** pour la première fois depuis plusieurs sessions. Probable conséquence positive de la régénération baseline de la PR #108 (session 14). À confirmer sur 2-3 PRs supplémentaires avant de réactiver le check obligatoire.
- **Bug section 7 du backlog wizard** : fermé automatiquement.

### Dette ouverte / fermée

- **Inversée** : entrée "Connaissances des Religions" (`docs/hurlevent_dette_technique.md`) — désormais "Aligner DB sur Manuel 2026" (manuel à jour édition 6 mai, DB/frontend obsolètes), à corriger Sprint 5.3.
- **Bumpée** : Vercel auto-trigger preview branches → 8 sessions consécutives.

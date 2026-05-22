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

---

## Session 18 — Sprint 5.2 Sweep corrections data critiques (21 mai 2026)

**Fichier** : `supabase/migrations/20260521030004_phase_5_2_sweep_corrections_data_critiques.sql`

**Phase** : 5.2 — Sweep corrections data critiques (alignement Manuel des règles 2026, édition 6 mai 2026)

**Objectif** : 6 corrections d'alignement entre la base prod et le manuel officiel, regroupées dans une seule migration idempotente.

**Tables touchées** :
- `categories_creatures` (2 UPDATE) — Nature → Forêt, Profondeurs → Souterrains
- `competences` (2 UPDATE jsonb) — ajout prérequis pour Herbes Rares et Métaux rares
- `effets_combat` (1 INSERT) — "Sans âme" (type=`mort`, première entrée légitime de ce type ; description verbatim du manuel p.5)
- `sorts` (1 UPDATE) — Inspiration spirituel : ajout paragraphe sur objets magiques/parchemins (985 → 1351 chars)
- `assemblages_runes` (1 UPDATE) — Assemblage de durabilité : description verbatim manuel (94 → 703 chars)

**Idempotence** : tous les `WHERE` filtres garantissent qu'une 2e exécution = no-op (UPDATE conditionnels, INSERT WHERE NOT EXISTS).

**Validation prod** : 12 checks SELECT exécutés post-migration, tous au vert.

**Découverte de session** : la table cible pour "Sans âme" était initialement `sections_regles` dans le backlog ; correction faite vers `effets_combat` après inspection de l'interface frontend (capture Fred). La CHECK constraint `effets_combat_type_check` accepte déjà `'mort'` — usage légitime au lieu de devoir ALTER la contrainte.

## Session 19 — Sprint 5.3 Renommage `multiple_choix_distinct` + multi-achat Religions (21 mai 2026)

**PR #112** (Sprint 5.3 principal) — `feat-sprint-5-3-multiple-choix-distinct-religions-multiple` → `main`.
**PR #113** (hotfix) — `fix-religions-dropdown-croyants-filtre-doublon` → `main`.

### Contexte

Alignement DB et frontend avec le Manuel des règles 2026 (édition 6 mai 2026) qui spécifie que `Connaissances des Religions` est achetable plusieurs fois, avec un choix de religion distinct à chaque achat (modèle similaire à `Langue supplémentaire`).

### Migration appliquée

`20260521041428_phase_5_3_renommage_multiple_choix_distinct_et_religions_multiple.sql` :

- **Renommage CHECK + UPDATE** : `type_achat = 'multiple_langue'` → `'multiple_choix_distinct'` (CHECK constraint mise à jour, valeurs migrées).
- **Bascule data** : `Connaissances des Religions` passe de `unique_avec_choix` à `multiple_choix_distinct` + `type_choix = 'religion'`.
- **Refactor `peut_acheter_competence`** : branche `multiple_langue` renommée `multiple_choix_distinct`, conserve la logique anti-doublon basée sur `personnage_competences.choix_achat`. Résolution UUID → nom lisible étendue à la branche `religion`.
- **Code mort documenté** : la branche `unique_avec_choix` reste fonctionnelle dans `peut_acheter_competence` (aucune compétence ne l'utilise après Sprint 5.3, conservée dans CHECK pour usage futur).

### Frontend (PR #112 + #113)

- **PR #112** : renommage cohérent dans plusieurs composants React (`PersonnageNouveau*`, `usePersonnageEdit`, `useCompetenceAchat`, etc.) — `multiple_langue` → `multiple_choix_distinct`.
- **PR #113** (hotfix immédiat post-merge #112) :
  - Dropdown religion ouvert aux croyants (et non plus seulement non-croyants) pour permettre l'achat de connaissances sur d'autres religions que la sienne.
  - Filtre anti-doublon côté UI : religion déjà sélectionnée → grisée dans la liste.

### Validation

- Tests prod via MCP `execute_sql` (scénarios sur Vilo + Lyla) — ✅
- Tests frontend sur preview Vercel (manuel — auto-trigger toujours cassé) — ✅

### Découvertes-clés

1. **`unique_avec_choix` désormais orphelin** — branche conservée dans le code (defensive coding) au cas où une future compétence en aurait besoin.
2. **Vercel manuel encore requis** sur les 2 PRs — 2 sessions supplémentaires bumpées au compteur cumulé (sessions 18 + 19).
3. **Consécration religion** distincte de la compétence : gérée par `personnages.religion_id` + `est_croyant`, indépendante de `Connaissances des Religions`.

### Dette ouverte / fermée

- **Fermée** : "Aligner DB sur Manuel 2026" (Connaissances des Religions) — confirmée résolue.
- **Bumpée** : Vercel auto-trigger preview branches → **10 sessions consécutives** (cf `docs/hurlevent_dette_technique.md`).

## Session 20 — Sprint 5.4 Audit `classes_requises` (21 mai 2026)

**3 PRs mergées dans la session** :

- **PR #114** (Étape 0) — `docs/cloture-session-19` : docs ajout entrée Session 19 + bump compteur Vercel 8 → 10.
- **PR #115** (Sprint 5.4 Phase A) — `feat/sprint-5-4a-classes-requises-6-evidents` → migration `20260521071345_phase_5_4a_classes_requises_6_evidents`.
- **PR #116** (Sprint 5.4 Phase C) — `feat/sprint-5-4b-grande-messe-prereq` → migration `20260521073247_phase_5_4b_grande_messe_prereq_connaissances_religions`.

### Contexte

Bug DB détecté session 15 : ~50 compétences ont `categorie ∈ {guerrier, voleur, mage, pretre}` mais `classes_requises = NULL`, permettant à des persos d'autres classes d'acheter des compétences réservées.

### Migrations appliquées

#### `20260521071345_phase_5_4a_classes_requises_6_evidents.sql` (PR #115)

6 compétences passées en `classes_requises = ['guerrier']` ou `['voleur']`, alignées sur les prereqs classe explicites du Manuel 2026 :

| Compétence | `classes_requises` | Manuel |
|---|---|---|
| Bonne santé | `['guerrier']` | L.1727 "Prérequis : Guerrier" |
| Défense Inflexible | `['guerrier']` | L.1926, 1940 "(Prérequis : Guerrier)" |
| Discours du Commandement | `['guerrier']` | L.1957 "Prérequis : Guerrier" |
| Poids Lourd | `['guerrier']` | L.2034 "Prérequis : Guerrier" |
| Cachette secrète | `['voleur']` | L.2206 "Prérequis : Voleur" |
| Fouille rapide | `['voleur']` | L.2337 "Prérequis : Voleur" |

Idempotence garantie par `AND classes_requises IS NULL`.

#### `20260521073247_phase_5_4b_grande_messe_prereq_connaissances_religions.sql` (PR #116)

Alignement du texte display `niveaux[i].prerequis` de Grande Messe sur ce que le moteur vérifie réellement via `prerequis_competences` :

| Niveau | Avant | Après |
|---|---|---|
| 1 | `"Religion"` | `"Connaissances des Religions"` |
| 2 | `"Grande Messe 1"` | `"Connaissances des Religions, Grande Messe 1"` |
| 3 | `"Grande Messe 2"` | `"Connaissances des Religions, Grande Messe 2"` |

Idempotence via `AND niveaux->0->>'prerequis' = 'Religion'`.

### Découvertes-clés

1. **Règle "niveau max 2 hors-classe" déjà implémentée** dans `peut_acheter_competence`. Donc `classes_requises = NULL` n'implique PAS accès illimité — limite niveau 2 hors-classe automatique. Sprint 5.4 = pur audit data.
2. **Phase A exhaustive** : grep complet du manuel a confirmé qu'il existe exactement 6 compétences orphelines avec prereq classe explicite.
3. **Politique Phase C** : pour les 45 compétences orphelines restantes, aucune n'a de prereq classe explicite dans le manuel. Politique stricte manuel littéral validée par Fred.
4. **Grande Messe — écart DB ↔ manuel assumé** : moteur enforce `Connaissances des Religions`, manuel dit "Religion". Display aligné sur moteur.
5. **Format URL raw GitHub** : ajout de `refs/heads/` pour éviter cache CDN stale. Liste URL raw mise à jour.
6. **Incohérences cosmétiques DB ↔ manuel** repérées : `Corps Sain`/`Corps sain`, `Compétence d'arme d'hast`/`Compétence d'arme à l'arme d'hast`, `Premiers Soins`/`Premiers soins`. Ajoutées à la dette technique.

### Validation

- BEGIN/ROLLBACK tests passés avant chaque `apply_migration`.
- 6 lignes UPDATEs Phase A validées via RETURNING.
- 3 niveaux Grande Messe Phase C validés en SELECT post-migration.

### Dette ouverte / fermée

- **Bumpée** : Vercel auto-trigger preview branches → 11 sessions consécutives. 3 PRs preview manuelles en session 20.
- **Ajoutée** : alignement cosmétique noms compétences DB ↔ manuel (priorité basse, voir entrée dette dédiée).

---

## Session 21 — Sprint 5.5 partiellement clos (22 mai 2026)

**7 PRs mergées dans la session (toutes squash-and-merge)** :

| PR | Description | Migration |
|---|---|---|
| **PR #118** | `feat(sprint-5-5a)` : vue_personnages_joueur expose est_finalise | `20260521191346` |
| **PR #117** | `feat(sprint-5-5b)` : wizard quick wins (sections 1+2.2+2.3) | (frontend only) |
| **PR #120** | `feat(sprint-5-5c)` : uniformisation noms 'Connaissances' pluriel + casse | `20260522012006` |
| **PR #121** | `fix(sprint-5-5c-hotfix)` : aligne vue_personnage_etat + 2 RPC sur 'Connaissances des Créatures' | `20260522021423` |
| **PR #122** | `feat(sprint-5-5d)` : fix Connaissances Criminelles frontend | (frontend only) |
| **PR #123** | `fix(sprint-5-5e-hotfix)` : cascade desacheter_competence par choix_achat | `20260522024852` + `20260522025028` |
| **PR #124** | `fix(sprint-5-5f-ui)` : aligne modale cascade sur desacheter_competence | (frontend only) |

### Contexte

Sprint 5.5 — Quick wins UX wizard. Initialement prévu pour 1 session simple (4 sections du backlog wizard). Dévié vers 7 PRs après découverte par Fred d'incohérences "Connaissance"/"Connaissances" dans le manuel, déclenchant une cascade de bugs latents :
- Régression Dépeçage (3 objets PL/pgSQL référençaient encore l'ancien nom)
- Bug Connaissances Criminelles frontend (niveau 1 imposait un choix à tort)
- Bug ancien `desacheter_competence` (cascade ne filtrait pas sur choix_achat)
- Bug UX modale cascade (frontend affichait l'ancienne logique cassée)

### Migrations appliquées

#### `20260521191346_phase_5_5a_vue_personnages_joueur_est_finalise.sql` (PR #118)

`vue_personnages_joueur` recréée pour exposer `personnages.est_finalise` (posée en Sprint 5.1) en plus des colonnes existantes. Préalable au badge "finalisé" tableau de bord (à venir session 22).

#### `20260522012006_phase_5_5b_uniformisation_connaissances_pluriel.sql` (PR #120)

Uniformisation des noms de compétences "Connaissance(s) ..." :
- **6 renames `competences.nom`** : 5 passages singulier→pluriel + 1 alignement casse (Métaux Communs/Rares avec C/R majuscule)
- **3 REPLACE sur `prerequis_competences`** (jsonb) : préserve le chaînage prereq côté moteur
- **1 UPDATE sur `sections_regles.contenu`** : section "Récolte de composantes sur les monstres"

**11 noms résultants** : Connaissances Criminelles, Connaissances des Créatures, Connaissances des Gemmes Communes/Rares, Connaissances des Herbes Communes/Rares, Connaissances des Métaux Communs/Rares, Connaissances des Religions, Connaissances des Runes, Connaissances Héraldique.

**Politique Fred** : pluriel + casse Majuscule sur Communs/Rares. Écart vs manuel papier édition 6 mai assumé (manuel mélange les 2 formes).

#### `20260522021423_phase_5_5c_hotfix_creatures_pluriel_dans_vues_et_rpc.sql` (PR #121)

Hotfix régression Dépeçage. La migration PR #120 n'avait pas couvert les références littérales de "Connaissance des Créatures" dans 3 objets PL/pgSQL :
- `vue_personnage_etat` : 2 occurrences dans `bool_or(c.nom = 'Connaissance des Créatures'...)` → `a_connaissance_creatures_1/2` retournait toujours false
- `peut_acheter_competence` : 6 occurrences (2 jointures bloquantes + 4 messages)
- `verifier_prerequis_competences` : 2 occurrences (messages d'erreur uniquement)

**Approche** : `CREATE OR REPLACE VIEW` pour la vue + `pg_get_functiondef + replace() + EXECUTE` pour les 2 fonctions (évite re-saisie manuelle de ~150 lignes par fonction).

**Leçon ajoutée à méthodologie v7 (règle #11)** : tout renommage de compétence/objet référencé par nom doit auditer obligatoirement `pg_get_functiondef` + `pg_get_viewdef` AVANT application.

#### `20260522024852_phase_5_5e_hotfix_desacheter_cascade_par_choix_achat.sql` (PR #123, bloc 1/2)

Hotfix cascade `desacheter_competence` pour `multiple_avec_choix_par_niveau`. **Bug ANCIEN** (présent dès la création de la RPC), pas une régression. Détection rendue possible par PR #122 (scénario "plusieurs familles niveau 2" activé).

Comportement corrigé :
- Ligne désachée avec `choix_achat` défini → cascade uniquement sur le même `choix_achat`
- Ligne désachée avec `choix_achat = NULL` (Criminelles niveau 1 savoir général) → cascade sur tout
- Pour `simple` / `unique_avec_choix` : inchangé

**Cette migration ne couvre que le bloc DELETE.** Le bloc FOR a été raté à cause d'une différence d'indentation (8 vs 10 espaces).

#### `20260522025028_phase_5_5e_hotfix2_desacheter_cascade_for_indentation.sql` (PR #123, bloc 2/2)

Migration de suivi immédiate. La migration `20260522024852` avait raté le bloc FOR de `desacheter_competence` à cause d'une indentation différente (10 espaces dans le FOR vs 8 dans le DELETE). Conséquence intermédiaire :
- DELETE correct (le bug fonctionnel était résolu)
- Mais `v_xp_total_rembourse` calculé sur portée trop large (remboursement XP surestimé)

Cette migration aligne le filtre `choix_achat` sur le bloc FOR.

**Leçon ajoutée à méthodologie v7 (règles #12 et #13)** : valider `regexp_count` post-application, et anticiper que l'indentation peut différer entre blocs d'une même fonction PL/pgSQL.

### Découvertes-clés session 21

1. **Manuel papier incohérent lui-même** : utilise indifféremment "Connaissance" et "Connaissances" pour le même type de compétence. Politique stricte "manuel littéral" doit céder face à l'incohérence → décision arbitraire cohérente requise.

2. **Renommage DB ≠ scan frontend seulement** : 3 objets PL/pgSQL référençaient encore l'ancien nom par littéral. Audit `pg_get_functiondef + pg_get_viewdef` obligatoire avant migration de renommage (règle méthodologie #11).

3. **Indentation peut différer entre blocs d'une même fonction** : DELETE (8 espaces) vs FOR (10 espaces) dans `desacheter_competence`. `regexp_count` post-application est obligatoire (règle #12 et #13).

4. **Bug latent ancien révélé par cas d'usage nouveau** : la cascade `desacheter_competence` était cassée depuis sa création, mais jamais détectée car le scénario "plusieurs familles niveau 2" n'avait jamais été testé. PR #122 (fix Connaissances Criminelles) a ouvert ce cas → bug visible immédiatement.

5. **Cohérence frontend ↔ backend** : après hotfix DB (PR #123), le frontend continuait à afficher la liste à supprimer selon l'ancienne logique. Bug cosmétique seulement, mais effrayant pour l'utilisateur (35 XP affichés au lieu de 10 XP réels). Audit systématique du frontend après tout fix backend modifiant la sémantique d'une cascade (règle #14).

6. **Logique Connaissances Criminelles côté DB déjà correcte** : `peut_acheter_competence` gérait déjà le cas spécial via branches conditionnelles sur `v_competence.nom = 'Connaissances Criminelles'`. Le bug était purement frontend.

### Validation

- BEGIN/ROLLBACK tests passés avant chaque `apply_migration`.
- Audit post-fix `regexp_count` confirmé : 0 référence à l'ancien nom dans les objets PL/pgSQL après hotfix.
- Test ciblé Valerius (perso de Fred) : `a_connaissance_creatures_1 = true` après hotfix.
- Test BEGIN/ROLLBACK cascade : "désache niv 2 Cauchemars, vérifie que niv 2 Forêt reste" → `apres_fix = '1/Cauchemars | 1/Forêt | 2/Forêt'` ✓
- Tests UI prod Fred sur Valerius : Dépeçage déblocable après hotfix ✓ ; cascade familles correcte ✓.

### Dette ouverte / fermée

- **Bumpée** : Vercel auto-trigger preview branches → **17 sessions consécutives** (sessions 6, 7, 8, 10, 11, 13, 14, 17, 18, 19, 20, **21**). 6 PRs preview manuelles dans la seule session 21 (PR #117, #118, #120, #121, #122, #123, #124 = 7 PRs mais PR #117 et #118 ouvertes en parallèle). Ticket support Vercel reporté par Fred encore.
- **Fermée partiellement** : 11 entrées Connaissance(s) closes par PR #120 (uniformisation pluriel + casse). 3 entrées historiques restent ouvertes (Corps Sain, Premiers Soins, Compétence d'arme d'hast) pour Sprint 5.7.
- **Ajoutée potentielle** : textes d'affichage `competences.niveaux[].prerequis` désalignés post-PR #120 (cosmétique, UI uniquement, pas le moteur) — à intégrer Sprint 5.7.
- **4 nouvelles règles méthodologie** ajoutées en v7 (#11 à #14) :
  - #11 : Audit fonctions/vues PL/pgSQL avant renommage DB
  - #12 : `regexp_count` post-application pour valider replacements PL/pgSQL
  - #13 : Indentation peut différer entre blocs d'une même fonction
  - #14 : Cohérence frontend ↔ backend lors d'un changement de sémantique cascade

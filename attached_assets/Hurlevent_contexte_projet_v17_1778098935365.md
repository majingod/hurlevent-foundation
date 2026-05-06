# 🎭 PROJET HURLEVENT — CONTEXTE COMPLET v17

**Date de mise à jour : 5 mai 2026**
**Remplace : v16 (4 mai 2026, après-midi)**

---

## 🎯 CE QU'EST LE PROJET

**Hurlevent** est une plateforme web pour un Grandeur Nature (GN) québécois fictif dans le monde de **Destéa**. Elle gère :

- Création et gestion de personnages joueurs (PJ)
- Encyclopédie du monde, races, classes, magie, religions
- Inscriptions aux événements (GN, mini-GN, ouvertures terrain)
- Tableau de bord admin/animateur
- XP, compétences, sorts, prières, artisanat (alchimie, forge, joaillerie, runes)

**Stack technique** :
- Frontend : LovableAI + React + Vite + Tailwind + shadcn/ui
- Backend : Supabase (Postgres + Auth + RLS)
- Repo : `majingod/hurlevent-foundation` sur GitHub
- Project Supabase : `dezocltwpuhbvpxwcbdy`
- Org Supabase : `Fred Org` (id `ezejxapvyaceblvzpnwo`)

**L'utilisateur travaille uniquement depuis un mobile** (pas d'accès ordinateur). Toute action sur le repo passe par Claude Code en parallèle.

---

## 🛡️ ÉTAT DE LA BASE DE DONNÉES AU 5 MAI 2026

| Élément | Quantité | Variation vs v16 |
|---|---|---|
| Tables (schéma `public`) | **40** | inchangé |
| Vues | **30** | inchangé |
| Fonctions | **43** | +16 (Phase 1.4 : 3 helpers + 11 valider_etape_N + dispatch + valider_personnage_final) |
| Triggers | **16** | inchangé |
| Contraintes CHECK | **46** | inchangé |
| Contraintes UNIQUE | **16** | inchangé |
| Contraintes FK | **45** | inchangé |
| RLS Policies | **81** | inchangé |
| Migrations enregistrées | **12** | +1 (Phase 1.4) |

### Données utilisateur (toutes les tables `personnage_*` sont vides)

| Table | Lignes |
|---|---|
| `personnages` | 0 |
| `personnage_competences` | 0 |
| `personnage_sorts` | 0 |
| `personnage_prieres` | 0 |
| `personnage_recettes` | 0 |
| `personnage_assemblages` | 0 |
| `personnage_objets_forge` | 0 |
| `personnage_objets_joaillerie` | 0 |
| `personnage_races_demandes` | 0 |
| `historique_xp` | 0 |
| `inscriptions_evenements` | 0 |
| `notifications` | 0 |
| `profiles` | 3 |

### Référentiels jeu (immuables sauf admin)

`races` (11), `classes` (4), `religions` (15), `familles_criminelles` (6), `langues` (11), `traits_raciaux` (20), `race_traits` (50), `competences` (89), `sorts` (135), `prieres` (121), `recettes_alchimie` (37), `ingredients_alchimiques` (30), `objets_forge` (23), `objets_joaillerie` (6), `reparations_forge` (11), `assemblages_runes` (15), `pieges` (27), `effets_combat` (32), `bestiaire` (6), `categories_creatures` (12), `evenements` (1), `config_jeu` (10), `menu_navigation` (6), `cartes_accueil` (8), `sections_regles` (52), `sections_encyclopedie` (14), `lore` (18).

---

## 📜 HISTORIQUE DES MIGRATIONS APPLIQUÉES EN PROD

| # | Version | Nom | Phase | Date |
|---|---|---|---|---|
| 1 | `20260419002417` | (bootstrap : 39 tables + `est_animateur_ou_admin` + 7 stubs RPC, voir PR #25) | bootstrap | 19 avril (réécrit le 4 mai) |
| 2 | `20260420214749` | (sécurisation profils) | historique | 20 avril |
| 3 | `20260420214843` | (ALTER VIEW security_invoker, rendu conditionnel par PR #25) | historique | 20 avril (modifié le 4 mai) |
| 4 | `20260420215042` | (vues admin) | historique | 20 avril |
| 5 | `20260421150131` | (rpc helpers) | historique | 21 avril |
| 6 | `20260504024143` | `phase1_1_contraintes_personnages` | **Phase 1.1** | 4 mai |
| 7 | `20260504024155` | `phase1_2_coherence_croyant_religion` | **Phase 1.2** | 4 mai |
| 8 | `20260504024420` | `phase1_1b_fix_search_path_valider_format_traits` | **Phase 1.1b** | 4 mai |
| 9 | `20260504034214` | `phase2_vues_data_first` | **Phase 2** | 4 mai |
| 10 | `20260504034236` | `phase2b_correctifs_vues_data_first` | **Phase 2b** | 4 mai |
| 11 | `20260504151633` | `phase1_3_historique_xp` | **Phase 1.3** | 4 mai |
| 12 | `20260505125529` | `phase1_4_validations_etapes` | **Phase 1.4** | 5 mai |

### Migrations Phase 1 du 28 avril (déjà en prod, jamais explicitement loggées)

Les colonnes `personnages.sous_type_chimeride`, `personnage_assemblages.est_gratuit`, `personnage_recettes.est_gratuit`, et la `vue_artisanat_quotas` enrichie existent déjà en prod (Phase 1 du plan original, mergée le 28 avril).

---

## 🧱 DÉCISIONS ACTÉES LE 3-5 MAI 2026

### 1. Format `traits_raciaux_choisis` → **NOUVEAU FORMAT**

```json
[
  {
    "trait_id": "uuid",
    "est_gratuit": true,
    "xp_depense": 0
  }
]
```

**Imposé par contrainte CHECK** `personnages_traits_raciaux_format` via la fonction helper `valider_format_traits_raciaux(jsonb)` dans le schéma `public`. L'ancien format legacy `{id, nom, gratuit, xp_depense}` est désormais rejeté à l'INSERT/UPDATE.

### 2. Cohérence stricte `est_croyant ↔ religion_id`

Contrainte `chk_croyant_religion_coherence` renforcée en bidirectionnelle :
- `est_croyant = TRUE` ⇔ `religion_id IS NOT NULL`
- `est_croyant = FALSE` ⇔ `religion_id IS NULL`

### 3. Contraintes XP

- `xp_total >= 0`
- `xp_depense >= 0`
- `xp_depense <= xp_total`

### 4. Contrainte nom

`nom IS NULL OR char_length(trim(nom)) >= 2` — autorise NULL pour les personnages en cours de création (étape 1) mais empêche les noms d'1 caractère ou en blanc.

### 5. Source de vérité XP : table `historique_xp` (Phase 1.3)

Toute modification d'XP passe désormais par un INSERT dans `historique_xp`. Le trigger `trg_sync_xp_personnage` recalcule automatiquement `personnages.xp_total` et `personnages.xp_depense` (mode recalcul total : `race.xp_depart + somme(gains) - somme(depenses)`).

**12 types de mouvements** :
- Positifs : `gain_evenement`, `gain_bonus`, `gain_correction`, `remboursement`
- Négatifs : `depense_competence`, `depense_trait`, `depense_sort`, `depense_priere`, `depense_recette`, `depense_assemblage`, `depense_objet_forge`, `depense_objet_joaillerie`

**8 colonnes FK objet** (exactement 1 non-nulle pour dépenses/remboursement) : `competence_id`, `trait_id`, `sort_id`, `priere_id`, `recette_id`, `assemblage_id`, `objet_forge_id`, `objet_joaillerie_id`.

**Colonne `personnage_source_id`** réservée pour les transferts d'XP entre personnages (Mini-GN d'hiver — fonction de transfert à coder plus tard).

**Garde-fou** : `RAISE WARNING` dans le trigger si `xp_depense > xp_total`, en plus du blocage par la contrainte CHECK `personnages_xp_depense_max`.

**RLS** : SELECT pour propriétaire ou animateur/admin ; INSERT/UPDATE/DELETE bloqués → tout passe par les RPC `donner_xp_bonus`, `attribuer_xp_evenement`, et les futures `acheter_*`.

### 6. Décisions actées Phase 1.4 (validation par étape)

| Question | Décision |
|---|---|
| Sémantique de `etape_creation` | **« étape en cours »** : si `etape_creation = 3`, le joueur remplit l'étape 3. Après validation, on passe à 4. |
| Liste des 11 étapes | **Confirmée telle quelle** (regroupement en blocs côté UI seulement, pas en DB) |
| Auto-skip des étapes conditionnelles (mage, prêtre, runiste) | **DB décide, frontend obéit** : chaque `valider_etape_N` retourne `ignoree: true` si l'étape ne concerne pas le personnage |
| Détection mage/prêtre/runiste | **Présence de compétence** (`Acquisition de Cercle` / `Acquisition de Domaine` / `Assemblage de Runes`), tous niveaux confondus |
| Multiclasse | OK, plusieurs étapes visibles |
| Étape 2 — race en attente | `'en_attente'` accepté ; `'refusee'` bloque |
| Étape 3 — quota traits | Lecture dynamique de `races.nb_traits_raciaux` |
| Étape 5 — compétences | Pas de seuil minimum (avertissement informatif si 0 compétence achetée) |
| Étape 7 — prières | **STRICT** sur match `prieres.religion_id = personnages.religion_id` |
| Étape 10 — histoire | Aucune contrainte |
| Retour en arrière | **Souple** : aucune suppression auto. Les fonctions de validation détectent les incohérences et les signalent comme erreurs ; le joueur les corrige avant verrouillage |
| Format de retour des validations | `{ valide: bool, ignoree: bool, erreurs: [{code, message, champ?}], avertissements: [...] }` (snake_case) |
| Verrouillage final | `valider_personnage_final` verrouille en une seule transaction (`est_verrouille = true`, `etape_creation = 12`) |

---

## 👁️ VUES (30 au total)

### Vues administratives (existantes)
`vue_admin_joueurs`, `vue_artisanat_etat`, `vue_artisanat_quotas`, `vue_cercles_disponibles`, `vue_competences_maitre_admin`, `vue_competences_maitre_attente`, `vue_demandes_races_attente`, `vue_demandes_races_complet`, `vue_domaines_disponibles`, `vue_evenements_admin`, `vue_inscriptions_par_evenement`, `vue_inscriptions_resumees`, `vue_joueurs_complete`, `vue_joueurs_maitres`, `vue_personnage_etat`, `vue_personnages_admin`, `vue_prochain_evenement`, `vue_stats_admin`, `vue_tableau_de_bord`, `vue_traits_par_race`, `vue_verrou_competences`, `vue_xp_personnage`.

### Vues data-first (8, Phase 2)
- `vue_evenements_publies` — événements publiés + nb_inscrits agrégé
- `vue_personnages_joueur` — personnages actifs avec race_nom et classe_nom joints
- `vue_fiche_personnage` — fiche complète avec race/classe/religion joints
- `vue_competences_personnage` — compétences avec nom, catégorie et description
- `vue_sorts_personnage` — sorts avec cercle, coût et description
- `vue_prieres_personnage` — prières avec domaine, durée et description
- `vue_assemblages_personnage` — assemblages avec runes_requises, xp_depense et effet
- `vue_recettes_personnage` — recettes avec type, niveau, xp_depense et effet

### vue_traits_par_race (enrichie en Phase 2b — 9 colonnes)

`race_trait_id`, `race_id`, `trait_id`, `sous_type`, `race_nom`, `trait_nom`, `trait_description`, `cout_xp`, `est_actif`. Filtre `est_actif = true` directement en SQL pour éviter le filtrage côté client.

### À CRÉER pour la suite du plan directeur
- ❌ `vue_personnage_creation_complet` (1.5 — agrégation tout-en-un pour récap) ← **PROCHAINE**
- ❌ `vue_personnage_etape_actuelle` (2.1 — données contextuelles selon `etape_creation`)

---

## 📊 TABLES NOUVELLES (Phase 1.3)

### `historique_xp` (18 colonnes)

| Colonne | Type | Note |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `personnage_id` | uuid NOT NULL | FK → `personnages(id)` ON DELETE CASCADE |
| `type_mouvement` | text NOT NULL | 12 valeurs autorisées |
| `montant` | integer NOT NULL | signé : positif=gain, négatif=dépense |
| `description` | text NOT NULL | longueur ≥ 1 après trim |
| `competence_id` | uuid | FK → `competences` ON DELETE SET NULL |
| `trait_id` | uuid | FK → `traits_raciaux` |
| `sort_id` | uuid | FK → `sorts` |
| `priere_id` | uuid | FK → `prieres` |
| `recette_id` | uuid | FK → `recettes_alchimie` |
| `assemblage_id` | uuid | FK → `assemblages_runes` |
| `objet_forge_id` | uuid | FK → `objets_forge` |
| `objet_joaillerie_id` | uuid | FK → `objets_joaillerie` |
| `evenement_id` | uuid | FK → `evenements` (pour gain_evenement) |
| `inscription_id` | uuid | FK → `inscriptions_evenements` |
| `acteur_id` | uuid | FK → `auth.users` (admin qui a déclenché) |
| `personnage_source_id` | uuid | FK → `personnages` (réservé Mini-GN d'hiver) |
| `created_at` | timestamptz NOT NULL | `now()` |

**6 contraintes CHECK** : `type_valide`, `montant_non_nul`, `signe_coherent`, `description_non_vide`, `reference_objet` (cardinalité), `type_alignement_fk` (FK alignée au type).

**2 index** : `(personnage_id, created_at DESC)`, `(type_mouvement)`.

---

## ⚙️ FONCTIONS RPC (43)

### Fonctions utilisateur existantes (25 + 1 modifiée + 1 trigger Phase 1.3)

**Validation lecture seule** : `peut_acheter_competence`, `peut_acheter_trait_racial`, `est_animateur_ou_admin`, `role_du_profil`.

**Actions personnages** : `creer_demande_race`, `approuver_race_demande`, `refuser_race_demande`, `archiver_personnage`, `verrouiller_personnage`, `deverrouiller_personnage`, `donner_xp_bonus` ⚡ (modifiée Phase 1.3 : insère dans `historique_xp` au lieu d'UPDATE direct sur `xp_total`).

**Actions admin** : `approuver_maitre_competence`, `refuser_maitre_competence`, `attribuer_xp_evenement` ⚡ (modifiée Phase 1.3), `marquer_present`, `marquer_absent`, `changer_role_utilisateur`, `update_user_role`.

**Lectures helper** : `get_joueurs_avec_count`, `get_stats_admin`.

**Triggers (5 fonctions de support + 1 Phase 1.3)** : `cleanup_demande_si_race_change`, `creer_profil_nouveau_joueur`, `proteger_profile_role`, `set_updated_at`, `verifier_race_approuvee_avant_inscription`, `sync_xp_personnage`.

### Fonction helper ajoutée (Phase 1.1)

- `valider_format_traits_raciaux(jsonb) → boolean` — IMMUTABLE, search_path fixé à `pg_catalog, public`. Utilisée par la contrainte CHECK `personnages_traits_raciaux_format`.

### Fonctions Phase 1.4 — Validation par étape (16 nouvelles, 5 mai 2026)

**Helpers de détection** (3, `STABLE`, `search_path` sécurisé) :
- `personnage_a_des_sorts(uuid) → boolean` — true si compétence `Acquisition de Cercle` présente
- `personnage_a_des_prieres(uuid) → boolean` — true si compétence `Acquisition de Domaine` présente
- `personnage_est_runiste(uuid) → boolean` — true si compétence `Assemblage de Runes` présente

**Validations par étape** (11, `STABLE`, format `{valide, ignoree, erreurs, avertissements}`) :
- `valider_etape_1` — InfosBase (nom, croyant/religion, gn_completes)
- `valider_etape_2` — Race + sous-type Chiméride + statut demande (`refusee` bloque)
- `valider_etape_3` — Traits raciaux (quota dynamique `races.nb_traits_raciaux`, doublons, appartenance, cohérence xp)
- `valider_etape_4` — Classe
- `valider_etape_5` — Compétences (avertissement informatif si 0)
- `valider_etape_6` — Sorts (auto-skip si non-mage, vérif niveau ≤ niveau_max du cercle via `vue_cercles_disponibles`)
- `valider_etape_7` — Prières (auto-skip si non-prêtre, **STRICT** sur match `religion_id`)
- `valider_etape_8` — Artisanat (auto-skip si pas Alchimie/Forge/Joaillerie, quotas mineure/intermédiaire/majeure via `vue_artisanat_quotas`)
- `valider_etape_9` — Assemblages (auto-skip si non-runiste, quota assemblages gratuits)
- `valider_etape_10` — Histoire & Âme (toujours valide)
- `valider_etape_11` — Récapitulatif (xp_depense ≤ xp_total)

**Dispatch + finalisation** (2) :
- `valider_etape(uuid, integer) → jsonb` — dispatcher unifié (étape hors [1..11] → exception SQLSTATE 22023)
- `valider_personnage_final(uuid) → jsonb` — `VOLATILE SECURITY DEFINER`, vérifie ownership/admin via `est_animateur_ou_admin()`, lock `FOR UPDATE`, rejoue les 11 étapes, verrouille (`est_verrouille=true`, `etape_creation=12`) en une transaction si tout valide

### À CRÉER pour la suite (Phase 1.6 du plan directeur)

**Actions atomiques** : `demarrer_creation_personnage`, `sauvegarder_etape_1` à `sauvegarder_etape_10`, `acheter_competence`, `acheter_trait_racial`, `acheter_recette`, `acheter_assemblage`, `acheter_sort`, `acheter_priere`, `finaliser_personnage`. Toutes feront un INSERT dans `historique_xp` (le trigger synchro mettra à jour `xp_total`/`xp_depense`).

**Verrouillage mutuel à implémenter dans les RPC d'achat** (loggé en Phase 1.4, à coder en Phase 1.6) :
- `Assemblage de Runes` : 2 versions distinctes en base (UUID `16361c8e...` mage / `5d0250d2...` prêtre). Acheter une version doit verrouiller l'autre dans `personnage_competences`.
- Même logique pour `Développement Spirituel` et `Développement Spirituel Supérieur`.

---

## 📁 ÉTAT DU REPO GITHUB

**Branches actives** :
- `main` — branche principale, alignée avec la prod Supabase
- `backup-pre-reconstruction-2026-05-03` — sauvegarde au commit `3ed716a`, **ne pas toucher**

**Branches mergées (à supprimer après-coup)** :
- `claude/add-supabase-migrations-GB6L8` (PR #23, mergée)
- `claude/phase1-3-historique-xp` (PR #24, mergée)
- `claude/dette-baseline-bootstrap-tables-G5Jaa` (PR #25, mergée)
- `phase-1-4-validations-etapes` (PR #26, mergée)

**PR récentes** :
- **PR #23** ✅ mergée — Phase 2 + 2b (vues data-first)
- **PR #24** ✅ mergée — Phase 1.3 (table `historique_xp` + trigger sync + RPC mises à jour)
- **PR #25** ✅ mergée — Bootstrap partiel des 39 tables + `est_animateur_ou_admin` + 7 stubs RPC + ALTER VIEW conditionnels
- **PR #26** ✅ mergée — Phase 1.4 (16 fonctions RPC de validation par étape)

**Migrations dans `supabase/migrations/`** (au 5 mai 2026) :
1. `20260419002418_f512e676-...sql` — **bootstrap** (39 CREATE TABLE IF NOT EXISTS + extensions + `est_animateur_ou_admin` + 7 stubs RPC). **Anciennement** un placeholder `SELECT 1;`, réécrit par PR #25.
2. `20260420214751_0a5b4fb2-...sql` (sécurisation profils, 191 lignes)
3. `20260420214845_188d126f-...sql` — **ALTER VIEW security_invoker conditionnel** (DO block tolérant aux vues inexistantes, modifié par PR #25)
4. `20260420215043_a07c3245-...sql` (30 lignes)
5. `20260421150134_f4294816-...sql` (150 lignes)
6. `20260428000001_phase1_colonnes_manquantes.sql` (14 lignes)
7. `20260428000002_phase1_vue_artisanat_quotas.sql` (75 lignes)
8. `20260503000000_baseline_pre_reconstruction.sql` (2669 lignes — snapshot complet)
9. `20260504024143_phase1_1_contraintes_personnages.sql` (79 lignes)
10. `20260504024155_phase1_2_coherence_croyant_religion.sql` (26 lignes)
11. `20260504024420_phase1_1b_fix_search_path_valider_format_traits.sql` (13 lignes)
12. `20260504034214_phase2_vues_data_first.sql`
13. `20260504034236_phase2b_correctifs_vues_data_first.sql`
14. `20260504151633_phase1_3_historique_xp.sql` (380 lignes)
15. `20260505125529_phase1_4_validations_etapes.sql` 🆕 (~860 lignes)

**Migration zombie supprimée** (avant le 4 mai) : `20240501_migrate_traits_json.sql` (datée frauduleusement avant tout le reste).

---

## ⚠️ DETTE TECHNIQUE CONNUE — Supabase Preview rouge

**Statut au 5 mai 2026 : non résolue, acceptée.**

### Symptôme
Supabase Preview reste rouge sur les nouvelles PR à cause d'une chaîne de dépendances entre les vieilles migrations (19 avril → 28 avril) et le baseline du 3 mai. Les migrations historiques référencent des fonctions, vues et RLS policies définies seulement dans `20260503000000_baseline_pre_reconstruction.sql`, qui s'exécute bien plus tard dans la séquence chronologique rejouée par Preview.

**Erreur typique observée** : `ERROR: relation "public.vue_artisanat_etat" does not exist` lors du replay de `20260428000002_phase1_vue_artisanat_quotas.sql`. La vue `vue_artisanat_etat` est créée par le baseline du 3 mai, donc inaccessible le 28 avril dans le rejeu.

### Tentatives de résolution
- **PR #25** a couvert : 39 CREATE TABLE manquants, fonction `est_animateur_ou_admin()`, 7 stubs RPC pour les `REVOKE/GRANT`, et un DO block conditionnel pour les `ALTER VIEW`. Cela débloque les 5 premières migrations historiques mais Preview replante encore plus loin (sur les migrations du 28 avril ou sur le baseline lui-même qui suppose des objets pré-existants).
- Investigation complète a montré que la dette est **plus profonde** que ce que les premières erreurs laissaient voir (12 vues manquantes, RLS sur de nombreuses tables, fonctions du baseline qui se référencent mutuellement, etc.).

### Décision actée
**On accepte que Preview reste rouge.** Le coût de la résolution complète (réinjecter quasiment tout le baseline en amont) dépasse le bénéfice (filet de sécurité supplémentaire).

### Mitigation : protocole "prod first"
Toutes les migrations sont **appliquées en prod via `apply_migration` AVANT** de pousser la PR au repo. Les tests SQL en transaction (`BEGIN; ... ROLLBACK;`) valident le SQL avant le commit en prod. Les PR sont ensuite mergées **sans attendre Preview au vert** : la prod est déjà testée et validée à ce stade. Preview reste un nice-to-have, pas un bloqueur.

### Source de vérité reproductible
Si un jour il faut reconstruire la DB from-scratch (test, audit, dev environnement), la procédure est : **jouer le baseline `20260503000000_baseline_pre_reconstruction.sql` en premier**, puis les migrations Phase 1.x dans l'ordre chronologique. Le baseline est le snapshot canonique de la DB.

---

## 🎯 FEUILLE DE ROUTE RESTANTE

### Phase 1 — Renforcement DB (en cours)

- [x] **1.1** Contraintes CHECK XP, nom, format JSON traits → ✅ 4 mai
- [x] **1.2** Trigger cohérence croyant/religion → ✅ 4 mai
- [x] **1.3** Table `historique_xp` + trigger sync + RPC mises à jour → ✅ 4 mai
- [x] **1.4** Fonctions RPC de validation par étape (16 fonctions) → ✅ 5 mai
- [ ] **1.5** Vue `vue_personnage_creation_complet` (agrégation pour récapitulatif) ← **PROCHAINE ÉTAPE**
- [ ] **1.6** Fonctions RPC d'action atomiques (`demarrer_creation_personnage`, `sauvegarder_etape_*`, `acheter_*`, `finaliser_personnage`)
- [ ] **1.7** Tests SQL unitaires sur les RPC

### Phase 2 — Frontend V2 (à faire)

- [x] Vues data-first créées (Phase 2 + 2b) → ✅ 4 mai
- [ ] **2.1** Squelette `PersonnageNouveauV2.tsx` (route `/personnage/nouveau-v2`)
- [ ] **2.2** Composants d'étape réécrits (InfosBase → Race → TraitsRaciaux → Classe → Compétences → Sorts → Prières → Artisanat → Assemblages → Historique → Récapitulatif)
- [ ] **2.3** Gestion progression et navigation
- [ ] **2.4** Validation finale et verrouillage

### Phase 3 — Modules complémentaires (optionnel)

Messagerie, factions/réputation, recherche full-text encyclopédie, multi-campagnes.

### Phase 4 — Migration et basculement

Coexistence des deux créateurs, migration des personnages legacy si besoin, basculement complet, désactivation de l'ancien.

---

## 🔧 RÈGLES DE TRAVAIL ÉTABLIES

### Répartition Claude (app) / Claude Code (terminal)

| Qui | Fait quoi |
|---|---|
| **Claude (app)** | Audit DB en lecture, écriture des scripts SQL, application directe des migrations Supabase via `apply_migration`, génération du code React complet, rédaction des specs, arbitrage des décisions |
| **Claude Code** | Opérations sur le repo : créer branches, commiter les fichiers, ouvrir des PR, builder, vérifier que ça compile |
| **L'utilisateur** | Décisions métier, validation des PR, tests visuels dans le navigateur mobile, copier-coller des prompts entre Claude et Claude Code |

### Workflow type pour une migration DB ("prod first")

1. Claude (app) écrit le SQL et le teste en transaction (`BEGIN; ... ROLLBACK;`).
2. Claude (app) applique en prod via `apply_migration`.
3. Claude (app) teste le résultat via `execute_sql` (cas valides + invalides).
4. Claude (app) fournit un prompt à Claude Code pour récupérer la migration et la commiter dans le repo.
5. L'utilisateur lance Claude Code, qui crée la PR.
6. L'utilisateur valide et merge la PR depuis l'app GitHub mobile **sans attendre Preview au vert** (cf. dette technique).

### Décisions structurelles

- **Pas de branche Supabase de dev** (jugée trop chère pour le bénéfice — 0,01344 USD/h, ~10 USD/mois).
- **Travail direct sur la prod** car les tables `personnage_*` sont vides (zéro risque de perte de données).
- **Migrations atomiques** : une intention = une migration séparée avec un nom horodaté `YYYYMMDDhhmmss_nom_snake_case.sql`. **Important** : Supabase génère son propre timestamp à l'application via `apply_migration` — le timestamp réel doit être utilisé dans le nom du fichier dans le repo pour rester aligné prod ↔ repo.
- **Search_path explicite** dans toutes les fonctions PL/pgSQL (`SET search_path = pg_catalog, public`) pour respecter le linter Supabase.
- **Squash and merge** pour les PR (1 PR = 1 commit dans `main`).
- **Toujours répondre en français** à l'utilisateur.

### ⚠️ Gestion du tool_search dans la session Claude

Les outils Supabase MCP (`Supabase:execute_sql`, `Supabase:apply_migration`, `Supabase:list_tables`, `Supabase:list_migrations`) sont des **deferred tools** : ils doivent être chargés via `tool_search` au début de la session avant la première utilisation. **Ciblage important** : utiliser `tool_search(query="supabase")` ou similaire pour ne charger que les outils Supabase et éviter de polluer le contexte avec des outils non pertinents (Vercel, Sentry, Context7, etc.).

---

## 🐛 BUGS HISTORIQUES (irrévélants pour la suite)

L'utilisateur a passé beaucoup de tokens/crédits avec d'autres AI à essayer de réparer des bugs d'affichage des traits raciaux dans le créateur. **Ces bugs ne sont plus pertinents** : on reconstruit le frontend du créateur à partir de zéro. Ne pas perdre de temps à analyser les anciens bugs ou comportements.

---

## 📦 LIVRABLES PHASE 0 (terminée le 3 mai)

- ✅ Audit DB complet (`audit_phase0_hurlevent_2026-05-03.md` dans les outputs Claude.ai)
- ✅ Baseline SQL (`20260503000000_baseline_pre_reconstruction.sql`, 2669 lignes, dans le repo `supabase/migrations/`)
- ✅ Branche backup `backup-pre-reconstruction-2026-05-03` sur GitHub (commit `3ed716a`)
- ✅ Décision format JSON actée (nouveau format)

---

## ✅ LIVRABLES PHASE 1.1 + 1.2 + 1.1b (terminés le 4 mai matin)

- ✅ 4 contraintes CHECK ajoutées sur `personnages` (XP × 3, nom)
- ✅ 1 contrainte CHECK format JSON traits_raciaux_choisis (nouveau format imposé)
- ✅ 1 fonction helper `valider_format_traits_raciaux` (IMMUTABLE, search_path sécurisé)
- ✅ Contrainte `chk_croyant_religion_coherence` renforcée en bidirectionnelle
- ✅ 9 tests unitaires passés (cas valides + invalides)
- ✅ 3 migrations enregistrées dans Supabase et dans le repo

---

## ✅ LIVRABLES PHASE 2 + 2b (terminés le 4 mai matin)

- ✅ 8 vues data-first créées
- ✅ 3 colonnes ajoutées (`competence_description`, `xp_depense` × 2)
- ✅ `vue_traits_par_race` enrichie (9 colonnes, filtre `est_actif`)
- ✅ Migration zombie `20240501_migrate_traits_json.sql` supprimée du repo
- ✅ Repo et prod Supabase synchronisés

---

## ✅ LIVRABLES PHASE 1.3 (terminés le 4 mai après-midi)

- ✅ Table `historique_xp` créée (18 colonnes, 6 CHECK, 13 FK, 2 index, 1 RLS policy)
- ✅ Fonction `sync_xp_personnage()` (mode recalcul total + RAISE WARNING anomalie)
- ✅ Trigger `trg_sync_xp_personnage` AFTER INSERT/UPDATE/DELETE
- ✅ Fonctions `donner_xp_bonus` et `attribuer_xp_evenement` modifiées (suppression du UPDATE direct sur `xp_total`, INSERT dans `historique_xp` à la place)
- ✅ 15 tests SQL passés (7 cas valides + 8 cas invalides)
- ✅ Migration `20260504151633_phase1_3_historique_xp.sql` enregistrée et committée (PR #24)

---

## ✅ LIVRABLES DETTE TECHNIQUE BASELINE (partielle, 4 mai après-midi)

- ✅ 39 CREATE TABLE IF NOT EXISTS dans la migration bootstrap (`20260419002418`)
- ✅ Fonction `est_animateur_ou_admin()` ajoutée au bootstrap
- ✅ 7 stubs RPC ajoutés au bootstrap (signatures exactes du baseline pour CREATE OR REPLACE compatible)
- ✅ Migration `20260420214843` rendue tolérante aux vues inexistantes (DO block conditionnel)
- ✅ PR #25 mergée
- ⚠️ Supabase Preview **reste rouge** (dette plus profonde, résolution complète abandonnée)

---

## ✅ LIVRABLES PHASE 1.4 (terminés le 5 mai 2026)

- ✅ 3 fonctions helper de détection (`personnage_a_des_sorts`, `personnage_a_des_prieres`, `personnage_est_runiste`) — STABLE, search_path sécurisé
- ✅ 11 fonctions `valider_etape_1` à `valider_etape_11` avec format de retour standardisé `{valide, ignoree, erreurs, avertissements}`
- ✅ Fonction de dispatch `valider_etape(p_id, p_etape)` avec exception SQLSTATE 22023 sur étape invalide
- ✅ Fonction `valider_personnage_final` avec `SECURITY DEFINER`, contrôle d'accès joueur/admin via `est_animateur_ou_admin()`, lock `FOR UPDATE`, et verrouillage transactionnel (`est_verrouille=true`, `etape_creation=12`)
- ✅ GRANT EXECUTE explicites (`authenticated` pour les validations, `+anon` pour les 3 helpers)
- ✅ Tests `BEGIN/ROLLBACK` passés (étapes 1, 2 avec 5 cas, 3, 4, 5, 6, 7, 8, 9, 10, 11, dispatch + dispatch invalide, `valider_personnage_final` sur perso incomplet)
- ✅ Migration `20260505125529_phase1_4_validations_etapes.sql` enregistrée et committée (PR #26)

### Note hors-scope loggée pour Phase 1.6

`Assemblage de Runes` apparaît 2 fois dans `competences` (UUID `16361c8e...` mage et `5d0250d2...` prêtre). Logique métier confirmée : un voleur/guerrier qui achète une version verrouille l'autre. Même logique pour `Développement Spirituel` et `Développement Spirituel Supérieur`. À implémenter dans les RPC d'achat en Phase 1.6, **pas en Phase 1.4 ni 1.5**.

---

## 🎯 PROCHAINE ÉTAPE IMMÉDIATE

**Phase 1.5 — Vue `vue_personnage_creation_complet`**

Vue d'agrégation qui rassemble en un seul SELECT toutes les infos d'un personnage (base, race, classe, religion, compétences, sorts, prières, artisanat, assemblages, traits raciaux), prête à alimenter l'étape 11 (récapitulatif) du créateur V2.

**À définir au début de Phase 1.5** :
- Forme exacte des colonnes (jsonb agrégés vs colonnes plates pour chaque catégorie ?)
- Inclure les données `historique_xp` ou pas (potentiellement volumineux) ?
- Performance : `STABLE` suffit-il, ou bien faut-il prévoir une vue matérialisée plus tard ?
- Comportement pour personnages incomplets (NULL race_id, etc.) ?

Phase 1.5 servira ensuite directement les composants React du créateur V2 en Phase 2.x.

---

*Document de contexte généré par Claude Opus 4.7 le 5 mai 2026 via accès direct Supabase MCP. À utiliser comme remplacement de `Hurlevent_contexte_projet_v16.md` dans les sources du projet Claude.*

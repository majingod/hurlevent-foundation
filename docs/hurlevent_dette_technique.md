# Hurlevent — Dette technique

Liste des chantiers de dette technique identifiés, par priorité.

---

## NEW — Pré-ouverture accordéon cible après navigation depuis recherche (priorité basse)

**Découvert** : session 11 (19 mai 2026) lors de la validation Phase 3.3c.

**Symptôme** : quand l'utilisateur clique un résultat dans l'onglet Recherche
(ex. "Tempête de Foudre"), il est bien dirigé vers l'onglet cible (Magie Arcane)
avec le filtre par titre pré-rempli. Mais l'item lui-même reste dans un accordéon
**fermé**. L'utilisateur doit cliquer une 2e fois pour voir la description.

**Cause** : `MagieSection` et `PrieresSection` (inline dans `Encyclopedie.tsx`)
utilisent `<Accordion type="multiple">` sans prop `defaultValue` ni state contrôlé.
Tous les accordéons sont fermés par défaut, indépendamment du filtre actif.

**Impact actuel** :
- Mineur — l'utilisateur peut toujours cliquer pour ouvrir.
- Affecte les 6 types de la recherche (régression latente depuis PR #98).
- Pas spécifique aux sorts/prières mais y est plus visible (listes plus longues).

**Plan** :
1. Passer chaque `*Section` à un `<Accordion type="multiple" value={...}>` contrôlé.
2. Quand `searchQuery` est non vide, pré-ouvrir tous les items dont le `nom` matche.
3. Alternative plus simple : si exactement 1 item matche, ouvrir cet item.

**Préreqs / dépendances** : aucun.

**Effort estimé** : 30-45 min (toucher 6+ sections, choisir une stratégie).

---

## NEW — MAJ Manuel des règles 2026 : Connaissances des Religions (priorité moyenne)

**Découvert** : session 7 (17 mai 2026) lors du debug du Bug #21.

**Symptôme** : le Manuel des règles 2026 indique pour la compétence Connaissances des Religions :

> "Cette compétence peut être achetée plusieurs fois uniquement afin d'acquérir la connaissance des rites et coutumes de différentes religions."

Or la règle métier réelle (confirmée par Fred en session 7) est :
- 1 achat max par personnage
- Religion forcée à celle du personnage s'il est croyant (sinon choix libre)

**Cause** : décalage entre le manuel publié et la règle effectivement appliquée par les animateurs / la base de données.

**Impact actuel** :
- DB et frontend alignés sur la règle réelle (post PR #91 + rollback session 7)
- Manuel papier / docx encore obsolète → confusion possible pour les joueurs

**Plan** :
1. Réécrire la section "Connaissances des Religions" du Manuel 2026
2. Publier la version corrigée

**Préreqs / dépendances** : aucun (chantier purement éditorial).

**Effort estimé** : 15 minutes.

**Liens** :
- Migrations Bug #21 : `20260517182730_bug21_connaissances_religions_achetable_multiple.sql` + `20260517191621_rollback_bug21_connaissances_religions_unique.sql`
- PR #91 (frontend : croyant → seule sa religion dans le dropdown)

---

## NEW — baseline_schema-regen (priorité haute après stabilisation)

**Découvert** : session 6 (16 mai 2026) lors du merge de F4.

**Symptôme** : `supabase db reset` ne fonctionne pas. Le check Supabase Preview sur GitHub Actions plante en chaîne sur :
- Baseline #2 (REVOKE sur fonctions absentes de `baseline_schema.sql`)
- Baseline #3 (ALTER VIEW sur vues absentes de `baseline_schema.sql`)
- Phase 1.3 (CREATE TABLE `historique_xp` déjà présente dans `baseline_schema.sql`)
- Probablement d'autres en cascade (Phase 1.4 RPC, Phase 1.5 vues, etc.)

**Cause** : `00000000000000_baseline_schema.sql` est un `pg_dump` récent (post-4 mai 2026) qui inclut déjà l'état des migrations versionnées qui le suivent. C'est un état hybride qui ne reflète pas une "baseline initiale" mais un "snapshot daté".

**Impact actuel** :
- Prod 100% saine, fonctionnelle
- F4 mergé avec bypass du check Supabase (acté en session 6)
- Aucun `db reset` possible (CI ou local) tant que ce chantier n'est pas fait
- Toute nouvelle PR devrait soit bypasser ce check, soit le résoudre

**Plan** :
1. Faire un `pg_dump` propre de la prod actuelle
2. Remplacer `00000000000000_baseline_schema.sql` par ce dump
3. Identifier les migrations versionnées dont les effets sont déjà dans le dump, et les supprimer (ou les squasher)
4. Vérifier que `supabase db reset` (local ou Supabase preview branch) passe
5. Réactiver le check Supabase obligatoire sur main

**Préreqs / dépendances** : aucun. Peut être fait n'importe quand.

**Effort estimé** : 1-2h en session desktop. Préférable de regrouper avec d'autres tâches de fond.

**Liens** :
- PR #92 (F4 mergé en bypass) : https://github.com/majingod/hurlevent-foundation/pull/92
- Branche `chore-f4-aligner-migrations-repo-base` poussée comme référence historique

---

## ONGOING — Vercel auto-trigger preview branches (priorité moyenne)

**Découvert** : session 6 (16 mai 2026), confirmé en sessions 7, 8, 10, 11.

**Symptôme** : les pushs sur branches non-main ne déclenchent pas systématiquement
un preview deployment Vercel. Vercel détecte le commit (visible dans Git History
de Vercel) mais n'enclenche pas le build.

**Données** :
- Sessions concernées : 6, 7, 8, 10, 11.
- PR #97 (session 9) a été un succès d'auto-trigger isolé — hypothèse "Git reconnect a résolu" infirmée par sessions 10, 11.
- 3 PRs consécutives en session 11 (#101, #102, #103) toutes en preview manuel.
- Production auto-deploye correctement sur merge to main (différence claire).

**Causes investiguées (non-conclusives)** :
- `Require Verified Commits` (Vercel security) : Claude Code commits non signés. Toggle désactivé en session 8, sans effet stable.
- `Ignored Build Step` : passé de `Automatic` à autre chose en session 8, sans effet stable.
- Git disconnect/reconnect : fait en session 9, semblait résoudre, mais en fait c'était une coïncidence (PR #97 = chance pure).

**Workaround stable** : Vercel UI → Project → Deployments → Create Deployment → sélectionner branche → Create Preview Deployment. ~30s.

**Plan** :
1. Reproduire le problème en une session dédiée (10-20 min).
2. Inspecter le Git History dans Vercel : voir si le commit y apparaît, voir si un build est tenté puis abandonné.
3. Inspecter les logs CI : `Vercel:get_deployment_build_logs` sur un deployment manuel pour comparer.
4. Ouvrir un ticket support Vercel si pas de cause identifiable. Plan Hobby = pas de SLA mais le support répond.

**Préreqs / dépendances** : aucun.

**Effort estimé** : 1-2h en session debug dédiée.

---

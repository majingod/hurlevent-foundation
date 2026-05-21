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

## NEW — Aligner DB sur Manuel 2026 : Connaissances des Religions (priorité moyenne, Sprint 5.3)

**Découvert** : session 7 (17 mai 2026). **Direction inversée** en session 17 (20 mai 2026) après publication du Manuel 2026 édition 6 mai.

**Symptôme** : la règle "Connaissances des Religions" diverge entre le Manuel 2026 (canonique, édition 6 mai 2026) et l'implémentation DB / frontend :

| Source | Règle |
|---|---|
| Manuel 2026 (canonique) | Plusieurs achats autorisés — 1 par religion différente |
| DB / frontend actuels | 1 achat max + religion forcée à celle du personnage si croyant |

**Cause** : le manuel a été mis à jour APRÈS les corrections DB de session 7 (Bug #21 → PR #91 + rollback). La DB et le frontend se retrouvent désormais obsolètes par rapport au manuel.

**Impact actuel** :
- Les joueurs croyants ne peuvent pas acheter Connaissances des Religions pour une seconde religion comme le manuel le permet.
- Confusion possible entre la règle écrite et l'expérience UI.

**Plan** (Sprint 5.3) :
1. Migration : autoriser plusieurs achats de `Connaissances des Religions` par personnage (réinstaurer la logique de la migration `20260517182730_bug21_*` rollbackée en session 7).
2. Frontend : retirer la contrainte "croyant → seule religion forcée" du dropdown ; permettre la sélection d'une religion différente par achat.
3. Stocker la religion choisie par achat (champ dédié dans `personnage_competences` ou table de liaison) pour distinguer les instances.

**Préreqs / dépendances** : aucun.

**Effort estimé** : 1-2h (migration + frontend + tests).

**Liens** :
- Migrations Bug #21 : `20260517182730_bug21_connaissances_religions_achetable_multiple.sql` + `20260517191621_rollback_bug21_connaissances_religions_unique.sql`
- PR #91 (frontend : croyant → seule sa religion dans le dropdown — à inverser)
- Manuel 2026 édition 6 mai (section Connaissances des Religions)

---

## ONGOING — Vercel auto-trigger preview branches (priorité moyenne)

**Découvert** : session 6 (16 mai 2026), confirmé en sessions 7, 8, 10, 11.

**Symptôme** : les pushs sur branches non-main ne déclenchent pas systématiquement
un preview deployment Vercel. Vercel détecte le commit (visible dans Git History
de Vercel) mais n'enclenche pas le build.

**Données** :
- Sessions concernées : 6, 7, 8, 10, 11, 13, 14.
- PR #97 (session 9) initialement crue auto-déployée, mais correction en session 14 : Fred confirme que toutes les PRs depuis l'apparition du problème ont été déployées manuellement. Hypothèse "Git reconnect a résolu" définitivement infirmée.
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

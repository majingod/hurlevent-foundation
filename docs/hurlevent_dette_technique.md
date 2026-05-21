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

## ONGOING — Vercel auto-trigger preview branches (priorité moyenne)

**Découvert** : session 6 (16 mai 2026), confirmé en sessions 7, 8, 10, 11.

**Symptôme** : les pushs sur branches non-main ne déclenchent pas systématiquement
un preview deployment Vercel. Vercel détecte le commit (visible dans Git History
de Vercel) mais n'enclenche pas le build.

**Données** :
- Sessions concernées : 6, 7, 8, 10, 11, 13, 14, 17, 18, 19, 20 (**11 sessions consécutives**).
- PR #97 (session 9) initialement crue auto-déployée, mais correction en session 14 : Fred confirme que toutes les PRs depuis l'apparition du problème ont été déployées manuellement. Hypothèse "Git reconnect a résolu" définitivement infirmée.
- 3 PRs consécutives en session 11 (#101, #102, #103) toutes en preview manuel.
- PR #109 (session 17) : preview manuel encore requis. Confirmation finale via `Vercel:list_deployments`.
- PR #111 (session 18) : preview manuel encore requis (Sprint 5.2 sweep corrections data critiques).
- PR #112 + #113 (session 19) : preview manuel encore requis pour les deux (Sprint 5.3 Religions + hotfix).
- PR #114, #115, #116 (session 20) : preview manuel encore requis pour les trois (clôture S19 + Sprint 5.4 Phase A + Phase C). `Vercel:list_deployments` confirme 0 deployment auto pour ces 3 branches.
- Production auto-deploye correctement sur merge to main (différence claire) — déploiement prod `9c1751b` de la PR #109 s'est bien fait automatiquement.

**Causes investiguées (non-conclusives)** :
- `Require Verified Commits` (Vercel security) : Claude Code commits non signés. Toggle désactivé en session 8, sans effet stable.
- `Ignored Build Step` : passé de `Automatic` à autre chose en session 8, sans effet stable.
- Git disconnect/reconnect : fait en session 9, semblait résoudre, mais en fait c'était une coïncidence (PR #97 = chance pure).

**Workaround stable** : Vercel UI → Project → Deployments → Create Deployment → sélectionner branche → Create Preview Deployment. ~30s.

**Statut session 20** : ticket Vercel proposé puis reporté par Fred (décision explicite — pas la priorité en session 20).

**Plan** :
1. Reproduire le problème en une session dédiée (10-20 min).
2. Inspecter le Git History dans Vercel : voir si le commit y apparaît, voir si un build est tenté puis abandonné.
3. Inspecter les logs CI : `Vercel:get_deployment_build_logs` sur un deployment manuel pour comparer.
4. Ouvrir un ticket support Vercel si pas de cause identifiable. Plan Hobby = pas de SLA mais le support répond.

**Préreqs / dépendances** : aucun.

**Effort estimé** : 1-2h en session debug dédiée.

---

## NEW — Refonte descriptions `effets_combat` (alignement Manuel) (priorité moyenne, Sprint 5.7)

**Découvert** : session 18 (21 mai 2026).

**Constat** : les 31 entrées existantes de la table `effets_combat` ont des descriptions résumées (16-42 chars) qui ne reflètent pas le texte du Manuel des règles. Exemples :

- `Inconscient` : *"Personne à 0 PV (différent de comateux)."* (40 c.)
- `Saignement` : *"1 dégât par minute jusqu'à soin."* (32 c.)

L'entrée "Sans âme" insérée en migration `20260521030004_phase_5_2_sweep_corrections_data_critiques` utilise la description verbatim du manuel (370 chars), créant une incohérence stylistique avec les 31 autres.

**Décision Fred (session 18)** : les descriptions de `effets_combat` doivent refléter exactement le texte du manuel pour éviter la confusion.

**Plan** :

1. Audit des 31 entrées vs Manuel des règles 2026 (édition 6 mai 2026).
2. UPDATE des descriptions verbatim.
3. Validation du rendu UI mobile sur cartes d'effets (le frontend gère-t-il bien des textes de 200-500 chars sans casser le layout ?).

**Cible** : intégrer dans Sprint 5.7 (Refonte descriptions massives) en étendant son scope. Le backlog `backlog_manuel_2026_v2.md` n'incluait pas initialement `effets_combat` — à corriger en project knowledge.

**Préreqs / dépendances** : aucun.

**Effort estimé** : 0.5-1 session dédiée.

---

## NEW — Alignement cosmétique noms compétences DB ↔ Manuel (priorité basse)

**Découvert** : session 20 (21 mai 2026) lors du grep exhaustif du manuel pour l'audit `classes_requises`.

**Constat** : 3 compétences ont un nom légèrement différent en base par rapport au manuel (édition 6 mai 2026) :

| Nom DB | Nom Manuel | Différence |
|---|---|---|
| `Corps Sain` | `Corps sain` | Casse du `S` |
| `Compétence d'arme d'hast` | `Compétence d'arme à l'arme d'hast` | Mots additionnels |
| `Premiers Soins` | `Premiers soins` | Casse du `S` |

**Impact actuel** :
- Aucun fonctionnel (le moteur d'achat utilise les UUIDs et les noms en DB).
- Cosmétique uniquement (joueurs voient le nom DB qui diffère légèrement de leur manuel papier).
- Pour `Compétence d'arme d'hast`, c'est un changement plus que cosmétique — le manuel a 5 mots de plus.

**Plan** :
1. Décider stratégie : soit corriger DB pour matcher manuel, soit corriger manuel pour matcher DB.
2. Si correction DB : 1 migration UPDATE avec 3 entrées.
3. Si correction manuel : mettre dans le tracker du manuel pour édition suivante.

**Cible suggérée** : intégrer à Sprint 5.7 (Refonte descriptions massives) en l'étendant pour inclure aussi les renommages cosmétiques.

**Préreqs / dépendances** : décision Fred sur la direction de l'alignement.

**Effort estimé** : 15 min (migration) ou 0 min (juste mettre en attente édition manuel).

---

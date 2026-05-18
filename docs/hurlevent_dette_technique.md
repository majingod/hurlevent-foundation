# Hurlevent — Dette technique

Liste des chantiers de dette technique identifiés, par priorité.

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

## NEW — Vercel auto-trigger preview branches (priorité moyenne, haute friction quotidienne)

**Découvert** : session 6 (16 mai 2026), confirmé non-résolu en session 8 (17 mai 2026).

**Symptôme** : les push sur les branches non-`main` ne déclenchent **plus** automatiquement de déploiement preview Vercel. Aucun build, aucun preview URL dans les checks GitHub.

**Workaround validé** : Vercel UI → Deployments → Create Deployment → sélectionner la branche → Create Preview Deployment.

**Causes investiguées (non concluantes)** :
- `Require Verified Commits` activé sur Vercel : les commits Claude Code ne sont pas signés → désactivé, sans effet
- `Ignored Build Step` réglé sur `Automatic` au lieu de `On` : modifié, sans effet
- Git disconnect/reconnect dans Vercel settings : tenté en fin de session 6, sans effet (reconfirmé en session 8 sur PR #95)

**Impact actuel** :
- Chaque PR nécessite un déclenchement manuel du preview
- Le check Vercel sur GitHub branch protection reste en attente jusqu'au trigger manuel
- Friction non-bloquante mais répétée à chaque PR

**Plan** :
1. Inspecter les webhook deliveries côté Vercel (intégration GitHub) pour identifier la cause
2. Si nécessaire : supprimer/recréer complètement l'intégration GitHub côté Vercel
3. Valider via MCP `Vercel:list_deployments` que le champ `creator` ≠ `majingod` après push (signe d'auto-trigger fonctionnel)

**Préreqs / dépendances** : aucun.

**Effort estimé** : 30-60 min de debug Vercel (sans garantie ; possible escalade au support Vercel).

**Observations** :
- Session 7 : ne marche pas
- Session 8 : ne marche pas (malgré le reconnect)
- Session 9 PR #96 : ne marche pas
- Session 9 PR #97 : auto-trigger ✅ (un seul succès)
- Session 9 PR #98 : manuel
- Session 10 PR #99 : ne marche pas

**Hypothèse infirmée (session 10)** : PR #97 = anomalie isolée, pas un retour à la normale du reconnect Git de session 6/8.

**Liens** :
- Session 8 — PR #95 : aucun preview déclenché malgré push complet
- MCP `Vercel:list_deployments` : `creator` distingue auto (identifiant distinct) vs manuel (`majingod`)

---

## NEW — RechercheSection : routage des nouveaux types (priorité moyenne)

**Découvert** : session 10 (18 mai 2026) lors de la livraison Phase 3.3b (PR #99).

**Symptôme** : Le RPC `rechercher_encyclopedie` retourne désormais 4 types (`lore`, `bestiaire`, `religion`, `competence`) suite à la PR #99. Le composant `RechercheSection.tsx` côté frontend (créé en PR #98) ne sait probablement router que le type `lore` au clic d'un résultat.

**Cause** : Le composant a été conçu avant l'extension multi-tables. Pas de switch/case sur `type` pour la navigation.

**Impact actuel** :
- Backend opérationnel, recherche multi-tables fonctionne (testée : `rechercher_encyclopedie('magie')` → 4 types représentés)
- Clic sur un résultat `bestiaire` / `religion` / `competence` : comportement à confirmer (probablement cassé ou redirige sur `/lore`)

**Plan** :
1. Cat `RechercheSection.tsx` pour confirmer l'état exact du routage
2. Étendre le switch (ou l'ajouter s'il est absent) pour router les 4 types vers leurs pages respectives
3. Vérifier que les pages cibles acceptent un paramètre `id` ou nom pour naviguer directement

**Préreqs / dépendances** : aucun.

**Effort estimé** : 30 minutes (incluant tests sur les 4 types).

**Liens** : PR #99 (extension backend Phase 3.3b).

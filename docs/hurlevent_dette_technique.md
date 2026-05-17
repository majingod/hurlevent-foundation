# Hurlevent — Dette technique

Liste des chantiers de dette technique identifiés, par priorité.

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

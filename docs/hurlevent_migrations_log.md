# Hurlevent — Migrations log

> **Dernière mise à jour** : 24 mai 2026 (clôture session 33).

---

## Session 33 — XP cleanup + C2 Phase 2 + hotfix Étape 7 (24 mai 2026)

**3 PRs mergées** : XP-CLEANUP (migration 31), C2 Phase 2 (migration 32 + UI), Hotfix Étape 7 (frontend uniquement).
**2 migrations DB** appliquées via MCP.

⚠️ **À synchroniser début session 34** : `docs/hurlevent_migrations_log.md` du repo doit être mis à jour avec ces 2 migrations (le fichier dans le repo est en retard d'une session).

### Migration #1 — `20260524031633_fix_recalculer_xp_personnage_exclure_remboursements.sql`

**Fonction modifiée** : `recalculer_xp_personnage(p_personnage_id uuid) RETURNS jsonb`. Signature inchangée, body refactoré.

**Bug fixé (cosmétique)** : la fonction calculait `xp_gains = SUM(montant > 0)` sans filtrer sur `type_mouvement`. Donc les remboursements (montant>0, type='remboursement') étaient comptés comme des gains, gonflant `xp_total` affiché.

**Nouvelle sémantique** (3 sommes explicites filtrées par `type_mouvement`) :
- `gain_*` → augmente `xp_total`
- `depense_*` → augmente `xp_depense`
- `remboursement` → diminue `xp_depense` (compensation)

**Formule finale** :
- `xp_total = xp_depart + xp_gn + SUM(gain_*)` (exclut remboursements)
- `xp_depense = SUM(|depense_*|) - SUM(remboursement)` (remboursements diminuent dépense)
- `xp_disponible = xp_total - xp_depense` (inchangé en pratique → aucune régression joueur)

**Tests pré-apply (BEGIN/ROLLBACK sur Valerius 7be8fd80 et 5b27f103)** :
- `7be8fd80` : xp_total 65 → 60 (-5 remboursements), xp_depense 64 → 59 ; xp_disponible 1 → 1 ✓
- `5b27f103` : xp_total 176 → 80 (-96 remboursements), xp_depense 150 → 54 ; xp_disponible 26 → 26 ✓

**Voie 1 acceptée** : pas de recalcul forcé des persos existants. Les persos de test session 33 doivent être effacés. Le trigger `trg_sync_xp_personnage` resynchronise automatiquement au prochain mouvement XP.

**Types.ts** : non régénéré (signature inchangée, seul body modifié).

**Convention update** : la phrase "xp_depense ne décrémente JAMAIS" est obsolète. Les **rows** `historique_xp` restent append-only, les **colonnes calculées** peuvent décrémenter.

### Migration #2 — `20260524124018_desacheter_sort_et_priere.sql`

**Nouvelles RPCs** :

```sql
desacheter_sort(p_personnage_sort_id uuid) RETURNS jsonb
desacheter_priere(p_personnage_priere_id uuid) RETURNS jsonb
```

**Modèle** : `desacheter_assemblage` (session 32) sans la branche `est_gratuit`. Sorts/prières sont configurables (niveau, zone, portée, durée, nom personnalisé) — plusieurs lignes possibles par sort_id avec configs différentes. Pas de quota gratuit.

**Pattern** :
1. Garde-fous : `non_authentifie`, `achat_introuvable`, `personnage_introuvable`, `ownership_refuse`, `personnage_verrouille`
2. DELETE de la ligne `personnage_sorts` / `personnage_prieres`
3. Si `xp_depense > 0` : UPDATE `personnages.xp_depense -= xp_depense` + INSERT `historique_xp` (type='remboursement', montant positif, FK = `sort_id` / `priere_id`)
4. Retour `{succes, erreurs, avertissements, donnees: {personnage_sort_id, sort_id, xp_rembourse, xp_total, xp_depense, xp_restant}}`

**Idempotence** : `CREATE OR REPLACE FUNCTION`.

**SECURITY DEFINER** + `SET search_path TO 'public'` conformes à la convention.

**Types.ts** : régénéré via MCP `Supabase:generate_typescript_types`, 2 entrées ajoutées dans `Functions` (ordre alphabétique : `desacheter_priere`, `desacheter_sort` entre `desacheter_competence` et `deverrouiller_personnage`).

**Tests post-merge** : Phase 2 livrée et validée par tests in vivo (achat sort + désachat + vérification XP header + cohérence `personnages.xp_total/xp_depense`).

### PR #3 — Hotfix Étape 7 (frontend uniquement, pas de migration)

**Bug régression** : `Etape7_Prieres_V2.tsx` exigeait `est_croyant=true` pour accéder à l'étape, même si `Acquisition de Domaine ≥ 1`.

**Source** : le backend a été corrigé en session 26 (commentaire explicite dans `acheter_priere` : "FIX session 26 : check religion supprime"). Mais le frontend a conservé la garde dans `conditionsRemplies`.

**Confirmation manuel 2026** : "Acquisition de Domaine 1 — Prérequis : Linguistique et Mathématique". Aucune mention de croyance ou Classe Prêtre.

**Découverte** : tests matriciels exhaustifs de Fred (14 scénarios mage/guerrier × croyant/non-croyant × diverses compétences).

**Fix** : 3 str_replace dans `Etape7_Prieres_V2.tsx` :
- Suppression `&& estCroyant` dans `conditionsRemplies`
- Nettoyage variable inutilisée `estCroyant`
- Adaptation texte + suppression `<p>Croyant : oui/non</p>` du bloc "conditions non remplies"

**Backend** : aucune modif (vue `vue_domaines_disponibles` et RPC `acheter_priere` déjà OK depuis session 26).

---

## Session 32 — C2 Phase 1 étapes 8/9 bidirectionnelles (24 mai 2026)

**3 PRs mergées** : #155 (C2 Phase 1 + migration 30), fix predicate invalidation (post-#155), badge tableau de bord brouillon/finalisé.
**1 migration DB** appliquée via MCP.

### Migration appliquée

#### `20260524004606_desacheter_recette_et_assemblage.sql` (PR #155)

**Nouvelles RPCs** :

```sql
desacheter_recette(p_personnage_recette_id uuid) RETURNS jsonb
desacheter_assemblage(p_personnage_assemblage_id uuid) RETURNS jsonb
```

**Modèle** : `desacheter_competence` existante.

**Pattern** :
1. DELETE de la ligne `personnage_recettes` / `personnage_assemblages`
2. Si payant (`xp_depense > 0`) : UPDATE `personnages.xp_depense -= xp_depense` + INSERT `historique_xp` (type='remboursement', montant positif, FK = recette_id/assemblage_id)
3. Si gratuit : juste DELETE (pas d'entrée historique pour éviter `chk_historique_xp_montant_non_nul`)

**GRANT** : `EXECUTE TO authenticated`.

**Garde-fous** : `non_authentifie`, `achat_introuvable`, `personnage_introuvable`, `ownership_refuse`, `personnage_verrouille`.

**Types.ts** : régénéré dans la même PR (Règle #15).

**Choix architectural Option D** : reproduire le pattern de `desacheter_competence` (qui produit le bug cosmétique de `xp_total` gonflé). Cohérence avec l'existant > corriger seulement ici. Le fix global a été fait en session 33 (XP-CLEANUP).

---

## Session 31 — Fix `annuler_etape` + features wizard (23 mai 2026)

**3 PRs mergées** : #152 (XP insuffisant), #153 (auto-skip > N + predicate + boutons Etape7), #154 (migration SQL + gratuités obligatoires + auto-skip `etapeMaxAtteinte`).
**1 migration DB** appliquée via MCP.

### Migration appliquée

#### `20260523210202_fix_annuler_etape_inserts_par_item_avec_fk.sql` (PR #154)

**Fonction modifiée** : `annuler_etape(p_personnage_id uuid, p_etape_courante integer, p_dry_run boolean DEFAULT false)`. Signature inchangée, corps refactoré.

**Bug fixé** : la fonction violait `chk_historique_xp_reference_objet` pour les étapes 6-9 car les remboursements étaient des INSERTs « bulk » sans FK.

Le check constraint exige EXACTEMENT 1 FK pour `type_mouvement = 'remboursement'` parmi :
`competence_id`, `trait_id`, `sort_id`, `priere_id`, `recette_id`, `assemblage_id`, `objet_forge_id`, `objet_joaillerie_id`.

**Nouveau comportement** : 1 INSERT `historique_xp` par item annulé, avec la FK appropriée.

- Étape 6 : `INSERT...SELECT FROM personnage_sorts` avec `sort_id`
- Étape 7 : `INSERT...SELECT FROM personnage_prieres` avec `priere_id`
- Étape 8 : 3 INSERT séparés (recettes, objets_forge, objets_joaillerie) avec FK correspondante
- Étape 9 : `INSERT...SELECT FROM personnage_assemblages` avec `assemblage_id`

**Items gratuits** (`xp_depense = 0`) : DELETE sans entrée historique (montant 0 violerait `chk_historique_xp_montant_non_nul`).

**Types.ts** : non régénéré (signature inchangée).

---

## Session 30 — Cat 2 voie A frontend (23 mai 2026)

**4 PRs mergées** : #148 (frontend modale simple), #149 (cleanup docs PK supprimés du repo), #150 (modale détaillée), #151 (commit migration `annuler_etape_items_detail`).
**1 migration DB** appliquée et committée.

### Migration appliquée

#### `20260523182119_annuler_etape_items_detail.sql` (PR #151)

Enrichit le retour `donnees` de `annuler_etape` avec un champ `items_detail` (array). Chaque entrée : `{type, type_label, nom, quantite, xp_unitaire, xp_total}`.

**Groupage par compétence_id** pour gérer multi-achats (Développement Spirituel ×15, etc.).
Pour sorts/prières/etc., 1 row = 1 item.

---

## Session 29 — Cat 1 + Cat 2 voie A backend (23 mai 2026)

**2 PRs mergées** : #146 (frontend cat 1), #147 (backend cat 2).
**1 migration DB** appliquée via MCP.

### Migration appliquée

#### `20260523152942_annuler_etape.sql` (PR #147)

**Nouvelle RPC** `annuler_etape(p_personnage_id uuid, p_etape_courante integer, p_dry_run boolean DEFAULT false) RETURNS jsonb`.

Implémente la voie A de la dette catégorie 2 (navigation backward rollback). Couvre les étapes 2-11 du wizard. Un appel = annulation atomique de l'étape courante + décrémentation `etape_creation`.

**Mode `p_dry_run`** : retourne les chiffres prévisionnels sans muter, pour preview UX modale.

**6 garde-fous** : non_authentifie, personnage_introuvable, ownership_refuse, personnage_verrouille, etape_incoherente, etape_invalide.

**Découverte session 29** : convention `historique_xp` append-only. Bug cosmétique `recalculer_xp_personnage` identifié et **résolu en session 33** (migration `20260524031633`).

---

## Session 28 — Bugs étape 7/5/11 (22 mai 2026)

3 PRs frontend mergées : #143, #144, #145. **Aucune migration DB**.

- **PR #143** : Fix Etape7 Prieres_V2 auto-skip robuste + bouton fallback
- **PR #144** : Fix langues anciennes étape 5
- **PR #145** : Fix UUID + groupage compétences étape 11

---

## Session 27 — Système magie suite (23 mai 2026)

2 PRs frontend mergées : #141 (fix asymétrie écran/impression Prières), #142 (formule magique automatique).

### Migration appliquée

`20260523033121_generer_formule_magique_et_acheter_sort` (PR #142)

Helper SQL `generer_formule_magique(p_cercle, p_zone, p_portee, p_duree, p_niveau)` IMMUTABLE qui retourne la formule magique déterministe selon manuel 2026 (5 mots de pouvoir). 59 mappings hardcodés. `acheter_sort` modifiée pour calculer `formule_magique` automatiquement à l'achat.

---

## Session 26 — Fix système magie (22 mai 2026)

3 PRs frontend mergées : #137 (calcul PS), #138 (système magie complet), #139 (race condition Etape7).

### Migration appliquée

`20260523000824_fix_magie_helper_calcul_xp_check_religion.sql` (PR #138)

5 bugs interconnectés corrigés simultanément. Nouvelle helper SQL `calculer_cout_xp_magie(zone, portee, duree, niveau, base)` miroir exact du frontend.

**⚠️ Point crucial pour session 33** : cette migration a aussi supprimé le check `est_croyant` de la RPC `acheter_priere` (avec commentaire explicite dans le code SQL). Le manuel 2026 n'exige pas d'être croyant pour Acquisition de Domaine. La garde frontend correspondante a été oubliée → corrigée en session 33 (hotfix Étape 7).

---

## Sessions antérieures (résumé)

- **Session 25** : PRs #135 (TabsList scrollable mobile), #136 (vue traits raciaux enrichie)
- **Session 24** : PR #133 (Sprint 5.6 §2), PR #134 (docs)
- **Session 23** : Sprint 5.6 §1 Voie C (5 PRs #128-132, pas de migration)
- **Session 22** : PR #126 (badge Finalisé), PR #127 (hard delete persos `20260522050242`)
- **Session 21** : Sprint 5.5 quick wins UX wizard (6 PRs)
- **Session 20** : Sprint 5.4 audit `classes_requises` (PRs #115, #116)
- **Session 19** : Sprint 5.3 re-migration Religions (PRs #112, #113)
- **Session 18** : Sprint 5.2 sweep corrections data critiques (PR #111)
- **Session 17** : Sprint 5.1 règle modif post-finalisation (PR #109)

---

*Fin de hurlevent_migrations_log.md (clôture session 33).*

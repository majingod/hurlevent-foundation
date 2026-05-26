# Hurlevent — Migrations log

> **Dernière mise à jour** : 26 mai 2026 (clôture session 36).

---

## Session 36 — Refonte affichage artisanat (forge/joaillerie/réparations + temps rare) (26 mai 2026)

**8 PRs mergées** : marathon de session focus élimination dette d'affichage artisanat. **1 migration BD** appliquée via MCP.

### Migration #1 — `20260526002111_temps_rare_joaillerie_et_recap_complet.sql` (PR #173)

**Cible** : table `objets_joaillerie` + vue `vue_personnage_creation_complet`.

**Changements** :

1. **ALTER TABLE** : ajout colonne `temps_rare_minutes integer` sur `objets_joaillerie`. Initialisée à `difficulte + 10` (règle Manuel 2026 : joaillerie temps rare = commun + 10 min). 6 objets impactés (Couronne, Pendentif, Épingle, Badge/Insigne, Bracelet, Bague).

2. **CREATE OR REPLACE VIEW vue_personnage_creation_complet** : refonte de 3 clés JSONB :
   - `objets_forge` : passe de jointure avec `personnage_objets_forge` (toujours vide depuis abandon Phase 3b) → lecture directe `objets_forge WHERE est_actif AND EXISTS (vue_artisanat_etat avec niveau_forge >= 1)`. Expose `materiaux_communs` et `materiaux_rares`.
   - `objets_joaillerie` : pareil + nouvelle colonne `temps_rare_minutes`.
   - `reparations_forge` : **nouvelle clé** (n'existait pas avant). Lecture directe `reparations_forge WHERE est_actif AND EXISTS (niveau_forge >= 1)`. Placée en fin de vue car `CREATE OR REPLACE VIEW` ne permet pas la réinsertion au milieu.

**Conséquence** : la vue passe de 51 colonnes / 11 JSONB → **52 colonnes / 12 JSONB**.

**Bug fixé** : l'étape 11 récap du wizard affichait « Aucun objet de forge » + « Aucun objet de joaillerie » même avec compétence acquise, car la vue joignait des tables d'achat individuel toujours vides depuis l'abandon de la Phase 3b en session 32. Désormais affichage correct selon niveau acquis.

**Pas de migration de données** : la vue est recréée à la volée par CREATE OR REPLACE. Aucune donnée historique impactée.

### Détail des 8 PRs

| PR | Titre | Cible |
|---|---|---|
| #169 | feat(tdb): cacher bouton wizard si perso finalisé | TableauDeBord.tsx |
| #170 | feat(etape8): filtrer matériaux rares selon niveau | Etape8_Artisanat_V2.tsx |
| #171 | fix(fiche): retirer filtres difficulté handlePrint | PersonnageFiche.tsx |
| #172 | feat(fiche): tab Artisanat sous-onglets + temps fab handlePrint | PersonnageFiche.tsx |
| #173 | feat(recap): afficher forge/joaillerie/réparations selon niveau + temps rare joaillerie | migration + types.ts + Etape11 |
| #174 | feat(etape8): sous-onglets fabrication/réparation forge + temps rare joaillerie | Etape8_Artisanat_V2.tsx |
| #175 | feat(fiche): temps rare joaillerie + tab alchimie groupé par niveau | PersonnageFiche.tsx |
| #176 | feat(etape8): quotas alchimie par niveau (mineures/intermédiaires/majeures) + recettes groupées | Etape8_Artisanat_V2.tsx |

### Dette résolue session 36

- ✅ AFFICHAGE-ARTISANAT-COMPLET (cohérence wizard ↔ fiche)
- ✅ BUG-QUOTAS-ALCHIMIE-GLOBAL (frontend lit désormais les 6 colonnes par niveau que la vue exposait déjà)

### Dettes nouvelles documentées

- DETTE-RENOMMER-DIFFICULTE-EN-TEMPS : `difficulte` est en réalité temps en minutes
- AUDIT-RPC-ACHETER-OBJET-FORGE-JOAILLERIE : RPCs probablement orphelines
- ACCESSOIRES-FORGE-DUPLIQUES : 6 entrées vs 1 ligne manuel

### Apprentissages techniques

- **Cache CDN stale même avec `refs/heads/`** : faire confiance à CC si props manquent (Règle #24 v14)
- **CC peut skipper silencieusement `str_replace`** : préférer `cp` + sanity check grep (Règle #25 v14)
- **Vérifier BD avant migration** : la vue exposait déjà les 6 colonnes par niveau (Règle #26 v14)
- **`<CardDescription asChild>` shadcn/ui non supporté** : utiliser `<div>` stylé

---

## Session 34 — Fix `sauvegarder_etape_3` append-only + cleanup (24 mai 2026)

**3 PRs mergées** : MIGRATIONS-LOG-REPO-SYNC (#161, doc-only), Fix `sauvegarder_etape_3` append-only (migration 33 + commit repo), Fix trait gratuit toggleable (auto-promote FIFO frontend).
**1 migration DB** appliquée via MCP.

### Migration #1 — `20260524170622_fix_sauvegarder_etape_3_append_only.sql`

**Fonction modifiée** : `sauvegarder_etape_3(p_personnage_id uuid, p_traits_raciaux_choisis jsonb) RETURNS jsonb`. Signature inchangée, body refactoré en profondeur.

**Bug fixé (critique)** : la fonction faisait `DELETE FROM historique_xp WHERE personnage_id = ... AND type_mouvement = 'depense_trait'` puis re-INSERT à chaque appel, violant la convention "historique_xp append-only" établie en session 33 (XP-CLEANUP).

**Conséquences du bug** :
- Perte de l'historique des achats (audit cassé)
- Pas de trace des remboursements (incohérent avec le pattern des autres `desacheter_*`)

**Nouveau comportement** : vrai **diff** entre l'ancien JSONB `traits_raciaux_choisis` et le nouveau payload.

**Algorithme en 3 phases** :

1. **Recalcul du nouveau JSONB** : pour chaque trait du payload (en ordre), si index < `nb_traits_raciaux` → gratuit (xp=0), sinon → payant (lookup cout_xp via `vue_traits_par_race`).

2. **Boucle 1 — Anciens traits** :
   - Si retiré du nouveau JSONB et était payant → INSERT `remboursement` (montant=+old_xp, FK trait_id, description "Remboursement trait racial : <nom>")
   - Si présent dans les deux mais coût différent (passage gratuit↔payant via reorganisation FIFO) :
     - Si old_xp > 0 → INSERT `remboursement` (description "Remboursement trait racial (reorganisation)")
     - Si new_xp > 0 → INSERT `depense_trait` (montant=-new_xp, description "Achat trait racial (reorganisation)")
   - Si présent dans les deux et coût identique → AUCUN INSERT (idempotent)

3. **Boucle 2 — Nouveaux traits ajoutés** :
   - Si pas dans l'ancien et payant → INSERT `depense_trait` (montant=-new_xp, FK trait_id, description "Achat trait racial : <nom>")

4. **UPDATE** `personnages.traits_raciaux_choisis = v_new_traits`.

**Pas de DELETE dans historique_xp**. Le trigger `trg_sync_xp_personnage` resync `xp_total`/`xp_depense` automatiquement via la formule de `recalculer_xp_personnage` (corrigée session 33).

**Tests pré-apply (BEGIN/ROLLBACK avec perso Demi-Elfe + 3 traits)** :
| # | Scénario | INSERTs attendus | Obtenus |
|---|---|---|---|
| 1 | vide → [A grat, B payant] | 1× depense_trait -10 | ✓ |
| 2 | [A, B] → [A] | 1× remboursement +10 | ✓ |
| 3 | [A, B] → [B] (FIFO) | 1× remboursement +10 (reorg) | ✓ |
| 4 | [B] → [B, C] | 1× depense_trait -10 | ✓ |
| 5 | re-submit identique | 0 INSERT | ✓ |

**Types.ts** : non régénéré (signature inchangée).

**Frontend** : `Etape3_V2.tsx` inchangé (RPC consommée de la même manière, payload identique).

### PR #2 — Hotfix trait gratuit toggleable (frontend uniquement, pas de migration)

**Bug régression** : `Etape3_V2.tsx` contenait une garde "Sprint 5.5 Section 1" qui affichait un Dialog "Impossible de changer ce trait gratuit" quand on tentait de décocher un gratuit avec des achats payants. Cette garde implémentait l'**Option C (interdiction)** alors que le backend (fix #1 ci-dessus) implémente l'**Option B (auto-promote FIFO)**.

**Découverte** : tests in vivo de Fred après le merge du fix backend. La modal apparaissait en prod, contredisant le comportement serveur validé par les 5 scénarios.

**Source** : la garde était ajoutée dans une session antérieure (Sprint 5.5) **sans documentation dans le PK**. Le `cat` du fichier via Claude Code a révélé son existence (CDN GitHub raw était stale).

**Fix** : 4 str_replace dans `Etape3_V2.tsx` :
- Suppression import `Dialog` et sous-composants
- Suppression state `blocChangementGratuit` + setter
- Refactor `toggleGratuit` : retrait de la garde + ajout auto-promote FIFO local
  - Quand on décoche un gratuit avec des payants en local : le 1er payant (FIFO, ordre du Set) est automatiquement promu en gratuit
- Suppression `<Dialog>` "Impossible de changer ce trait gratuit"

**Backend** : aucune modif.

### PR #1 — MIGRATIONS-LOG-REPO-SYNC (PR #161, doc-only)

**Cible** : `docs/hurlevent_migrations_log.md` du repo.

**Méthode** : overwrite complet avec la version PK canonique (clôture session 33). Sync sessions 32 + 33 qui étaient absentes ou incomplètes.

**Pas de migration DB**, pas de typecheck, pas de frontend impacté.

---

## Session 33 — XP cleanup + C2 Phase 2 + hotfix Étape 7 (24 mai 2026)

**3 PRs mergées** : XP-CLEANUP (migration 31), C2 Phase 2 (migration 32 + UI), Hotfix Étape 7 (frontend uniquement).
**2 migrations DB** appliquées via MCP.

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

### Migration #2 — `20260524124018_desacheter_sort_et_priere.sql`

**Nouvelles RPCs** :

```sql
desacheter_sort(p_personnage_sort_id uuid) RETURNS jsonb
desacheter_priere(p_personnage_priere_id uuid) RETURNS jsonb
```

**Modèle** : `desacheter_assemblage` (session 32) sans la branche `est_gratuit`. Sorts/prières sont configurables — plusieurs lignes possibles par sort_id avec configs différentes. Pas de quota gratuit.

### PR #3 — Hotfix Étape 7 (frontend uniquement)

Suppression de la garde `&& estCroyant` dans `Etape7_Prieres_V2.tsx`. Le backend avait corrigé ça en session 26 ; le frontend conservait l'ancien check.

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

Pattern : DELETE + remboursement si payant. Modèle `desacheter_competence`. Pour items **non configurables** avec quota gratuit.

---

## Session 31 — Fix `annuler_etape` + features wizard (23 mai 2026)

**3 PRs mergées** : #152 (XP insuffisant), #153 (auto-skip > N + predicate + boutons Etape7), #154 (migration SQL + gratuités obligatoires + auto-skip `etapeMaxAtteinte`).
**1 migration DB** appliquée via MCP.

### Migration appliquée

#### `20260523210202_fix_annuler_etape_inserts_par_item_avec_fk.sql` (PR #154)

Fix du bug `chk_historique_xp_reference_objet` pour les étapes 6-9 : 1 INSERT historique_xp par item annulé, avec la FK appropriée (sort_id, priere_id, recette_id, assemblage_id, objet_forge_id, objet_joaillerie_id).

---

## Session 30 — Cat 2 voie A frontend (23 mai 2026)

**4 PRs mergées** : #148 (frontend modale simple), #149 (cleanup docs PK supprimés du repo), #150 (modale détaillée), #151 (commit migration `annuler_etape_items_detail`).
**1 migration DB** appliquée et committée.

### Migration appliquée

#### `20260523182119_annuler_etape_items_detail.sql` (PR #151)

Enrichit le retour `donnees` de `annuler_etape` avec un champ `items_detail` (array). Chaque entrée : `{type, type_label, nom, quantite, xp_unitaire, xp_total}`.

---

## Session 29 — Cat 1 + Cat 2 voie A backend (23 mai 2026)

**2 PRs mergées** : #146 (frontend cat 1), #147 (backend cat 2).
**1 migration DB** appliquée via MCP.

### Migration appliquée

#### `20260523152942_annuler_etape.sql` (PR #147)

Nouvelle RPC `annuler_etape(p_personnage_id uuid, p_etape_courante integer, p_dry_run boolean DEFAULT false)` pour navigation backward rollback du wizard (étapes 2-11).

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

Helper SQL `generer_formule_magique(p_cercle, p_zone, p_portee, p_duree, p_niveau)` IMMUTABLE qui retourne la formule magique déterministe selon manuel 2026 (5 mots de pouvoir). `acheter_sort` modifiée pour calculer `formule_magique` automatiquement à l'achat.

---

## Session 26 — Fix système magie (22 mai 2026)

3 PRs frontend mergées : #137 (calcul PS), #138 (système magie complet), #139 (race condition Etape7).

### Migration appliquée

`20260523000824_fix_magie_helper_calcul_xp_check_religion.sql` (PR #138)

5 bugs interconnectés corrigés simultanément. Nouvelle helper SQL `calculer_cout_xp_magie(zone, portee, duree, niveau, base)` miroir exact du frontend.

**⚠️ Point crucial** : cette migration a aussi supprimé le check `est_croyant` de la RPC `acheter_priere`. La garde frontend correspondante a été oubliée → corrigée en session 33 (hotfix Étape 7).

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

*Fin de hurlevent_migrations_log.md (clôture session 34).*

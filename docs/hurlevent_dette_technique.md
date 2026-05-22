# Hurlevent — Dette technique

> **Dernière mise à jour** : 22 mai 2026 (clôture session 24).

Document vivant qui liste les bugs connus, les dettes techniques, les
choses à revoir, les vestiges acceptables, et les apprentissages
méthodologie.

---

## 🐛 Bugs ouverts session 24 (8 nouveaux)

### #8 — Sous-menu Tabs `PersonnageFiche` illisible mobile [HAUTE]

**Découvert** : session 24, par test fonctionnel de PR #133.

**Symptôme** : sur `/personnage/:id`, le `<TabsList className="grid w-full grid-cols-8">` rend les 8 onglets (Infos | Traits | Compétences | Sorts | Prières | Artisanat | Historique | Export) sur ~47px chacun en mobile (375px viewport). Texte chevauché/écrasé, illisible.

**Impact** : empêche actuellement le test mobile complet de PR #133 (§2) sur les onglets enrichis (Sorts/Prières/Artisanat). Aussi bloquera §3 (masquage onglets vides) si pas résolu d'abord.

**Solution** : pattern scrollable horizontal déjà existant dans le repo (étape 5 du créateur, Encyclopédie sous-catégories). À dupliquer plutôt que réinventer (cf règle inventaire avant code session 23).

**Cible** : `artifacts/arlor/src/pages/PersonnageFiche.tsx` ligne ~454.

**Effort** : S (1 fichier, ~10 lignes).

**Cible** : session 25, priorité 1.

---

### #4 — Étape sorts divins sautée malgré "Acquisition de Domaine" [CRITIQUE]

**Découvert** : session 24, par test fonctionnel de Valerius.

**Symptôme** : compétence "Acquisition de Domaine (Bénédiction)" achetée dans la catégorie Prêtre à l'étape 5. Mais l'étape sorts divins (prières) est skip dans le wizard → récap étape 11 affiche "Prières divines (0) - Aucune prière".

**Hypothèse cause** : la RPC `personnage_a_des_prieres()` (ou la logique de skip d'étape) ne détecte pas correctement "Acquisition de Domaine" comme prérequis pour ouvrir l'étape prières.

**Impact** : tout joueur prêtre/croyant est privé de ses prières divines. Bloquant fonctionnel pour la classe Prêtre.

**Investigation à faire** :
1. Lire `personnage_a_des_prieres(uuid)` (langage SQL, NON security definer d'après contexte)
2. Identifier la compétence "Acquisition de Domaine" en base (UUID, table, choix_achat)
3. Vérifier la logique de skip dans `valider_etape_*` et/ou les RPC `avancer_etape_progression*`

**Cible** : session 25, priorité 2.

---

### #2 — Langues "L'Ancien*" mal placées dans menu Langue supplémentaire [HAUTE]

**Découvert** : session 24, par test fonctionnel.

**Symptôme** : le menu déroulant de la compétence "Langue supplémentaire" affiche actuellement :
- Le Drow ✓ (correct)
- L'Elfique ✓
- Le Nain ✓
- L'Orc ✓
- **L'Ancien** ❌ (n'existe pas du tout — à supprimer)
- **L'Ancien Commun** ❌ (déplacer vers Décryptage)
- **L'Ancien Démoniaque** ❌
- **L'Ancien Drow** ❌
- **L'Ancien Elfique** ❌
- **L'Ancien Nain** ❌

Les langues anciennes sont pour la compétence "Décryptage", pas "Langue supplémentaire".

**Solution** : data fix DB. Soit DELETE des 6 entrées mal placées, soit UPDATE d'un champ catégorie/scope. À investiguer (table `langues` probable + relation avec compétences).

**Effort** : S (data fix), mais nécessite inspection préalable du modèle.

**Cible** : session 25, priorité 3.

---

### #1 — Alchimie étape 8 : cases payantes pas grisées [MOYENNE]

**Découvert** : session 24.

**Symptôme** : sur étape 8 (artisanat), le quota de recettes gratuites est affiché (ex. 4/5 restant). Mais les boutons "Acheter (X XP)" sont actifs même quand le quota gratuit n'est pas épuisé. Devraient être grisés tant que quota gratuit > 0.

**Aussi** : empêcher décocher un choix gratuit si quota plein et déjà des payants sélectionnés (sinon état incohérent).

**Pattern à reprendre** : Traits raciaux (déjà implémenté précédemment).

**Cible** : `Etape8_Artisanat_V2.tsx` ou similaire.

**Effort** : M.

**Cible** : session 25-26.

---

### #3 — Assemblages runes étape 9 : cases payantes pas grisées [MOYENNE]

**Découvert** : session 24.

**Symptôme** : identique à #1, sur étape 9 (assemblages de runes). Quota gratuit 2/2 affiché, mais boutons "Acheter" actifs.

**Solution** : même pattern que #1 et que Traits raciaux.

**Cible** : `Etape9_Assemblages_V2.tsx`.

**Effort** : M.

**Cible** : session 25-26.

---

### #5 — UUID affichés au lieu de noms en étape 11 [MOYENNE]

**Découvert** : session 24.

**Symptôme** : dans `Etape11_Recapitulatif_V2.tsx` section Compétences, on voit par exemple :
- "Langue supplémentaire (0dca7806-6956-4b56-9693-9a72311fe6c3)" au lieu de "Langue supplémentaire (Le Drow)"
- "Décryptage (073762ec-4a6a-4767-85ba-2adf33c9679d)" au lieu de "Décryptage (L'Ancien Drow)"

**Hypothèse** : la colonne `personnage_competences.choix_achat` stocke un UUID (référence vers `langues.id`) qui n'est pas dénormalisé en nom dans `vue_personnage_creation_complet`.

**Solution** :
- Soit modifier la vue agrégée pour joindre et résoudre les UUID → nom
- Soit faire le lookup côté frontend (mais lourd)

**Cible** : `vue_personnage_creation_complet` (le JSONB `competences` hydraté).

**Effort** : S-M (1 migration de vue).

**Cible** : session 25-26.

---

### #6 — Dev Spirituel × N : grouper sur 1 ligne en étape 11 [FAIBLE]

**Découvert** : session 24.

**Symptôme** : en étape 11, si le joueur a acheté 5x "Développement Spirituel" (2 XP chacun), c'est affiché sur 5 lignes distinctes. Idem pour "Développement Spirituel Supérieur" (4 XP chacun).

**Comportement souhaité** : 1 seule ligne par compétence multiniveau, avec count + XP unitaire + XP total.

Exemple :
```
Développement Spirituel        × 5    2 XP / 10 XP total
Développement Spirituel Supérieur  × 5    4 XP / 20 XP total
```

**Cible** : `Etape11_Recapitulatif_V2.tsx`, section Compétences (logique d'agrégation à ajouter).

**Effort** : S (UI uniquement, agrégation `Array.reduce` par nom).

**Cible** : session 26+.

---

### #7 — Étape 11 + version imprimable : descriptions complètes manuel [MOYENNE]

**Découvert** : session 24.

**Demande Fred** : "chaque composant que ce soit la race, les traits raciaux, les competences, les recettes, les sorts Arcane ou divin, les assemblages de rune, les pièges, etc, bref tout, cest qu'il montre toute les informations les concernant comme dans le manuel des règles".

**Périmètre** :
- Étape 11 (`Etape11_Recapitulatif_V2.tsx`) doit afficher descriptions complètes
- Version imprimable (`PersonnageFiche.handlePrint()`) → déjà très complète mais à vérifier
- `PersonnageFiche` Tabs onglets : §2 a couvert Sorts/Prières/Artisanat ; **MANQUE descriptions des compétences elles-mêmes** (oubli §2 — à compléter)

**Travail** :
- Vérifier que `vue_personnage_creation_complet` JSONB hydratés contiennent les descriptions (probablement non actuellement)
- Migration de vue pour ajouter `description` aux JSONB de competences, sorts, prieres, etc.
- Régénérer types Supabase dans la même PR
- Mise à jour UI Etape11
- Mise à jour UI PersonnageFiche onglet Compétences (descriptions oubliées en §2)

**Effort** : L (gros chantier multi-fichiers + migration vue).

**Cible** : session 26+. À planifier comme Sprint 5.6 §4 ou Sprint 5.7.

---

## ✅ DETTES RÉSOLUES SESSION 24

### Valerius sans `historique_xp` ✅ RÉSOLUE

**Découvert** : session 22 (vague, "à investiguer").

**Cause racine identifiée session 24** : bug systémique sur le calcul XP. `sauvegarder_etape_1` enregistrait `gn_completes` mais aucun mécanisme DB ne convertissait ça en XP. `recalculer_xp_personnage` ignorait `gn_completes`, `mini_gn_completes`, `ouvertures_terrain`. Au choix de race, le trigger `set_xp_initial_on_race_change` écrasait `xp_total` avec `race.xp_depart` seul → les XP de GN initiaux disparaissaient.

**Fix** : migration `20260522174852_bugfix_calcul_xp_niveau_gn_initiaux` (voir log migrations).

**Validation prod** : Valerius (111 GN, Drow xp_depart=60) → xp_total=1725 ✅ (= 60 + 15·111), niveau=112 ✅ (= 1 + 111).

---

## 🔧 Dettes ouvertes pré-session 24 (inchangées)

### Bouton "Continuer/Modifier" basé sur `etape_creation` au lieu de `est_finalise`

**Découvert** : session 22.

(Voir notes session 22 pour détails.)

### Pas de script `lint` dans `artifacts/arlor/package.json`

**Découvert** : session 22.

### Mention obsolète "16 erreurs TS" dans `CLAUDE.md` (mini-PR docs)

**Découvert** : session 21.

### Cache CDN GitHub raw stale même avec `refs/heads/`

**Découvert** : session 22.

### FK `inscriptions_evenements.personnage_id` en `NO ACTION`

**Découvert** : session 22.

### Champ `est_actif` de `personnages` plus utilisé

**Découvert** : session 22.

### Doc `vue_personnage_creation_complet` inexacte sur PersonnageFiche

**Découvert** : session 24, signalé proactivement.

**Constat** : `hurlevent_fonctions_et_vues.md` (v51) disait que cette vue sert "récap étape 11 ET fiche personnage finalisée". Faux : `PersonnageFiche` utilise 7 vues granulaires distinctes. **Corrigé dans v52 de `hurlevent_fonctions_et_vues.md`.**

### Bug onglet Artisanat de PersonnageFiche : Forge et Joaillerie absents

**Découvert** : session 24, signalé proactivement.

**Constat** : la version imprimable (`handlePrint`) affiche Forge et Joaillerie. L'onglet Artisanat à l'écran (Tabs) ne montre que Assemblages + Recettes. `objetsForge` et `objetsJoaillerie` sont fetchés mais inutilisés dans le rendu Tabs.

**Effort** : S (ajouter les sections manquantes dans l'onglet Artisanat).

**Cible** : à combiner avec #8 et §3 idéalement (même fichier `PersonnageFiche.tsx`).

### Anomalie Liste_URL_RAW au démarrage session 24

**Découvert** : session 24, étape 0.

**Constat** : header daté session 20, EncyclopedieCard.tsx (créé session 23) absent. La régénération de fin session 23 n'a apparemment pas été uploadée correctement.

**Résolu en clôture session 24** : régénération via Claude Code.

**Apprentissage** : à la prochaine clôture, vérifier explicitement que le swap a bien été fait.

---

## 🎓 Apprentissages méthodologie session 24

### NOUVEAU — Test fonctionnel complet révèle bugs DB anciens

Sprint 5.6 §2 (purement UI) a déclenché un test fonctionnel complet de création de personnage par Fred, ce qui a révélé un bug critique DB ancien (XP de GN jamais persistés). Ce bug aurait dû être visible bien plus tôt mais personne ne créait de perso de bout en bout en environnement de dev.

**Méthode** : après tout PR frontend non-trivial, prévoir un scénario de création/utilisation complet pour révéler les bugs cachés du backend. Pourrait devenir une règle méthodologie #18.

### NOUVEAU — Dette technique vague masque parfois un bug critique

La dette session 22 "Valerius sans `historique_xp` — à investiguer" était formulée vaguement, sans hypothèse ni estimation d'impact. La cause racine (bug systémique calcul XP) n'a été identifiée que par test fonctionnel session 24 — 2 sessions plus tard.

**Méthode** : formuler les dettes avec :
1. Symptôme observé
2. Hypothèse cause racine
3. Impact estimé (cosmétique / fonctionnel / data)
4. Effort estimé (S/M/L)

Pourrait devenir une règle méthodologie #19.

### NOUVEAU — Workflow validation Sol A pour bugfix DB systémique

Pattern observé session 24 et à répliquer :
1. Diagnostic complet (lecture RPC + triggers + CHECK constraints)
2. Identification cause racine
3. Présentation 3 solutions (A : calcul dérivé / B : nouvelle entrée historique / C : type existant)
4. Recommandation argumentée
5. Test en `BEGIN/ROLLBACK` avec 3 scénarios représentatifs (avant/touch1/touch2)
6. `apply_migration` via MCP avec data fix idempotent inclus
7. Validation prod via SELECT immédiat
8. Commit du `.sql` dans le repo via prompt CC

---

## 📊 Sessions consécutives Vercel auto-trigger : **20**

Premier signalement : session 5. Dernière vérification : session 24 (PR #133).

---

*Fin de hurlevent_dette_technique.md (clôture session 24).*

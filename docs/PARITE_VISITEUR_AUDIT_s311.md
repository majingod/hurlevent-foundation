# Audit de parité wizard serveur ↔ moteur visiteur (s311)

> **Audit en lecture seule** — aucun correctif appliqué ; les fixes seront des lots séparés.
>
> **Périmètre** : les **68 méthodes** de l'interface `ClientCreation`
> (`artifacts/arlor/src/creation/types.ts`) — 26 écritures (RPC) + 42 lectures —
> comparées règle par règle entre le SQL serveur (dernière définition dans
> `supabase/migrations/`) et l'implémentation visiteur
> (`artifacts/arlor/src/creation/visiteur/clientVisiteur.ts` + `artifacts/arlor/src/moteurCreation/`).
> **Couverture : 68 méthodes / 68 méthodes** (voir la table de correspondance en annexe A).
>
> **Méthode** : pour chaque RPC, la définition SQL en vigueur a fait foi (pas les
> commentaires de code) ; pour chaque lecture, le SELECT réel de `clientServeur.ts` et le
> SQL des vues. Les divergences volontairement hors scope citent `TROUS_A3II.md`
> (`artifacts/arlor/TROUS_A3II.md`). La colonne « Test ? » indique si un test côté
> visiteur/moteur verrouille spécifiquement la règle.
>
> Gravité : 💥 divergence joueur-visible · ⚠️ divergence silencieuse · 📝 hors scope documenté · ✅ conforme.

---

## TOP 5 des trous par gravité

1. **💥 Économie XP divergente à deux endroits fondamentaux.**
   (a) `xp_total` : `calculerXp` (`moteurCreation/deriveurs.ts:149-153`) force
   `gn_completes`/`mini_gn_completes`/`ouvertures_terrain` à 0, alors que l'étape 1 offline
   les collecte et promet « +15 XP » — le serveur les compte
   (`xp_depart + gn×15 + mini×15 + ouvertures×10`).
   (b) Rabais « Acquisition de Cercle/Domaine » : le serveur débite
   `GREATEST(base − nb items, 0)` et stocke `xp_depense` réduit
   (`acheter_competence`, migration 20260617210831) ; le moteur visiteur facture le **plein
   tarif** (`brouillon/deriver.ts:240`, `grep rabais moteurCreation/ → 0 hit`) alors que
   l'écran affiche le prix réduit via l'aperçu. Conséquences en chaîne : header XP faux,
   gates « XP insuffisant » faussées, badge « Gratuit » (`xp_depense===0`) divergent,
   remboursements de désachat divergents. Non documenté.

2. **💥 Changement de classe en cours de wizard sans cascade serveur.**
   `sauvegarder_etape_4` serveur délègue à `changer_classe_personnage(p_dry_run:false)`
   dès que la classe change : purge des compétences payantes class-locked/over-cap +
   cascade prérequis, mise en sommeil des sorts/prières, refund D6, remboursements. Le
   visiteur fait un simple swap de `classeId` (seules les gratuités se recomposent). Un
   visiteur qui revient à l'étape 4 et change de classe garde des compétences que le
   serveur supprimerait. `TROUS_A3II §4` ne couvre que le dry-run et son affirmation
   « chemin réel jamais appelé par les écrans » est périmée (atteint via `Etape4_V2`).

3. **💥 Désachats infidèles (3 mécanismes).**
   (a) `desacheter_piege` : la **cascade ascendante** serveur (palier ciblé + tous les
   paliers ≥ N de la famille) n'est pas portée — l'écran Étape 9 promet pourtant la
   cascade dans son dialogue → paliers orphelins, XP annoncée fausse.
   (b) `desacheter_competence` : le visiteur **invente** une purge des sorts/prières par
   cercle/domaine fermé que le SQL A6 n'effectue pas (purge totale uniquement sur chute
   d'« Acquisition de Sort/Prière ») — `TROUS_A3II §2` qualifie à tort ce comportement de
   fidèle.
   (c) Identité d'instance effondrée : les ids synthétiques (`ps␁<sortId>`,
   `(comp,niveau,choix)`…) désignent le **catalogue**, pas l'instance → désacheter un
   sort/une prière/une compétence `multiple_sans_choix` supprime **toutes les copies**
   d'un coup (XP cumulée), là où le serveur supprime une ligne.

4. **💥 `lireArtisanatQuotas` : les 7 colonnes `quota_*_utilises` posées à `null`.**
   Étape 9 les consomme (`?? 0`) → compteurs « X/Y utilisés » figés à 0, `quotaRestant`
   jamais décrémenté, badge gratuit/payant mensonger dès quota épuisé. Aggravant :
   **`TROUS_A3II §1` affirme l'inverse** (« quotas totaux et utilisés dérivés
   fidèlement ») — et la donnée est trivialement dérivable de
   `etat.contexte*.{…}Acquis[].estGratuit`.

5. **💥 Pertes de données joueur-visibles en rafale.**
   (a) `modifierSort`/`modifierPriere` écrasent `nom_personnalise` avec `undefined`
   (le serveur fait `COALESCE`, les écrans omettent le param quand inchangé).
   (b) `lirePersonnagePrieres.duree_incantation_calculee: null` → le badge
   « Incantation : N s » d'Étape 7 disparaît, alors que `calculerDureeIncantation` est
   porté et testé.
   (c) `lireObjetsForge` : la table `reparations_forge` n'est **pas exportée** par la RPC
   `snapshot_visiteur()` → `reparation: null` pour 100 % des objets, le bloc réparation
   d'Étape 9 disparaît pour les 11 objets réparables.
   (d) `demarrerCreationPersonnage` **écrase** le brouillon finalisé (slot localStorage
   unique) là où le serveur crée un nouveau personnage et conserve l'ancien.

### Recommandation d'ordre de fix

1. **Lot XP** (TOP 1) : compteurs GN dans `calculerXp` + modélisation du rabais à l'achat
   (et `xp_depense` stocké au tarif réduit) — c'est la fondation dont dépendent gates,
   badges et remboursements.
2. **Lot lectures triviales** (TOP 4 + 5b/5c) : `quota_*_utilises`,
   `duree_incantation_calculee`, `formule_magique`, export `reparations_forge` dans
   `snapshot_visiteur()` — fixes mécaniques, très visibles, sans refonte.
3. **Lot désachats** (TOP 3) : cascade pièges, retrait de la purge cercle/domaine
   inventée, vrais ids d'instance (uuid local par achat).
4. **Lot changement de classe** (TOP 2) : porter la cascade réelle (ou, a minima,
   verrouiller l'étape 4 offline après achats + documenter).
5. **Lot cosmétique/verbatim** : labels de prérequis (`formater_prereq_label`,
   `formater_classes_requises_label`), gate « Race inapte à la magie », avertissements
   `info_*` étapes 5/6/7, protection du perso finalisé au re-`demarrer`.
6. **Transverse** : corriger les inexactitudes de `TROUS_A3II.md` (§1, §2, §4,
   « code mort jusqu'à P2-b ») et ajouter des tests de parité sur les lectures et les
   désachats (aujourd'hui : zéro test sur les deux).

---

## Matrice de parité (une ligne par règle)

Les écritures sont désignées par leur nom de RPC (mapping 1:1 avec la méthode
`ClientCreation`, documenté dans `types.ts`) ; les lectures par leur nom de méthode.

### Écritures — cycle de vie

| Méthode | Règle serveur (résumé + message verbatim si gate) | Visiteur | Test ? | Gravité |
|---|---|---|---|---|
| `demarrer_creation_personnage` | Gate auth : « Authentification requise pour démarrer la création d'un personnage. » (`non_authentifie`) | Hors scope — omission auth documentée (en-tête §C clientVisiteur.ts l.776-778 + TROUS_A3II §6) | ❌ aucun | 📝 |
| `demarrer_creation_personnage` | Gate profil : « Aucun profil actif valide pour ce compte. » (`profil_introuvable`) | Hors scope §6 ; `p_profil_id` ignoré (`PROFIL_VISITEUR_LOCAL`) | ❌ aucun | 📝 |
| `demarrer_creation_personnage` | Gate `brouillon_existant` : brouillon actif non verrouillé `etape_creation < 11` → « Vous avez déjà un personnage en cours de création. » + donnees `{personnage_id, etape_creation}` | Verbatim (l.784-789) | ❌ aucun | ✅ |
| `demarrer_creation_personnage` | Effet : INSERT d'un NOUVEAU personnage (l'ancien finalisé/étape 11 conservé en base) | Divergent : `creerBrouillonVide()` ÉCRASE le brouillon finalisé (slot localStorage unique) — le personnage finalisé visiteur est détruit ; non documenté | ❌ aucun | 💥 |
| `demarrer_creation_personnage` | Retour succès : `{personnage_id, etape_creation: 1}` | Verbatim (id = `visiteur-local`) | ❌ retour jamais asserté | ✅ |
| `etat_edition_personnage` | Introuvable : `etat: null` + `raison` « Personnage introuvable. » + 11 champs neutres | Verbatim (l.1054-1066) | ❌ aucun | ✅ |
| `etat_edition_personnage` | État `mort` : « Personnage mort — lecture seule. » | Absent — sans objet offline (pas de cimetière) | ❌ aucun | 📝 |
| `etat_edition_personnage` | État `mort_en_attente` : « Demande de mort en attente — fiche verrouillée jusqu'à la décision du staff. » + `demande_mort_epitaphe` | Absent — sans objet offline ; `demande_mort_epitaphe: null` | ❌ aucun | 📝 |
| `etat_edition_personnage` | État `brouillon` (NOT est_finalise) : « En création (wizard). », `peut_tout_editer/peut_ajouter/rattrapage_editable = true` | Verbatim (l.1054-1059) | ❌ aucun | ✅ |
| `etat_edition_personnage` | État `gele` (fenêtre `gel_heures_avant`, défaut 24 h) : « Événement imminent (moins de X h) — fiche gelée jusqu'à la confirmation des présences. » | Hors scope §6 (pas d'événements offline) | ❌ aucun | 📝 |
| `etat_edition_personnage` | État `campagne` : « En campagne — ajouts et améliorations uniquement (nom/race/traits figés). » | Hors scope §6 | ❌ aucun | 📝 |
| `etat_edition_personnage` | État `remodelage_libre` (finalisé, jamais présent) : « Remodelage libre — tout est modifiable. » | Divergent : après finalisation offline, le visiteur renvoie toujours `brouillon`/« En création (wizard). » ; non documenté | ❌ aucun | ⚠️ |
| `etat_edition_personnage` | Champs retournés : les 11 clés du contrat | Toutes présentes, valeurs neutres pour les clés événement | ❌ aucun | ✅ |
| `avancer_etape` | Gate auth « Authentification requise. » | Hors scope §6 | ❌ aucun | 📝 |
| `avancer_etape` | Gate plage : hors 5..9 → « avancer_etape ne couvre que les etapes 5 a 9. » (`etape_invalide`) | Verbatim (l.1034-1036, orthographe sans accents comprise) | ✅ clientVisiteur.test.ts « etape_invalide hors 5..9 » | ✅ |
| `avancer_etape` | Gate « Personnage introuvable. » (`personnage_introuvable`) | Partiel : id inconnu → code `PERSONNAGE_INCONNU` (message identique) ; brouillon absent → `BROUILLON_ABSENT` « Aucun brouillon en cours. Démarrez une création. » (message différent) | ❌ aucun | ⚠️ |
| `avancer_etape` | Gate ownership « Ce personnage ne vous appartient pas. » | Hors scope §6 | ❌ aucun | 📝 |
| `avancer_etape` | Gate `personnage_est_modifiable` : « Ce personnage ne peut plus être modifié (verrouillé par l'animation ou inscrit à un événement confirmé). » | Hors scope §6 (gel/verrou) | ❌ aucun | 📝 |
| `avancer_etape` | `valider_etape_5` — avertissement `info_aucune_competence_payante` « Vous n'avez acheté aucune compétence supplémentaire » si `count(personnage_competences)=0` — gratuités de classe INCLUSES (matérialisées à l'étape 4, les 4 classes en ont 2-3 → quasi jamais déclenché online) | Divergent : le visiteur teste `acquisitions.competences.length === 0` (achats PAYANTS seuls) → avertissement affiché offline pour tout perso sans achat payant, jamais online | ✅ mais verrouille le comportement DIVERGENT (« étape 5 sans compétence payante → avertissement, valide ») | 💥 |
| `avancer_etape` | `valider_etape_6` — gates sorts : « Le sort X appartient au cercle Y, non débloqué » / « Le sort X (niveau N) dépasse le max M du cercle Y » | Verbatim messages (l.1821-1837) ; mais 1re erreur seulement (SQL accumule) ; sorts `dormants` inexistants offline (TROUS §4) | ❌ aucun sur `validerEtape(6)` | ⚠️ |
| `avancer_etape` | `valider_etape_6` — avertissement `info_cercle_sans_sort` : « Vous avez débloqué un ou plusieurs cercles mais n'avez acheté aucun sort » | Absent (retour `ok` dès `sorts.length === 0`) ; non documenté | ❌ aucun | 💥 |
| `avancer_etape` | `valider_etape_7` — gates prières : « La prière X appartient au domaine Y, non débloqué » / « La prière X (niveau N) dépasse le max M du domaine Y » | Verbatim (l.1839-1855) ; même limite « 1re erreur seulement » | ❌ aucun | ⚠️ |
| `avancer_etape` | `valider_etape_7` — avertissement `info_domaine_sans_priere` : « Vous avez débloqué un ou plusieurs domaines mais n'avez acheté aucune prière » | Absent ; non documenté | ❌ aucun | 💥 |
| `avancer_etape` | `valider_etape_8` — ignorée si non runiste ; « Quota assemblages gratuits dépassé (u/t) » (`artisanat_quota_depasse`) | Verbatim (l.1857-1864) | ❌ aucun direct | ✅ |
| `avancer_etape` | `valider_etape_9` — ignorée si aucune compétence Alchimie/Forge/Joaillerie ; « Quota recettes alchimie mineure/intermédiaire/majeure dépassé (u/t) » | Messages verbatim ; condition d'application approximée (`niveauAlchimie < 1`) — verdict identique en pratique ; forge/joaillerie = TROUS §1 | ❌ aucun | ✅ |
| `avancer_etape` | Incrément conditionnel idempotent : `etape_creation = p_etape_courante` → +1, sinon inchangé | Verbatim (`avancerVers`, l.1766-1769) | ✅ indirect | ✅ |
| `avancer_etape` | Retour échec : TOUTES les erreurs + `donnees.etape_creation_apres` | Partiel : 1 seule erreur (`erreurs[0]`) ; `donnees` sans `etape_creation_apres` | ❌ aucun | ⚠️ |
| `avancer_etape` | Retour succès : `{personnage_id, etape_creation_apres}` + avertissements | Verbatim (l.1043-1046) | ✅ test étape 5 | ✅ |
| `valider_personnage_final` | Introuvable : `{valide:false, est_verrouille:false, erreurs:[{personnage_introuvable, « Personnage introuvable »}]}` (sans point) | Verbatim (l.1073-1080, forme plate respectée) | ❌ aucun | ✅ |
| `valider_personnage_final` | Gate ownership : « Vous n'êtes pas autorisé à finaliser ce personnage » (`non_autorise`) | Hors scope §6 | ❌ aucun | 📝 |
| `valider_personnage_final` | Gate « Ce personnage est déjà verrouillé » (`personnage_deja_verrouille`) | Absent : re-appel après finalisation offline re-valide et renvoie `valide:true` ; rattachable au « verrou DB » §6 mais divergence observable | ❌ aucun | ⚠️ |
| `valider_personnage_final` | Boucle agrégée `valider_etape_1..10` : accumulation de TOUTES les erreurs des 10 étapes | Partiel : boucle présente (l.1084-1088) mais 1re erreur par étape ; revalidations amputées : étape 2 → seul `race_manquante` (manquent sous-type et `race_demande_refusee`), étape 3 → `return ok` sec, étape 4 → seul `classe_manquante`. Un brouillon sauvé en `p_brouillon:true` peut finaliser offline là où le serveur refuse | ❌ aucun | ⚠️ |
| `valider_personnage_final` | `valider_etape_10` : « XP dépensée (X) supérieure à XP totale (Y) » (`xp_insuffisant`) | Verbatim (l.1884-1889) | ❌ aucun | ✅ |
| `valider_personnage_final` | Effet succès : `UPDATE personnages SET est_verrouille=true, est_finalise=true, etape_creation=11` | Partiel documenté : seul `meta.etapeCourante = 11` (« aucune écriture serveur — sync = lot a4 ») ; brouillon conservé | ✅ regressionBugsS311 « BUG C » + « wizard complet simulé » | 📝 |
| `valider_personnage_final` | Retour : `{valide, est_verrouille, erreurs, avertissements}` | Verbatim (l.1089-1098) | ✅ wizard complet | ✅ |
| `corriger_xp_personnage` | Gate staff : « Action réservée au staff. » (`acces_refuse`) | Remplacé par refus global `INDISPONIBLE_VISITEUR` « Cette action nécessite un compte. » — documenté (commentaire §50, l.1102) | ✅ « corrigerXp → refus poli » | 📝 |
| `corriger_xp_personnage` | Gate `montant_invalide` : « Le montant doit être non nul. » | Absent (refus global) | ❌ aucun | 📝 |
| `corriger_xp_personnage` | Gate « Personnage introuvable. » | Absent (refus global) | ❌ aucun | 📝 |
| `corriger_xp_personnage` | Gate `correction_excessive` : « Retrait impossible : X XP non dépensés seulement. Désacheter des éléments d'abord pour libérer de l'XP. » | Absent (refus global) | ❌ aucun | 📝 |
| `corriger_xp_personnage` | Effets : INSERT `historique_xp` + `creer_notification` + `log_audit` (+ trigger `xp_total`) | Absents (action staff sans objet visiteur) | ❌ aucun | 📝 |
| `corriger_xp_personnage` | Retour succès : `{xp_corrige, xp_total, xp_disponible}` | Jamais produit (refus global) | ✅ asserte `succes:false` | 📝 |

### Écritures — étapes 1-4 + changement de classe

| Méthode | Règle serveur (résumé + message verbatim si gate) | Visiteur | Test ? | Gravité |
|---|---|---|---|---|
| `sauvegarder_etape_1` | Gates auth/ownership : « Authentification requise. », « Personnage introuvable. », « Ce personnage ne vous appartient pas. » | Hors scope §6 ; `guardPerso`/`repBrouillonAbsent` en tiennent lieu | ❌ aucun | 📝 |
| `sauvegarder_etape_1` | Gate campagne : « En campagne, l'identité du personnage est figée (nom, compteurs d'expérience, croyance). Seuls l'historique et l'âme du personnage restent modifiables. » | Absent — famille gel §6 | ❌ aucun | 📝 |
| `sauvegarder_etape_1` | Gate rattrapage : « Tes compteurs d'expérience sont figés tant que tu es inscrit à un événement. Désinscris-toi pour les modifier. » | Absent — famille gel §6 ; `rattrapage_editable: true` en dur | ❌ aucun | 📝 |
| `sauvegarder_etape_1` | UPDATE `historique`/`ame_personnage` avec **COALESCE** (NULL ⇒ conserve l'existant) | Partiel : `appliquerEtape1` remplace tout `etape1` ⇒ appel sans `p_historique` EFFACE l'historique (théorique : Etape1_V2 passe toujours `?? ""`) | ❌ aucun | ⚠️ |
| `sauvegarder_etape_1` | `p_brouillon=true` : persiste sans valider/avancer/loguer ; retour `{personnage_id, brouillon:true, etape_creation_apres}` | Verbatim (l.813-821) | ❌ indirect (stockageBrouillon.test.ts) | ✅ |
| `sauvegarder_etape_1` | « Le nom du personnage est obligatoire » (`nom_manquant`) / « Le nom doit contenir au moins 2 caractères » (`nom_trop_court`) | Verbatim (l.824-829) | ✅ deux tests dédiés | ✅ |
| `sauvegarder_etape_1` | « Un personnage croyant doit avoir une religion » (`religion_manquante`) / « Un personnage non-croyant ne doit pas avoir de religion » (`religion_incoherente`) | Verbatim (l.830-835) | ✅ deux tests dédiés | ✅ |
| `sauvegarder_etape_1` | « Le nombre de GN complétés ne peut pas être négatif » (`gn_completes_negatif`) | Verbatim (l.836-838) | ✅ test dédié | ✅ |
| `sauvegarder_etape_1` | Sémantique serveur : **persiste d'abord, valide ensuite** (échec ⇒ champs quand même enregistrés) | Divergent : le visiteur ne sauve qu'après validation réussie ⇒ état post-échec différent | ❌ aucun | ⚠️ |
| `sauvegarder_etape_1` | `valider_etape_1` accumule toutes les erreurs | Partiel : 1re erreur seulement ; les écrans ne lisent que `erreurs[0]` | ❌ aucun | ⚠️ |
| `sauvegarder_etape_1` | Avancement 1→2 si `etape_creation=1` ; retour `etape_creation_apres` | Verbatim (`avancerVers(b,1,2)`) | ✅ « cas passant » | ✅ |
| `sauvegarder_etape_1` | `log_audit` conditionnel | Absent (audit serveur, §6 par extension) | ❌ aucun | 📝 |
| `sauvegarder_etape_2` | Gates auth/ownership/gel (`gate_edition_personnage 'complet'`) | Hors scope §6 | ❌ aucun | 📝 |
| `sauvegarder_etape_2` | UPDATE `race_id`/`sous_type_chimeride` AVANT validation | Divergent : persiste après validation | ❌ aucun | ⚠️ |
| `sauvegarder_etape_2` | `p_brouillon=true` : persiste race/sous-type sans toucher la demande de race, sans valider/avancer | Verbatim (l.856-860) | ❌ aucun | ✅ |
| `sauvegarder_etape_2` | Effet de bord demande de race (Chiméride / Les Non-Races) : DELETE + `creer_demande_race` ; avertissement `demande_race_echec` « Création de la demande de race échouée. » | Absent intégralement (pas de `personnage_races_demandes` offline). Non documenté. Impact offline limité | ❌ aucun | ⚠️ |
| `sauvegarder_etape_2` | « La race est obligatoire » (`race_manquante`) | Verbatim (l.863-865) | ✅ test dédié | ✅ |
| `sauvegarder_etape_2` | « Un Chiméride doit avoir un sous-type (carnivore ou herbivore) » / « Seuls les Chimérides ont un sous-type » | Verbatim (l.866-881, détection par nom comme le SQL) | ✅ deux tests dédiés | ✅ |
| `sauvegarder_etape_2` | Gate « La demande pour cette race a été refusée » (`race_demande_refusee`) | Absent — inatteignable offline ; non documenté | ❌ aucun | ⚠️ |
| `sauvegarder_etape_2` | Avancement 2→3 ; retour `etape_creation_apres` + avertissements | Verbatim | ✅ « wizard complet simulé » | ✅ |
| `sauvegarder_etape_3` | Gates auth/ownership/gel | Hors scope §6 | ❌ aucun | 📝 |
| `sauvegarder_etape_3` | **Recompute serveur** : N premiers traits (N=`nb_traits_raciaux`) gratuits/0 XP, suivants au `cout_xp` de la vue — flags client IGNORÉS ; retour = tableau **normalisé** | Partiel : dérivation XP fidèle (fix VIS-3 s311, deriver.ts l.308-320) ; MAIS le brouillon stocke et retourne le tableau BRUT du client (l.909/977) | ✅ regressionBugsS311 « VIS-3 » (5 its) ; normalisation du retour non testée | ⚠️ |
| `sauvegarder_etape_3` | Diff append-only `historique_xp` (messages « Achat/Remboursement trait racial… ») même en brouillon | Absent : pas de grand livre offline (XP re-dérivée) ; non consommé par `ClientCreation` | ❌ aucun | ⚠️ |
| `sauvegarder_etape_3` | Persistance AVANT validation | Divergent : après validation | ❌ aucun | ⚠️ |
| `sauvegarder_etape_3` | « Sélectionnez une race avant de choisir des traits » (`race_manquante`) | Verbatim (l.914-917) | ✅ test dédié | ✅ |
| `sauvegarder_etape_3` | « Vous devez choisir exactement %s trait(s) gratuit(s), pas %s » (`traits_gratuits_quota_incorrect`) | Verbatim (l.923-930) | ✅ message exact asserté | ✅ |
| `sauvegarder_etape_3` | « Un même trait apparaît plusieurs fois » (`traits_doublon`) | Verbatim (l.931-938) | ✅ test dédié | ✅ |
| `sauvegarder_etape_3` | « Le trait %s n'est pas accessible à cette race » — EXISTS `race_traits` avec **`(sous_type IS NULL OR sous_type = sous_type_chimeride)`** | Partiel : l.941 teste `race_id`+`trait_id` seulement, le filtre `sous_type` est OMIS ⇒ un Chiméride carnivore peut valider un trait herbivore offline. Atténué par `peutAcheterTraitRacial` (gatesTraits.ts l.38-45) qui porte le sous_type | ✅ cas race sans trait / ❌ cas sous_type | ⚠️ |
| `sauvegarder_etape_3` | « Le trait %s est gratuit mais a un xp_depense non nul » / « Le trait %s coûte %s XP, pas %s » | Verbatim (l.950-969, même source de coût) | ✅ deux tests dédiés | ✅ |
| `sauvegarder_etape_3` | Avancement 3→4 ; retour `etape_creation_apres` + `traits_raciaux_choisis` | Verbatim (hors normalisation signalée) | ✅ wizard complet | ✅ |
| `sauvegarder_etape_4` | Gates auth/ownership/gel | Hors scope §6 | ❌ aucun | 📝 |
| `sauvegarder_etape_4` | `p_brouillon=true` : persiste UNIQUEMENT `classe_id` (choix jetés) | Partiel : `appliquerEtape4` persiste classeId ET `choixParCompetence` — état persisté divergent, sans conséquence dérivée immédiate | ✅ indirect | ⚠️ |
| `sauvegarder_etape_4` | **Si classe déjà posée et différente ⇒ délégation `changer_classe_personnage(p_dry_run:false)`** : purge class-locked/over-cap/cascade, dormance sorts/prières, D6, remboursements, gate `choix_requis` « Choisissez quelle instance de « %s » devient gratuite » | **Absent** : simple swap dans tous les cas ; seules les gratuités se recomposent (`appliquerGratuites`). Compétences payantes conservées à tort, pas de dormance, pas de D6 ⇒ liste et XP divergent après changement de classe en cours de wizard. TROUS §4 ne couvre que le dry-run (affirmation « chemin réel jamais appelé » périmée) | ✅ purge gratuités seulement / ❌ cascade payante | 💥 |
| `sauvegarder_etape_4` | Sinon : UPDATE `classe_id` + `attribuer_competences_gratuites_classe` (purge lignes `xp_depense=0` hors gratuités nouvelle classe ; insertion idempotente) | Verbatim par recompute : purge sur flag de provenance `estGratuiteClasse` (fix s311-A, plus fidèle à l'intention que `xp=0`) + réinsertion idempotente | ✅ gratuites.test.ts ×3 + regressionBugsS311 BUG A | ✅ |
| `sauvegarder_etape_4` | `attribuer…` : choix obligatoire si `type_choix` non nul — « Un choix de type "%s" est obligatoire pour %s » (`choix_manquant`), avec **fallback religion = `personnages.religion_id`** | Partiel : le refus visiteur émet le message de `valider_etape_4` (« Choix de %s manquant pour %s ») au lieu de celui d'`attribuer…` (celui réellement retourné) ; fallback religion non appliqué dans le refus ⇒ refuse un croyant sans choix explicite là où le serveur accepte. `appliquerGratuites` (dérivation) porte fallback + message SQL exact mais généralisé à tout `type_choix` | ✅ partiels (gratuites.test fallback religion) | ⚠️ |
| `sauvegarder_etape_4` | Effet religion : choix `type_choix='religion'` ⇒ `UPDATE personnages SET religion_id, est_croyant=true` | Partiel : l'état dérivé adopte la religion mais `etape1.religionId/estCroyant` du brouillon non réécrits ⇒ `lirePersonnage`/`Identite` affichent l'ancienne religion | ✅ dérivé seulement | ⚠️ |
| `sauvegarder_etape_4` | « La classe est obligatoire » / « La classe sélectionnée n'existe pas » / « Choix de %s manquant pour %s » | Verbatim (l.998-1019) | ✅ trois tests dédiés | ✅ |
| `sauvegarder_etape_4` | Persistance/attribution AVANT validation | Divergent : après validation | ❌ aucun | ⚠️ |
| `sauvegarder_etape_4` | Avancement 4→5 ; retour `etape_creation_apres` | Verbatim | ✅ wizard complet | ✅ |
| `changer_classe_personnage` | Gates : « Authentification requise », « Personnage introuvable », « Accès refusé à ce personnage » | Hors scope §6 | ❌ aucun | 📝 |
| `changer_classe_personnage` | Gate « Classe cible introuvable ou inactive » (`classe_introuvable`) | Absent : `find` sans erreur (`classe_apres: null`) | ❌ aucun | ⚠️ |
| `changer_classe_personnage` | Gate « Le personnage possède déjà cette classe » (`classe_identique`) | Absent : aperçu no-op accepté | ❌ aucun | ⚠️ |
| `changer_classe_personnage` | Gel appliqué hors dry-run uniquement | Hors scope §6 — cohérent par vacuité | ❌ aucun | 📝 |
| `changer_classe_personnage` (dry-run) | Simulation complète : `perdues[]`, `dormants[]`, `maitre_en_attente[]`, `offertes[]` (`ajout`/`d6_refund`), `multi_choix[]` (+ labels + `defaut`), `xp_rembourse` global | Hors scope documenté TROUS §4 : tableaux vides, `xp_rembourse` = `max(0, ΔxpDispo)` re-dérivé (l.1116-1127) | ❌ aucun | 📝 |
| `changer_classe_personnage` (dry-run) | Avertissements `maitre_requis` « « %s » niveau %s passe hors-classe : approbation d'un maître désormais requise. » | Absent (aperçu vide §4) | ❌ aucun | 📝 |
| `changer_classe_personnage` (réel) | Application complète : remboursements `historique_xp` (messages verbatim), DELETE, `statut_maitre='en_attente'`, D6 `xp_depense=0`, INSERT gratuites, UPDATE classe ; retour `xp_total/xp_depense/xp_restant` | Partiel/documenté §4 — seul swap + recompute gratuités ; purge payantes/cascade/dormance/D6/champs xp_* absents (même trou que la délégation étape 4). Chemin jamais appelé directement par les écrans | ✅ partiel (purge gratuités) | 📝/⚠️ |

### Écritures — compétences

| Méthode | Règle serveur (résumé + message verbatim si gate) | Visiteur | Test ? | Gravité |
|---|---|---|---|---|
| `verifier_prerequis_competences` | Perso introuvable → `{"erreur": "Personnage introuvable"}` | Verbatim (brouillon absent → même objet) | ❌ aucun | ✅ |
| `verifier_prerequis_competences` | Pastille **classe** au niveau 1 : `acquis`/`manquant` si classe ∈ `classes_requises`, SANS entrer dans `v_manquants` ni réduire `niveau_max_achetable`, `competence_id: null` | Verbatim (logique) | ✅ clientVisiteur.test.ts §D.4 (2 cas) | ✅ |
| `verifier_prerequis_competences` | Label pastille classe = `formater_classes_requises_label` → « Classe Guerrier ou Prêtre » (préfixe + capitalisation) | Divergent : `classes_requises.join(" ou ")` → « guerrier ou pretre » (slugs bruts) — affiché dans la pastille | ❌ aucun | 💥 |
| `verifier_prerequis_competences` | Labels prérequis compétence = `formater_prereq_label` → « X Niv N », ou **nom seul** si cible mono-niveau | Divergent : toujours « X niveau N » — visible dans pastilles ET `raisons_par_niveau` | ❌ aucun | 💥 |
| `verifier_prerequis_competences` | `competence_id` de chaque pastille = id résolu (pastille **cliquable** dans Étape 5) | Absent : toujours `null` → pastilles statiques offline | ❌ aucun | ⚠️ |
| `verifier_prerequis_competences` | Prérequis `special` (`depecage_creat1/creat2/ps`, `dev_spirituel_20ps`) + leurs labels | Absents ; blocage réel assuré par `peutAcheterCompetence` | ✅ blocage (gatesCompetences.test.ts) / ❌ pastilles | 📝 TROUS §7 |
| `verifier_prerequis_competences` | Gabarit « Prérequis manquant(s) : %s » ; `niveau_max_achetable` = premier niveau en échec − 1 ; condition d'émission | Verbatim (gabarit + algo) ; seul le CONTENU des labels diverge | ✅ regressionBugsS311 BUG B #2 | ✅ |
| `verifier_prerequis_competences` | Périmètre : `competences WHERE est_actif = true` | Partiel : itère tout le snapshot sans filtre (excédent non affiché car l'écran filtre) | ❌ aucun | ⚠️ |
| `apercu_rabais_acquisition_competence` | `type_choix ∉ (cercle, domaine)` ou compétence inconnue → `[]` | Verbatim | ❌ aucun | ✅ |
| `apercu_rabais_acquisition_competence` | Éligibilité d'un item : **niveau CATALOGUE** (`sorts.niveau`/`prieres.niveau`) ≤ seuil (5 pour niv 2, 10 pour niv 3), statut `achete\|cree` | Divergent : compte sur le niveau d'INSTANCE choisi au constructeur → `nb`/`cout_final`/`rabais` faux dès qu'un sort est construit à un niveau ≠ catalogue (l'écran s'en sert pour l'affichage ET l'affordability) | ❌ aucun | 💥 |
| `apercu_rabais_acquisition_competence` | `cout_base` = `niveaux[].cout_xp` ; `cout_final = GREATEST(base − nb, 0)` ; `rabais = base − cout_final` | Verbatim (formule) | ❌ aucun | ✅ |
| `apercu_rabais_acquisition_competence` | Ne renvoie QUE `nb > 0` ; tri `ORDER BY choix, niveau` | Partiel : renvoie aussi `nb = 0`, ordre d'insertion — sans impact (indexation par clé) | ❌ aucun | ⚠️ |
| `apercu_rabais_acquisition_competence` | auth/ownership → `[]` | Omis | — | 📝 §6 |
| `acheter_competence` | Gates `non_authentifie`/`personnage_introuvable`/`ownership_refuse`/gel/`contrainte_violee` (SQLERRM) | Omis (guards locaux) | ✅ guards | 📝 §6 |
| `acheter_competence` | Gate `peut_acheter_competence` → refus `achat_refuse` avec raison verbatim (« Classe requise : … », « Niveau %s inaccessible hors de votre classe (maximum autorisé : %s) », « Un choix est obligatoire », « Prérequis manquant(s) : … », « XP insuffisant. Requis : %s \| Disponible : %s », etc.) | Verbatim via `peutAcheterCompetence` (au caractère près) ; champ `code` non posé (écran lit `message`) | ✅ pariteVisiteur (88 verdicts prod rejoués) + parite.test.ts (88) + gatesCompetences.test.ts | ✅ |
| `acheter_competence` | Sous-gate race inapte : Demi-Orc « Inapte à la magie » + Développement Spirituel → « Race inapte à la magie : impossible d'augmenter les points de spiritualité » | **Absent** : gatesCompetences.ts l.28-29 saute explicitement le check alors que `ctx.raceInapteMagie` est disponible → achat AUTORISÉ offline | ❌ aucun | 💥 |
| `acheter_competence` | `niveau_invalide` « Niveau de compétence invalide » | Non porté tel quel mais inatteignable (refus amont identique des deux côtés) | ✅ niveau non défini | ✅ |
| `acheter_competence` | **Rabais à l'achat** (niv 2/3 + `type_choix cercle/domaine`) : `cout_xp = GREATEST(base − nb, 0)` débité, `xp_depense` stocké réduit, étiquette `rabais_items` par ID D'INSTANCE | **Absent** : aucune notion de rabais dans le moteur (`grep rabais moteurCreation/ → 0`) ; plein tarif débité (deriver.ts l.240) alors que l'écran affiche le prix réduit → `xp_restant` divergent, achats suivants bloqués à tort | ❌ aucun | 💥 |
| `acheter_competence` | Étiquette `rabais_items` (support des reprises au désachat sort/prière) | Absent (`rabais_items: null` en lecture) ; la reprise est documentée non portée | ❌ aucun | 📝 §2 |
| `acheter_competence` | Gate XP interne (coût rabais-ajusté) — mort en pratique (gate amont au plein tarif) | Équivalent : gate XP plein tarif des deux côtés | ✅ cas XP | ✅ |
| `acheter_competence` | `p_appris_via_maitre`/`p_nom_maitre` → `statut_maitre='en_attente'`/`'non_requis'`, `nom_maitre` stocké (l'écran ENVOIE ces params) | **Absent** : params ignorés, info maître perdue ; lecture renvoie `false`/`null`/`null` | ❌ aucun | ⚠️ |
| `acheter_competence` | `historique_xp` (« Achat compétence niveau N (X XP, rabais -n) ») + `log_audit` | Absent (journal serveur non consommé par le wizard) | ❌ aucun | ⚠️ |
| `acheter_competence` | Retour `donnees = {personnage_competence_id, cout_base, rabais, cout_xp, xp_total, xp_depense, xp_restant}` | Absent : `donnees: null` — l'écran ne consomme que `succes`/`erreurs[0].message` | ❌ aucun | ⚠️ |
| `desacheter_competence` | `achat_introuvable` « Cet achat de compétence n'existe pas » | Verbatim | ❌ aucun | ✅ |
| `desacheter_competence` | `competence_introuvable` « Compétence introuvable » | Verbatim | ❌ aucun | ✅ |
| `desacheter_competence` | Gates auth/ownership/gel + campagne INV-3 « Ce désachat toucherait des acquis du personnage (dernière présence confirmée), directement ou par cascade — impossible en campagne. » | Omis | — | 📝 §6 |
| `desacheter_competence` | Refus gratuité : `xp_depense = 0 AND NOT desachat_force` → « Une compétence acquise gratuitement (de classe) ne peut pas être désachetée » | Verbatim (provenance `estGratuiteClasse` OU coût catalogue 0) | ✅ regressionBugsS311 (message VERBATIM + `desachat_force`) | ✅ |
| `desacheter_competence` | Nuance : achat payant tombé à `xp_depense=0` par rabais total → refusé serveur, autorisé offline | Divergent (conséquence du rabais non modélisé) | ❌ aucun | ⚠️ |
| `desacheter_competence` | Cascade niveaux : `type_achat IN ('simple','unique_avec_choix','multiple_avec_choix_par_niveau')` → suppression `niveau_acquis >= cible`, bornée au même `choix_achat` | Verbatim (`TYPES_ACHAT_CASCADE` + filtre choix) | ✅ regressionBugsS311 BUG B #1 | ✅ |
| `desacheter_competence` | Types NON cascade (`multiple_choix_distinct`, `multiple_sans_choix`) : suppression d'UNE seule ligne | Divergent : id synthétique `(comp, niveau, choix)` → retrait de TOUTES les copies du triplet (ex. « Développement Spirituel » ×N retiré d'un coup, counts et `xp_rembourse` multipliés) | ❌ aucun | 💥 |
| `desacheter_competence` | Boucle prérequis : `WHILE changed` → retrait des `niveau_acquis > niveau_max_achetable` | Verbatim (via `calculerPrerequis` local) ; nuance : prérequis `special` non portés (📝 §7) | ✅ regressionBugsS311 BUG B #2 | ✅ |
| `desacheter_competence` | La boucle serveur peut cascader des lignes gratuites (`xp_depense=0`, comptées à 0) | Divergent : gratuités re-dérivées jamais retirées offline (edge) | ❌ aucun | ⚠️ |
| `desacheter_competence` | Purge sorts/prières : UNIQUEMENT si « Acquisition de Sort/Prière » tombe → purge **TOTALE** | Purge totale portée ✅ ; MAIS purge SUPPLÉMENTAIRE par cercle/domaine fermé que le serveur ne fait PAS (ni trigger, vérifié) → sorts supprimés + XP remboursée en trop + `items_detail`/counts divergents. TROUS §2 la mentionne mais la présente comme fidèle | ❌ aucun | 💥 |
| `desacheter_competence` | `items_detail` compétences : agrégat par nom (`quantite`, `xp_unitaire=MIN`, `xp_total=SUM`, `niveaux` triés, tri nom) | Structure/clés verbatim ; xp basés sur coût CATALOGUE au lieu du `xp_depense` réel (rabais, gratuités cascadées) | ✅ regressionBugsS311 BUG B #1 | ⚠️ |
| `desacheter_competence` | `items_detail` sorts/prières : `COALESCE(nom_personnalise, nom)`, `xp = xp_depense` stocké | Structure verbatim ; xp recalculé (équivalent en création) | ❌ aucun | ✅ |
| `desacheter_competence` | `cascade`, `competence_cible`, `count_*`, `xp_rembourse` | Verbatim (formules) | ✅ regressionBugsS311 BUG B | ✅ |
| `desacheter_competence` | `p_dry_run=true` → mêmes `donnees`, AUCUNE écriture | Verbatim | ✅ « dry_run ne modifie rien » | ✅ |
| `desacheter_competence` | Chemin réel : `donnees` enrichi de `xp_total/xp_depense/xp_restant` | Absent (mêmes `donnees` qu'en dry-run) — écran ne lit que counts + `xp_rembourse` | ❌ aucun | ⚠️ |
| `desacheter_competence` | `historique_xp` (« Désachat en cascade — … ») + `log_audit` par item | Absent (journal serveur) | ❌ aucun | ⚠️ |

### Écritures — sorts & prières

| Méthode | Règle serveur (résumé + message verbatim si gate) | Visiteur | Test ? | Gravité |
|---|---|---|---|---|
| `acheter_sort` | Branches auth/ownership/gel | Hors scope §6 | ❌ aucun | 📝 |
| `acheter_sort` | Gate `sort_introuvable` « Sort introuvable » | Verbatim (`gatesMagie.peutAcheterSort`) | ✅ pariteMagie + pariteVisiteur | ✅ |
| `acheter_sort` | Coût XP : `CEIL((pts_zone + pts_portee + pts_duree + niveau) × COALESCE(cout_xp_base,0))` ; barèmes zone/portée/durée ; label inconnu → 0 | Verbatim terme à terme (`calculerCoutXP` + constantes identiques) | ✅ calculsMagie.test.ts « parité DB » + 59 fixtures | ✅ |
| `acheter_sort` | Formule magique (`generer_formule_magique`, 5 dictionnaires, mot manquant → NULL) | Verbatim (`formuleMagique.ts`) | ✅ verdicts figés | ✅ |
| `acheter_sort` | Gate niveau : `vue_cercles_disponibles` (1→5/2→10/3→20) ; « Niveau de sort superieur au maximum autorise pour ce cercle » (sans accents) | Verbatim | ✅ pariteMagie + pariteVisiteur | ✅ |
| `acheter_sort` | Gate XP « XP insuffisant » (après gate niveau) | Verbatim, même ordre | ✅ | ✅ |
| `acheter_sort` | Pas de gate doublon (multi-instances permises, PK seul) | Achat multiple accepté MAIS instance identifiée par le seul `sortId` → doublons indissociables | ❌ aucun | ⚠️ |
| `acheter_sort` | Effets : INSERT (stocke `formule_magique`), `historique_xp`, trigger | Ajout brouillon + recompute ; formule NON stockée (lecture → `null` alors que le générateur est porté) ; non documenté | ❌ aucun | ⚠️ |
| `acheter_sort` | Retour succès : `personnage_sort_id`, `xp_depense_achat`, `xp_total/xp_depense/xp_restant` | Absent : `repOk(null)` ; É6 n'en consomme aucun | ❌ aucun | ⚠️ |
| `desacheter_sort` | Branches auth/ownership/gel | Hors scope §6 | ❌ aucun | 📝 |
| `desacheter_sort` | Gate `achat_introuvable` « Ce sort n'existe pas dans le personnage » | Divergent : préfixe invalide → `introuvable` « Sort introuvable. » ; id valide mais sort absent → **succès silencieux** (`xp_rembourse: 0`) | ❌ aucun | ⚠️ |
| `desacheter_sort` | Gate campagne `acquis_intouchable` : « Ce sort fait partie des acquis du personnage (dernière présence confirmée) — il ne peut pas être annulé en campagne. » | Absent (campagne impossible offline) | ❌ aucun | 📝 |
| `desacheter_sort` | Reprise rabais (étiquettes `rabais_items` type `sort`) → `reprises[]`, `reprise_totale`, `net` | Absent : `reprises: []`, `net = xp_rembourse` | ❌ aucun | 📝 §2 |
| `desacheter_sort` | Garde rouge (dry-run ET réel) : `xp_restant_apres < 0` → `reprise_rouge`, `bloque:true`, « Supprimer ce sort te ferait passer en XP négatif (il manque N XP). Retire d'abord une Acquisition de Cercle de niveau supérieur pour le cercle « X » — cela te rendra des XP — puis ce sort. » | Absent : `bloque:false` toujours, `message_action: null` | ❌ aucun | 📝 §2 |
| `desacheter_sort` | Dry-run — champs : `dry_run, type, nom, cercle, xp_rembourse, reprises, reprise_totale (ENTIER), net, bloque, xp_restant_avant/apres` | Partiel : manquent `dry_run/type/nom/xp_restant_*` ; **`reprise_totale: false` (booléen)** — l'écran le type `number` (non documenté) | ❌ aucun | 📝 §2 / ⚠️ |
| `desacheter_sort` | Réel : DELETE par INSTANCE (PK), mouvement `remboursement`, application des reprises | DELETE par `sortId` catalogue : **toutes les copies supprimées d'un coup**, `xp_rembourse` cumulé | ❌ aucun | 💥 |
| `desacheter_sort` | Retour réel : ids + `xp_total/xp_depense/xp_restant` | Objet aperçu sans ids ni xp_* ; écran ne lit que `succes` | ❌ aucun | ⚠️ |
| `modifier_sort` | Gate `achat_introuvable` « Ce sort n'existe pas dans le personnage » | Divergent : `sort_introuvable` / « Sort introuvable » (message de l'achat) | ❌ aucun | ⚠️ |
| `modifier_sort` | Plancher campagne `acquis_regression` + `donnees.plancher` | Hors scope : plancher = valeurs COURANTES, erreur jamais émise | ❌ aucun | 📝 §3 |
| `modifier_sort` | Gate niveau cercle (même message sans accents) | Verbatim (l.599) | ❌ direct | ✅ |
| `modifier_sort` | `v_diff = cout_nouveau − xp_depense STOCKÉ` ; « XP insuffisant » si `diff > 0 && dispo < diff` | Fidèle : `ancienCout` re-calculé (équivalent offline : stocké = dérivé) | ❌ aucun | ✅ |
| `modifier_sort` | `nom_personnalise = COALESCE(p_nom_personnalise, nom_personnalise)` — É6 omet le param quand inchangé | **Divergent** : spread avec `nomPersonnalise: undefined` → nom personnalisé ÉCRASÉ à chaque modification | ❌ aucun | 💥 |
| `modifier_sort` | `formule_magique` régénérée + stockée + retournée | Non régénérée/stockée ; lecture → `null` | ❌ aucun | ⚠️ |
| `modifier_sort` | Retour succès : `cout_avant/cout_apres/xp_diff/formule_magique/xp_*` | Partiel : `{xp_diff}` seul (seul champ consommé) ; `plancher` ajouté aux erreurs niveau/xp (bénin) | ❌ aucun | ⚠️ |
| `acheter_priere` | Branches auth/ownership/gel | Hors scope §6 | ❌ aucun | 📝 |
| `acheter_priere` | Gate `priere_introuvable` « Prière introuvable » | Verbatim | ✅ | ✅ |
| `acheter_priere` | Gate religion : porté par `vue_domaines_disponibles` qui EXCLUT `religions.domaines_proscrits` (20260702233303) | Verbatim (`deriverDomainesDisponibles(acquises, religionId)`) | ✅ fixtures avec `religion_id` | ✅ |
| `acheter_priere` | Gate niveau : « Niveau de prière supérieur au maximum autorisé pour ce domaine » (AVEC accents) | Verbatim | ✅ | ✅ |
| `acheter_priere` | Gate XP « XP insuffisant » | Verbatim | ✅ | ✅ |
| `acheter_priere` | Coût XP : même helper que sorts | Verbatim | ✅ calculsMagie.test.ts | ✅ |
| `acheter_priere` | Durée d'incantation : `ceil((2 + sec_portee + sec_zone + sec_duree + sec_niveau)/2)` ; paliers niveau 1-3→1 … 19-20→13, `ELSE 0` | Verbatim SAUF bornes : TS rend 1 (niveau ≤ 0) / 13 (> 20), SQL 0 — inatteignable via les gates | ✅ (pas les bornes) | ⚠️ |
| `acheter_priere` | INSERT stocke `duree_incantation_calculee` (autoritatif) ; retour avec ids + xp_* + durée | `repOk(null)` ; couplé à `lirePersonnagePrieres` → badge « Incantation : N s » d'É7 disparaît (cf. lectures) | ❌ aucun | 💥 |
| `desacheter_priere` | Gate `achat_introuvable` « Cette prière n'existe pas dans le personnage » | Divergent : `introuvable` / « Prière introuvable. » + succès silencieux si absente | ❌ aucun | ⚠️ |
| `desacheter_priere` | Gate campagne `acquis_intouchable` (verbatim prière) | Absent | ❌ aucun | 📝 |
| `desacheter_priere` | Reprise rabais « Acquisition de Domaine » + garde rouge `reprise_rouge` (« Supprimer cette prière te ferait passer en XP négatif (il manque N XP)… ») | Absent : `bloque:false`, `reprises: []`, `net = xp_rembourse` | ❌ aucun | 📝 §2 |
| `desacheter_priere` | Dry-run/réel — mêmes champs que sort (`domaine`) ; `reprise_totale` ENTIER ; réel : DELETE par instance | Partiel : `reprise_totale: false` (booléen), champs manquants ; DELETE par `priereId` catalogue → **toutes copies supprimées ensemble** | ❌ aucun | 📝 §2 / 💥 |
| `modifier_priere` | Gate `achat_introuvable` « Cette prière n'existe pas dans le personnage » | Divergent : `priere_introuvable` / « Prière introuvable » | ❌ aucun | ⚠️ |
| `modifier_priere` | Plancher campagne `acquis_regression` + `donnees.plancher` | Hors scope §3 | ❌ aucun | 📝 |
| `modifier_priere` | Gate niveau domaine puis gate XP sur `diff` | Verbatim (même ordre) ; `ancienCout` recomputé (équivalent) | ❌ aucun | ✅ |
| `modifier_priere` | `nom_personnalise = COALESCE(...)` | **Divergent** : même écrasement par `undefined` → nom perdu | ❌ aucun | 💥 |
| `modifier_priere` | `duree_incantation_calculee` recalculée + stockée + retournée ; retour `cout_avant/cout_apres/xp_diff/duree/xp_*` | Partiel : `{xp_diff}` seul ; durée ni recalculée ni stockée (lecture → `null`) | ❌ aucun | ⚠️ |

### Écritures — artisanat

| Méthode | Règle serveur (résumé + message verbatim si gate) | Visiteur | Test ? | Gravité |
|---|---|---|---|---|
| `acheter_recette` | Branches auth (« Authentification requise »), ownership (« Accès refusé à ce personnage »), gel `'ajout'` | Hors scope §6 | ❌ aucun | 📝 |
| `acheter_recette` | « Personnage introuvable » | Partiel : `guardPerso` → code `PERSONNAGE_INCONNU`, « Personnage introuvable. » (point ajouté, code différent) ; assumé dans gatesArtisanat.ts, pas dans TROUS_A3II | ❌ aucun | ⚠️ |
| `acheter_recette` | Gate existence : `niveau_requis IS NULL` → « Recette introuvable ou sans coût défini » | Verbatim (quirk compris) | ✅ pariteArtisanat + pariteVisiteur | ✅ |
| `acheter_recette` | Gate niveau : « Compétence Alchimie requise » (`niveau_alchimie < 1`) | Verbatim ; `deriverNiveauxArtisanat` réplique `vue_personnage_etat` | ✅ (3 cas) | ✅ |
| `acheter_recette` | Gate palier : « Palier de recette non débloqué (niveau Alchimie %s requis) », `champ:'niveau_requis'` | Verbatim (template + champ) | ✅ pariteArtisanat #11 (toEqual strict) | ✅ |
| `acheter_recette` | Quota palier : 5 (alch ≥ 1) / 4 (≥ 2) / 3 (≥ 3) | `quotaRecettesPalier` identique | ✅ indirect — aucun test dédié des seuils | ✅ |
| `acheter_recette` | Coût prévu : count toutes lignes du palier ; `< quota` → 0 sinon `cout_xp` | Verbatim | ✅ (6 cas) | ✅ |
| `acheter_recette` | Gate XP « XP insuffisant » | Verbatim | ✅ | ✅ |
| `acheter_recette` | Doublon : pas de gate ; `unique_violation` → `contrainte_violee` + SQLERRM | Absent (quirk figé volontairement, §6 couvre SQLERRM) — MAIS hors ligne le doublon est AJOUTÉ au brouillon avec succès, le serveur n'insère rien | ❌ aucun | 📝/⚠️ |
| `acheter_recette` | Effet : `reconcilier_recettes` (rang ≤ quota palier → gratuit, ledger, idempotent) | Équivalent par rejeu from-scratch (deriver.ts) | ❌ aucun côté deriver | ✅ |
| `acheter_recette` | Retour `donnees` : `id, est_gratuit, xp_depense_achat, xp_*` | Absent (`donnees: null`) ; non consommé par l'écran | ❌ aucun | ⚠️ |
| `desacheter_recette` | Branches auth/`peut_editer_personnage`/gel `'complet'` | Hors scope §6 | ❌ aucun | 📝 |
| `desacheter_recette` | Gate `achat_introuvable` « Cette recette n'existe pas dans le personnage » | Divergent : id mal préfixé → « Recette introuvable. » ; id valide mais absent → SUCCÈS silencieux (no-op) | ❌ aucun | ⚠️ |
| `desacheter_recette` | Campagne INV-3 : « Cette recette fait partie des acquis du personnage (dernière présence confirmée) — elle ne peut pas être annulée en campagne. » | Absent (rattaché gel §6, non cité explicitement) | ❌ aucun | 📝 |
| `desacheter_recette` | DELETE + ledger « Remboursement recette d'alchimie (N XP) » | Équivalent : XP re-dérivée (même solde) | ❌ aucun | ✅ |
| `desacheter_recette` | Effet « auto-soin » : `reconcilier_recettes` promeut une payante du palier en gratuite | Équivalent par rejeu | ❌ aucun | ✅ |
| `desacheter_recette` | Suppression d'UNE ligne (par `personnage_recette_id`) | `retirerRecette` filtre par `recetteId` → toutes les occurrences (visible si doublon) | ❌ aucun | ⚠️ |
| `desacheter_recette` | Retour : `personnage_recette_id, recette_id, etait_gratuit, xp_rembourse, xp_*` | Absent (`donnees: null`) | ❌ aucun | ⚠️ |
| `acheter_piege` | Branches techniques + « Personnage introuvable » | Hors scope §6 + guardPerso | ❌ aucun | 📝 |
| `acheter_piege` | Gate existence « Piège introuvable » | Verbatim | ✅ | ✅ |
| `acheter_piege` | Gate bornes : `niveau < 1 OR > 3` → « Niveau de piège invalide » | Verbatim (`niveau ?? 0`) | ❌ aucune fixture | ✅ |
| `acheter_piege` | Gate niveau : « Compétence « Création et désarmement de piège » requise » | Verbatim guillemets compris ; NULL SQL ≡ 0 | ✅ | ✅ |
| `acheter_piege` | Gate doublon : « Ce palier de piège est déjà acquis » | Verbatim | ✅ #6 | ✅ |
| `acheter_piege` | Gate séquence : « Le palier précédent doit être acquis avant celui-ci » | Verbatim | ✅ #5 | ✅ |
| `acheter_piege` | Gratuité : count pièges GRATUITS au niveau visé < quota 3/2/1 → gratuit, sinon `cout_xp` | Verbatim | ✅ #4 | ✅ |
| `acheter_piege` | Gate XP « XP insuffisant » (payant) | Verbatim | ❌ aucune fixture | ✅ |
| `acheter_piege` | `est_gratuit` FIGÉ à l'achat ; AUCUN réconciliateur pièges (« Pièges : intacts », 20260601181909) | Divergent : re-dérivation à chaque recompute → promotions rétroactives gratuit/payant que le serveur ne fait jamais (badges + XP divergeront à la synchro a4) | ❌ aucun | ⚠️ |
| `acheter_piege` | Retour : `id, piege_nom, niveau_acquis, est_gratuit, xp_depense_palier, xp_*` | Absent (`donnees: null`) ; écran compatible | ❌ aucun | ⚠️ |
| `desacheter_piege` | Branches techniques | Hors scope §6 | ❌ aucun | 📝 |
| `desacheter_piege` | Gate `achat_introuvable` « Ce piège n'existe pas dans le personnage » | Divergent : « Piège introuvable. » ou succès silencieux ; message non verbatim joueur-visible (l'écran affiche `erreurs[0].message`) | ❌ aucun | ⚠️ |
| `desacheter_piege` | Campagne INV-1/INV-3 : « Ce palier de piège fait partie des acquis du personnage (dernière présence confirmée) — il ne peut pas être annulé en campagne. » | Absent | ❌ aucun | 📝 |
| `desacheter_piege` | **CASCADE ascendante : DELETE palier ciblé + TOUS les paliers ≥ N de la même famille**, remboursement = somme | **ABSENT** : `retirerPiege` (appliquer.ts l.183-190) ne retire QUE le palier cliqué. L'écran Étape 9 (l.485-513) affiche un dialogue promettant la cascade → paliers orphelins, XP annoncée fausse. Non documenté | ❌ aucun | 💥 |
| `desacheter_piege` | Ledger « Annulation piège « X » (n palier(s)) » | XP re-dérivée — fausse tant que la cascade est absente | ❌ aucun | ⚠️ |
| `desacheter_piege` | Retour : `piege_nom, lignes_supprimees[], nb_paliers_supprimes, xp_rembourse, xp_*` | Absent (`donnees: null`) ; dialogue construit AVANT mutation | ❌ aucun | ⚠️ |
| `acheter_assemblage` | Branches techniques + « Personnage introuvable » | Hors scope §6 + guardPerso | ❌ aucun | 📝 |
| `acheter_assemblage` | Gate existence : `cout_xp IS NULL` → « Assemblage introuvable ou sans coût défini » | Verbatim (quirk conservé) | ✅ | ✅ |
| `acheter_assemblage` | Gate niveau : « Compétence Assemblage de Runes requise » | Verbatim | ✅ + test bout-en-bout clientVisiteur.test.ts | ✅ |
| `acheter_assemblage` | Coût seau unique : count TOTAL < quota 2/4/5 → 0, sinon `cout_xp` | Verbatim | ✅ (5 cas) | ✅ |
| `acheter_assemblage` | Gate XP « XP insuffisant » | Verbatim | ❌ aucune fixture | ✅ |
| `acheter_assemblage` | Doublon : `unique_violation` → `contrainte_violee` SQLERRM | Absent (quirk figé) ; doublon ajouté au brouillon avec succès | ❌ aucun | 📝/⚠️ |
| `acheter_assemblage` | Effet : `reconcilier_assemblages` (rang global ≤ quota → gratuit) | Équivalent rejeu (deriver.ts l.301-306) | ❌ aucun | ✅ |
| `acheter_assemblage` | Retour : `id, est_gratuit, xp_depense_achat, xp_*` | Absent (`donnees: null`) | ❌ aucun | ⚠️ |
| `desacheter_assemblage` | Branches techniques | Hors scope §6 | ❌ aucun | 📝 |
| `desacheter_assemblage` | Gate `achat_introuvable` « Cet assemblage n'existe pas dans le personnage » | Divergent : « Assemblage introuvable. » ou succès silencieux | ❌ aucun | ⚠️ |
| `desacheter_assemblage` | Campagne INV-3 : « Cet assemblage fait partie des acquis du personnage (dernière présence confirmée) — il ne peut pas être annulé en campagne. » | Absent | ❌ aucun | 📝 |
| `desacheter_assemblage` | DELETE + ledger + `reconcilier_assemblages` (auto-soin) | Équivalent rejeu ; toutes occurrences du même `assemblageId` supprimées (nuance doublon) | ❌ aucun | ✅ |
| `desacheter_assemblage` | Retour : `personnage_assemblage_id, assemblage_id, etait_gratuit, xp_rembourse, xp_*` | Absent (`donnees: null`) | ❌ aucun | ⚠️ |

### Lectures — état personnage & vues

| Méthode | Règle serveur (colonnes/filtres/formule) | Visiteur | Test ? | Gravité |
|---|---|---|---|---|
| `lirePersonnage` | `personnages` SELECT `*` `.eq id .single` (~50 colonnes) | Partiel : 19 colonnes construites depuis brouillon + `deriverEtat`, colonnes serveur **omises** (undefined, pas null — TROUS §5 dit « posées à un neutre ») | ✅ incident (regressionBugsS311) | 📝 |
| `lirePersonnage` (`updated_at`) | Colonne DB, bump à chaque écriture | **Absente** ; consommée par Étape 5 (queryKey `["apercu-rabais", …, personnage?.updated_at]`) → l'aperçu rabais ne se ré-invalide jamais offline | ❌ aucun | ⚠️ |
| `lirePersonnage`/`lirePersonnageRace`/`lirePersonnageProgression` (`xp_total`) | `recalculer_xp_valeurs` : `xp_depart + gn_completes×15 + mini_gn×15 + ouvertures×10` | Divergent : `calculerXp` (deriveurs.ts:149-153) **force gn/mini/ouvertures = 0** alors que l'étape 1 offline les stocke et affiche « +15 XP » ; xp_total sous-évalué, gates XP faussées en cascade | ❌ aucun | 💥 |
| `lirePersonnageProgression` (`xp_depense`) / `lirePersonnage` | Σ `historique_xp`, où `acheter_competence` débite `GREATEST(base − rabais, 0)` (20260617210831) | Divergent : plein tarif facturé, aucun rabais — alors que `apercuRabaisAcquisitionCompetence` visiteur affiche le prix réduit (header XP incohérent avec l'UI) | ❌ aucun | 💥 |
| `lirePersonnageIdentite` | 8 colonnes étape 1, `.eq id .single` | Verbatim depuis `b.etape1` | ❌ aucun | ✅ |
| `lirePersonnageRace` | `race_id, sous_type_chimeride, traits_raciaux_choisis, xp_total` | Verbatim (traits jsonb brut identique) — sauf `xp_total`, cf. ligne 💥 | ❌ aucun | ✅ |
| `lirePersonnageClasse` | `classe_id, race_id, religion_id, est_croyant, nom` | Verbatim | ❌ aucun | ✅ |
| `lirePersonnageReligion` | `id, religion_id` | Verbatim (`id` = `visiteur-local`) | ❌ aucun | ✅ |
| `lirePersonnageProgression` | `id, nom, etape_creation, xp_total, xp_depense` | Verbatim structurellement (valeurs XP : cf. lignes 💥) | ❌ aucun | ✅ |
| `lireTraitsParRace` | Vue (20260701182246) : JOIN race_traits×races×traits_raciaux, **WHERE tr.est_actif**, filtre sous_type `eq X OR is.null`, `.order trait_nom` | Partiel : jointure + sous_type fidèles, MAIS filtre `est_actif` **no-op** (`traits.find(x => x.trait_id === r.trait_id)` — la colonne est `id`, jamais de match → `undefined?.est_actif !== false` = actif). Latent : 0 trait inactif dans le snapshot actuel, mais la RPC `snapshot_visiteur` n'exclut pas les inactifs | ❌ aucun | ⚠️ |
| `lireDomainesDisponibles` | Vue (20260702233303) : « Acquisition de Domaine », choix non null, **exclusion `religions.domaines_proscrits`**, CASE max 1→5/2→10/3→20, `.order domaine` | Verbatim (`deriverDomainesDisponibles`, proscrits inclus) | ✅ indirect (pariteMagie) ; exclusion proscrits sans test direct | ✅ |
| `lireCerclesDisponibles` | Vue baseline : « Acquisition de Cercle », CASE max 1→5/2→10/3→20, `.order cercle` | Verbatim (`deriverCerclesDisponibles`) | ✅ indirect (pariteMagie, 59 verdicts) | ✅ |
| `lireArtisanatQuotas` (niveaux + quotas `*_total` alchimie/runes/pièges) | Vue (20260530164052) : niveaux = MAX(niveau_acquis) par nom, totaux = CASE (5/4/3 ; 2/4/5 ; 3/2/1) | Verbatim (`deriverNiveauxArtisanat` + mêmes constantes) | ✅ indirect (pariteArtisanat) | ✅ |
| `lireArtisanatQuotas` (`quota_*_utilises` ×7) | `COUNT(*) WHERE est_gratuit=true` par palier (recettes/pièges) + total (assemblages) | **Absent : tous à `null`** alors que l'état dérivé porte les `estGratuit` (trivialement dérivable). Étape 9 les consomme (`?? 0`) → compteurs « X/Y utilisés » figés à 0, badge gratuit/payant mensonger. **TROUS §1 affirme l'inverse** | ❌ aucun | 💥 |
| `lireArtisanatQuotas` (forge/joaillerie/légendaire, `quota_recettes_total`) | `niveau_forge/joaillerie`, `a_*_legendaire`, `quota_recettes_total` (12/9/5) | null/false — hors scope documenté TROUS §1 ; non consommé par le wizard | ❌ aucun | 📝 |
| `lirePersonnageCompetences` (cœur) | SELECT `*` (gratuités de classe = vraies lignes DB) | Verbatim (gratuités re-dérivées, id synthétique round-trip) | ✅ regressionBugsS311 | ✅ |
| `lirePersonnageCompetences` (`xp_depense`) | Coût réellement débité = `GREATEST(base − rabais, 0)` | Plein tarif (0 seulement si gratuité). Étape 5 dérive `estGratuit = xp_depense===0` → rabais total serveur affiché « payant » offline, et refus de désachat divergent | ❌ aucun | 💥 |
| `lirePersonnageCompetences` (`appris_via_maitre`/`nom_maitre`/`statut_maitre`/`rabais_items`/`date_acquisition`) | Statuts maître réels, `rabais_items` jsonb, date réelle | Neutres (`false`/`null`/…/`creeLe`) ; params maître jetés par `acheterCompetence` ; aucun écran du wizard ne les relit | ❌ aucun | ⚠️ |
| `lirePersonnageCompetencesNoms` | `competences(nom)` `.eq personnage_id` | Verbatim (gratuités incluses) | ❌ aucun | ✅ |
| `lireNiveauCompetenceParNom` | `niveau_acquis, competences!inner(nom)`, `.eq nom`, `.order desc, .limit 1` | Verbatim (max local ≡ order desc + limit 1) | ✅ regressionBugsS311 | ✅ |
| `lirePersonnageSorts` | SELECT `*` + embed `sorts` (13 col.), `.order date_acquisition` ; `xp_depense` = calcul SQL ; `statut` défaut `'achete'` | Verbatim : embed 13/13, `xp_depense` via `calculerCoutXP` (≡ SQL), ordre insertion ≡ date | ✅ indirect (fixtures cout_xp) | ✅ |
| `lirePersonnageSorts` (`formule_magique`) | Insérée par `acheter_sort` (calcul SQL) | `null` — alors que `formuleMagique.ts` est porté ; non consommée par le wizard (fiche perso seulement) | ❌ aucun | ⚠️ |
| `lirePersonnagePrieres` | Idem sorts + `duree_incantation_calculee` insérée par `acheter_priere` | Embed et xp fidèles, MAIS `duree_incantation_calculee: null` alors qu'Étape 7 (l.1341) affiche « Incantation : N » si non-null → ligne invisible offline ; le moteur SAIT la calculer (porté + testé) | ❌ aucun | 💥 |
| `lirePersonnagePieges` | SELECT `*` : `est_gratuit`/`xp_depense` FIGÉS à l'achat | Verbatim en séquence append-only ; après désachat intermédiaire, le serveur conserve les flags historiques, le visiteur re-étiquette from scratch | ✅ indirect | ⚠️ |
| `lirePersonnageRecettes` | SELECT `*` : flags figés à l'achat | Idem : fidèle append-only, divergence recompute-vs-historique après désachats | ❌ aucun | ⚠️ |
| `lirePersonnageAssemblages` | SELECT `*` : flags figés | Idem ; Étape 8 compte `nbGratuits` depuis `est_gratuit` → correct append-only, divergent après désachat | ❌ aucun | ⚠️ |

### Lectures — catalogues

| Méthode | Règle serveur (colonnes/filtres/tri) | Visiteur | Test ? | Gravité |
|---|---|---|---|---|
| `lireRaces` | 12 cols, `.eq est_actif` + `.eq est_jouable`, `.order nom` | Partiel : filtres/tri identiques (3 races non jouables bien exclues), mais renvoie la ligne snapshot COMPLÈTE (16 cols : + `est_actif`, `image_url`, `recherche_tsv`, `description_courte`) | ❌ aucun | ⚠️ |
| `lireRace` | `id, nom, restrictions_classes`, `.eq id .single` (pas de filtre est_actif) | Verbatim (projection exacte ; erreur `.single` → `{message:"Race introuvable."}`, seul `message` lu) | ❌ aucun | ✅ |
| `lireClasses` | 9 cols, `.eq est_actif`, `.order nom` | Partiel : filtre/tri identiques mais lignes complètes (13 cols) | ❌ aucun | ⚠️ |
| `lireClasse` | `id, nom`, `.eq id .single` | Verbatim | ❌ aucun | ✅ |
| `lireCompetences` | SELECT `*`, `.eq est_actif`, `.order nom` | Verbatim (colonnes/filtre/tri vérifiés) | ❌ direct (plancher ≥ 50 dans snapshot.integrity) | ✅ |
| `lireCompetencesParIds` | 5 cols, `.in id`, sans tri | Verbatim | ❌ aucun | ✅ |
| `lireSorts` | SELECT `*`, `.eq cercle`, `.lte niveau`, `.eq est_actif`, `.order nom` | Verbatim (3 filtres + tri) | ❌ aucun | ✅ |
| `lireSortsCercles` | `select("cercle")`, `.eq est_actif`, `.not null` → **une ligne PAR SORT (doublons)** | Partiel : le visiteur DÉDOUBLONNE → cardinalité différente (le commentaire d'interface décrit le visiteur, pas le serveur). Unique appelant (Étape 5 l.868) fait `Set` + re-tri → invisible à l'écran | ❌ aucun | ⚠️ |
| `lirePrieres` | SELECT `*`, `.eq domaine`, `.lte niveau`, `.eq est_actif`, `.order nom` | Verbatim | ❌ aucun | ✅ |
| `lirePrieresDomaines` | `select("domaine")` → doublons | Partiel : même dédoublonnage ; appelant dédoublonne de toute façon | ❌ aucun | ⚠️ |
| `lireReligions` | SELECT `*`, `.eq est_actif`, `.order nom` | Verbatim | ❌ aucun | ✅ |
| `lireReligionsCatalogue` | 13 cols, `.eq est_actif`, `.order nom` | Verbatim (projection + tri) | ❌ aucun | ✅ |
| `lireReligionsFiches` | 12 cols, `.eq est_actif`, sans tri | Verbatim (aucun contrat d'ordre) | ❌ aucun | ✅ |
| `lireReligionProscrits` | `domaines_proscrits`, `.eq id .single` | Verbatim | ❌ aucun | ✅ |
| `lireLangues` | `id, nom, est_ancienne`, `.eq est_actif`, `.order ordre` | Verbatim (trie par `ordre` puis strippe la colonne) | ❌ aucun | ✅ |
| `lireLanguesAnciennes` | `id, nom, ordre`, `.eq est_ancienne` + `.eq est_actif`, `.order ordre, nom` | Verbatim | ❌ aucun | ✅ |
| `lireCategoriesCreatures` | `id, nom, ordre`, `.eq est_actif`, `.order ordre` | Verbatim | ❌ aucun | ✅ |
| `lireFamillesCriminelles` | `id, nom`, `.eq est_actif`, `.order nom` | Verbatim | ❌ aucun | ✅ |
| `lirePieges` | SELECT `*`, `.eq est_actif`, `.order nom` puis `.order niveau` | Verbatim | ❌ aucun | ✅ |
| `lireRecettesAlchimie` | SELECT `*`, `.eq est_actif`, `.lte niveau_requis`, `.order niveau_requis, nom` | Verbatim | ❌ aucun | ✅ |
| `lireObjetsForge` | SELECT `*` + embed `reparation:reparations_forge!reparation_id` (5 cols), `.eq est_actif`, `.order temps_fabrication_minutes, nom` | **Absent (jointure)** : le code reproduit la jointure via `snap().tables.reparations_forge` MAIS la RPC `snapshot_visiteur()` (20260703182834) n'exporte PAS cette table → `reparation: null` pour 100 % des lignes (11/20 objets ont un `reparation_id`) ; le `?.` masque l'absence. Bloc réparation d'Étape 9 (l.1226) invisible. Non documenté | ❌ aucun | 💥 |
| `lireObjetsJoaillerie` | SELECT `*`, `.eq est_actif`, `.order temps_fabrication_minutes, nom` | Verbatim | ❌ aucun | ✅ |
| `lireAssemblagesRunes` | SELECT `*`, `.eq est_actif`, `.order nom` | Verbatim | ❌ aucun | ✅ |
| `lireParametresJeu` | 3 cols, `.limit(1) .maybeSingle()` | Verbatim (`rows[0]` ; table absente → `{data:null, error:null}` = sémantique maybeSingle) | ❌ aucun | ✅ |
| *(transversal, lectures triées)* | `.order()` PostgREST = collation de la base | Tri via `localeCompare(…, "fr")` (`cmp()`, l.223) — ordre potentiellement différent sur accents/casse/apostrophes ; écart théorique, non verrouillé | ❌ aucun | ⚠️ |

---

## Annexe A — Couverture des 68 méthodes

- **26 écritures** : `demarrerCreationPersonnage`, `etatEditionPersonnage`, `avancerEtape`, `validerPersonnageFinal`, `corrigerXpPersonnage`, `sauvegarderEtape1..4`, `changerClassePersonnage`, `verifierPrerequisCompetences`, `apercuRabaisAcquisitionCompetence`, `acheterCompetence`, `desacheterCompetence`, `acheterSort`, `desacheterSort`, `modifierSort`, `acheterPriere`, `desacheterPriere`, `modifierPriere`, `acheterRecette`, `desacheterRecette`, `acheterPiege`, `desacheterPiege`, `acheterAssemblage`, `desacheterAssemblage` — toutes présentes dans la matrice (désignées par leur RPC, mapping 1:1 de `types.ts`).
- **42 lectures** : `lirePersonnage`, `lirePersonnageIdentite`, `lirePersonnageRace`, `lirePersonnageClasse`, `lirePersonnageReligion`, `lirePersonnageProgression`, `lireRaces`, `lireRace`, `lireClasses`, `lireClasse`, `lireCompetences`, `lireCompetencesParIds`, `lireSorts`, `lireSortsCercles`, `lirePrieres`, `lirePrieresDomaines`, `lireReligions`, `lireReligionsCatalogue`, `lireReligionsFiches`, `lireReligionProscrits`, `lireLangues`, `lireLanguesAnciennes`, `lireCategoriesCreatures`, `lireFamillesCriminelles`, `lirePieges`, `lireRecettesAlchimie`, `lireObjetsForge`, `lireObjetsJoaillerie`, `lireAssemblagesRunes`, `lireParametresJeu`, `lireTraitsParRace`, `lireDomainesDisponibles`, `lireCerclesDisponibles`, `lireArtisanatQuotas`, `lirePersonnageCompetences`, `lirePersonnageCompetencesNoms`, `lireNiveauCompetenceParNom`, `lirePersonnageSorts`, `lirePersonnagePrieres`, `lirePersonnagePieges`, `lirePersonnageRecettes`, `lirePersonnageAssemblages` — toutes présentes dans la matrice.

## Annexe B — Anomalies transverses relevées pendant l'audit

1. **`TROUS_A3II.md` n'est plus fiable sur 4 points** :
   - §1 affirme que les quotas « utilisés » alchimie/runes/pièges sont « dérivés fidèlement » — faux, ils sont à `null` (`clientVisiteur.ts:1558-1565`).
   - §2 qualifie la purge cercle/domaine du désachat de compétence de fidèle au serveur — le SQL A6 ne la fait pas (purge inventée côté visiteur).
   - §4 affirme que le chemin réel de `changer_classe_personnage` n'est « jamais appelé par les écrans » — il l'est, indirectement, via `sauvegarder_etape_4`.
   - Le préambule (« code mort jusqu'à P2-b, risque prod nul ») est périmé : `clientActif.ts` route déjà `/visiteur/**` vers `clientVisiteur` (P2-b livré, PR #639).
   - Cosmétique : §7 intercalé avant §6 ; le commentaire `MODE_VISITEUR_OFFLINE_REFERENCE` cité par certains prompts n'existe pas dans le code (la doc d'omission réelle = en-tête §C de `clientVisiteur.ts` + TROUS §6).
2. **Snapshot visiteur : fraîcheur sans garde-fou.** Capturé une fois (2026-07-03, PR #627) via `snapshot_visiteur()` (SECURITY INVOKER, RLS anon) ; gardes anti-*stub* solides (planchers, UUID) mais aucun mécanisme anti-*staleness* (script non branché en CI, aucun test snapshot ↔ base). Tout changement catalogue prod diverge silencieusement jusqu'à régénération manuelle.
3. **Chaînes de parité indirectes côté SQL** : les harnais visiteur sont verrouillés contre les RPCs de preview `peut_acheter_*` (magie 20260703232550, artisanat 20260703232626), qui sont des COPIES des validations inline des mutateurs. Vérifiées identiques aujourd'hui, mais rien ne lie les deux chemins — une évolution future des mutateurs peut désynchroniser la spec de parité sans casser aucun test.
4. **Zéro test de parité** sur : les 42 lectures (aucune n'a de test dédié), les désachats artisanat (3 RPCs), les désachats/modifications magie (4 RPCs), la finalisation en échec, les avertissements `info_*`. Les trous 💥 « cascade pièges », « lireObjetsForge » et « quotas utilisés » sont indétectables par la suite actuelle.
5. **Anomalie écran (affecte les deux implémentations)** : les mutations recettes (Étape 9) et assemblages (Étape 8) ne vérifient pas `payload.succes` (seuls les pièges le font) → un refus métier affiche le toast de succès. Pré-existant, hors parité stricte, mais masque les messages verbatim audités ici.
6. **Piège d'audit sur le tri des migrations** : `desacheter_sort/priere` ont été redéfinis par la refonte XP (20260615171408) 2 jours AVANT le DROP+recreate qui change leur signature (20260617210912/54) — un audit qui s'arrête à la première correspondance rate toute la couche rabais/dry-run. La règle « dernière définition au timestamp le plus récent » a été appliquée partout.

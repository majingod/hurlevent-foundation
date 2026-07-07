# TROUS_A3II — champs non reproductibles hors ligne (`clientVisiteur`)

Ce document liste, conformément au **§5** du cahier des charges P2-a3-ii, les
méthodes du guichet `ClientCreation` dont une partie du retour **ne peut pas être
produite fidèlement hors ligne** (colonne absente du `getSnapshot()`, logique
serveur non portée par le moteur, ou identifiant serveur inexistant). Aucun champ
n'est **inventé** : les valeurs non dérivables sont posées à un neutre documenté
et signalées ici.

`clientVisiteur` est **code mort jusqu'à P2-b** (`clientActif` = `clientServeur`) :
le risque prod est nul. Les trous ci-dessous sont des approximations de *preview*
UX qui seront rebranchées/complétées lors de la synchronisation serveur (lot a4).

## 1. `lireArtisanatQuotas` — colonnes forge / joaillerie absentes du moteur

`vue_artisanat_quotas` expose `niveau_forge`, `niveau_joaillerie`,
`a_forge_legendaire`, `a_joaillerie_legendaire`, `quota_recettes_total` et les
quotas forge/joaillerie. Le moteur (`deriverNiveauxArtisanat`) ne dérive QUE
`niveauAlchimie`, `niveauRunes`, `niveauPieges`. Les colonnes forge/joaillerie
sont donc posées à `null` / `false` (neutre documenté). Les colonnes alchimie /
runes / pièges (niveaux, quotas totaux et utilisés) sont dérivées fidèlement.

## 2. Désachats en `p_dry_run` — cascade « reprise / rabais » non portée

- `desacheterSort` / `desacheterPriere` (dry-run) : l'aperçu serveur calcule un
  remboursement avec **recalcul de rabais** (`reprises[]`, `net`, `reprise_totale`,
  `message_action`) via une logique SQL non portée par le moteur. Hors ligne on
  renvoie `bloque:false`, `xp_rembourse` (delta d'XP dépensée re-dérivé),
  `reprises: []`, `net = xp_rembourse`. Les libellés `message_action` sont neutres.
- `desacheterCompetence` (dry-run **et** réel) : PORTÉ FIDÈLEMENT (fix s311-B).
  Refus gratuité (message VERBATIM), cascade niveaux (`type_achat IN
  (simple, unique_avec_choix, multiple_avec_choix_par_niveau)`), boucle
  prérequis (via `verifier_prerequis_competences` local), purge sorts/prières
  (« Acquisition de Sort/Prière » qui tombe → purge totale ; plus cercle/domaine
  fermé). `items_detail[]`, `count_competences`, `count_competences_distinctes`,
  `count_sorts`, `count_prieres`, `xp_rembourse`, `cascade`, `competence_cible`
  ont les mêmes clés/valeurs que le serveur (A6). La cascade **artisanat**
  (recettes/assemblages invalidés par le retrait d'une compétence d'artisanat)
  n'est pas comptée par le serveur dans ces champs et n'est donc pas portée.

## 3. `modifierSort` / `modifierPriere` — champ `plancher` approximé

Le serveur renvoie sur erreur un `plancher` (niveau/zone/portée/durée minimum
imposé par les acquisitions existantes). Cette borne est calculée côté SQL ; hors
ligne on renvoie les choix **courants** du sort/prière comme plancher. `xp_diff`
(succès) est calculé fidèlement via `calculerCoutXP`.

## 4. `changerClassePersonnage` (dry-run) — aperçu de changement de classe

L'écran n'appelle cette RPC qu'en `p_dry_run: true` et consomme l'objet
`ApercuChangementClasse` complet (`perdues[]`, `dormants[]`, `offertes[]`,
`multi_choix[]`, `maitre_en_attente[]`…). Cette simulation serveur (quelles
compétences deviennent dormantes/perdues au changement de classe) n'est pas
portée par le moteur. Hors ligne on renvoie `classe_avant` / `classe_apres`
(noms depuis le snapshot), les tableaux **vides**, et `xp_rembourse` = delta d'XP
re-dérivé entre les deux classes. Le chemin non-dry-run (jamais appelé par les
écrans) applique réellement le changement (`changerClasse` + `deriverEtat`).

## 5. `lirePersonnage` (SELECT `*`) — colonnes serveur neutres

`personnages` (SELECT `*`) porte ~50 colonnes dont beaucoup n'ont aucun sens hors
ligne (ids profil, timestamps DB, `est_verrouille`, `est_finalise`, `est_mort`,
compteurs d'événements…). On construit la ligne avec les colonnes que le brouillon
+ `deriverEtat` produisent (nom, race/classe/religion, traits, xp_total/xp_depense,
etape_creation, historique, âme) et on pose un **neutre documenté** (`null` / `0` /
`false` / `visiteur-local`) pour les colonnes serveur. Les lectures suffixées
(`lirePersonnageIdentite/Race/Classe/Religion/Progression`), qui sont celles que
les écrans du wizard consomment réellement, sont produites exactement.

## 7. `verifierPrerequisCompetences` — prérequis « special » non portés

La version pastille-classe (migration 20260706195514) traite fidèlement les
prérequis de **classe** (pastille sans impact sur `niveau_max_achetable`, §6) et
de **compétence** (`prerequis_competences` indexé par niveau → `v_manquants`,
`raisons_par_niveau`, réduction de `niveau_max_achetable`). Les prérequis de type
`special` codés en dur côté SQL (`depecage_creat1/creat2/ps`, `dev_spirituel_20ps`)
ne sont **pas** portés : ils concernent 2-3 compétences et le blocage réel reste
assuré par `peutAcheterCompetence` (gate de parité, déjà 100 % couvert). À
compléter avec les autres pastilles lors de la synchro (lot a4).

## 6. Validations serveur volontairement omises (sans objet hors ligne)

Portées **par méthode**, toutes les branches `auth` / `profil` / `ownership` /
`gel` / `verrou DB` / `contrainte DB (SQLERRM)` du SQL sont omises (aucun sens en
création offline) — cf. commentaires en tête de chaque méthode de cycle de vie
dans `clientVisiteur.ts`. Seules les **validations métier** (messages VERBATIM)
sont portées.

/**
 * Page « Mises à jour » (publique, route /mises-a-jour).
 * Transparence : ce qui est livré / en cours / prévu, en langage joueur.
 * Gabarit calqué sur pages/Apropos.tsx (tokens réels). Contenu = Option A :
 * les jalons vivent dans le tableau JALONS ci-dessous. Éditer un jalon = modifier
 * une ligne (puis redéploiement). Les jalons « fait » portent une `periode`
 * (mois) et sont regroupés par mois, du plus récent au plus ancien.
 */
import { Card, CardContent } from "@/components/ui/card";

type Statut = "en_cours" | "fait" | "prevu";

interface Jalon {
  titre: string;
  statut: Statut;
  description: string;
  periode?: string; // pour les jalons « fait » : le mois de livraison
}

// Ordre d'affichage des mois dans la section « Fait » (plus récent d'abord).
const PERIODES: string[] = ["Juillet 2026", "Juin 2026", "Mai 2026", "Avril 2026 · Mise en route"];

const JALONS: Jalon[] = [
  // ===== En cours =====
  {
    statut: "en_cours",
    titre: "Page « Nouveautés »",
    description:
      "La page que tu lis : un espace de transparence sur l'évolution de la plateforme.",
  },

  // ===== Fait — Juillet 2026 =====
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Ton accueil, c'est maintenant ton espace de jeu",
    description:
      "En te connectant, tu arrives directement sur ton espace : ta fiche de personnage à portée de main, le prochain GN et son inscription, ta banque d'XP et tes notifications. Plus besoin de fouiller le menu pour retrouver ton personnage — il est là dès l'ouverture. La page « Tableau de bord » reste ton outil pour tout gérer (tous tes persos, transferts).",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Acceptation des conditions d'utilisation",
    description:
      "À votre prochaine connexion, une fenêtre unique vous demandera de confirmer avoir lu et accepté les conditions d'utilisation. Une seule confirmation par compte : c'est le titulaire du compte qui accepte, pour tous les profils de sa famille. Les nouveaux comptes cochent la case directement à l'inscription.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Conditions d'utilisation et mentions légales",
    description:
      "Deux nouvelles pages au bas du site : les Conditions d'utilisation de la plateforme et les Mentions légales (qui contacter au sujet de vos renseignements). La Politique de confidentialité a aussi été précisée : durées de conservation réelles et stockage local du navigateur.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Encyclopédie — sections de règles fidèles au manuel",
    description:
      "Les 52 sections de règles (règlements généraux, combat, magie, artisanat, objets en jeu, création de sorts) ont été auditées mot à mot et fait par fait contre le Manuel corrigé 2026. 2 coquilles corrigées (compétence « Mineur », runes tirées du langage nain et du nain ancien) et 9 précisions de règles ajoutées : exception de l'acte héroïque (potion ou soin sur soi), seul un rappel à la vie pendant un coup de grâce, port du torse requis pour les accessoires d'armure, aucune limite au nombre de compétences de niveau 3, temps des renforcements de forge, prospection minière et botanique, détail des cartes d'expédition d'herbes, propriétés des métaux hors cumul d'effets, ingrédients en gras des pièges.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Encyclopédie — Monde de Destéa",
    description:
      "6 nouveaux lieux ajoutés (Fort-aux-Fous, Château Danos, Fort Gronde, Cité-Forêt de Melchior, Fort-Aro, Sil'dor) et plusieurs fiches existantes corrigées selon le manuel (dont la Forteresse Écarlate, entièrement réécrite).",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Encyclopédie fidèle au manuel — races, bestiaire, pièges et lore",
    description:
      "Correction de 13 divergences avec le Manuel corrigé 2026 : descriptions du bestiaire (habileté), constructions de pièges (goujon, catalyseur, fiole d'encre réutilisable), exigences de costume et fiche du Royaume de Torekh.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Encyclopédie — assemblages de runes et alchimie fidèles au manuel",
    description:
      "Les 15 assemblages de runes et les 40 recettes d'alchimie ont été resynchronisés mot à mot avec le manuel corrigé : 33 coquilles et phrases altérées corrigées, dont « points de spiritualité » (accord, corrigé partout), l'Encre d'Activation Runique (le barème d'activations selon la valeur de la pierre est restauré), le Remède curatif (le Palos est activé par un souffle volontaire) et la Potion de peau de marbre.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Encyclopédie — textes des compétences fidèles au manuel",
    description:
      "35 descriptions de niveaux de compétences ont été resynchronisées mot à mot avec le manuel corrigé. Notamment : Combat à deux armes (armes courtes 45 cm, arme longue jusqu'à 110 cm au niveau 3), Discours du Commandement (rayon 10 pieds, 1 attaque ignorée par combat), Bénédiction (le pouvoir du symbole sacré est décrit au niveau 3), Dépeçage 2 (famille exacte requise), Pistage (Chiméride), Premiers Soins (« panser »), Berserk, Canalisation, Hypnose et une vingtaine d'autres corrections de coquilles.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Encyclopédie : religions et prières fidèles au manuel corrigé",
    description:
      "Grand audit de conformité mot à mot avec le manuel corrigé : les 15 cultes (histoires, serments et rituels) et les 121 prières ont été vérifiés intégralement. Une soixantaine de coquilles et quelques phrases altérées ont été corrigées — notamment les trois « voies » de la Pinte Sauvage. Ce que tu lis dans l'encyclopédie pour bâtir ton personnage est le texte officiel.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Mode visiteur et hors-ligne : ta fiche reste consultable",
    description:
      "Mode visiteur et hors-ligne : après avoir finalisé ton personnage d'essai, tu peux maintenant revoir sa fiche à tout moment (« Voir ma fiche »), y récupérer ton code de reprise ou ton fichier, et l'imprimer.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Corrigé : changer de classe à l'étape 4",
    description:
      "Corrigé : changer de classe à l'étape 4 (ex. vers Mage ou Prêtre) bloquait avec une erreur de choix manquant même après avoir choisi. C'est réglé, en ligne comme en mode visiteur.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Ton personnage d'essai devient un vrai personnage",
    description:
      "Vous avez bâti un personnage en essai libre ? À votre première connexion, Hurlevent vous propose de le transformer en vrai personnage — vérification des règles à l'appui.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Emporte ton brouillon : le code de reprise",
    description:
      "Ton brouillon d'essai libre vit sur ton appareil — et un téléphone peut l'oublier. Depuis le récapitulatif, génère un code de reprise : colle-le dans tes notes ou envoie-le-toi par message, puis colle-le sur n'importe quel appareil (site ou fichier hors-ligne) pour reprendre exactement où tu étais. Un fichier .json est aussi proposé quand ton navigateur le permet. Avant de remplacer un brouillon existant, un aperçu te montre toujours ce que tu t'apprêtes à écraser.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Plus jamais coincé hors ligne",
    description:
      "Si tu ouvres l'application sans réseau et que tes profils ne se chargent pas, un lien « Continuer hors ligne en mode visiteur » t'emmène directement au créateur de personnage, aux règles et à l'encyclopédie — qui fonctionnent sans connexion.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Les règles et l'encyclopédie voyagent avec toi",
    description:
      "Le fichier hors-ligne ne se limite plus à la création de personnage : il embarque maintenant toutes les règles du jeu et l'encyclopédie complète (races, classes, sorts, prières, bestiaire, artisanat…), avec la recherche qui fonctionne sans réseau — accents ou pas. Re-télécharge le fichier depuis la page Téléchargements pour en profiter : en forêt, en déplacement, tout le manuel vivant est dans ta poche.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Sauvegarder son personnage passe par ton compte",
    description:
      "En mode essai libre (sans compte) et dans le fichier hors-ligne, les boutons d'impression du récapitulatif ont été remplacés par un rappel : crée un compte sur le site pour enregistrer ton personnage, l'imprimer et le retrouver partout. Les joueurs connectés ne perdent rien — impression et export restent au même endroit sur ta fiche.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Le créateur hors ligne se télécharge en un clic",
    description:
      "Sur la page Téléchargements, un seul fichier à récupérer qui fonctionne sans réseau : les données du jeu sont à jour à chaque téléchargement, et un récapitulatif complet du personnage est inclus.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Essaie le créateur de personnage — sans compte, même sans réseau",
    description:
      "Tu peux maintenant essayer le créateur de personnage sans créer de compte : un bouton « Créer mon personnage — essai libre » t'attend sur l'accueil. Ça marche même hors ligne (en forêt, en sous-sol…) : ton brouillon est sauvegardé sur ton appareil et reprend là où tu étais. Toutes les règles du jeu s'appliquent (coûts XP, prérequis, classes) — avec un aperçu clair avant tout changement de classe ou désachat. À la fin, ton personnage est validé, prêt à être recréé en quelques minutes quand tu ouvres un vrai compte.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Prérequis de classe affichés",
    description:
      "Les compétences réservées à une classe affichent maintenant clairement leur classe requise (ex. « Classe Prêtre ») dans leurs prérequis — autant dans l'encyclopédie que dans le créateur de personnage, où la puce apparaît en vert si ta classe correspond, en rouge sinon.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Fiche de personnage unifiée",
    description:
      "Tous les onglets de ta fiche (traits, sorts, prières, compétences, artisanat, pièges, assemblages) partagent désormais la même présentation : même style de carte, même taille de texte, mêmes emplacements pour les titres et les badges. La lecture est plus cohérente d'un onglet à l'autre. Aucun contenu n'a changé — seule l'apparence a été harmonisée.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Recherche par fragment de mot",
    description:
      "La recherche de l'encyclopédie trouve maintenant les mots à partir d'un simple fragment, où qu'il se trouve dans le mot : « reat » trouve « créature », « boucl » trouve tous les boucliers, « regen » trouve « régénération ». À combiner avec la recherche sans accents.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Recherche sans accents",
    description:
      "La recherche de l'encyclopédie trouve maintenant les résultats même si tu tapes sans accents : « creatures », « depecage » ou « regeneration » donnent les mêmes résultats que « créatures », « dépeçage » ou « régénération ».",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Tableau de bord allégé",
    description:
      "Ton tableau de bord va droit au but : tes personnages apparaissent dès le haut de la page, et un petit tableau de bord regroupe en un coup d'œil ton prochain événement, ta banque d'XP et tes notifications — chacun se déplie quand tu veux le détail.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Fiche de personnage : abrégé ou intégral",
    description:
      "Ta fiche de personnage propose maintenant le même interrupteur que l'encyclopédie : « abrégé » pour l'essentiel d'un coup d'œil, « intégral » pour le texte complet du manuel — pour tes races, classes, traits, compétences, sorts, prières et assemblages de runes.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Feuille de personnage imprimable",
    description:
      "Tu peux imprimer ta fiche en deux versions : « abrégé » — une feuille compacte pensée pour le terrain, qui rassemble tout ton personnage (compétences, magie, artisanat) sur le moins de pages possible — ou « intégral », avec le texte complet du manuel. Un rappel des règles de fouille figure en haut de la feuille.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Forge présentée d'un seul tenant",
    description:
      "À la création de personnage comme sur ta fiche, chaque objet de forge affiche désormais sa fabrication ET sa réparation au même endroit, comme dans l'encyclopédie — fini les allers-retours entre deux onglets.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Création alignée sur l'encyclopédie",
    description:
      "La création de personnage affiche désormais la version abrégée de l'encyclopédie — le même texte partout — avec l'interrupteur abrégé ↔ intégral pour races, classes, traits, compétences, sorts, prières et assemblages de runes.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Alerte de nouvelle version",
    description:
      "Quand une nouvelle version de l'app est prête, un bandeau propose de recharger — fini le « vider le cache » ou réinstaller.",
  },
  {
    statut: "fait",
    periode: "Juillet 2026",
    titre: "Chargement plus fiable",
    description:
      "Si une liste ne se charge pas (souci de réseau), la création de personnage et l'encyclopédie affichent un message clair avec un bouton « Réessayer » au lieu d'une page vide.",
  },

  // ===== Fait — Juin 2026 =====
  {
    statut: "fait",
    periode: "Juin 2026",
    titre: "Encyclopédie repensée",
    description:
      "Navigation regroupée par grands thèmes et recherche globale couvrant toutes les catégories de l'encyclopédie, des règles au bestiaire.",
  },
  {
    statut: "fait",
    periode: "Juin 2026",
    titre: "Cimetière des Héros",
    description:
      "Hommage aux personnages tombés ; les joueurs peuvent demander la mort de leur personnage.",
  },
  {
    statut: "fait",
    periode: "Juin 2026",
    titre: "Suppression en libre-service",
    description:
      "Supprimer définitivement son compte, un profil ou un personnage depuis la plateforme.",
  },
  {
    statut: "fait",
    periode: "Juin 2026",
    titre: "Mode campagne",
    description:
      "Faire évoluer son personnage après un GN ; les acquis validés sont scellés ; changement de classe possible.",
  },
  {
    statut: "fait",
    periode: "Juin 2026",
    titre: "Comptes multi-profils",
    description:
      "Un compte peut gérer plusieurs joueurs et transférer un personnage de l'un à l'autre.",
  },
  {
    statut: "fait",
    periode: "Juin 2026",
    titre: "Banque XP",
    description:
      "Les XP gagnés (mini-GN, entretien) sont mis en banque, transférables vers un personnage ; historique consultable.",
  },
  {
    statut: "fait",
    periode: "Juin 2026",
    titre: "Tableau de bord enrichi",
    description:
      "XP disponible, progression de chaque personnage, et le prochain événement (lieu, GPS, horaires).",
  },
  {
    statut: "fait",
    periode: "Juin 2026",
    titre: "Notifications en temps réel",
    description:
      "Une cloche de notifications mise à jour en direct, rattachée à chaque profil.",
  },
  {
    statut: "fait",
    periode: "Juin 2026",
    titre: "Affichage Fiche / Manuel",
    description:
      "Basculer entre version courte et texte complet des règles ; effets des sorts et prières calculés selon le niveau.",
  },
  {
    statut: "fait",
    periode: "Juin 2026",
    titre: "Journal d'activité",
    description: "Suivre l'historique des changements apportés à son personnage.",
  },
  {
    statut: "fait",
    periode: "Juin 2026",
    titre: "Installation, pages d'info & menu",
    description:
      "Installation en application (téléphone/ordinateur), pages « À propos », « FAQ » et « Confidentialité », et menu réorganisé par sections.",
  },

  // ===== Fait — Mai 2026 =====
  {
    statut: "fait",
    periode: "Mai 2026",
    titre: "Création de personnage repensée",
    description:
      "Cases à cocher, coûts XP en direct, retour en arrière possible, validation des prérequis.",
  },
  {
    statut: "fait",
    periode: "Mai 2026",
    titre: "Système de pièges",
    description:
      "Création et désarmement de pièges intégrés à la création de personnage.",
  },
  {
    statut: "fait",
    periode: "Mai 2026",
    titre: "Recherche dans l'encyclopédie",
    description:
      "Recherche plein texte : règles, sorts, prières, bestiaire, religions, compétences.",
  },
  {
    statut: "fait",
    periode: "Mai 2026",
    titre: "Fiche imprimable",
    description: "Imprimer sa fiche de personnage, en version courte ou détaillée.",
  },
  {
    statut: "fait",
    periode: "Mai 2026",
    titre: "Artisanat détaillé",
    description:
      "Forge, joaillerie et alchimie avec quotas par niveau et temps de fabrication.",
  },

  // ===== Fait — Avril 2026 (mise en route) =====
  {
    statut: "fait",
    periode: "Avril 2026 · Mise en route",
    titre: "Assistant de création de personnage",
    description:
      "Le parcours pas-à-pas complet, de l'identité aux sorts et prières.",
  },
  {
    statut: "fait",
    periode: "Avril 2026 · Mise en route",
    titre: "Encyclopédie des règles",
    description:
      "Races, classes, religions, sorts, prières, assemblages, alchimie — consultables avec filtres.",
  },
  {
    statut: "fait",
    periode: "Avril 2026 · Mise en route",
    titre: "Fiche de personnage complète",
    description: "Toutes les informations d'un personnage réunies sur une fiche.",
  },
  {
    statut: "fait",
    periode: "Avril 2026 · Mise en route",
    titre: "Outils d'organisation",
    description: "Un panneau d'administration pour l'équipe du GN.",
  },

  // ===== Prévu =====
  {
    statut: "prevu",
    titre: "Biographie de stèle",
    description:
      "Un court texte narratif d'hommage pour les personnages décédés, à figer sur leur stèle.",
  },
  {
    statut: "prevu",
    titre: "Personnages portés disparus",
    description: "Repérer les personnages absents depuis plusieurs GN consécutifs.",
  },
  {
    statut: "prevu",
    titre: "Abrégé / intégral sur la fiche de personnage",
    description:
      "Amener le même interrupteur abrégé ↔ intégral sur la fiche de personnage.",
  },
];

const GROUPES: { statut: Statut; titre: string }[] = [
  { statut: "en_cours", titre: "En cours" },
  { statut: "fait", titre: "Fait" },
  { statut: "prevu", titre: "Prévu" },
];

const STYLE_STATUT: Record<
  Statut,
  { badge: string; bordure: string; pastille: string }
> = {
  en_cours: { badge: "bg-gold/15 text-gold", bordure: "border-l-gold", pastille: "bg-gold" },
  fait: {
    badge: "bg-emerald-600/15 text-emerald-500",
    bordure: "border-l-emerald-600",
    pastille: "bg-emerald-500",
  },
  prevu: {
    badge: "bg-muted text-muted-foreground",
    bordure: "border-l-muted-foreground",
    pastille: "bg-muted-foreground",
  },
};

const LABEL_STATUT: Record<Statut, string> = {
  en_cours: "En cours",
  fait: "Fait",
  prevu: "Prévu",
};

function CarteJalon({ jalon }: { jalon: Jalon }) {
  const st = STYLE_STATUT[jalon.statut];
  return (
    <Card className={`border-l-4 ${st.bordure}`}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
          <span
            className={`text-xs font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${st.badge}`}
          >
            {LABEL_STATUT[jalon.statut]}
          </span>
          <span className="font-semibold text-foreground text-sm">{jalon.titre}</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{jalon.description}</p>
      </CardContent>
    </Card>
  );
}

export default function MisesAJour() {
  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-3">
        Nouveautés
      </h1>
      <p className="text-muted-foreground leading-relaxed mb-6">
        Ce que l'on a livré, ce qui avance, et ce qui s'en vient sur la plateforme.
      </p>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-8">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Fait
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gold" /> En cours
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground" /> Prévu
        </span>
      </div>

      <div className="space-y-8">
        {GROUPES.map((groupe) => {
          const items = JALONS.filter((j) => j.statut === groupe.statut);
          if (items.length === 0) return null;
          const s = STYLE_STATUT[groupe.statut];
          return (
            <section key={groupe.statut}>
              <h2 className="font-heading text-xl text-primary mb-3 flex items-center gap-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${s.pastille}`} />
                {groupe.titre}
                <span className="ml-auto text-xs font-normal text-muted-foreground border border-border rounded-full px-2.5 py-0.5">
                  {items.length}
                </span>
              </h2>

              {groupe.statut === "fait" ? (
                <div className="space-y-5">
                  {PERIODES.map((periode) => {
                    const parMois = items.filter((j) => j.periode === periode);
                    if (parMois.length === 0) return null;
                    return (
                      <div key={periode}>
                        <p className="font-heading text-xs uppercase tracking-wider text-muted-foreground mb-2 pl-0.5">
                        — {periode}
                      </p>
                      <div className="space-y-2.5">
                        {parMois.map((j) => (
                          <CarteJalon key={j.titre} jalon={j} />
                        ))}
                      </div>
                    </div>
                  );
                  })}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {items.map((j) => (
                    <CarteJalon key={j.titre} jalon={j} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground pt-8 mt-8 border-t border-border leading-relaxed">
        Cette plateforme est un outil bénévole et indépendant. Pour les annonces officielles du jeu,
        consulte la{" "}
        <a
          href="https://gnhurlevent.my.canva.site"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-4 hover:text-primary/80"
        >
          page officielle du GN
        </a>
        . Dernière mise à jour : 1er juillet 2026.
      </p>
    </div>
  );
}

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
const PERIODES: string[] = ["Juin 2026", "Mai 2026", "Avril 2026 · Mise en route"];

const JALONS: Jalon[] = [
  // ===== En cours =====
  {
    statut: "en_cours",
    titre: "Page « Nouveautés »",
    description:
      "La page que tu lis : un espace de transparence sur l'évolution de la plateforme.",
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
    titre: "Mode visiteur",
    description: "Essayer la création de personnage sans avoir à créer de compte.",
  },
  {
    statut: "prevu",
    titre: "Affichage court / complet généralisé",
    description:
      "Un seul interrupteur court ↔ complet pour les textes de règles, partout sur la plateforme.",
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
        . Dernière mise à jour : 21 juin 2026.
      </p>
    </div>
  );
}

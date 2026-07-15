import { Link } from "react-router-dom";

/**
 * Page « Conditions d'utilisation » (publique, route /conditions-utilisation) — s334.
 * §2 : modèle réel de la plateforme (1 compte par famille, 1 profil par personne,
 * mineur = profil dans le compte d'un parent), harmonisé avec Confidentialite §7.
 * Gabarit visuel calqué sur pages/Confidentialite.tsx (tokens réels).
 */
export default function ConditionsUtilisation() {
  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-2">
        Conditions d'utilisation
      </h1>
      <p className="text-sm text-muted-foreground mb-6">Dernière mise à jour : 14 juillet 2026.</p>

      <div className="space-y-4 text-muted-foreground leading-relaxed">
        <p>
          En créant un compte ou en utilisant la plateforme d'Hurlevent, vous acceptez les
          conditions suivantes.
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">1. Objet du service</h2>
        <p>
          La plateforme sert à gérer les personnages, les points d'expérience, les inscriptions
          aux événements et l'accès aux règles du GN Hurlevent. C'est un service bénévole et
          gratuit, offert à la communauté du jeu.
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">2. Compte et profils</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Idéalement, un seul compte par famille ; chaque personne qui joue a son propre profil
            dans ce compte.
          </li>
          <li>Les renseignements fournis doivent être exacts.</li>
          <li>
            Le titulaire du compte est responsable de la confidentialité de son mot de passe et
            de l'utilisation qui est faite du compte et de ses profils.
          </li>
          <li>
            Un mineur ne crée pas de compte : il utilise un profil dans le compte d'un parent ou
            tuteur, qui le supervise.
          </li>
        </ul>

        <h2 className="font-heading text-xl text-primary pt-4">3. Utilisation acceptable</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Les textes libres (nom, historique, âme de personnage, épitaphes…) ne doivent
            contenir aucun contenu illégal, haineux ou visant une personne réelle.
          </li>
          <li>
            Il est interdit de tenter de contourner les protections de la plateforme ou de
            fausser des données de jeu (XP, inscriptions, présences).
          </li>
        </ul>

        <h2 className="font-heading text-xl text-primary pt-4">4. Modération</h2>
        <p>
          L'équipe d'animation peut corriger des données de jeu, retirer un contenu inapproprié
          ou bloquer un compte, un profil ou un personnage. Ces actions sont journalisées.
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">5. Disponibilité</h2>
        <p>
          La plateforme est fournie « telle quelle », bénévolement, sans garantie de
          disponibilité ni d'absence d'erreur. Elle peut évoluer, être interrompue ou fermée. Les
          données de jeu (XP, fiches, objets) n'ont aucune valeur monétaire.
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">6. Renseignements personnels</h2>
        <p>
          Le traitement des renseignements personnels est décrit dans la{" "}
          <Link
            to="/confidentialite"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Politique de confidentialité
          </Link>{" "}
          et les responsables sont identifiés dans les{" "}
          <Link
            to="/mentions-legales"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Mentions légales
          </Link>
          .
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">7. Suppression</h2>
        <p>
          Vous pouvez supprimer votre personnage, votre profil ou votre compte en tout temps
          depuis la plateforme. Cette suppression est irréversible.
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">8. Droit applicable</h2>
        <p>Les présentes conditions sont régies par les lois du Québec et du Canada.</p>

        <h2 className="font-heading text-xl text-primary pt-4">9. Modifications</h2>
        <p>
          Les conditions peuvent être mises à jour ; la version affichée sur le site est celle en
          vigueur.
        </p>
      </div>
    </div>
  );
}

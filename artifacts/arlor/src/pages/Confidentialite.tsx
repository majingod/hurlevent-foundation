import { Link } from "react-router-dom";

/**
 * Page « Politique de confidentialité » (publique, route /confidentialite).
 * Conforme Loi 25. Contenu figé s254 (contenu_pages_publiques_s255.md) — reproduit verbatim.
 * Enrichie s334 (audit Loi 25) : hors-Québec précisé, durées de conservation réelles,
 * témoins/stockage local, contact du responsable (voir /mentions-legales).
 * Gabarit visuel calqué sur pages/Telechargements.tsx (tokens réels).
 */
export default function Confidentialite() {
  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-2">
        Politique de confidentialité de la plateforme d'Hurlevent
      </h1>
      <p className="text-sm text-muted-foreground mb-6">Dernière mise à jour : 14 juillet 2026.</p>

      <div className="space-y-4 text-muted-foreground leading-relaxed">
        <p>
          La présente politique décrit les renseignements traités par la plateforme d'Hurlevent,
          la manière dont ils sont utilisés et les choix offerts aux utilisateurs.
        </p>
        <p>
          La plateforme est exploitée par une personne privée, bénévole et indépendante, pour le
          projet Hurlevent.
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">1. Renseignements traités</h2>
        <p>La plateforme peut traiter notamment les renseignements suivants :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Adresse courriel.</li>
          <li>Nom d'utilisateur.</li>
          <li>Mot de passe haché, géré par le système d'authentification.</li>
          <li>Profils joueurs.</li>
          <li>Données de personnages.</li>
          <li>Inscriptions aux événements.</li>
          <li>Points XP et historique de progression.</li>
          <li>Messages et notifications liés au compte.</li>
          <li>Journal technique et journal d'audit des actions administratives.</li>
          <li>
            Textes libres saisis par les utilisateurs dans certaines sections, pouvant contenir
            des renseignements personnels.
          </li>
          <li>
            Données liées au Cimetière des Héros, lorsqu'un personnage décède et qu'un mémorial
            public est créé.
          </li>
        </ul>

        <h2 className="font-heading text-xl text-primary pt-4">2. Utilisation des renseignements</h2>
        <p>Ces renseignements servent uniquement à :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Créer et gérer les comptes.</li>
          <li>Créer et gérer les profils joueurs et les personnages.</li>
          <li>Gérer les inscriptions aux événements.</li>
          <li>Attribuer automatiquement les points XP.</li>
          <li>Permettre l'accès aux règles et aux fonctionnalités du jeu.</li>
          <li>Assurer le fonctionnement technique, la sécurité et l'administration de la plateforme.</li>
          <li>
            Conserver certains éléments de jeu ou de mémoire communautaire lorsque cela est prévu
            par la plateforme.
          </li>
        </ul>

        <h2 className="font-heading text-xl text-primary pt-4">3. Hébergement et services utilisés</h2>
        <p>La plateforme utilise notamment :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Supabase pour la base de données et l'authentification.</li>
          <li>Vercel pour l'hébergement de l'application web.</li>
          <li>GitHub pour le code source.</li>
        </ul>
        <p>Aucun fichier téléversé n'est utilisé actuellement sur la plateforme.</p>
        <p>
          Ces fournisseurs conservent les données sur des serveurs situés à l'extérieur du
          Québec, notamment aux États-Unis. En utilisant la plateforme, l'utilisateur consent à
          cette communication hors Québec, encadrée par les mesures de protection de ces
          fournisseurs.
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">4. Autorisation sur l'univers du jeu</h2>
        <p>
          Le créateur de la plateforme a l'autorisation de l'organisation du GN Hurlevent pour
          utiliser les données de l'univers fantastique uniquement pour cette plateforme.
          Cette autorisation ne permet pas de réutiliser ces éléments à d'autres fins sans permission.
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">5. Conservation</h2>
        <p>
          Les renseignements sont conservés tant qu'un compte, un profil ou un personnage existe,
          ou tant qu'ils sont nécessaires au fonctionnement de la plateforme.
        </p>
        <p>
          Lorsque l'utilisateur supprime définitivement son compte, son profil ou son personnage
          via la plateforme, les données associées sont supprimées selon les mécanismes prévus par
          le système.
        </p>
        <p>
          Certains éléments techniques ou de jeu peuvent être conservés plus longtemps lorsque cela
          est nécessaire au fonctionnement de la plateforme, à la sécurité, à l'administration ou au
          suivi du jeu.
        </p>
        <p>En pratique :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Les notifications sont supprimées automatiquement après 90 jours.</li>
          <li>
            Après la suppression définitive d'un compte, le journal d'activité associé est
            conservé 24 mois à des fins de sécurité et de suivi, puis anonymisé : les noms et
            identifiants en sont retirés et seules des statistiques anonymes subsistent.
          </li>
          <li>
            Le mémorial public des personnages décédés (cimetière) peut afficher le nom de profil
            choisi par le joueur, lorsqu'une stèle est créée.
          </li>
        </ul>

        <h2 className="font-heading text-xl text-primary pt-4">6. Suppression définitive par l'utilisateur</h2>
        <p>
          La plateforme permet aux utilisateurs de supprimer eux-mêmes, en tout temps, leur
          personnage, leur profil et leur compte de façon définitive.
        </p>
        <p>Cette suppression est irréversible.</p>

        <h2 className="font-heading text-xl text-primary pt-4">7. Mineurs</h2>
        <p>
          La plateforme peut être utilisée par des mineurs uniquement avec l'autorisation et la
          supervision d'un parent ou tuteur.
        </p>
        <p>
          Le parent peut créer son propre compte et gérer un ou plusieurs profils associés, afin de
          séparer correctement les personnages.
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">8. Sécurité</h2>
        <p>
          Des mesures raisonnables sont mises en place pour protéger les renseignements traités,
          notamment :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Authentification gérée par le système d'hébergement.</li>
          <li>Accès restreint aux fonctions administratives.</li>
          <li>Journalisation de certaines actions administratives.</li>
          <li>Mécanismes de suppression et de blocage des comptes.</li>
          <li>Utilisation d'une infrastructure d'hébergement externe pour le stockage et l'application.</li>
        </ul>

        <h2 className="font-heading text-xl text-primary pt-4">9. Communication avec le GN</h2>
        <p>
          La plateforme est distincte de la page officielle du GN. Pour toute question liée aux
          annonces officielles, aux règles du jeu ou au contenu de l'univers, veuillez consulter la{" "}
          <a
            href="https://gnhurlevent.my.canva.site"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            page officielle du GN
          </a>
          .
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">10. Témoins et stockage local</h2>
        <p>
          La plateforme n'utilise aucun témoin (cookie) publicitaire ni outil de mesure
          d'audience.
        </p>
        <p>
          Le navigateur de l'utilisateur conserve localement certains éléments nécessaires au
          fonctionnement : la session de connexion, les brouillons de création de personnage et
          des préférences d'affichage. Ces éléments restent sur l'appareil de l'utilisateur, ne
          sont pas transmis à des tiers et peuvent être effacés en vidant les données de
          navigation.
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">11. Vos droits et contact</h2>
        <p>
          L'utilisateur peut consulter et corriger la plupart de ses renseignements directement
          dans l'application. Pour toute demande d'accès, de rectification ou toute question sur
          la présente politique :{" "}
          <a
            href="mailto:badfred50@gmail.com"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            badfred50@gmail.com
          </a>{" "}
          (voir aussi les{" "}
          <Link
            to="/mentions-legales"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            mentions légales
          </Link>
          ).
        </p>
        <p>
          L'équipe d'animation a accès aux renseignements nécessaires à la gestion du jeu ; ses
          actions sensibles sont journalisées.
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">12. Modifications</h2>
        <p>
          Cette politique peut être mise à jour si les fonctionnalités de la plateforme ou les
          services utilisés changent.
        </p>
        <p>La version la plus récente est toujours celle affichée sur le site.</p>
        <p>
          Pour toute question au sujet de cette politique, vous pouvez communiquer avec le créateur
          via le{" "}
          <a
            href="https://discord.gg/phRws4sKn"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Discord de la plateforme d'Hurlevent
          </a>
          .
        </p>
      </div>
    </div>
  );
}

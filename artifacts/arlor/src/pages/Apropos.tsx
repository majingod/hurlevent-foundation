/**
 * Page « À propos » (publique, route /apropos).
 * Contenu figé s254 (contenu_pages_publiques_s255.md) — reproduit verbatim.
 * Gabarit visuel calqué sur pages/Telechargements.tsx (tokens réels).
 */
export default function Apropos() {
  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-6">
        À propos de la plateforme d'Hurlevent
      </h1>

      <div className="space-y-4 text-muted-foreground leading-relaxed">
        <p>
          La plateforme d'Hurlevent est un outil web créé bénévolement pour faciliter la vie
          des joueurs et des organisateurs du GN Hurlevent.
        </p>
        <p>
          Elle a été conçue pour simplifier la création de personnages, la gestion des profils
          joueurs, les inscriptions aux événements, le suivi des points XP et l'accès à certaines
          informations utiles au jeu.
        </p>
        <p>
          Cette plateforme a été développée par une personne privée, bénévole et indépendante,
          pour répondre aux besoins du projet Hurlevent. Elle n'est pas un service commercial et
          ne remplace pas les communications officielles du GN.
        </p>
        <p>
          Pour plus d'information sur le GN Hurlevent, les annonces officielles, les règles du jeu
          et l'univers, veuillez consulter la{" "}
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

        <h2 className="font-heading text-xl text-primary pt-4">Fonctionnalités principales</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Création et gestion de comptes.</li>
          <li>Création de profils joueurs et de personnages.</li>
          <li>Inscription aux événements.</li>
          <li>Attribution automatique des points XP.</li>
          <li>Consultation des règles du jeu.</li>
          <li>Suppression définitive des comptes, profils et personnages directement sur la plateforme.</li>
        </ul>

        <p>
          La plateforme est pensée pour soutenir la communauté, alléger certaines tâches
          administratives et améliorer l'expérience de jeu.
        </p>
        <p>
          Si vous avez des questions au sujet de la plateforme, vous pouvez communiquer avec le
          créateur via le{" "}
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

        <p className="text-sm pt-4">Dernière mise à jour : 21 juin 2026.</p>
      </div>
    </div>
  );
}

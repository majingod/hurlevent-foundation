import { Link } from "react-router-dom";

/**
 * Page « Mentions légales » (publique, route /mentions-legales) — s334.
 * Loi 25 art. 3.1 : titre et coordonnées du responsable de la protection des RP.
 * Gabarit visuel calqué sur pages/Confidentialite.tsx (tokens réels).
 */
export default function MentionsLegales() {
  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-2">
        Mentions légales
      </h1>
      <p className="text-sm text-muted-foreground mb-6">Dernière mise à jour : 14 juillet 2026.</p>

      <div className="space-y-4 text-muted-foreground leading-relaxed">
        <h2 className="font-heading text-xl text-primary pt-4">1. Exploitant</h2>
        <p>
          La plateforme d'Hurlevent est un outil bénévole et sans but lucratif, exploité par une
          personne privée (Fred) au Québec (Canada), pour la communauté du GN Hurlevent. Elle ne
          vend rien, n'affiche aucune publicité et ne transmet aucun renseignement à des fins
          commerciales.
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">
          2. Responsable de la protection des renseignements personnels
        </h2>
        <p>
          Fred, exploitant bénévole de la plateforme, agit comme responsable de la protection des
          renseignements personnels au sens de la Loi 25 (Québec).
        </p>
        <p>
          Contact :{" "}
          <a
            href="mailto:badfred50@gmail.com"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            badfred50@gmail.com
          </a>
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">3. Exercer vos droits</h2>
        <p>
          Vous pouvez consulter et corriger la plupart de vos renseignements directement dans
          l'application, et supprimer vous-même votre personnage, votre profil ou votre compte en
          tout temps. Pour toute autre demande d'accès, de rectification ou de retrait, écrivez à{" "}
          <a
            href="mailto:badfred50@gmail.com"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            badfred50@gmail.com
          </a>
          . Une réponse vous sera donnée dans un délai maximal de 30 jours.
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">4. Incident de confidentialité</h2>
        <p>
          Si vous croyez que des renseignements vous concernant ont été consultés ou utilisés sans
          autorisation, signalez-le à{" "}
          <a
            href="mailto:badfred50@gmail.com"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            badfred50@gmail.com
          </a>
          .
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">5. Hébergement</h2>
        <p>
          L'application est hébergée par Vercel et les données par Supabase, sur des serveurs
          situés à l'extérieur du Québec. Le détail se trouve dans la{" "}
          <Link
            to="/confidentialite"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Politique de confidentialité
          </Link>
          .
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">6. Mineurs</h2>
        <p>
          La plateforme peut être utilisée par des mineurs uniquement avec l'autorisation et la
          supervision d'un parent ou tuteur (voir la{" "}
          <Link
            to="/confidentialite"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Politique de confidentialité
          </Link>
          ).
        </p>

        <h2 className="font-heading text-xl text-primary pt-4">7. Propriété intellectuelle</h2>
        <p>
          L'univers de Destéa, les règles et les contenus du jeu appartiennent au GN Hurlevent.
          Les textes créatifs saisis par les joueurs (nom, historique, âme de personnage)
          demeurent les leurs ; en les saisissant, le joueur autorise leur affichage dans la
          plateforme aux fins du jeu.
        </p>
      </div>
    </div>
  );
}

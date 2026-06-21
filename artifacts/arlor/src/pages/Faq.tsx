/**
 * Page « Foire aux questions » (publique, route /faq).
 * Contenu figé s254 (contenu_pages_publiques_s255.md), v2 — Q3 = version A. Reproduit verbatim.
 * Gabarit visuel calqué sur pages/Telechargements.tsx (tokens réels).
 */

interface QR {
  question: string;
  reponse: string;
}

const FAQ: QR[] = [
  {
    question: "La plateforme est-elle contrôlée par un joueur ? Que se passe-t-il en cas de départ ?",
    reponse:
      "La plateforme d'Hurlevent est développée et opérée par une personne privée, bénévole et indépendante. Elle tourne sur des services d'hébergement gérés (Supabase, Vercel) et son code est conservé sur GitHub — pas sur un ordinateur personnel. Pour la pérennité, un plan de continuité est prévu avec l'organisation du GN Hurlevent.",
  },
  {
    question: "L'animation pourra-t-elle mettre à jour les compétences, sorts, etc. ?",
    reponse:
      "Dès que l'animation met à jour une règle, le créateur la reporte sur la plateforme aussitôt que possible. Un outil d'édition en libre-service pour l'animation est prévu, mais sa mise en place côté interface est complexe : aucune date précise pour l'instant.",
  },
  {
    question: "Où sont stockées les données ? Qui y a accès ? Et mes fiches ?",
    reponse:
      "Les données sont stockées sur une base gérée (Supabase). Chaque joueur n'a accès qu'à ses propres données, et oui, chaque joueur accède à ses propres fiches de personnage. Aucun autre joueur — y compris le créateur dans son rôle de joueur — ne peut consulter vos fiches : le cloisonnement de sécurité l'empêche. Seuls les membres de l'organisation du GN Hurlevent disposent d'un accès administratif aux données, utilisé uniquement pour l'administration du jeu. Les mots de passe ne sont jamais stockés en clair : ils sont hachés et gérés par le système d'authentification — le créateur ne les voit pas.",
  },
  {
    question: "Y a-t-il les sorts, pièges, runes, potions pour les personnages ?",
    reponse:
      "Oui. Les sorts, prières, l'alchimie (potions), l'artisanat, les compétences (dont les pièges) et les assemblages de runes font partie de la création de personnage. Des informations sur ces sujets sont aussi disponibles dans l'encyclopédie.",
  },
  {
    question: "Comment accéder aux données depuis le terrain, à part le PDF ?",
    reponse:
      "La plateforme s'installe comme une application sur téléphone ou ordinateur, en plus de l'accès par navigateur. Pour le terrain sans connexion, le manuel PDF téléchargeable reste la référence hors-ligne.",
  },
  {
    question: "Qui paie les frais ?",
    reponse:
      "Les frais sont assumés par le créateur, bénévolement. La plateforme utilise des offres d'hébergement gratuites, choisies aussi pour leur pérennité.",
  },
  {
    question:
      "Certaines plateformes imposent des limites ou des frais élevés sous fort trafic. Est-ce pris en compte ?",
    reponse:
      "Avec une communauté d'environ 120 à 150 joueurs, le trafic reste faible et dans les limites des offres d'hébergement actuelles. L'usage est surveillé ; en cas de croissance, des options existent.",
  },
];

export default function Faq() {
  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-6">
        Foire aux questions
      </h1>

      <div className="space-y-6">
        {FAQ.map((item, i) => (
          <div key={i} className="border-b border-border pb-6 last:border-b-0">
            <h2 className="font-heading text-lg text-primary mb-2">{item.question}</h2>
            <p className="text-muted-foreground leading-relaxed">{item.reponse}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

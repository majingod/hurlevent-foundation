import { Link } from "react-router-dom";
import { useMenuNavigation } from "@/hooks/useMenuNavigation";

// Un lien dont l'URL commence par http(s) pointe hors de l'application
// (page officielle du GN, Discord) : rendu en <a target="_blank">.
// react-router ne gère pas les URL absolues, d'où le <Link> réservé aux liens internes.
const estLienExterne = (url: string) => /^https?:\/\//i.test(url);

const Footer = () => {
  const { data: menuItems } = useMenuNavigation(null);
  const liens = menuItems?.filter((item) => item.afficher_footer) ?? [];
  // Ligne 1 : pages d'information (internes). Ligne 2 : liens communauté (externes).
  const internes = liens.filter((item) => !estLienExterne(item.url));
  const externes = liens.filter((item) => estLienExterne(item.url));

  return (
    <footer className="border-t border-border py-8">
      <div className="container flex flex-col items-center gap-3 text-sm text-muted-foreground">
        {internes.length > 0 && (
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {internes.map((item) => (
              <Link
                key={item.id}
                to={item.url}
                className="hover:text-primary transition-colors"
              >
                {item.libelle}
              </Link>
            ))}
          </nav>
        )}

        {externes.length > 0 && (
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs">
            {externes.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                {item.libelle}
              </a>
            ))}
          </nav>
        )}

        <p className="font-heading text-xs">© Hurlevent — GN Médiéval-Fantastique de Destéa</p>
      </div>
    </footer>
  );
};

export default Footer;

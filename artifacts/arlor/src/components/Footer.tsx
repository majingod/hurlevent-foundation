import { Link } from "react-router-dom";
import { useMenuNavigation } from "@/hooks/useMenuNavigation";

// Un lien dont l'URL commence par http(s) pointe hors de l'application
// (page officielle du GN, Discord) : on le rend en <a target="_blank">,
// jamais en <Link> (react-router ne gère pas les URL absolues).
const estLienExterne = (url: string) => /^https?:\/\//i.test(url);

const Footer = () => {
  const { data: menuItems } = useMenuNavigation(null);

  return (
    <footer className="border-t border-border py-8">
      <div className="container flex flex-col items-center gap-4 text-sm text-muted-foreground">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {menuItems
            ?.filter((item) => item.afficher_footer)
            .map((item) =>
              estLienExterne(item.url) ? (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  {item.libelle}
                </a>
              ) : (
                <Link
                  key={item.id}
                  to={item.url}
                  className="hover:text-primary transition-colors"
                >
                  {item.libelle}
                </Link>
              )
            )}
        </nav>
        <p className="font-heading text-xs">© Hurlevent — GN Médiéval-Fantastique de Destéa</p>
      </div>
    </footer>
  );
};

export default Footer;

import { Link } from "react-router-dom";
import { useMenuNavigation } from "@/hooks/useMenuNavigation";

const Footer = () => {
  const { data: menuItems } = useMenuNavigation(null);

  return (
    <footer className="border-t border-border py-8">
      <div className="container flex flex-col items-center gap-4 text-sm text-muted-foreground">
        <nav className="flex gap-6">
          {menuItems?.filter(item => item.afficher_footer).map(item => (
            <Link key={item.id} to={item.url} className="hover:text-primary transition-colors">
              {item.libelle}
            </Link>
          ))}
        </nav>
        <p className="font-heading text-xs">© Hurlevent — GN Médiéval-Fantastique de Destéa</p>
      </div>
    </footer>
  );
};

export default Footer;

import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="border-t border-border py-8">
    <div className="container flex flex-col items-center gap-4 text-sm text-muted-foreground">
      <nav className="flex gap-6">
        <Link to="/" className="hover:text-primary transition-colors">Accueil</Link>
        <Link to="/regles" className="hover:text-primary transition-colors">Règles</Link>
        <Link to="/evenements" className="hover:text-primary transition-colors">Événements</Link>
      </nav>
      <p className="font-heading text-xs">© Hurlevent — GN Médiéval-Fantastique de Destéa</p>
    </div>
  </footer>
);

export default Footer;

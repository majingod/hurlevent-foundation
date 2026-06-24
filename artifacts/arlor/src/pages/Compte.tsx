import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import FluxSuppressionCimetiere from "@/components/suppression/FluxSuppressionCimetiere";

/**
 * Page « Mon compte » (protégée).
 * Self-service de suppression définitive du compte — table rase RGPD (Loi 25) :
 * la RPC `creer_steles_et_supprimer(p_cible='compte', …)` purge profils + personnages
 * ET efface le login (`auth.users`). On déconnecte donc la session après succès.
 */
export default function Compte() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Mon compte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gère la suppression définitive de ton compte Hurlevent.
        </p>
      </div>

      <FluxSuppressionCimetiere
        cible="compte"
        idCible={user.id}
        titre="Supprimer mon compte"
        variante="page"
        onSuccess={async () => {
          // Le login est effacé côté serveur : on termine la session locale.
          try {
            await signOut();
          } catch {
            /* la session est déjà invalide, on ignore */
          }
          navigate("/", { replace: true });
        }}
      />
    </div>
  );
}

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfil } from "@/contexts/ProfilContext";
import { useModeStaff } from "@/contexts/ModeStaffContext";
import QuiJoue from "@/components/profil/QuiJoue";
import Navbar from "@/components/Navbar";
import ScrollToTop from "@/components/ScrollToTop";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import PwaAutoUpdater from "@/components/PwaAutoUpdater";

// Pages publiques
import Accueil from "@/pages/Accueil";
import Regles from "@/pages/Regles";
import Encyclopedie from "@/pages/Encyclopedie";
import Evenements from "@/pages/Evenements";
import Connexion from "@/pages/Connexion";
import Telechargements from "@/pages/Telechargements";
import Apropos from "@/pages/Apropos";
import Confidentialite from "@/pages/Confidentialite";
import Faq from "@/pages/Faq";
import MisesAJour from "@/pages/MisesAJour";

// Pages joueur
import TableauDeBord from "@/pages/TableauDeBord";
import PersonnageNouveauV2 from "@/pages/PersonnageNouveauV2";
import RepriseEssai from "@/pages/RepriseEssai";
import CreationVisiteur from "@/pages/CreationVisiteur";
import PersonnageFiche from "@/pages/PersonnageFiche";
import PersonnageJournal from "@/pages/PersonnageJournal";
import Cimetiere from "@/pages/Cimetiere";
import Compte from "@/pages/Compte";

// Pages administration
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminJoueurs from "@/pages/admin/AdminJoueurs";
import AdminPersonnages from "@/pages/admin/AdminPersonnages";
import AdminEvenements from "@/pages/admin/AdminEvenements";
import AdminApprobations from "@/pages/admin/AdminApprobations";
import AdminJournal from "@/pages/admin/AdminJournal";
import AdminDonnees from "@/pages/admin/AdminDonnees";
import AdminCimetiere from "@/pages/admin/AdminCimetiere";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.skipGlobalErrorToast === true) return;
      toast.error(`Erreur de chargement: ${error.message}`);
      console.error('[Query Error]', query.queryKey, error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.skipGlobalErrorToast === true) return;
      toast.error(`Erreur: ${error.message}`);
      console.error('[Mutation Error]', mutation.options.mutationKey, error);
    },
  }),
});

// Garde de route staff : redirige hors de /administration/* si le mode staff
// n'est pas actif (compte non-staff, profil non-principal, ou interrupteur OFF).
// Attend la résolution du rôle pour éviter un rebond au boot.
const GardeStaff = () => {
  const { roleLoading } = useAuth();
  const { staffActif } = useModeStaff();
  if (roleLoading) return null;
  return staffActif ? <Outlet /> : <Navigate to="/tableau-de-bord" replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Accueil />} />
    <Route path="/regles" element={<Regles />} />
    <Route path="/encyclopedie" element={<Encyclopedie />} />
    <Route path="/evenements" element={<Evenements />} />
    <Route path="/telechargements" element={<Telechargements />} />
    <Route path="/apropos" element={<Apropos />} />
    <Route path="/confidentialite" element={<Confidentialite />} />
    <Route path="/faq" element={<Faq />} />
    <Route path="/mises-a-jour" element={<MisesAJour />} />
    <Route path="/connexion" element={<Connexion />} />

    {/* Route PUBLIQUE (hors ProtectedRoute) : créateur en mode visiteur,
        sans compte ni réseau (P2-b). */}
    <Route path="/visiteur" element={<CreationVisiteur />} />

    <Route
      path="/tableau-de-bord"
      element={
        <ProtectedRoute>
          <TableauDeBord />
        </ProtectedRoute>
      }
    />
    <Route
      path="/personnage/nouveau"
      element={
        <ProtectedRoute>
          <PersonnageNouveauV2 />
        </ProtectedRoute>
      }
    />
    {/* [VIS-6] Lot 2 — reprise du brouillon visiteur (même garde auth). */}
    <Route
      path="/reprise-essai"
      element={
        <ProtectedRoute>
          <RepriseEssai />
        </ProtectedRoute>
      }
    />
    <Route
      path="/personnage/:id"
      element={
        <ProtectedRoute>
          <PersonnageFiche />
        </ProtectedRoute>
      }
    />
    <Route
      path="/personnage/:id/journal"
      element={
        <ProtectedRoute>
          <PersonnageJournal />
        </ProtectedRoute>
      }
    />

    <Route
      path="/cimetiere"
      element={
        <ProtectedRoute>
          <Cimetiere />
        </ProtectedRoute>
      }
    />

    <Route
      path="/compte"
      element={
        <ProtectedRoute>
          <Compte />
        </ProtectedRoute>
      }
    />

    <Route element={<GardeStaff />}>
    <Route
      path="/administration"
      element={<Navigate to="/administration/dashboard" replace />}
    />
    <Route
      path="/administration/dashboard"
      element={
        <ProtectedRoute requiredRole="animateur">
          <AdminDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/administration/joueurs"
      element={
        <ProtectedRoute requiredRole="animateur">
          <AdminJoueurs />
        </ProtectedRoute>
      }
    />
    <Route
      path="/administration/personnages"
      element={
        <ProtectedRoute requiredRole="animateur">
          <AdminPersonnages />
        </ProtectedRoute>
      }
    />
    <Route
      path="/administration/evenements"
      element={
        <ProtectedRoute requiredRole="animateur">
          <AdminEvenements />
        </ProtectedRoute>
      }
    />
    <Route
      path="/administration/approbations"
      element={
        <ProtectedRoute requiredRole="animateur">
          <AdminApprobations />
        </ProtectedRoute>
      }
    />
    <Route
      path="/administration/journal"
      element={
        <ProtectedRoute requiredRole="animateur">
          <AdminJournal />
        </ProtectedRoute>
      }
    />
    <Route
      path="/administration/cimetiere"
      element={
        <ProtectedRoute requiredRole="animateur">
          <AdminCimetiere />
        </ProtectedRoute>
      }
    />
    <Route
      path="/administration/competences-maitre"
      element={<Navigate to="/administration/approbations" replace />}
    />
    <Route
      path="/administration/donnees"
      element={
        <ProtectedRoute requiredRole="admin">
          <AdminDonnees />
        </ProtectedRoute>
      }
    />
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App = () => {
  const { loading, user, bootLent } = useAuth();
  const { loadingProfils, profilActif } = useProfil();

  // P2-b : la route visiteur vit HORS de la barrière auth. Sans cette garde,
  // le gate spinner bloque l'affichage hors ligne (gotcha s307 : écran blanc)
  // tant que la session Supabase n'a pas résolu — ce qui n'arrive jamais sans
  // réseau. On lit le pathname brut (le Proxy `clientActif` fait de même).
  const estRouteVisiteur = /^\/visiteur(\/|$)/.test(window.location.pathname);

  if (!estRouteVisiteur && (loading || (user && loadingProfils))) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-black px-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
        {bootLent && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-white/70">
              La connexion prend plus de temps que prévu…
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-black"
            >
              Réessayer
            </button>
            {/* [VIS-7] Échappatoire hors-ligne : lien DUR (pas de navigate), estRouteVisiteur vit au-dessus du Router. */}
            <a
              href="/visiteur"
              className="text-sm text-gold underline underline-offset-2"
            >
              Continuer hors ligne en mode visiteur
            </a>
          </div>
        )}
      </div>
    );
  }

  // « Sans skip » : connecté + aucun profil choisi cette session -> écran « Qui joue ? ».
  // Jamais sur la route visiteur (publique, aucun profil requis).
  const doitChoisirProfil = !estRouteVisiteur && !!user && !profilActif;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PwaAutoUpdater />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <ScrollToTop />
          {doitChoisirProfil ? (
            <QuiJoue />
          ) : (
            <div className="min-h-screen flex flex-col bg-black text-white">
              <Navbar />
              <main className="flex-1">
                <AppRoutes />
              </main>
              <Footer />
            </div>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

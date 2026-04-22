import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";

// Pages publiques
import Accueil from "@/pages/Accueil";
import Regles from "@/pages/Regles";
import Encyclopedie from "@/pages/Encyclopedie";
import Evenements from "@/pages/Evenements";
import Connexion from "@/pages/Connexion";

// Pages joueur
import TableauDeBord from "@/pages/TableauDeBord";
import FichePersonnage from "@/pages/FichePersonnage";

// Pages admin (Manus AI)
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminJoueurs from "@/pages/admin/AdminJoueurs";
import AdminPersonnages from "@/pages/admin/AdminPersonnages";
import AdminEvenements from "@/pages/admin/AdminEvenements";
import AdminCompetencesMaitre from "@/pages/admin/AdminCompetencesMaitre";
import AdminDonnees from "@/pages/admin/AdminDonnees";

const queryClient = new QueryClient();

const App = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-black text-white">
            <Navbar />
            <main className="flex-1">
              <Routes>
                {/* Routes publiques */}
                <Route path="/" element={<Accueil />} />
                <Route path="/regles" element={<Regles />} />
                <Route path="/encyclopedie" element={<Encyclopedie />} />
                <Route path="/evenements" element={<Evenements />} />
                <Route path="/connexion" element={<Connexion />} />

                {/* Routes joueur connecté */}
                <Route
                  path="/tableau-de-bord"
                  element={
                    <ProtectedRoute>
                      <TableauDeBord />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/personnage/:id"
                  element={
                    <ProtectedRoute>
                      <FichePersonnage />
                    </ProtectedRoute>
                  }
                />

                {/* Routes administration */}
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
                  path="/administration/competences-maitre"
                  element={
                    <ProtectedRoute requiredRole="animateur">
                      <AdminCompetencesMaitre />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/administration/donnees"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <AdminDonnees />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

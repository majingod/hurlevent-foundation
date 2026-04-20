import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";

import Accueil from "@/pages/Accueil";
import Regles from "@/pages/Regles";
import Encyclopedie from "@/pages/Encyclopedie";
import Evenements from "@/pages/Evenements";
import Connexion from "@/pages/Connexion";
import TableauDeBord from "@/pages/TableauDeBord";
import PersonnageNouveau from "@/pages/PersonnageNouveau";
import PersonnageFiche from "@/pages/PersonnageFiche";
import Administration from "@/pages/Administration";
import AdministrationEvenements from "@/pages/AdministrationEvenements";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Accueil />} />
              <Route path="/regles" element={<Regles />} />
              <Route path="/encyclopedie" element={<Encyclopedie />} />
              <Route path="/evenements" element={<Evenements />} />
              <Route path="/connexion" element={<Connexion />} />

              <Route path="/tableau-de-bord" element={
                <ProtectedRoute allowedRoles={["joueur", "animateur", "admin"]}>
                  <TableauDeBord />
                </ProtectedRoute>
              } />
              <Route path="/personnage/nouveau" element={
                <ProtectedRoute allowedRoles={["joueur", "animateur", "admin"]}>
                  <PersonnageNouveau />
                </ProtectedRoute>
              } />
              <Route path="/personnage/:id" element={
                <ProtectedRoute allowedRoles={["joueur", "animateur", "admin"]}>
                  <PersonnageFiche />
                </ProtectedRoute>
              } />

              <Route path="/administration" element={
                <ProtectedRoute allowedRoles={["animateur", "admin"]}>
                  <Administration />
                </ProtectedRoute>
              } />
              <Route path="/administration/evenements" element={
                <ProtectedRoute allowedRoles={["animateur", "admin"]}>
                  <AdministrationEvenements />
                </ProtectedRoute>
              } />

              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { Search, Mail, User, Users, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Joueur {
  joueur_id: string;
  username: string | null;
  email: string | null;
  nom_affichage: string | null;
  role: string | null;
  is_active: boolean;
  compte_cree_le: string;
  nb_personnages_actifs: number;
  nb_personnages_morts: number;
  nb_personnages_archives: number;
  nb_personnages_total: number;
  personnage_actif_principal: string | null;
}

const AdminJoueurs = () => {
  const { role: currentUserRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();
  const isAdmin = currentUserRole === "admin";

  const { data: joueurs, isLoading } = useQuery({
    queryKey: ["admin-joueurs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_joueurs_complete")
        .select("*")
        .order("nom_affichage", { ascending: true });
      return (data ?? []) as Joueur[];
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase.rpc("update_user_role", {
        user_id: userId,
        new_role: newRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-joueurs"] });
      toast.success("Rôle mis à jour avec succès");
    },
    onError: (error: any) => {
      toast.error(`Erreur : ${error.message}`);
    },
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, newRole });
  };

  const filteredJoueurs = joueurs?.filter(
    (j) =>
      j.nom_affichage?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="font-cinzel text-3xl mb-6">Gestion des joueurs</h1>

      <div className="flex justify-between items-center mb-4">
        <p className="text-white/60">Total : {joueurs?.length ?? 0} joueurs</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <Input
          placeholder="Rechercher un joueur par nom ou email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-white/5 border-white/10"
        />
      </div>

      <div className="grid gap-4">
        {filteredJoueurs?.map((joueur) => (
          <Card key={joueur.joueur_id} className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-gold" />
                  <CardTitle className="text-white text-lg">
                    {joueur.nom_affichage || joueur.email || "Joueur inconnu"}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      joueur.role === "admin"
                        ? "bg-red-500"
                        : joueur.role === "animateur"
                        ? "bg-blue-500"
                        : "bg-green-500"
                    }
                  >
                    {joueur.role || "joueur"}
                  </Badge>
                  {/* Sélecteur de rôle */}
                  {(currentUserRole === "admin" ||
                    (currentUserRole === "animateur" && joueur.role !== "admin")) && (
                    <Select
                      value={joueur.role || "joueur"}
                      onValueChange={(newRole) =>
                        handleRoleChange(joueur.joueur_id, newRole)
                      }
                      disabled={updateRoleMutation.isPending}
                    >
                      <SelectTrigger className="w-[130px] bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-800 text-white">
                        <SelectItem value="joueur">Joueur</SelectItem>
                        <SelectItem value="animateur">Animateur</SelectItem>
                        {isAdmin && <SelectItem value="admin">Admin</SelectItem>}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {joueur.email || "Email non renseigné"}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>
                    {joueur.nb_personnages_actifs} actif
                    {joueur.nb_personnages_actifs > 1 ? "s" : ""}
                    {joueur.nb_personnages_morts > 0 &&
                      ` • ${joueur.nb_personnages_morts} mort(s)`}
                    {joueur.nb_personnages_archives > 0 &&
                      ` • ${joueur.nb_personnages_archives} archivé(s)`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/40">Principal :</span>
                  {joueur.personnage_actif_principal || "Aucun"}
                </div>
              </div>
              <div className="mt-4 text-xs text-white/40">
                Inscrit le {new Date(joueur.compte_cree_le).toLocaleDateString("fr-FR")}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredJoueurs?.length === 0 && (
        <p className="text-center text-white/60 py-8">Aucun joueur trouvé.</p>
      )}
    </div>
  );
};

export default AdminJoueurs;
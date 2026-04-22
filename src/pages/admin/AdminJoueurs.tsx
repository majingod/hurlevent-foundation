import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";

interface Joueur {
  id: string;
  nom_affichage: string;
  email: string;
  role: "joueur" | "animateur" | "admin";
  created_at: string;
  nb_personnages: number;
}

const AdminJoueurs = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const { data: joueurs, isLoading, refetch } = useQuery({
    queryKey: ["admin-joueurs"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_joueurs_avec_count");
      return (data ?? []) as Joueur[];
    },
  });

  const filteredJoueurs = joueurs?.filter(
    (j) =>
      j.nom_affichage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleChangeRole = async (joueurId: string, newRole: string) => {
    setUpdatingRole(joueurId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", joueurId);

      if (error) throw error;
      toast.success("Rôle mis à jour !");
      refetch();
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de la mise à jour du rôle.");
    } finally {
      setUpdatingRole(null);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout
        title="Gestion des joueurs"
        searchPlaceholder="Rechercher un joueur…"
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
      >
        <p className="text-center py-12 text-muted-foreground">Chargement…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Gestion des joueurs"
      searchPlaceholder="Rechercher un joueur…"
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Liste des joueurs ({filteredJoueurs?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nom</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Rôle</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Personnages</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Inscription</th>
                </tr>
              </thead>
              <tbody>
                {filteredJoueurs?.map((joueur) => (
                  <tr key={joueur.id} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium text-foreground">{joueur.nom_affichage}</td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">{joueur.email}</td>
                    <td className="py-3 px-4">
                      <Select
                        value={joueur.role}
                        onValueChange={(value) => handleChangeRole(joueur.id, value)}
                        disabled={updatingRole === joueur.id}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="joueur">Joueur</SelectItem>
                          <SelectItem value="animateur">Animateur</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{joueur.nb_personnages}</Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {new Date(joueur.created_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default AdminJoueurs;

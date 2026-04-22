import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { useState } from "react";

interface Personnage {
  id: string;
  nom: string;
  joueur_nom: string;
  race_nom: string;
  classe_nom: string;
  niveau: number;
  est_actif: boolean;
  etape_creation: number;
  created_at: string;
}

const AdminPersonnages = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: personnages, isLoading } = useQuery({
    queryKey: ["admin-personnages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_personnages_admin")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as Personnage[];
    },
  });

  const filteredPersonnages = personnages?.filter(
    (p) =>
      p.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.joueur_nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.race_nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.classe_nom.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <AdminLayout
        title="Gestion des personnages"
        searchPlaceholder="Rechercher un personnage…"
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
      >
        <p className="text-center py-12 text-muted-foreground">Chargement…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Gestion des personnages"
      searchPlaceholder="Rechercher un personnage…"
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Liste des personnages ({filteredPersonnages?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nom</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Joueur</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Race</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Classe</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Niveau</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Statut</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Étape</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPersonnages?.map((perso) => (
                  <tr key={perso.id} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium text-foreground">{perso.nom}</td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">{perso.joueur_nom}</td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">{perso.race_nom}</td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">{perso.classe_nom}</td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary">{perso.niveau}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      {perso.est_actif ? (
                        <Badge className="bg-green-500/20 text-green-700">Actif</Badge>
                      ) : (
                        <Badge variant="outline">Brouillon</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {perso.etape_creation}/10
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/personnage/${perso.id}`)}
                      >
                        Voir
                      </Button>
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

export default AdminPersonnages;

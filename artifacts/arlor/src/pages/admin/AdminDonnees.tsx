import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import AdminLayout from "@/components/admin/AdminLayout";
import { useState } from "react";

interface DataCount {
  table_name: string;
  count: number;
}

const AdminDonnees = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: counts, isLoading } = useQuery({
    queryKey: ["admin-data-counts"],
    queryFn: async () => {
      const tables = [
        "races",
        "classes",
        "traits_raciaux",
        "competences",
        "sorts",
        "prieres",
        "religions",
        "recettes_alchimie",
        "assemblages_runes",
        "pieges",
      ];

      const results: DataCount[] = [];
      for (const table of tables) {
        const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
        results.push({ table_name: table, count: count ?? 0 });
      }
      return results;
    },
  });

  if (isLoading) {
    return (
      <AdminLayout
        title="Gestion des donnÃ©es de jeu"
        searchPlaceholder="Rechercherâ€¦"
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
      >
        <p className="text-center py-12 text-muted-foreground">Chargementâ€¦</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Gestion des donnÃ©es de jeu"
      searchPlaceholder="Rechercherâ€¦"
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
    >
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="races">Races</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
        </TabsList>

        {/* Vue d'ensemble */}
        <TabsContent value="overview" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {counts?.map((item) => (
              <Card key={item.table_name} className="border-primary/10 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground capitalize">
                        {item.table_name.replace(/_/g, " ")}
                      </p>
                      <p className="text-2xl font-bold text-primary mt-1">{item.count}</p>
                    </div>
                    <Badge variant="secondary" className="text-lg">
                      {item.count}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Races */}
        <TabsContent value="races" className="space-y-4 mt-6">
          <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base font-heading">Races disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                GÃ©rez les races disponibles pour la crÃ©ation de personnages. Les races marquÃ©es comme "jouables" apparaÃ®tront dans le crÃ©ateur.
              </p>
              <Button className="mt-4">GÃ©rer les races</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Classes */}
        <TabsContent value="classes" className="space-y-4 mt-6">
          <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base font-heading">Classes disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                GÃ©rez les classes disponibles pour la crÃ©ation de personnages. Chaque classe dÃ©finit les compÃ©tences gratuites et les statistiques de base.
              </p>
              <Button className="mt-4">GÃ©rer les classes</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default AdminDonnees;

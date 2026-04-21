import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface DataCount {
  table_name: string;
  count: number;
}

const AdminDonnees = () => {
  const { data: counts, isLoading } = useQuery({
    queryKey: ["admin-data-counts"],
    queryFn: async () => {
      const tables = [
        "races",
        "classes",
        "traits",
        "competences",
        "sorts",
        "prieres",
        "religions",
        "recettes_alchimie",
        "assemblages_runes",
        "pièges",
      ];

      const results: DataCount[] = [];
      for (const table of tables) {
        const { count } = await supabase.from(table as any).select("*", { count: "exact", head: true });
        results.push({ table_name: table, count: count ?? 0 });
      }
      return results;
    },
  });

  if (isLoading) {
    return <p className="text-center py-12 text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-primary">Gestion des données de jeu</h1>
        <p className="text-muted-foreground mt-1">Référentiels et données de base du LARP Hurlevent</p>
      </div>

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
              <Card key={item.table_name}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground capitalize">{item.table_name.replace(/_/g, " ")}</p>
                      <p className="text-2xl font-bold text-primary mt-1">{item.count}</p>
                    </div>
                    <Badge variant="secondary" className="text-lg">{item.count}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Races */}
        <TabsContent value="races" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Races disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Gérez les races disponibles pour la création de personnages. Les races marquées comme "jouables" apparaîtront dans le créateur.
              </p>
              <Button className="mt-4">Gérer les races</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Classes */}
        <TabsContent value="classes" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Classes disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Gérez les classes disponibles pour la création de personnages. Chaque classe définit les compétences gratuites et les statistiques de base.
              </p>
              <Button className="mt-4">Gérer les classes</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDonnees;

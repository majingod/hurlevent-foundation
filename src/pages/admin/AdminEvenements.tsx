import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Calendar, MapPin, Users } from "lucide-react";

interface Evenement {
  id: string;
  titre: string;
  description: string | null;
  date_debut: string;
  date_fin: string | null;
  lieu: string | null;
  nb_participants: number;
  est_publie: boolean;
}

const AdminEvenements = () => {
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: evenements, isLoading, refetch } = useQuery({
    queryKey: ["admin-evenements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_evenements_admin")
        .select("*")
        .order("date_debut", { ascending: true });
      return (data ?? []) as Evenement[];
    },
  });

  const handleTogglePublish = async (id: string, currentStatus: boolean) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from("evenements")
        .update({ est_publie: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(!currentStatus ? "Événement publié !" : "Événement dépublié !");
      refetch();
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return <p className="text-center py-12 text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-primary">Gestion des événements</h1>
        <p className="text-muted-foreground mt-1">Total : {evenements?.length ?? 0} événements</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {evenements?.map((evt) => (
          <Card key={evt.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{evt.titre}</CardTitle>
                  {evt.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{evt.description}</p>
                  )}
                </div>
                <Badge className={evt.est_publie ? "bg-green-500/20 text-green-700" : "variant-outline"}>
                  {evt.est_publie ? "Publié" : "Brouillon"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {new Date(evt.date_debut).toLocaleDateString("fr-FR", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              {evt.lieu && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {evt.lieu}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {evt.nb_participants} participant{evt.nb_participants > 1 ? "s" : ""}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-4"
                onClick={() => handleTogglePublish(evt.id, evt.est_publie)}
                disabled={updatingId === evt.id}
              >
                {evt.est_publie ? "Dépublier" : "Publier"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!evenements || evenements.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucun événement créé.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminEvenements;

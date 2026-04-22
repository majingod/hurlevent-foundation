import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";

interface CompetenceMaitre {
  id: string;
  personnage_nom: string;
  joueur_nom: string;
  competence_nom: string;
  niveau_acquis: number;
  nom_maitre: string;
  statut_maitre: "en_attente" | "approuvee" | "rejetee";
  date_demande: string;
}

const AdminCompetencesMaitre = () => {
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: competences, isLoading, refetch } = useQuery({
    queryKey: ["admin-competences-maitre"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_competences_maitre_admin")
        .select("*")
        .order("date_demande", { ascending: false });
      return (data ?? []) as CompetenceMaitre[];
    },
  });

  const filteredCompetences = competences?.filter(
    (c) =>
      c.competence_nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.personnage_nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.joueur_nom.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const enAttente = filteredCompetences?.filter((c) => c.statut_maitre === "en_attente") ?? [];
  const approuvees = filteredCompetences?.filter((c) => c.statut_maitre === "approuvee") ?? [];
  const rejetees = filteredCompetences?.filter((c) => c.statut_maitre === "rejetee") ?? [];

  const handleApprove = async (id: string) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from("personnage_competences")
        .update({ statut_maitre: "approuvee" })
        .eq("id", id);

      if (error) throw error;
      toast.success("Compétence approuvée !");
      refetch();
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'approbation.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from("personnage_competences")
        .update({ statut_maitre: "rejetee" })
        .eq("id", id);

      if (error) throw error;
      toast.success("Compétence rejetée !");
      refetch();
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors du rejet.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout
        title="Approbations maître"
        searchPlaceholder="Rechercher une compétence…"
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
      >
        <p className="text-center py-12 text-muted-foreground">Chargement…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Approbations maître"
      searchPlaceholder="Rechercher une compétence…"
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
    >
      <div className="space-y-6">
        {/* En attente */}
        {enAttente.length > 0 && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardHeader>
              <CardTitle className="text-base text-yellow-700">
                En attente d'approbation ({enAttente.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {enAttente.map((comp) => (
                <div key={comp.id} className="p-3 rounded border border-border/50 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{comp.competence_nom}</p>
                    <p className="text-xs text-muted-foreground">
                      {comp.personnage_nom} ({comp.joueur_nom}) • Niveau {comp.niveau_acquis} • Maître: {comp.nom_maitre}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 hover:text-green-700"
                      onClick={() => handleApprove(comp.id)}
                      disabled={updatingId === comp.id}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approuver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleReject(comp.id)}
                      disabled={updatingId === comp.id}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Rejeter
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Approuvées */}
        {approuvees.length > 0 && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader>
              <CardTitle className="text-base text-green-700">Approuvées ({approuvees.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {approuvees.map((comp) => (
                <div key={comp.id} className="p-2 rounded border border-border/50 text-sm">
                  <p className="font-medium text-foreground">{comp.competence_nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {comp.personnage_nom} • {new Date(comp.date_demande).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Rejetées */}
        {rejetees.length > 0 && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardHeader>
              <CardTitle className="text-base text-red-700">Rejetées ({rejetees.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rejetees.map((comp) => (
                <div key={comp.id} className="p-2 rounded border border-border/50 text-sm">
                  <p className="font-medium text-foreground">{comp.competence_nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {comp.personnage_nom} • {new Date(comp.date_demande).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {enAttente.length === 0 && approuvees.length === 0 && rejetees.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Aucune compétence maître.
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminCompetencesMaitre;

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Crown, ClipboardList, ArrowRight } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";

interface CompetenceMaitre {
  id: string;
  personnage_nom: string;
  joueur_nom: string;
  competence_nom: string;
  niveau_acquis: number;
  nom_maitre: string;
  statut_maitre: "non_requis" | "en_attente" | "approuve" | "refuse";
  date_demande: string;
}

const AdminApprobations = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const segment = searchParams.get("seg") ?? "competences";
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: competences, isLoading: loadingComp, refetch: refetchComp } = useQuery({
    queryKey: ["admin-competences-maitre"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_competences_maitre_admin")
        .select("*")
        .order("date_demande", { ascending: false });
      return (data ?? []) as CompetenceMaitre[];
    },
  });
  const compEnAttente = competences?.filter((c) => c.statut_maitre === "en_attente") ?? [];

  const { data: nbRaces } = useQuery({
    queryKey: ["admin-races-attente-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("personnage_races_demandes")
        .select("*", { count: "exact", head: true })
        .eq("statut", "en_attente");
      return count ?? 0;
    },
  });

  const { data: nbPresences } = useQuery({
    queryKey: ["admin-presences-attente-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("inscriptions_evenements")
        .select("*", { count: "exact", head: true })
        .eq("statut", "en_attente");
      return count ?? 0;
    },
  });

  const updateStatut = async (id: string, statut: "approuve" | "refuse") => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from("personnage_competences")
        .update({ statut_maitre: statut })
        .eq("id", id);
      if (error) throw error;
      toast.success(statut === "approuve" ? "Compétence approuvée !" : "Compétence refusée.");
      refetchComp();
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AdminLayout title="File d'approbations" showSearch={false}>
      <Tabs value={segment} onValueChange={(v) => setSearchParams({ seg: v })}>
        <TabsList className="mb-6">
          <TabsTrigger value="races">⚜ Races{nbRaces ? ` (${nbRaces})` : ""}</TabsTrigger>
          <TabsTrigger value="competences">⭐ Compétences-maître{compEnAttente.length ? ` (${compEnAttente.length})` : ""}</TabsTrigger>
          <TabsTrigger value="presences">📋 Présences{nbPresences ? ` (${nbPresences})` : ""}</TabsTrigger>
        </TabsList>

        {/* RACES — lecture seule (actions au Lot 1) */}
        <TabsContent value="races">
          <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" /> Demandes de race spéciale
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-bold text-primary">{nbRaces ?? 0}</p>
              <p className="text-sm text-muted-foreground">
                demande(s) en attente (Chiméride / Les Non-Races).
              </p>
              <p className="text-xs text-muted-foreground italic">
                L'approbation / le refus depuis cet écran seront activés au prochain lot (backend en préparation).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMPÉTENCES-MAÎTRE — fonctionnel (enum corrigé) */}
        <TabsContent value="competences">
          {loadingComp ? (
            <p className="text-center py-12 text-muted-foreground">Chargement…</p>
          ) : compEnAttente.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aucune compétence-maître en attente.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {compEnAttente.map((comp) => (
                <Card key={comp.id} className="border-primary/10 bg-card/50 backdrop-blur-sm">
                  <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <p className="font-medium text-foreground">{comp.competence_nom}</p>
                      <p className="text-xs text-muted-foreground">
                        {comp.personnage_nom} ({comp.joueur_nom}) • Niveau {comp.niveau_acquis} • Maître : {comp.nom_maitre}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 hover:text-green-700"
                        onClick={() => updateStatut(comp.id, "approuve")}
                        disabled={updatingId === comp.id}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" /> Approuver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => updateStatut(comp.id, "refuse")}
                        disabled={updatingId === comp.id}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Refuser
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* PRÉSENCES — compteur + lien (choix P1) */}
        <TabsContent value="presences">
          <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" /> Présences à confirmer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-bold text-primary">{nbPresences ?? 0}</p>
              <p className="text-sm text-muted-foreground">
                inscription(s) en attente. La confirmation des présences et la distribution d'XP se font par événement (clôture).
              </p>
              <Button variant="outline" onClick={() => navigate("/administration/evenements")}>
                Aller aux événements <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default AdminApprobations;

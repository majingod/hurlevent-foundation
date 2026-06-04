import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

interface DemandeRace {
  id: string;
  personnage_id: string;
  personnage_nom: string;
  personnage_niveau: number;
  joueur_id: string;
  joueur_nom: string;
  joueur_email: string;
  race_id: string;
  race_nom: string;
  race_nom_latin: string | null;
  background: string | null;
  date_demande: string;
}

const AdminApprobations = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const segment = searchParams.get("seg") ?? "competences";
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [refuseTarget, setRefuseTarget] = useState<DemandeRace | null>(null);
  const [refuseReason, setRefuseReason] = useState("");

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

  const { data: races, isLoading: loadingRaces, refetch: refetchRaces } = useQuery({
    queryKey: ["admin-races-attente"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_demandes_races_attente")
        .select("*")
        .order("date_demande", { ascending: true });
      return (data ?? []) as DemandeRace[];
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

  const approuverRace = async (id: string) => {
    setUpdatingId(id);
    try {
      const { data, error } = await supabase.rpc("approuver_race_demande", {
        p_demande_id: id,
      });
      if (error) throw error;
      const res = data as unknown as { succes?: boolean; erreur?: string } | null;
      if (res && res.succes === false) throw new Error(res.erreur ?? "Échec de l'approbation.");
      toast.success("Race approuvée !");
      refetchRaces();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'approbation.");
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmerRefus = async () => {
    if (!refuseTarget || refuseReason.trim().length < 10) return;
    const id = refuseTarget.id;
    setUpdatingId(id);
    try {
      const { data, error } = await supabase.rpc("refuser_race_demande", {
        p_demande_id: id,
        p_raison: refuseReason.trim(),
      });
      if (error) throw error;
      const res = data as unknown as { succes?: boolean; erreur?: string } | null;
      if (res && res.succes === false) throw new Error(res.erreur ?? "Échec du refus.");
      toast.success("Race refusée.");
      setRefuseTarget(null);
      setRefuseReason("");
      refetchRaces();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erreur lors du refus.");
    } finally {
      setUpdatingId(null);
    }
  };

  const nbRaces = races?.length ?? 0;

  return (
    <AdminLayout title="File d'approbations" showSearch={false}>
      <Tabs value={segment} onValueChange={(v) => setSearchParams({ seg: v })}>
        <TabsList className="mb-6">
          <TabsTrigger value="races">⚜ Races{nbRaces ? ` (${nbRaces})` : ""}</TabsTrigger>
          <TabsTrigger value="competences">⭐ Compétences-maître{compEnAttente.length ? ` (${compEnAttente.length})` : ""}</TabsTrigger>
          <TabsTrigger value="presences">📋 Présences{nbPresences ? ` (${nbPresences})` : ""}</TabsTrigger>
        </TabsList>

        {/* RACES — fonctionnel (Lot 1, s112) */}
        <TabsContent value="races">
          {loadingRaces ? (
            <p className="text-center py-12 text-muted-foreground">Chargement…</p>
          ) : nbRaces === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aucune demande de race en attente.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {(races ?? []).map((d) => (
                <Card key={d.id} className="border-primary/10 bg-card/50 backdrop-blur-sm">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-[180px]">
                        <p className="font-medium text-foreground flex items-center gap-2">
                          <Crown className="h-4 w-4 text-primary" />
                          {d.race_nom}
                          {d.race_nom_latin ? (
                            <span className="text-xs italic text-muted-foreground">· {d.race_nom_latin}</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {d.personnage_nom} (Nv {d.personnage_niveau}) • {d.joueur_nom}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => approuverRace(d.id)}
                          disabled={updatingId === d.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => {
                            setRefuseReason("");
                            setRefuseTarget(d);
                          }}
                          disabled={updatingId === d.id}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Refuser
                        </Button>
                      </div>
                    </div>
                    {d.background ? (
                      <p className="text-sm text-foreground bg-background/60 border border-border rounded-md p-3 whitespace-pre-wrap">
                        {d.background}
                      </p>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">(Aucun historique fourni)</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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

      {/* Modal de refus de race (Option B) */}
      <Dialog
        open={!!refuseTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRefuseTarget(null);
            setRefuseReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser « {refuseTarget?.race_nom} »</DialogTitle>
            <DialogDescription>
              Personnage {refuseTarget?.personnage_nom} · {refuseTarget?.joueur_nom}. La raison sera communiquée au joueur.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={refuseReason}
            onChange={(e) => setRefuseReason(e.target.value)}
            rows={3}
            placeholder="Raison du refus (≥ 10 caractères)…"
          />
          <p className={refuseReason.trim().length >= 10 ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
            {refuseReason.trim().length}/10 caractères minimum
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRefuseTarget(null);
                setRefuseReason("");
              }}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmerRefus}
              disabled={refuseReason.trim().length < 10 || updatingId === refuseTarget?.id}
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminApprobations;

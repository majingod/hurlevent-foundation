import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, User, Edit2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfil } from "@/contexts/ProfilContext";
import BoutonRemodeler from "@/components/personnage/BoutonRemodeler";
import { toast } from "@/hooks/use-toast";

interface PersonnageResume {
  id: string;
  joueur_id: string;
  nom: string | null;
  niveau: number;
  xp_total: number;
  xp_depense: number;
  etape_creation: number;
  created_at: string;
  race_nom: string;
  classe_nom: string;
  est_finalise: boolean;
}


const TableauDeBord = () => {
  const { user } = useAuth();
  const { joueurId } = useProfil();
  const queryClient = useQueryClient();
  const [personnageASupprimer, setPersonnageASupprimer] = useState<PersonnageResume | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  // DATA-FIRST : vue_personnages_joueur retourne directement race_nom / classe_nom
  // Remplace la requête sur la table brute personnages qui affichait des UUIDs
  const {
    data: personnages = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["mes-personnages", joueurId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vue_personnages_joueur")
        .select("*")
        .eq("joueur_id", joueurId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PersonnageResume[];
    },
    enabled: !!joueurId,
  });

  const supprimerPersonnage = async () => {
    if (!personnageASupprimer) return;

    try {
      setSuppressionEnCours(true);
      const { data: deleted, error: deleteError } = await supabase
        .from("personnages")
        .delete()
        .eq("id", personnageASupprimer.id)
        .select("id");

      // FK inscriptions_evenements (NO ACTION) : un perso inscrit a un evenement
      // ne peut pas etre supprime tant qu'il est inscrit.
      if (deleteError) {
        if (deleteError.code === "23503") {
          throw new Error(
            "Ce personnage est inscrit à un événement. Désinscris-toi d'abord, puis réessaie."
          );
        }
        throw deleteError;
      }

      // Garde-fou : si 0 ligne supprimee, ne jamais afficher un faux succes.
      if (!deleted || deleted.length === 0) {
        throw new Error(
          "La suppression n'a pas pu être effectuée. Réessaie, ou contacte un animateur si le problème persiste."
        );
      }

      queryClient.setQueryData<PersonnageResume[]>(
        ["mes-personnages", user?.id],
        (prev) => (prev ?? []).filter((p) => p.id !== personnageASupprimer.id)
      );
      toast({
        title: "Personnage supprimé",
        description: `Le personnage «${personnageASupprimer.nom}» a été supprimé.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erreur lors de la suppression",
        description: err.message,
      });
    } finally {
      setSuppressionEnCours(false);
      setPersonnageASupprimer(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading text-gold">Tableau de bord</h1>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
        <Link to="/personnage/nouveau">
          <Button className="bg-gold hover:bg-gold/80 text-black font-bold">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau personnage
          </Button>
        </Link>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-6">
            <p className="text-destructive">{(error as Error).message}</p>
          </CardContent>
        </Card>
      )}

      {personnages.length === 0 ? (
        <Card className="border-white/10 bg-white/5 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <User className="mb-4 h-12 w-12 text-white/20" />
            <h3 className="text-xl font-heading text-white/80">Aucun personnage actif</h3>
            <p className="mb-6 text-muted-foreground">
              Vous n'avez pas encore créé de personnage. Commencez votre aventure maintenant !
            </p>
            <Link to="/personnage/nouveau">
              <Button variant="outline">Créer mon premier personnage</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {personnages.map((p) => (
            <Card key={p.id} className="group overflow-hidden border-white/10 bg-white/5 transition-all hover:border-gold/30">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-heading text-gold">{p.nom}</CardTitle>
                    {p.est_finalise ? (
                      <Badge className="border border-green-600/30 bg-green-600/20 text-green-400">
                        Finalisé
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-600/40 bg-amber-600/10 text-amber-400">
                        Brouillon
                      </Badge>
                    )}
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold group-hover:scale-110 transition-transform">
                    <User size={20} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><span className="text-white/60">Race :</span> {p.race_nom}</p>
                  <p><span className="text-white/60">Classe :</span> {p.classe_nom}</p>
                  <p><span className="text-white/60">Niveau :</span> {p.niveau}</p>
                  <p><span className="text-white/60">XP dépensés :</span> {p.xp_depense} / {p.xp_total}</p>
                </div>

                <div className="mt-6 flex flex-col gap-2">
                  {p.est_finalise && (
                    <Link to={`/personnage/${p.id}`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full border-white/20 hover:bg-white/5">
                        <User className="mr-2 h-4 w-4" />
                        Voir la fiche
                      </Button>
                    </Link>
                  )}

                  {p.est_finalise && (
                    <BoutonRemodeler personnageId={p.id} compact />
                  )}

                  {!p.est_finalise && (
                    <Link
                      to={`/personnage/nouveau?id=${p.id}&etape=${(p.etape_creation ?? 0) >= 11 ? 11 : Math.max(1, (p.etape_creation ?? 0) + 1)}`}
                      className="w-full"
                    >
                      <Button variant="secondary" size="sm" className="w-full bg-gold/10 text-gold hover:bg-gold/20 border-gold/20">
                        <Edit2 className="mr-2 h-4 w-4" />
                        Continuer la création
                      </Button>
                    </Link>
                  )}

                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full opacity-40 hover:opacity-100 transition-opacity mt-2"
                    onClick={() => setPersonnageASupprimer(p)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!personnageASupprimer} onOpenChange={(open) => { if (!open) setPersonnageASupprimer(null); }}>
        <DialogContent className="border-white/10 bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-gold font-heading">Supprimer le personnage</DialogTitle>
            <DialogDescription className="text-white/70">
              Êtes-vous sûr de vouloir supprimer le personnage «{personnageASupprimer?.nom}» ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPersonnageASupprimer(null)} disabled={suppressionEnCours}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={supprimerPersonnage} disabled={suppressionEnCours}>
              {suppressionEnCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TableauDeBord;

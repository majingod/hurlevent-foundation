import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { toast } from "@/hooks/use-toast";

const TableauDeBord = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personnages, setPersonnages] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [personnageASupprimer, setPersonnageASupprimer] = useState<any | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUser = sessionData.session?.user;
        setUserEmail(sessionUser?.email || null);

        if (!sessionUser) {
          setError("Vous devez être connecté pour accéder au tableau de bord.");
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("personnages")
          .select("*")
          .eq("joueur_id", sessionUser.id)
          .eq("est_actif", true)
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;
        setPersonnages(data || []);
      } catch (err: any) {
        console.error("Erreur lors du chargement :", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const supprimerPersonnage = async () => {
    if (!personnageASupprimer) return;

    try {
      setSuppressionEnCours(true);
      const { error: deleteError } = await supabase
        .from("personnages")
        .update({ est_actif: false })
        .eq("id", personnageASupprimer.id);

      if (deleteError) throw deleteError;

      setPersonnages(personnages.filter((p) => p.id !== personnageASupprimer.id));
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

  if (loading) {
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
          <p className="text-muted-foreground">{userEmail}</p>
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
            <p className="text-destructive">{error}</p>
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
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-heading text-gold">{p.nom}</CardTitle>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/10 text-gold group-hover:scale-110 transition-transform">
                    <User size={20} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><span className="text-white/60">Race:</span> {p.race_id || "Non définie"}</p>
                  <p><span className="text-white/60">Classe:</span> {p.classe_id || "Non définie"}</p>
                </div>
                
                <div className="mt-6 flex flex-col gap-2">
                  <Link to={`/personnage/${p.id}`} className="w-full">
                    <Button variant="outline" size="sm" className="w-full border-white/20 hover:bg-white/5">
                      <User className="mr-2 h-4 w-4" />
                      Voir la fiche
                    </Button>
                  </Link>
                  
                  <Link to={`/personnage/nouveau?id=${p.id}`} className="w-full">
                    <Button variant="secondary" size="sm" className="w-full bg-gold/10 text-gold hover:bg-gold/20 border-gold/20">
                      <Edit2 className="mr-2 h-4 w-4" />
                      {p.etape_creation < 11 ? "Continuer la création" : "Modifier le personnage"}
                    </Button>
                  </Link>

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

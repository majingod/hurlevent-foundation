import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Mapping des rôles pour l'affichage
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  animateur: "Animateur",
  joueur: "Joueur",
};

interface JoueurComplet {
  id: string;
  email: string;
  username: string | null;
  nom_affichage: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  nb_personnages_actifs: number;
  nb_personnages_morts: number;
  nb_personnages_archives: number;
}

export const AdminJoueurs = () => {
  const [joueurs, setJoueurs] = useState<JoueurComplet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchJoueurs();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data } = await supabase.auth.getSession();
    setCurrentUserId(data.session?.user?.id || null);
  };

  const fetchJoueurs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("vue_joueurs_complete")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJoueurs(data as JoueurComplet[]);
    } catch (err: any) {
      console.error("Erreur chargement joueurs:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { data, error } = await supabase.rpc("changer_role_utilisateur", {
        p_user_id: userId,
        p_nouveau_role: newRole,
      });

      if (error) throw error;

      // Mise à jour locale
      setJoueurs(prev =>
        prev.map(j => (j.id === userId ? { ...j, role: newRole } : j))
      );

      // Afficher un message de succès (optionnel)
      alert(data?.message || "Rôle mis à jour");
    } catch (err: any) {
      console.error("Erreur changement rôle:", err);
      alert(`Erreur : ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
        Erreur : {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-cinzel text-3xl">Gestion des joueurs</h1>
        <Badge variant="outline" className="text-white/70 border-white/20">
          {joueurs.length} joueur(s)
        </Badge>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/70">Nom</TableHead>
                <TableHead className="text-white/70">Email</TableHead>
                <TableHead className="text-white/70">Rôle</TableHead>
                <TableHead className="text-white/70">Personnages</TableHead>
                <TableHead className="text-white/70">Inscription</TableHead>
                <TableHead className="text-white/70">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {joueurs.map((joueur) => (
                <TableRow key={joueur.id} className="border-white/5">
                  <TableCell className="font-medium text-white">
                    {joueur.nom_affichage || joueur.username || joueur.email}
                  </TableCell>
                  <TableCell className="text-white/70">{joueur.email}</TableCell>
                  <TableCell>
                    <Select
                      value={joueur.role}
                      onValueChange={(value) => handleRoleChange(joueur.id, value)}
                      disabled={joueur.id === currentUserId} // Empêcher de changer son propre rôle
                    >
                      <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-white/10">
                        <SelectItem value="joueur">Joueur</SelectItem>
                        <SelectItem value="animateur">Animateur</SelectItem>
                        <SelectItem value="admin">Administrateur</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-white/70">
                    {joueur.nb_personnages_actifs} actif(s)
                    {joueur.nb_personnages_morts > 0 && ` / ${joueur.nb_personnages_morts} mort(s)`}
                  </TableCell>
                  <TableCell className="text-white/50 text-sm">
                    {joueur.created_at && format(new Date(joueur.created_at), "dd/MM/yyyy", { locale: fr })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        joueur.is_active
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                      }
                    >
                      {joueur.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminJoueurs;

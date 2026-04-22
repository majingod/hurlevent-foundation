import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, Mail, User, Users } from "lucide-react";

interface Joueur {
  joueur_id: string;
  username: string | null;
  email: string | null;
  nom_affichage: string | null;
  role: string | null;
  is_active: boolean;
  compte_cree_le: string;
  nb_personnages_actifs: number;
  nb_personnages_morts: number;
  nb_personnages_archives: number;
  nb_personnages_total: number;
  personnage_actif_principal: string | null;
}

const AdminJoueurs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: joueurs, isLoading } = useQuery({
    queryKey: ["admin-joueurs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_joueurs_complete")
        .select("*")
        .order("nom_affichage", { ascending: true });
      return (data ?? []) as Joueur[];
    },
  });

  const filteredJoueurs = joueurs?.filter(
    (j) =>
      j.nom_affichage?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <div className="p-8 text-center">Chargement…</div>;
  }

  return (
    <div className="container py-8">
      <h1 className="font-cinzel text-3xl mb-6">Gestion des joueurs</h1>
      
      <div className="flex justify-between items-center mb-4">
        <p className="text-white/60">
          Total : {joueurs?.length ?? 0} joueurs
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <Input
          placeholder="Rechercher un joueur par nom ou email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-white/5 border-white/10"
        />
      </div>

      <div className="grid gap-4">
        {filteredJoueurs?.map((joueur) => (
          <Card key={joueur.joueur_id} className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-gold" />
                  <CardTitle className="text-white text-lg">
                    {joueur.nom_affichage || joueur.email || "Joueur inconnu"}
                  </CardTitle>
                </div>
                <Badge className={joueur.role === 'admin' ? 'bg-red-500' : joueur.role === 'animateur' ? 'bg-blue-500' : 'bg-green-500'}>
                  {joueur.role || 'joueur'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {joueur.email || "Email non renseigné"}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>
                    {joueur.nb_personnages_actifs} actif{joueur.nb_personnages_actifs > 1 ? 's' : ''} 
                    {joueur.nb_personnages_morts > 0 && ` • ${joueur.nb_personnages_morts} mort(s)`}
                    {joueur.nb_personnages_archives > 0 && ` • ${joueur.nb_personnages_archives} archivé(s)`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/40">Principal :</span>
                  {joueur.personnage_actif_principal || "Aucun"}
                </div>
              </div>
              <div className="mt-4 text-xs text-white/40">
                Inscrit le {new Date(joueur.compte_cree_le).toLocaleDateString('fr-FR')}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {filteredJoueurs?.length === 0 && (
        <p className="text-center text-white/60 py-8">Aucun joueur trouvé.</p>
      )}
    </div>
  );
};

export default AdminJoueurs;
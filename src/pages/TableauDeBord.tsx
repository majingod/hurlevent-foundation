import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, User } from "lucide-react";
import { Link } from "react-router-dom";

const TableauDeBord = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personnages, setPersonnages] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        setUserEmail(user?.email || null);

        if (!user) {
          setError("Vous devez être connecté.");
          return;
        }

        // 🟢 Appel à la vue Supabase – plus aucune jointure à écrire côté React
        const { data: personnagesData, error: persoError } = await supabase
          .from("vue_tableau_de_bord")
          .select("*")
          .eq("joueur_id", user.id)
          .order("date_creation", { ascending: false });

        if (persoError) throw persoError;
        setPersonnages(personnagesData || []);
      } catch (err: any) {
        console.error("Erreur tableau de bord:", err);
        setError(err.message || "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="container py-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          <h2 className="text-xl font-bold mb-2">Erreur de chargement</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="font-cinzel text-3xl mb-4 md:mb-0">Tableau de bord</h1>
        <p className="text-white/60">{userEmail}</p>
      </div>

      <div className="mb-8">
        <Link to="/personnage/nouveau">
          <Button className="bg-gold text-black hover:bg-gold/80">
            <Plus className="mr-2 h-4 w-4" />
            Créer un nouveau personnage
          </Button>
        </Link>
      </div>

      <h2 className="font-cinzel text-2xl mb-4">Mes personnages</h2>
      {personnages.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="py-8 text-center text-white/60">
            Vous n'avez pas encore créé de personnage.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {personnages.map((p) => (
            <Card key={p.id} className="bg-white/5 border-white/10 hover:bg-white/10 transition">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center justify-between">
                  <span>{p.nom}</span>
                  {!p.est_actif && <span className="text-xs bg-white/10 px-2 py-1 rounded">Archivé</span>}
                  {p.est_mort && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">Mort</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm text-white/70">
                  <p>Race : {p.race_nom || "Inconnue"}</p>
                  <p>Classe : {p.classe_nom || "Inconnue"}</p>
                  <p>Niveau {p.niveau} — XP : {p.xp_total} total / {p.xp_depense} dépensé</p>
                </div>
                <div className="mt-4">
                  <Link to={`/personnage/${p.id}`}>
                    <Button variant="outline" size="sm" className="w-full border-white/20 text-white/80">
                      <User className="mr-2 h-4 w-4" />
                      Voir la fiche
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TableauDeBord;
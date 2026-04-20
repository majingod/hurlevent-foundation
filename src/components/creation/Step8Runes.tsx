import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Gem } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  QUOTA_ASSEMBLAGES_TOTAL,
  COUT_ASSEMBLAGE_SUPPLEMENTAIRE,
} from "@/constants/artisanat";

interface Assemblage {
  id: string;
  nom: string;
  description_longue: string | null;
  effet: string | null;
  cible: string | null;
  runes_requises: string[] | null;
  cout_ps: number | null;
}

interface Step8Props {
  personnageId: string;
  niveauRunes: number;
  quotaAssemblages: number;
  xpDisponible: number;
  xpDepense: number;
  onXpSpent: (amount: number) => void;
}

const Step8Runes = ({
  personnageId,
  niveauRunes,
  quotaAssemblages,
  xpDisponible,
  xpDepense,
  onXpSpent,
}: Step8Props) => {
  const { toast } = useToast();
  const [assemblages, setAssemblages] = useState<Assemblage[]>([]);
  const [loading, setLoading] = useState(true);

  const [assemblagesGratuits, setAssemblagesGratuits] = useState<Set<string>>(new Set());
  const [assemblagesAchetes, setAssemblagesAchetes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Récupérer les assemblages de runes
        const { data: assemblagesData, error: assemblagesError } = await supabase
          .from("assemblages_runes")
          .select("*")
          .eq("est_actif", true)
          .order("nom");

        if (assemblagesError) throw assemblagesError;
        setAssemblages((assemblagesData ?? []) as Assemblage[]);

        setLoading(false);
      } catch (err: any) {
        console.error(err);
        toast.error("Erreur lors du chargement des assemblages de runes.");
        setLoading(false);
      }
    };

    fetchData();
  }, [personnageId, toast]);

  if (loading) {
    return <p className="text-muted-foreground text-center py-8">Chargement…</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold text-foreground">
        Étape 8 — Assemblages de runes
      </h2>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Niveau d'Assemblage de Runes : <strong className="text-primary">{niveauRunes}</strong>
        </p>
        <p className="text-sm text-muted-foreground">
          Quota gratuit : <strong className="text-primary">{assemblagesGratuits.size} / {quotaAssemblages}</strong> assemblages sélectionnés
        </p>
      </div>

      {/* Section Assemblages gratuits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gem className="h-4 w-4" />
            Choisissez vos assemblages gratuits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {assemblages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun assemblage disponible.</p>
          ) : (
            assemblages.map((assemblage) => (
              <div key={assemblage.id} className="flex items-start gap-3 p-3 rounded border border-border/50">
                <Checkbox
                  id={`assemblage-gratuit-${assemblage.id}`}
                  checked={assemblagesGratuits.has(assemblage.id)}
                  disabled={!assemblagesGratuits.has(assemblage.id) && assemblagesGratuits.size >= quotaAssemblages}
                  onCheckedChange={(checked) => {
                    const newSet = new Set(assemblagesGratuits);
                    if (checked) newSet.add(assemblage.id);
                    else newSet.delete(assemblage.id);
                    setAssemblagesGratuits(newSet);
                  }}
                />
                <label htmlFor={`assemblage-gratuit-${assemblage.id}`} className="flex-1 cursor-pointer text-sm">
                  <div className="font-medium text-foreground">{assemblage.nom}</div>
                  <div className="text-xs text-muted-foreground space-y-1 mt-1">
                    {assemblage.description_longue && <p>{assemblage.description_longue}</p>}
                    {assemblage.effet && <p><span className="font-medium text-foreground">Effet :</span> {assemblage.effet}</p>}
                    {assemblage.cible && <p><span className="font-medium text-foreground">Cible :</span> {assemblage.cible}</p>}
                    {assemblage.runes_requises && <p><span className="font-medium text-foreground">Runes requises :</span> {assemblage.runes_requises}</p>}
                    {assemblage.cout_ps != null && <p><span className="font-medium text-foreground">Coût PS :</span> {assemblage.cout_ps}</p>}
                  </div>
                </label>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Section Assemblages supplémentaires */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assemblages supplémentaires ({COUT_ASSEMBLAGE_SUPPLEMENTAIRE} XP chacun)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {assemblages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun assemblage disponible.</p>
          ) : (
            assemblages.map((assemblage) => {
              const isAchetee = assemblagesAchetes.has(assemblage.id);
              const isGratuit = assemblagesGratuits.has(assemblage.id);

              return (
                <div
                  key={assemblage.id}
                  className="flex items-center justify-between p-3 rounded border border-border/50"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm text-foreground">{assemblage.nom}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {assemblage.description_longue && <p>{assemblage.description_longue}</p>}
                      {assemblage.effet && <p><span className="font-medium text-foreground">Effet :</span> {assemblage.effet}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {isGratuit && (
                      <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-xs">Gratuit</Badge>
                    )}
                    {isAchetee ? (
                      <>
                        <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-xs">Acquis</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => {
                            setAssemblagesAchetes((prev) => {
                              const newSet = new Set(prev);
                              newSet.delete(assemblage.id);
                              return newSet;
                            });
                            onXpSpent(-COUT_ASSEMBLAGE_SUPPLEMENTAIRE);
                          }}
                        >
                          Retirer
                        </Button>
                      </>
                    ) : !isGratuit ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        disabled={xpDisponible < COUT_ASSEMBLAGE_SUPPLEMENTAIRE}
                        onClick={() => {
                          setAssemblagesAchetes((prev) => new Set(prev).add(assemblage.id));
                          onXpSpent(COUT_ASSEMBLAGE_SUPPLEMENTAIRE);
                        }}
                      >
                        Acheter ({COUT_ASSEMBLAGE_SUPPLEMENTAIRE} XP)
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Step8Runes;

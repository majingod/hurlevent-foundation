import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gem } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { COUT_ASSEMBLAGE_SUPPLEMENTAIRE } from "@/constants/artisanat";

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
  xpDisponible: number;
  xpDepense: number;
  onXpSpent: (amount: number) => void;
}

const Step8Runes = ({
  personnageId,
  xpDisponible,
  xpDepense,
  onXpSpent,
}: Step8Props) => {
  const { toast } = useToast();
  const [assemblages, setAssemblages] = useState<Assemblage[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotaTotal, setQuotaTotal] = useState(0);
  const [quotaUtilises, setQuotaUtilises] = useState(0);
  const [niveauRunes, setNiveauRunes] = useState(0);
  const [xpDisponibleLocal, setXpDisponibleLocal] = useState(xpDisponible);
  const [assemblagesGratuits, setAssemblagesGratuits] = useState<string[]>([]);
  const [assemblagesAchetes, setAssemblagesAchetes] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [assemblagesRes, quotasRes, existingRes] = await Promise.all([
          supabase
            .from("assemblages_runes")
            .select("*")
            .eq("est_actif", true)
            .order("nom"),
          supabase
            .from("vue_artisanat_quotas")
            .select("quota_assemblages_total, quota_assemblages_utilises, niveau_runes")
            .eq("personnage_id", personnageId)
            .maybeSingle(),
          supabase
            .from("personnage_assemblages")
            .select("assemblage_id, est_gratuit")
            .eq("personnage_id", personnageId),
        ]);

        if (assemblagesRes.error) throw assemblagesRes.error;
        setAssemblages((assemblagesRes.data ?? []) as Assemblage[]);

        if (quotasRes.data) {
          setQuotaTotal((quotasRes.data as any).quota_assemblages_total ?? 0);
          setQuotaUtilises((quotasRes.data as any).quota_assemblages_utilises ?? 0);
          setNiveauRunes((quotasRes.data as any).niveau_runes ?? 0);
        }

        if (existingRes.data) {
          setAssemblagesGratuits(
            existingRes.data.filter((a) => a.est_gratuit).map((a) => a.assemblage_id)
          );
          setAssemblagesAchetes(
            existingRes.data.filter((a) => !a.est_gratuit).map((a) => a.assemblage_id)
          );
        }

        setLoading(false);
      } catch (err: any) {
        console.error(err);
        toast.error("Erreur lors du chargement des assemblages de runes.");
        setLoading(false);
      }
    };

    fetchData();
  }, [personnageId, toast]);

  const handleGratuit = async (assemblageId: string) => {
    if (assemblagesAchetes.includes(assemblageId)) return;

    const dejaGratuit = assemblagesGratuits.includes(assemblageId);
    if (dejaGratuit) {
      const { error } = await supabase
        .from("personnage_assemblages")
        .delete()
        .eq("personnage_id", personnageId)
        .eq("assemblage_id", assemblageId);
      if (error) { toast.error("Erreur lors de la suppression."); return; }
      setAssemblagesGratuits((prev) => prev.filter((id) => id !== assemblageId));
      setQuotaUtilises((prev) => Math.max(0, prev - 1));
    } else if (assemblagesGratuits.length < quotaTotal) {
      const { error } = await supabase.from("personnage_assemblages").insert({
        personnage_id: personnageId,
        assemblage_id: assemblageId,
        est_gratuit: true,
        xp_depense: 0,
      });
      if (error) { toast.error("Erreur lors de la sélection."); return; }
      setAssemblagesGratuits((prev) => [...prev, assemblageId]);
      setQuotaUtilises((prev) => prev + 1);
    }
  };

  const handleAcheter = async (assemblageId: string) => {
    if (assemblagesGratuits.includes(assemblageId)) return;

    const dejaAchete = assemblagesAchetes.includes(assemblageId);
    if (dejaAchete) {
      const { error } = await supabase
        .from("personnage_assemblages")
        .delete()
        .eq("personnage_id", personnageId)
        .eq("assemblage_id", assemblageId);
      if (error) { toast.error("Erreur lors de la suppression."); return; }
      setAssemblagesAchetes((prev) => prev.filter((id) => id !== assemblageId));
      setXpDisponibleLocal((prev) => prev + COUT_ASSEMBLAGE_SUPPLEMENTAIRE);
      onXpSpent(-COUT_ASSEMBLAGE_SUPPLEMENTAIRE);
    } else {
      if (xpDisponibleLocal < COUT_ASSEMBLAGE_SUPPLEMENTAIRE) return;
      const { error } = await supabase.from("personnage_assemblages").insert({
        personnage_id: personnageId,
        assemblage_id: assemblageId,
        est_gratuit: false,
        xp_depense: COUT_ASSEMBLAGE_SUPPLEMENTAIRE,
      });
      if (error) { toast.error("Erreur lors de l'achat."); return; }
      setAssemblagesAchetes((prev) => [...prev, assemblageId]);
      setXpDisponibleLocal((prev) => prev - COUT_ASSEMBLAGE_SUPPLEMENTAIRE);
      onXpSpent(COUT_ASSEMBLAGE_SUPPLEMENTAIRE);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground text-center py-8">Chargement…</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold text-foreground">
        Étape 9 — Assemblages de runes
      </h2>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Niveau d'Assemblage de Runes : <strong className="text-primary">{niveauRunes}</strong>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gem className="h-4 w-4" />
            Choisissez vos assemblages de runes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-sm mb-4 font-medium ${quotaUtilises >= quotaTotal ? "text-green-400" : "text-amber-300"}`}>
            Assemblages gratuits : {quotaUtilises} / {quotaTotal} sélectionnés
          </div>
          <div className="space-y-3">
            {assemblages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun assemblage disponible.</p>
            ) : (
              assemblages.map((assemblage) => {
                const isGratuit = assemblagesGratuits.includes(assemblage.id);
                const isAchete = assemblagesAchetes.includes(assemblage.id);
                const quotaAtteint = !isGratuit && assemblagesGratuits.length >= quotaTotal;
                const xpInsuffisant = !isAchete && xpDisponibleLocal < COUT_ASSEMBLAGE_SUPPLEMENTAIRE;

                return (
                  <div
                    key={assemblage.id}
                    className="flex items-start justify-between gap-4 p-3 rounded border border-border/50"
                  >
                    <div className="flex-1 text-sm">
                      <div className="font-medium text-foreground">{assemblage.nom}</div>
                      <div className="text-xs text-muted-foreground space-y-1 mt-1">
                        {assemblage.description_longue && <p>{assemblage.description_longue}</p>}
                        {assemblage.effet && (
                          <p><span className="font-medium text-foreground">Effet :</span> {assemblage.effet}</p>
                        )}
                        {assemblage.cible && (
                          <p><span className="font-medium text-foreground">Cible :</span> {assemblage.cible}</p>
                        )}
                        {assemblage.runes_requises && (
                          <p><span className="font-medium text-foreground">Runes requises :</span> {assemblage.runes_requises.join(", ")}</p>
                        )}
                        {assemblage.cout_ps != null && (
                          <p><span className="font-medium text-foreground">Coût PS :</span> {assemblage.cout_ps}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {/* Bouton Gratuit */}
                      {isGratuit ? (
                        <button
                          className="px-3 py-1 text-sm bg-amber-600 text-black rounded font-semibold"
                          onClick={() => handleGratuit(assemblage.id)}
                        >
                          Gratuit ✓
                        </button>
                      ) : quotaAtteint ? (
                        <button
                          disabled
                          className="px-3 py-1 text-sm border border-gray-700 text-gray-600 rounded cursor-not-allowed"
                        >
                          Gratuit
                        </button>
                      ) : (
                        <button
                          className="px-3 py-1 text-sm border border-amber-600 text-amber-400 rounded"
                          onClick={() => handleGratuit(assemblage.id)}
                          disabled={isAchete}
                        >
                          Gratuit
                        </button>
                      )}

                      {/* Bouton Acheter / Retirer */}
                      {isAchete ? (
                        <button
                          className="px-3 py-1 text-sm bg-green-700 text-white rounded font-semibold"
                          onClick={() => handleAcheter(assemblage.id)}
                        >
                          Acheté ✓
                        </button>
                      ) : (
                        <button
                          className={`px-3 py-1 text-sm rounded ${
                            xpInsuffisant || isGratuit
                              ? "border border-gray-700 text-gray-600 cursor-not-allowed"
                              : "border border-green-600 text-green-400"
                          }`}
                          onClick={() => handleAcheter(assemblage.id)}
                          disabled={xpInsuffisant || isGratuit}
                        >
                          Acheter ({COUT_ASSEMBLAGE_SUPPLEMENTAIRE} xp)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Step8Runes;

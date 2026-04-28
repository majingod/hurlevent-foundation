import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Sparkles, Hammer, Gem } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  COUT_RECETTE_SUPPLEMENTAIRE,
  NOTE_FORGE,
  NOTE_JOAILLERIE,
  LEGENDE_FORGE_DISPO,
  LEGENDE_FORGE_UTILISE,
  LEGENDE_JOAILLERIE_DISPO,
  LEGENDE_JOAILLERIE_UTILISE,
  CONFIRM_LEGENDE_FORGE,
  CONFIRM_LEGENDE_JOAILLERIE,
} from "@/constants/artisanat";
import { NIVEAU_ALCHIMIE_LABELS, TYPE_RECETTE_LABELS } from "@/constants/labels";

interface ArtisanatState {
  niveau_alchimie: number;
  niveau_forge: number;
  niveau_joaillerie: number;
  niveau_runes: number;
  a_forge_legendaire: boolean;
  a_joaillerie_legendaire: boolean;
  quota_alchimie_mineure_total: number;
  quota_alchimie_intermediaire_total: number;
  quota_alchimie_majeure_total: number;
  quota_alchimie_mineure_utilises: number;
  quota_alchimie_intermediaire_utilises: number;
  quota_alchimie_majeure_utilises: number;
}

interface Recette {
  id: string;
  nom: string;
  effet: string | null;
  type: string;
  niveau_requis: number;
}

interface ObjetForge {
  id: string;
  nom: string | null;
  description: string | null;
  type: string | null;
  stats: any;
  difficulte: number | null;
  materiaux_communs: string | null;
  materiaux_rares: string | null;
}

interface ObjetJoaillerie {
  id: string;
  nom: string | null;
  description: string | null;
  effet: string | null;
  difficulte: number | null;
  materiaux_communs: string | null;
  materiaux_rares: string | null;
}

interface Step7Props {
  personnageId: string;
  xpDisponible: number;
  xpDepense: number;
  onXpSpent: (amount: number) => void;
}

const Step7Artisanat = ({
  personnageId,
  xpDisponible,
  xpDepense,
  onXpSpent,
}: Step7Props) => {
  const { toast } = useToast();
  const [artisanat, setArtisanat] = useState<ArtisanatState | null>(null);
  const [recettes, setRecettes] = useState<Recette[]>([]);
  const [forge, setForge] = useState<ObjetForge[]>([]);
  const [joaillerie, setJoaillerie] = useState<ObjetJoaillerie[]>([]);
  const [loading, setLoading] = useState(true);

  // Sélections persistées en DB
  const [recettesGratuites, setRecettesGratuites] = useState<Set<string>>(new Set());
  const [recettesAchetees, setRecettesAchetees] = useState<Set<string>>(new Set());
  const [showLegendForgeModal, setShowLegendForgeModal] = useState(false);
  const [showLegendJoaillerieModal, setShowLegendJoaillerieModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [quotasRes, recettesRes, forgeRes, joaillerieRes, existingRecettesRes] = await Promise.all([
          supabase
            .from("vue_artisanat_quotas")
            .select("*")
            .eq("personnage_id", personnageId)
            .maybeSingle(),
          supabase
            .from("recettes_alchimie")
            .select("*")
            .eq("est_actif", true)
            .order("niveau_requis")
            .order("nom"),
          supabase
            .from("objets_forge")
            .select("*")
            .eq("est_actif", true)
            .order("difficulte")
            .order("nom"),
          supabase
            .from("objets_joaillerie")
            .select("*")
            .eq("est_actif", true)
            .order("difficulte")
            .order("nom"),
          supabase
            .from("personnage_recettes")
            .select("recette_id, est_gratuit")
            .eq("personnage_id", personnageId),
        ]);

        if (quotasRes.error) throw quotasRes.error;
        if (quotasRes.data) {
          const d = quotasRes.data as any;
          setArtisanat({
            niveau_alchimie: d.niveau_alchimie ?? 0,
            niveau_forge: d.niveau_forge ?? 0,
            niveau_joaillerie: d.niveau_joaillerie ?? 0,
            niveau_runes: d.niveau_runes ?? 0,
            a_forge_legendaire: d.a_forge_legendaire ?? false,
            a_joaillerie_legendaire: d.a_joaillerie_legendaire ?? false,
            quota_alchimie_mineure_total: d.quota_alchimie_mineure_total ?? 0,
            quota_alchimie_intermediaire_total: d.quota_alchimie_intermediaire_total ?? 0,
            quota_alchimie_majeure_total: d.quota_alchimie_majeure_total ?? 0,
            quota_alchimie_mineure_utilises: d.quota_alchimie_mineure_utilises ?? 0,
            quota_alchimie_intermediaire_utilises: d.quota_alchimie_intermediaire_utilises ?? 0,
            quota_alchimie_majeure_utilises: d.quota_alchimie_majeure_utilises ?? 0,
          });
        }

        if (recettesRes.error) throw recettesRes.error;
        setRecettes((recettesRes.data ?? []) as Recette[]);

        if (forgeRes.error) throw forgeRes.error;
        setForge((forgeRes.data ?? []) as ObjetForge[]);

        if (joaillerieRes.error) throw joaillerieRes.error;
        setJoaillerie((joaillerieRes.data ?? []) as ObjetJoaillerie[]);

        // Restaurer les sélections existantes
        if (existingRecettesRes.data) {
          const gratuits = new Set<string>();
          const achetes = new Set<string>();
          existingRecettesRes.data.forEach((r: any) => {
            if (r.est_gratuit) gratuits.add(r.recette_id);
            else achetes.add(r.recette_id);
          });
          setRecettesGratuites(gratuits);
          setRecettesAchetees(achetes);
        }

        setLoading(false);
      } catch (err: any) {
        console.error(err);
        toast.error("Erreur lors du chargement des données d'artisanat.");
        setLoading(false);
      }
    };

    fetchData();
  }, [personnageId, toast]);

  const handleToggleGratuit = async (recette: Recette) => {
    const estGratuite = recettesGratuites.has(recette.id);
    const niv = recette.niveau_requis;

    if (estGratuite) {
      // Désélectionner
      const { error } = await supabase
        .from("personnage_recettes")
        .delete()
        .eq("personnage_id", personnageId)
        .eq("recette_id", recette.id);
      if (error) { toast.error("Erreur lors de la suppression."); return; }
      setRecettesGratuites((prev) => { const s = new Set(prev); s.delete(recette.id); return s; });
      setArtisanat((prev) => {
        if (!prev) return prev;
        const key = niv === 1 ? "quota_alchimie_mineure_utilises"
          : niv === 2 ? "quota_alchimie_intermediaire_utilises"
          : "quota_alchimie_majeure_utilises";
        return { ...prev, [key]: Math.max(0, prev[key] - 1) };
      });
    } else {
      // Vérifier le quota
      const utilises = niv === 1 ? (artisanat?.quota_alchimie_mineure_utilises ?? 0)
        : niv === 2 ? (artisanat?.quota_alchimie_intermediaire_utilises ?? 0)
        : (artisanat?.quota_alchimie_majeure_utilises ?? 0);
      const total = niv === 1 ? (artisanat?.quota_alchimie_mineure_total ?? 0)
        : niv === 2 ? (artisanat?.quota_alchimie_intermediaire_total ?? 0)
        : (artisanat?.quota_alchimie_majeure_total ?? 0);
      if (utilises >= total) return;

      const { error } = await supabase
        .from("personnage_recettes")
        .insert({ personnage_id: personnageId, recette_id: recette.id, est_gratuit: true, xp_depense: 0 });
      if (error) { toast.error("Erreur lors de la sélection."); return; }
      setRecettesGratuites((prev) => new Set(prev).add(recette.id));
      setArtisanat((prev) => {
        if (!prev) return prev;
        const key = niv === 1 ? "quota_alchimie_mineure_utilises"
          : niv === 2 ? "quota_alchimie_intermediaire_utilises"
          : "quota_alchimie_majeure_utilises";
        return { ...prev, [key]: prev[key] + 1 };
      });
    }
  };

  const handleToggleAcheter = async (recette: Recette) => {
    const estAchetee = recettesAchetees.has(recette.id);

    if (estAchetee) {
      const { error } = await supabase
        .from("personnage_recettes")
        .delete()
        .eq("personnage_id", personnageId)
        .eq("recette_id", recette.id);
      if (error) { toast.error("Erreur lors de la suppression."); return; }
      setRecettesAchetees((prev) => { const s = new Set(prev); s.delete(recette.id); return s; });
      onXpSpent(-COUT_RECETTE_SUPPLEMENTAIRE);
    } else {
      if (xpDisponible < COUT_RECETTE_SUPPLEMENTAIRE) {
        toast.error("XP insuffisant pour acheter cette recette.");
        return;
      }
      const { error } = await supabase
        .from("personnage_recettes")
        .insert({ personnage_id: personnageId, recette_id: recette.id, est_gratuit: false, xp_depense: COUT_RECETTE_SUPPLEMENTAIRE });
      if (error) { toast.error("Erreur lors de l'achat."); return; }
      setRecettesAchetees((prev) => new Set(prev).add(recette.id));
      onXpSpent(COUT_RECETTE_SUPPLEMENTAIRE);
    }
  };

  if (loading || !artisanat) {
    return <p className="text-muted-foreground text-center py-8">Chargement…</p>;
  }

  const hasAlchimie = artisanat.niveau_alchimie >= 1;
  const hasForge = artisanat.niveau_forge >= 1;
  const hasJoaillerie = artisanat.niveau_joaillerie >= 1;

  if (!hasAlchimie && !hasForge && !hasJoaillerie) {
    return (
      <div className="space-y-6">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Étape 7 — Artisanat
        </h2>
        <Card className="border-border/50">
          <CardContent className="py-6 text-center text-muted-foreground">
            Vous n'avez acheté aucune compétence d'artisanat à l'étape 4. Vous pouvez passer à l'étape suivante.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold text-foreground">
        Étape 7 — Artisanat
      </h2>

      <Tabs defaultValue={hasAlchimie ? "alchimie" : hasForge ? "forge" : "joaillerie"} className="w-full">
        <TabsList className="grid w-full gap-1" style={{ gridTemplateColumns: `repeat(${[hasAlchimie, hasForge, hasJoaillerie].filter(Boolean).length}, 1fr)` }}>
          {hasAlchimie && <TabsTrigger value="alchimie" className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Alchimie</TabsTrigger>}
          {hasForge && <TabsTrigger value="forge" className="flex items-center gap-2"><Hammer className="h-4 w-4" /> Forge</TabsTrigger>}
          {hasJoaillerie && <TabsTrigger value="joaillerie" className="flex items-center gap-2"><Gem className="h-4 w-4" /> Joaillerie</TabsTrigger>}
        </TabsList>

        {/* Alchimie Tab */}
        {hasAlchimie && (
          <TabsContent value="alchimie" className="space-y-6 mt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Niveau d'Alchimie : <strong className="text-primary">{artisanat.niveau_alchimie}</strong>
              </p>
              {artisanat.niveau_alchimie >= 1 && (
                <p className={`text-sm font-medium ${artisanat.quota_alchimie_mineure_utilises >= artisanat.quota_alchimie_mineure_total ? "text-green-400" : "text-amber-400"}`}>
                  Recettes Mineures gratuites : {artisanat.quota_alchimie_mineure_utilises} / {artisanat.quota_alchimie_mineure_total}
                </p>
              )}
              {artisanat.niveau_alchimie >= 2 && (
                <p className={`text-sm font-medium ${artisanat.quota_alchimie_intermediaire_utilises >= artisanat.quota_alchimie_intermediaire_total ? "text-green-400" : "text-amber-400"}`}>
                  Recettes Intermédiaires gratuites : {artisanat.quota_alchimie_intermediaire_utilises} / {artisanat.quota_alchimie_intermediaire_total}
                </p>
              )}
              {artisanat.niveau_alchimie >= 3 && (
                <p className={`text-sm font-medium ${artisanat.quota_alchimie_majeure_utilises >= artisanat.quota_alchimie_majeure_total ? "text-green-400" : "text-amber-400"}`}>
                  Recettes Majeures gratuites : {artisanat.quota_alchimie_majeure_utilises} / {artisanat.quota_alchimie_majeure_total}
                </p>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recettes d'alchimie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recettes
                  .filter((r) => r.niveau_requis <= artisanat.niveau_alchimie)
                  .map((recette) => {
                    const estGratuite = recettesGratuites.has(recette.id);
                    const estAchetee = recettesAchetees.has(recette.id);
                    const niv = recette.niveau_requis;
                    const utilises = niv === 1 ? artisanat.quota_alchimie_mineure_utilises
                      : niv === 2 ? artisanat.quota_alchimie_intermediaire_utilises
                      : artisanat.quota_alchimie_majeure_utilises;
                    const total = niv === 1 ? artisanat.quota_alchimie_mineure_total
                      : niv === 2 ? artisanat.quota_alchimie_intermediaire_total
                      : artisanat.quota_alchimie_majeure_total;
                    const gratuitDisabled = estAchetee || (!estGratuite && utilises >= total);
                    const achatDisabled = estGratuite || (!estAchetee && xpDisponible < COUT_RECETTE_SUPPLEMENTAIRE);
                    return (
                      <div key={recette.id} className="p-2 rounded border border-border/50 space-y-2">
                        <div>
                          <div className="font-medium text-sm text-foreground">{recette.nom}</div>
                          <div className="text-xs text-muted-foreground">
                            {recette.effet && <p>{recette.effet}</p>}
                            <div className="flex gap-2 mt-1">
                              {recette.type && <Badge variant="outline" className="text-xs">{TYPE_RECETTE_LABELS[recette.type] || recette.type}</Badge>}
                              {recette.niveau_requis && <Badge variant="secondary" className="text-xs">{NIVEAU_ALCHIMIE_LABELS[recette.niveau_requis] || `Niveau ${recette.niveau_requis}`}</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={estGratuite ? "default" : "outline"}
                            className={`text-xs flex-1${estGratuite ? " bg-green-700 hover:bg-green-800" : ""}`}
                            disabled={gratuitDisabled}
                            onClick={() => handleToggleGratuit(recette)}
                          >
                            {estGratuite ? "✓ Gratuit" : "Gratuit"}
                          </Button>
                          <Button
                            size="sm"
                            variant={estAchetee ? "default" : "outline"}
                            className={`text-xs flex-1${estAchetee ? " bg-amber-700 hover:bg-amber-800" : ""}`}
                            disabled={achatDisabled}
                            onClick={() => handleToggleAcheter(recette)}
                          >
                            {estAchetee ? `✓ Acheté (${COUT_RECETTE_SUPPLEMENTAIRE} XP)` : `Acheter (${COUT_RECETTE_SUPPLEMENTAIRE} XP)`}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Forge Tab */}
        {hasForge && (
          <TabsContent value="forge" className="space-y-6 mt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Niveau de Forge : <strong className="text-primary">{artisanat.niveau_forge}</strong>
              </p>
              <p className="text-sm text-muted-foreground italic">{NOTE_FORGE[artisanat.niveau_forge] || "Accès à tous les objets de forge."}</p>
            </div>

            {artisanat.niveau_forge === 3 && (
              <Card className="border-[#c9a84c]/40 bg-[#c9a84c]/5">
                <CardHeader>
                  <CardTitle className="text-base text-[#c9a84c]">Droit légendaire</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {artisanat.a_forge_legendaire ? (
                    <Badge className="bg-gray-600/20 text-gray-400 border-gray-600/30">{LEGENDE_FORGE_UTILISE}</Badge>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">{LEGENDE_FORGE_DISPO}</p>
                      <Button onClick={() => setShowLegendForgeModal(true)} className="w-full">
                        Utiliser mon droit légendaire
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {forge.map((obj) => (
                <Card key={obj.id} className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{obj.nom}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {obj.description && <p className="text-muted-foreground">{obj.description}</p>}
                    {obj.type && <p><span className="font-medium text-foreground">Type :</span> {obj.type}</p>}
                    <p className="text-xs text-muted-foreground">Temps de fabrication : {obj.difficulte} min</p>
                    {obj.materiaux_communs && (
                      <div className="mt-2 text-xs text-gray-300">
                        <span className="text-amber-400">Matériaux communs :</span> {obj.materiaux_communs}
                      </div>
                    )}
                    {obj.materiaux_rares && (
                      <div className="text-xs text-gray-300">
                        <span className="text-purple-400">Matériaux rares :</span> {obj.materiaux_rares}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}

        {/* Joaillerie Tab */}
        {hasJoaillerie && (
          <TabsContent value="joaillerie" className="space-y-6 mt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Niveau de Joaillerie : <strong className="text-primary">{artisanat.niveau_joaillerie}</strong>
              </p>
              <p className="text-sm text-muted-foreground italic">{NOTE_JOAILLERIE[artisanat.niveau_joaillerie] || "Accès à tous les objets de joaillerie."}</p>
            </div>

            {artisanat.niveau_joaillerie === 3 && (
              <Card className="border-[#c9a84c]/40 bg-[#c9a84c]/5">
                <CardHeader>
                  <CardTitle className="text-base text-[#c9a84c]">Droit légendaire</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {artisanat.a_joaillerie_legendaire ? (
                    <Badge className="bg-gray-600/20 text-gray-400 border-gray-600/30">{LEGENDE_JOAILLERIE_UTILISE}</Badge>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">{LEGENDE_JOAILLERIE_DISPO}</p>
                      <Button onClick={() => setShowLegendJoaillerieModal(true)} className="w-full">
                        Utiliser mon droit légendaire
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {joaillerie.map((obj) => (
                <Card key={obj.id} className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{obj.nom}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {obj.description && <p className="text-muted-foreground">{obj.description}</p>}
                    {obj.effet && <p><span className="font-medium text-foreground">Effet :</span> {obj.effet}</p>}
                    <p className="text-xs text-muted-foreground">Temps de fabrication : {obj.difficulte} min</p>
                    {obj.materiaux_communs && (
                      <div className="mt-2 text-xs text-gray-300">
                        <span className="text-amber-400">Matériaux communs :</span> {obj.materiaux_communs}
                      </div>
                    )}
                    {obj.materiaux_rares && (
                      <div className="text-xs text-gray-300">
                        <span className="text-purple-400">Matériaux rares :</span> {obj.materiaux_rares}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Modales de confirmation */}
      {showLegendForgeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader><CardTitle>Confirmation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{CONFIRM_LEGENDE_FORGE}</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowLegendForgeModal(false)}>Annuler</Button>
                <Button
                  onClick={async () => {
                    try {
                      await supabase.from("personnages").update({ a_forge_legendaire: true }).eq("id", personnageId);
                      setArtisanat((prev) => prev ? { ...prev, a_forge_legendaire: true } : null);
                      setShowLegendForgeModal(false);
                      toast.success("Droit légendaire utilisé !");
                    } catch { toast.error("Erreur lors de la mise à jour."); }
                  }}
                >Confirmer</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showLegendJoaillerieModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader><CardTitle>Confirmation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{CONFIRM_LEGENDE_JOAILLERIE}</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowLegendJoaillerieModal(false)}>Annuler</Button>
                <Button
                  onClick={async () => {
                    try {
                      await supabase.from("personnages").update({ a_joaillerie_legendaire: true }).eq("id", personnageId);
                      setArtisanat((prev) => prev ? { ...prev, a_joaillerie_legendaire: true } : null);
                      setShowLegendJoaillerieModal(false);
                      toast.success("Droit légendaire utilisé !");
                    } catch { toast.error("Erreur lors de la mise à jour."); }
                  }}
                >Confirmer</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Step7Artisanat;

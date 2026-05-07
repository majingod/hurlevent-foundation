import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Lock } from "lucide-react";

type CompetenceRow = Database["public"]["Tables"]["competences"]["Row"];
type PersonnageCompetenceRow =
  Database["public"]["Tables"]["personnage_competences"]["Row"];
type PersonnageRow = Database["public"]["Tables"]["personnages"]["Row"];
type ClasseRow = Database["public"]["Tables"]["classes"]["Row"];

interface NiveauInfo {
  niveau: number;
  cout_xp: number;
  description_niveau?: string;
  prerequis?: string | null;
}

interface CompetenceWithNiveaux extends CompetenceRow {
  niveaux_parsed: NiveauInfo[];
}

interface AcheterCompetenceParams {
  p_personnage_id: string;
  p_competence_id: string;
  p_niveau_desire: number;
  p_appris_via_maitre?: boolean;
  p_nom_maitre?: string;
  p_choix_achat?: string;
}

interface Etape5Props {
  personnageId: string;
  onSuccess?: (data: Json) => void;
  onError?: (error: Error) => void;
}

const TAB_CONFIG: { key: string; label: string; categories: string[] }[] = [
  { key: "generale", label: "Générales", categories: ["generale", "générale"] },
  { key: "guerrier", label: "Guerrier", categories: ["guerrier"] },
  { key: "voleur", label: "Voleur", categories: ["voleur"] },
  { key: "mage", label: "Mage", categories: ["mage"] },
  { key: "pretre", label: "Prêtre", categories: ["pretre", "prêtre"] },
];

function parseNiveaux(raw: Json | null): NiveauInfo[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const obj = entry as Record<string, unknown>;
      return {
        niveau: typeof obj.niveau === "number" ? obj.niveau : Number(obj.niveau ?? 1),
        cout_xp: typeof obj.cout_xp === "number" ? obj.cout_xp : Number(obj.cout_xp ?? 0),
        description_niveau:
          typeof obj.description_niveau === "string" ? obj.description_niveau : undefined,
        prerequis: typeof obj.prerequis === "string" ? obj.prerequis : null,
      } as NiveauInfo;
    })
    .filter((n): n is NiveauInfo => n !== null)
    .sort((a, b) => a.niveau - b.niveau);
}

function normalizeCategorie(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const Etape5_Competences_V2 = ({ personnageId, onSuccess, onError }: Etape5Props) => {
  const queryClient = useQueryClient();

  const [masterDialog, setMasterDialog] = useState<{
    competence: CompetenceWithNiveaux;
    niveau: NiveauInfo;
  } | null>(null);
  const [masterName, setMasterName] = useState("");

  // Personnage (pour connaître la classe)
  const { data: personnage } = useQuery({
    queryKey: ["personnage", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnages")
        .select("*")
        .eq("id", personnageId)
        .single();
      if (error) throw error;
      return data as PersonnageRow;
    },
  });

  const { data: classe, isLoading: loadingClasse } = useQuery({
    queryKey: ["classe", personnage?.classe_id],
    queryFn: async () => {
      if (!personnage?.classe_id) return null;
      const { data, error } = await supabase
        .from("classes")
        .select("id, nom")
        .eq("id", personnage.classe_id)
        .single();
      if (error) throw error;
      return data as Pick<ClasseRow, "id" | "nom">;
    },
    enabled: !!personnage?.classe_id,
  });

  const classeNom = normalizeCategorie(classe?.nom ?? null);

  // Compétences actives
  const { data: competences, isLoading: loadingCompetences } = useQuery({
    queryKey: ["competences-actives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competences")
        .select("*")
        .eq("est_actif", true)
        .order("nom");
      if (error) throw error;
      return (data ?? []).map<CompetenceWithNiveaux>((c) => ({
        ...c,
        niveaux_parsed: parseNiveaux(c.niveaux),
      }));
    },
  });

  // Compétences déjà achetées
  const { data: achats, isLoading: loadingAchats } = useQuery({
    queryKey: ["personnage-competences", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnage_competences")
        .select("*")
        .eq("personnage_id", personnageId);
      if (error) throw error;
      return (data ?? []) as PersonnageCompetenceRow[];
    },
    enabled: !!personnageId,
  });

  const niveauxAchetes = useMemo(() => {
    const map = new Map<string, Set<number>>();
    (achats ?? []).forEach((a) => {
      if (!map.has(a.competence_id)) map.set(a.competence_id, new Set());
      map.get(a.competence_id)!.add(a.niveau_acquis);
    });
    return map;
  }, [achats]);

  const competencesParTab = useMemo(() => {
    const grouped: Record<string, CompetenceWithNiveaux[]> = {};
    TAB_CONFIG.forEach((t) => (grouped[t.key] = []));
    (competences ?? []).forEach((c) => {
      const cat = normalizeCategorie(c.categorie);
      const tab = TAB_CONFIG.find((t) => t.categories.includes(cat));
      if (tab) grouped[tab.key].push(c);
      else if (c.est_general) grouped.generale.push(c);
    });
    return grouped;
  }, [competences]);

  const needsMaster = (comp: CompetenceWithNiveaux, niveau: number): boolean => {
    const cat = normalizeCategorie(comp.categorie);
    const isGenerale = comp.est_general || cat === "generale";
    const isOwnClass = !!classeNom && cat === classeNom;
    if (isGenerale || isOwnClass) return niveau >= 3;
    return niveau >= 2;
  };

  const mutation = useMutation({
    mutationFn: async (params: AcheterCompetenceParams) => {
      const { data, error } = await supabase.rpc("acheter_competence", params);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["personnage", personnageId] });
      queryClient.invalidateQueries({
        queryKey: ["personnage-competences", personnageId],
      });
      toast.success("Compétence achetée !");
      onSuccess?.(data);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const handleBuy = (comp: CompetenceWithNiveaux, niveau: NiveauInfo) => {
    if (needsMaster(comp, niveau.niveau)) {
      setMasterDialog({ competence: comp, niveau });
      setMasterName("");
      return;
    }
    mutation.mutate({
      p_personnage_id: personnageId,
      p_competence_id: comp.id,
      p_niveau_desire: niveau.niveau,
    });
  };

  const confirmMaster = () => {
    if (!masterDialog) return;
    const trimmed = masterName.trim();
    if (!trimmed) {
      toast.error("Le nom du maître est obligatoire.");
      return;
    }
    mutation.mutate({
      p_personnage_id: personnageId,
      p_competence_id: masterDialog.competence.id,
      p_niveau_desire: masterDialog.niveau.niveau,
      p_appris_via_maitre: true,
      p_nom_maitre: trimmed,
    });
    setMasterDialog(null);
  };

  const renderCompetence = (comp: CompetenceWithNiveaux) => {
    const niveauxAchetesPourComp = niveauxAchetes.get(comp.id) ?? new Set<number>();
    const maxAchete = niveauxAchetesPourComp.size
      ? Math.max(...niveauxAchetesPourComp)
      : 0;

    return (
      <Card key={comp.id}>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-heading">{comp.nom}</CardTitle>
            {comp.est_general && (
              <Badge variant="outline" className="text-xs">
                Générale
              </Badge>
            )}
          </div>
          {comp.description && (
            <p className="text-xs text-muted-foreground">{comp.description}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {comp.niveaux_parsed.length === 0 && (
            <p className="text-xs italic text-muted-foreground">
              Aucun niveau défini pour cette compétence.
            </p>
          )}
          {comp.niveaux_parsed.map((niv) => {
            const dejaAchete = niveauxAchetesPourComp.has(niv.niveau);
            const niveauPrecedentRequis = niv.niveau > 1 && niv.niveau - 1 > maxAchete;
            const requiresMaster = needsMaster(comp, niv.niveau);
            const disabled =
              dejaAchete || niveauPrecedentRequis || mutation.isPending;

            return (
              <div
                key={niv.niveau}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <strong>Niveau {niv.niveau}</strong>
                    <Badge variant="secondary" className="text-xs">
                      {niv.cout_xp} XP
                    </Badge>
                    {requiresMaster && (
                      <Badge
                        variant="outline"
                        className="text-xs border-amber-600/40 text-amber-500"
                      >
                        Maître requis
                      </Badge>
                    )}
                    {dejaAchete && (
                      <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-xs">
                        Acquis
                      </Badge>
                    )}
                  </div>
                  {niv.description_niveau && (
                    <p className="text-muted-foreground">{niv.description_niveau}</p>
                  )}
                  {niveauPrecedentRequis && !dejaAchete && (
                    <p className="flex items-center gap-1 text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      Acheter d'abord le niveau {niv.niveau - 1}
                    </p>
                  )}
                </div>
                {!dejaAchete && (
                  <Button
                    size="sm"
                    onClick={() => handleBuy(comp, niv)}
                    disabled={disabled}
                  >
                    {mutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    Acheter niveau {niv.niveau} (coût {niv.cout_xp} XP)
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  if (loadingCompetences || loadingAchats || loadingClasse) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Chargement des compétences…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="generale" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          {TAB_CONFIG.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TAB_CONFIG.map((t) => (
          <TabsContent key={t.key} value={t.key} className="space-y-3">
            {(competencesParTab[t.key] ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune compétence dans cette catégorie.
              </p>
            ) : (
              competencesParTab[t.key].map((c) => renderCompetence(c))
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog
        open={!!masterDialog}
        onOpenChange={(open) => {
          if (!open) setMasterDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apprentissage avec un maître</DialogTitle>
            <DialogDescription>
              {masterDialog && (
                <>
                  L'achat du niveau {masterDialog.niveau.niveau} de{" "}
                  <strong>{masterDialog.competence.nom}</strong> nécessite l'apprentissage
                  auprès d'un maître. Indiquez son nom — la demande sera soumise à
                  validation.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="master-name">Nom du maître</Label>
            <Input
              id="master-name"
              value={masterName}
              onChange={(e) => setMasterName(e.target.value)}
              placeholder="Nom du personnage maître"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMasterDialog(null)}>
              Annuler
            </Button>
            <Button onClick={confirmMaster} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirmer l'achat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Etape5_Competences_V2;

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BookOpen, Loader2 } from "lucide-react";
import type { EtapeProps } from "@/pages/PersonnageNouveauV2";

type PersonnageRow = Database["public"]["Tables"]["personnages"]["Row"];

const Etape10_Historique_V2 = ({
  personnageId,
  onSuccess,
  onPrevious,
}: EtapeProps) => {
  const queryClient = useQueryClient();

  const [historique, setHistorique] = useState("");
  const [amePersonnage, setAmePersonnage] = useState("");

  const { data: personnage, isLoading: loadingPersonnage } = useQuery({
    queryKey: ["personnage", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnages")
        .select("historique, ame_personnage")
        .eq("id", personnageId)
        .maybeSingle();
      if (error) throw error;
      return data as Pick<PersonnageRow, "historique" | "ame_personnage"> | null;
    },
    enabled: !!personnageId,
  });

  useEffect(() => {
    if (personnage) {
      setHistorique(personnage.historique ?? "");
      setAmePersonnage(personnage.ame_personnage ?? "");
    }
  }, [personnage]);

  const sauvegarderMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("sauvegarder_etape_10", {
        p_personnage_id: personnageId,
        p_historique: historique,
        p_ame_personnage: amePersonnage,
      });
      if (error) throw error;
      // sauvegarder_etape_10 renvoie {succes, erreurs, avertissements, donnees}
      // en HTTP 200 même en cas de refus métier (personnage_verrouille,
      // ownership_refuse, contrainte_violee, non_authentifie, échec de
      // valider_etape_10…). On traite succes:false comme une erreur : pas de
      // faux toast de succès, et le wizard n'avance pas.
      const payload = (data ?? {}) as Record<string, unknown>;
      if (payload.succes === false) {
        const erreurs =
          (payload.erreurs as Array<{ code?: string; message?: string }>) ?? [];
        const code = erreurs[0]?.code ?? "erreur";
        const message = erreurs[0]?.message ?? "Sauvegarde refusée.";
        throw new Error(`[${code}] ${message}`);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnage", personnageId] });
      queryClient.invalidateQueries({
        queryKey: ["v2-personnage", personnageId],
      });
      toast.success("Historique et âme sauvegardés !");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (loadingPersonnage) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Chargement de l'historique…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Étape 10 — Historique et âme
        </h2>
        <p className="text-sm text-muted-foreground">
          Décrivez l'histoire et la personnalité profonde de votre personnage.
          Ces champs seront toujours modifiables après la création.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">
            Historique du personnage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="historique">
              Racontez l'histoire de votre personnage
            </Label>
            <Textarea
              id="historique"
              placeholder="Racontez l'histoire de votre personnage, ses origines, ses motivations, les événements qui l'ont marqué..."
              value={historique}
              onChange={(e) => setHistorique(e.target.value)}
              className="min-h-[200px] resize-none"
              disabled={sauvegarderMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Aucune limite de caractères. Soyez aussi détaillé que vous le
              souhaitez.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">
            Âme du personnage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="ame">Décrivez la personnalité profonde</Label>
            <Textarea
              id="ame"
              placeholder="Décrivez la personnalité profonde, les valeurs, les traits de caractère, les motivations cachées de votre personnage..."
              value={amePersonnage}
              onChange={(e) => setAmePersonnage(e.target.value)}
              className="min-h-[200px] resize-none"
              disabled={sauvegarderMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Aucune limite de caractères. Explorez la psychologie de votre
              personnage.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        {onPrevious && (
          <Button variant="outline" onClick={onPrevious}>
            ← Précédent
          </Button>
        )}
        <Button
          className="ml-auto"
          onClick={() => sauvegarderMutation.mutate()}
          disabled={sauvegarderMutation.isPending}
        >
          {sauvegarderMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Suivant →
        </Button>
      </div>
    </div>
  );
};

export default Etape10_Historique_V2;

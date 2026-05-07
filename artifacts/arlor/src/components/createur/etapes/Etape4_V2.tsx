import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import type { EtapeProps } from "@/pages/PersonnageNouveauV2";

interface Etape4Form {
  classe_id: string;
}

const Etape4_V2 = ({ personnageId, onSuccess, onPrevious }: EtapeProps) => {
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, reset } = useForm<Etape4Form>({
    defaultValues: { classe_id: "" },
  });

  // Race du personnage pour filtrer les classes restreintes
  const { data: perso } = useQuery({
    queryKey: ["v2-perso-classe", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnages")
        .select("classe_id, race_id")
        .eq("id", personnageId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["v2-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, nom, description, emoji, role_combat, pv_depart, ps_depart")
        .eq("est_actif", true)
        .order("nom");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Récupérer les restrictions_classes de la race pour filtrer
  const raceId = perso?.race_id ?? null;
  const { data: race } = useQuery({
    queryKey: ["v2-race-restrictions", raceId],
    enabled: !!raceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("races")
        .select("id, nom, restrictions_classes")
        .eq("id", raceId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const restrictions = (race?.restrictions_classes ?? []) as string[];
  const classesAffichees = restrictions.length
    ? classes.filter(
        (c: any) => !restrictions.includes(c.id) && !restrictions.includes(c.nom),
      )
    : classes;

  useEffect(() => {
    if (perso?.classe_id) reset({ classe_id: perso.classe_id });
  }, [perso, reset]);

  const onSubmit = async (values: Etape4Form) => {
    if (!values.classe_id) {
      toast.error("Choisis une classe.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("sauvegarder_etape_4", {
      p_personnage_id: personnageId,
      p_classe_id: values.classe_id,
    });
    setSubmitting(false);

    if (error) {
      console.error("[V2 Etape4] RPC error:", error);
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    const payload = (data ?? {}) as Record<string, unknown>;
    if (payload.succes === false) {
      const code = (payload.code as string) ?? "erreur";
      const message = (payload.message as string) ?? "Sauvegarde refusée.";
      toast.error(`[${code}] ${message}`);
      return;
    }

    toast.success("Classe enregistrée.");
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-heading text-2xl text-gold">Choix de la classe</h2>
        <p className="text-sm text-white/50">
          Sélectionne la classe principale de ton personnage.
        </p>
      </div>

      <Controller
        control={control}
        name="classe_id"
        render={({ field }) => (
          <RadioGroup
            value={field.value}
            onValueChange={field.onChange}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
          >
            {isLoading && (
              <p className="text-white/50">Chargement des classes…</p>
            )}
            {classesAffichees.map((c: any) => {
              const selectionne = field.value === c.id;
              return (
                <Label
                  key={c.id}
                  htmlFor={`classe-${c.id}`}
                  className="cursor-pointer"
                >
                  <Card
                    className={`border-white/10 bg-black/30 transition-colors ${
                      selectionne ? "border-gold/60 bg-gold/5" : ""
                    }`}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-base text-gold">
                        <span className="flex items-center gap-2">
                          <RadioGroupItem
                            id={`classe-${c.id}`}
                            value={c.id}
                          />
                          {c.emoji ? <span>{c.emoji}</span> : null}
                          {c.nom}
                        </span>
                        {c.role_combat && (
                          <span className="text-xs text-white/50">
                            {c.role_combat}
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {c.description && (
                        <p className="text-sm text-white/70">
                          {c.description}
                        </p>
                      )}
                      <p className="text-xs text-white/50">
                        PV {c.pv_depart ?? "?"} · PS {c.ps_depart ?? "?"}
                      </p>
                    </CardContent>
                  </Card>
                </Label>
              );
            })}
          </RadioGroup>
        )}
      />

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onPrevious}>
          Étape précédente
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-gold text-black hover:bg-gold/90"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Suivant
        </Button>
      </div>
    </form>
  );
};

export default Etape4_V2;

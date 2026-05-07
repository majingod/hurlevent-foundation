import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import type { EtapeProps } from "@/pages/PersonnageNouveauV2";

const CHIMERIDE_ID = "926b6948-e192-4d41-9909-efabaa3059b5";
const NON_RACES_ID = "4d7e2226-76cb-4b94-9df4-b8f12ff486e1";

interface Etape2Form {
  race_id: string;
  sous_type_chimeride: "carnivore" | "herbivore" | "";
  justification: string;
}

const Etape2_V2 = ({ personnageId, onSuccess, onPrevious }: EtapeProps) => {
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, watch, reset, register } =
    useForm<Etape2Form>({
      defaultValues: { race_id: "", sous_type_chimeride: "", justification: "" },
    });

  // Mémoriser la justification précédemment saisie pour ne pas la perdre lors d'un changement de race
  const [justificationSauvegardee, setJustificationSauvegardee] = useState("");

  const raceId = watch("race_id");
  const estChimeride = raceId === CHIMERIDE_ID;
  const necessiteJustification = raceId === NON_RACES_ID;

  const { data: races = [], isLoading } = useQuery({
    queryKey: ["v2-races"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("races")
        .select("id, nom, description, xp_depart, est_jouable")
        .eq("est_actif", true)
        .order("nom");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const charger = async () => {
      // Charger la race + la dernière demande de race (justification)
      const [{ data: perso }, { data: demande }] = await Promise.all([
        supabase
          .from("personnages")
          .select("race_id, sous_type_chimeride")
          .eq("id", personnageId)
          .single(),
        supabase
          .from("personnage_races_demandes")
          .select("background")
          .eq("personnage_id", personnageId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!perso) return;
      const just = (demande?.background as string | undefined) ?? "";
      setJustificationSauvegardee(just);
      reset({
        race_id: perso.race_id ?? "",
        sous_type_chimeride:
          (perso.sous_type_chimeride as "carnivore" | "herbivore" | null) ?? "",
        justification: just,
      });
    };
    charger();
  }, [personnageId, reset]);

  const onSubmit = async (values: Etape2Form) => {
    if (!values.race_id) {
      toast.error("Choisis une race.");
      return;
    }
    if (estChimeride && !values.sous_type_chimeride) {
      toast.error("Choisis le sous-type Chiméride (carnivore ou herbivore).");
      return;
    }
    if (necessiteJustification && !values.justification.trim()) {
      toast.error("Une justification est requise pour ce choix de race.");
      return;
    }

    setSubmitting(true);
    // On envoie toujours explicitement null pour effacer les valeurs obsolètes côté backend.
    const sousType = estChimeride ? values.sous_type_chimeride : null;
    const justif = necessiteJustification ? values.justification.trim() : null;
    const { data, error } = await supabase.rpc("sauvegarder_etape_2", {
      p_personnage_id: personnageId,
      p_race_id: values.race_id,
      p_sous_type_chimeride: sousType as unknown as string,
      p_justification: justif as unknown as string,
    });
    setSubmitting(false);

    if (error) {
      console.error("[V2 Etape2] RPC error:", error);
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

    toast.success("Race enregistrée.");
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="space-y-2">
        <h2 className="font-heading text-2xl text-gold">Choix de la race</h2>
        <p className="text-sm text-white/50">
          Sélectionne la race de ton personnage.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-base text-gold">Race</Label>
        <Controller
          control={control}
          name="race_id"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="bg-white/5 border-white/10">
                <SelectValue
                  placeholder={isLoading ? "Chargement…" : "Choisis une race"}
                />
              </SelectTrigger>
              <SelectContent>
                {races.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nom}
                    {r.xp_depart != null ? ` — ${r.xp_depart} XP` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {estChimeride && (
        <div className="space-y-3 rounded-lg border border-gold/20 bg-gold/5 p-4">
          <Label className="text-base text-gold">Sous-type Chiméride</Label>
          <Controller
            control={control}
            name="sous_type_chimeride"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="chim-carn" value="carnivore" />
                  <Label htmlFor="chim-carn">Carnivore</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="chim-herb" value="herbivore" />
                  <Label htmlFor="chim-herb">Herbivore</Label>
                </div>
              </RadioGroup>
            )}
          />
        </div>
      )}

      {necessiteJustification && (
        <div className="space-y-2">
          <Label htmlFor="justif" className="text-base text-gold">
            Justification
          </Label>
          <p className="text-xs text-white/50">
            Cette race nécessite l'accord de l'équipe d'animation : explique
            ton choix et ton background.
          </p>
          <Textarea
            id="justif"
            rows={5}
            {...register("justification")}
            placeholder="Décris pourquoi tu choisis cette race et le background associé…"
            className="bg-white/5 border-white/10"
          />
        </div>
      )}

      <div className="flex justify-between">
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

export default Etape2_V2;

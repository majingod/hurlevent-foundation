import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Etape1Form {
  nom: string;
  gn_completes: number;
  mini_gn_completes: number;
  ouvertures_terrain: number;
  est_croyant: "oui" | "non" | "";
  religion_id: string;
}

const Etape1_V2 = ({ personnageId, onSuccess }: EtapeProps) => {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<Etape1Form>({
    defaultValues: {
      nom: "",
      gn_completes: 0,
      mini_gn_completes: 0,
      ouvertures_terrain: 0,
      est_croyant: "",
      religion_id: "",
    },
  });

  const estCroyant = watch("est_croyant");

  // Charger les religions actives
  const { data: religions = [], isLoading: loadingReligions } = useQuery({
    queryKey: ["v2-religions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("religions")
        .select("id, nom, description")
        .eq("est_actif", true)
        .order("nom");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Pré-remplir avec les valeurs déjà sauvegardées sur le brouillon
  useEffect(() => {
    const charger = async () => {
      const { data } = await supabase
        .from("personnages")
        .select(
          "nom, gn_completes, mini_gn_completes, ouvertures_terrain, est_croyant, religion_id"
        )
        .eq("id", personnageId)
        .single();
      if (!data) return;
      reset({
        nom: data.nom ?? "",
        gn_completes: data.gn_completes ?? 0,
        mini_gn_completes: data.mini_gn_completes ?? 0,
        ouvertures_terrain: data.ouvertures_terrain ?? 0,
        est_croyant:
          data.est_croyant === true
            ? "oui"
            : data.est_croyant === false
            ? "non"
            : "",
        religion_id: data.religion_id ?? "",
      });
    };
    charger();
  }, [personnageId, reset]);

  const onSubmit = async (values: Etape1Form) => {
    if (!values.nom.trim()) {
      toast.error("Le nom est obligatoire.");
      return;
    }
    if (values.est_croyant === "") {
      toast.error("Indique si ton personnage est croyant ou non.");
      return;
    }
    const croyant = values.est_croyant === "oui";
    if (croyant && !values.religion_id) {
      toast.error("Choisis une religion pour ton personnage croyant.");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.rpc("sauvegarder_etape_1", {
      p_personnage_id: personnageId,
      p_nom: values.nom.trim(),
      p_gn_completes: Number(values.gn_completes) || 0,
      p_mini_gn_completes: Number(values.mini_gn_completes) || 0,
      p_ouvertures_terrain: Number(values.ouvertures_terrain) || 0,
      p_est_croyant: croyant,
      p_religion_id: (croyant ? values.religion_id : null) as unknown as string,
    });
    setSubmitting(false);

    if (error) {
      console.error("[V2 Etape1] RPC error:", error);
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

    toast.success("Étape 1 enregistrée.");
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="space-y-2">
        <h2 className="font-heading text-2xl text-gold">
          Identité &amp; expérience
        </h2>
        <p className="text-sm text-white/50">
          Présente ton personnage et indique ton expérience de jeu.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nom" className="text-base text-gold">
          Nom du personnage
        </Label>
        <Input
          id="nom"
          {...register("nom", { required: true })}
          placeholder="Ex : Valerius l'Ancien"
          className="bg-white/5 border-white/10"
        />
        {errors.nom && (
          <p className="text-xs text-red-400">Le nom est requis.</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="gn" className="text-sm text-white/70">
            GN réguliers complétés
          </Label>
          <Input
            id="gn"
            type="number"
            min={0}
            {...register("gn_completes", { valueAsNumber: true, min: 0 })}
            className="bg-white/5 border-white/10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mini" className="text-sm text-white/70">
            Mini-GN complétés
          </Label>
          <Input
            id="mini"
            type="number"
            min={0}
            {...register("mini_gn_completes", { valueAsNumber: true, min: 0 })}
            className="bg-white/5 border-white/10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ouv" className="text-sm text-white/70">
            Ouvertures de terrain
          </Label>
          <Input
            id="ouv"
            type="number"
            min={0}
            {...register("ouvertures_terrain", {
              valueAsNumber: true,
              min: 0,
            })}
            className="bg-white/5 border-white/10"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-base text-gold">
          Ton personnage est-il croyant ?
        </Label>
        <Controller
          control={control}
          name="est_croyant"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="croyant-oui" value="oui" />
                <Label htmlFor="croyant-oui">Oui</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="croyant-non" value="non" />
                <Label htmlFor="croyant-non">Non</Label>
              </div>
            </RadioGroup>
          )}
        />
      </div>

      {estCroyant === "oui" && (
        <div className="space-y-2">
          <Label className="text-base text-gold">Religion</Label>
          <Controller
            control={control}
            name="religion_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue
                    placeholder={
                      loadingReligions
                        ? "Chargement…"
                        : "Choisis une religion"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {religions.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      <div className="flex justify-end">
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

export default Etape1_V2;

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// =========================================================================
// CONSTANTES DE CALCUL XP/NIVEAU
// Valeurs par défaut conventionnelles du manuel. NOTE : ces défauts ne sont
// pas stockés en base aujourd'hui (evenements.xp_recompense est nullable sans
// défaut). Le bloc récapitulatif ci-dessous est donc un ESTIMATIF indicatif —
// l'XP réel est attribué par un animateur via attribuer_xp_evenement.
// Dette technique : si l'animateur surcharge l'XP d'un événement, l'estimatif
// sera désynchronisé. À terme, sourcer ces valeurs depuis la DB.
// =========================================================================
const XP_GN_REGULIER = 15;
const XP_MINI_GN = 15;
const XP_OUVERTURE_TERRAIN = 10;
const NIVEAU_BASE = 1;

interface Etape1Form {
  nom: string;
  gn_completes: number;
  mini_gn_completes: number;
  ouvertures_terrain: number;
  est_croyant: "oui" | "non" | "";
  religion_id: string;
  historique: string;
  ame_personnage: string;
}

const Etape1_V2 = ({ personnageId, onSuccess, onXpGainChange }: EtapeProps) => {
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
      historique: "",
      ame_personnage: "",
    },
  });

  const estCroyant = watch("est_croyant");

  // Watch temps réel des compteurs d'événements pour le bloc récapitulatif
  const gnCompletes = Number(watch("gn_completes")) || 0;
  const miniGnCompletes = Number(watch("mini_gn_completes")) || 0;
  const ouverturesTerrain = Number(watch("ouvertures_terrain")) || 0;

  const niveauActuel = NIVEAU_BASE + gnCompletes;
  const xpGn = gnCompletes * XP_GN_REGULIER;
  const xpMiniGn = miniGnCompletes * XP_MINI_GN;
  const xpOuvertures = ouverturesTerrain * XP_OUVERTURE_TERRAIN;

  // Remonte l'XP gagné estimé au header parent, en temps réel
  useEffect(() => {
    const gainEstime = xpGn + xpMiniGn + xpOuvertures;
    onXpGainChange?.(gainEstime);
  }, [xpGn, xpMiniGn, xpOuvertures, onXpGainChange]);

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
          "nom, gn_completes, mini_gn_completes, ouvertures_terrain, est_croyant, religion_id, historique, ame_personnage"
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
        historique: data.historique ?? "",
        ame_personnage: data.ame_personnage ?? "",
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
      p_historique: values.historique,
      p_ame_personnage: values.ame_personnage,
    });
    setSubmitting(false);

    if (error) {
      console.error("[V2 Etape1] RPC error:", error);
      toast.error(`Erreur : ${error.message}`);
      return;
    }

    const payload = (data ?? {}) as Record<string, unknown>;
    const erreurs =
      (payload.erreurs as Array<{ code?: string; message?: string }>) ?? [];
    const avertissements =
      (payload.avertissements as Array<{ code?: string; message?: string }>) ?? [];

    if (payload.succes === false) {
      const premiereErreur = erreurs[0] ?? {};
      const code = premiereErreur.code ?? "erreur";
      const message = premiereErreur.message ?? "Sauvegarde refusée.";
      toast.error(`[${code}] ${message}`);
      return;
    }

    // Avertissements éventuels (cas succès — ex. validation propagée par valider_etape_1)
    avertissements.forEach((a) => {
      if (a.message) toast.info(a.message);
    });

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
            GN réguliers complétés{" "}
            <span className="text-white/40">(+15 XP et +1 niveau par GN)</span>
          </Label>
          <Input
            id="gn"
            type="number"
            min={0}
            {...register("gn_completes", {
              valueAsNumber: true,
              min: 0,
              setValueAs: (v) => {
                const n = Number(v);
                if (Number.isNaN(n) || n < 0) return 0;
                return Math.floor(n);
              },
            })}
            className="bg-white/5 border-white/10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mini" className="text-sm text-white/70">
            Mini-GN complétés{" "}
            <span className="text-white/40">(+15 XP par mini-GN)</span>
          </Label>
          <Input
            id="mini"
            type="number"
            min={0}
            {...register("mini_gn_completes", {
              valueAsNumber: true,
              min: 0,
              setValueAs: (v) => {
                const n = Number(v);
                if (Number.isNaN(n) || n < 0) return 0;
                return Math.floor(n);
              },
            })}
            className="bg-white/5 border-white/10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ouv" className="text-sm text-white/70">
            Ouvertures de terrain{" "}
            <span className="text-white/40">(+10 XP par ouverture)</span>
          </Label>
          <Input
            id="ouv"
            type="number"
            min={0}
            {...register("ouvertures_terrain", {
              valueAsNumber: true,
              min: 0,
              setValueAs: (v) => {
                const n = Number(v);
                if (Number.isNaN(n) || n < 0) return 0;
                return Math.floor(n);
              },
            })}
            className="bg-white/5 border-white/10"
          />
        </div>
      </div>

      {/* Bloc récapitulatif XP/niveau — estimatif temps réel */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-1.5 text-sm">
        <p className="text-white/70">
          Niveau actuel :{" "}
          <strong className="text-gold">{niveauActuel}</strong>{" "}
          <span className="text-white/40">
            ({NIVEAU_BASE} niveau de base + {gnCompletes} GN régulier
            {gnCompletes > 1 ? "s" : ""})
          </span>
        </p>
        <p className="text-white/70">
          XP de GN : <strong className="text-green-400">+{xpGn}</strong>
        </p>
        <p className="text-white/70">
          XP de mini-GN :{" "}
          <strong className="text-green-400">+{xpMiniGn}</strong>
        </p>
        <p className="text-white/70">
          XP d'ouvertures :{" "}
          <strong className="text-green-400">+{xpOuvertures}</strong>
        </p>
        <p className="text-xs italic text-white/40 pt-1">
          XP total : sera calculé à l'étape suivante après le choix de la race.
        </p>
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

      <div className="space-y-2">
        <Label htmlFor="historique" className="text-base text-gold">
          Historique du personnage
        </Label>
        <Textarea
          id="historique"
          placeholder="Racontez l'histoire de votre personnage, ses origines, ses motivations, les événements qui l'ont marqué..."
          {...register("historique")}
          className="min-h-[160px] resize-none bg-white/5 border-white/10"
        />
        <p className="text-xs italic text-white/40">
          Aucune limite de caractères. Modifiable plus tard.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ame_personnage" className="text-base text-gold">
          Âme du personnage
        </Label>
        <Textarea
          id="ame_personnage"
          placeholder="Décrivez la personnalité profonde, les valeurs, les traits de caractère, les motivations cachées de votre personnage..."
          {...register("ame_personnage")}
          className="min-h-[160px] resize-none bg-white/5 border-white/10"
        />
        <p className="text-xs italic text-white/40">
          Aucune limite de caractères. Modifiable plus tard.
        </p>
      </div>

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

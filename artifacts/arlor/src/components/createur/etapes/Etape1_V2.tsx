import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Lock, Info } from "lucide-react";
import ReligionDetails from "@/components/shared/ReligionDetails";

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

const Etape1_V2 = ({
  personnageId,
  onSuccess,
  onXpGainChange,
  modeCampagne = false,
}: EtapeProps & { modeCampagne?: boolean }) => {
  const [submitting, setSubmitting] = useState(false);
  // M3a PR-C1 : valeurs d'identité figées en campagne (INV-4). On capture les
  // valeurs DB d'origine au chargement pour les renvoyer telles quelles au RPC,
  // quoi qu'il arrive côté formulaire (garantie anti-identite_figee_campagne).
  const valeursFigees = useRef<{
    nom: string;
    gn_completes: number;
    mini_gn_completes: number;
    ouvertures_terrain: number;
    est_croyant: boolean | null;
    religion_id: string | null;
  } | null>(null);
  // XP des GN/mini-GN/ouvertures DÉJÀ sauvegardé (donc déjà inclus dans xp_total serveur).
  // Sert à ne remonter au header que la portion NON sauvegardée (évite le double-compte).
  const [gainSauvegarde, setGainSauvegarde] = useState(0);
  const [religionManuelOpen, setReligionManuelOpen] = useState(false);

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
    onXpGainChange?.(gainEstime - gainSauvegarde);
  }, [xpGn, xpMiniGn, xpOuvertures, gainSauvegarde, onXpGainChange]);

  // Charger les religions actives
  const { data: religions = [], isLoading: loadingReligions } = useQuery({
    queryKey: ["v2-religions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("religions")
        .select(
          "id, nom, description, dirigeant, fondateur, symbole_sacre, pouvoir_symbole, domaines_principaux, domaines_proscrits, lore_fiche, rituels_fiche, lore_manuel, rituels_manuel"
        )
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
      // Garder les valeurs DB d'origine des 6 champs figés (INV-4) pour le submit campagne.
      valeursFigees.current = {
        nom: data.nom ?? "",
        gn_completes: data.gn_completes ?? 0,
        mini_gn_completes: data.mini_gn_completes ?? 0,
        ouvertures_terrain: data.ouvertures_terrain ?? 0,
        est_croyant: data.est_croyant ?? null,
        religion_id: data.religion_id ?? null,
      };
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
      setGainSauvegarde(
        (data.gn_completes ?? 0) * XP_GN_REGULIER +
          (data.mini_gn_completes ?? 0) * XP_MINI_GN +
          (data.ouvertures_terrain ?? 0) * XP_OUVERTURE_TERRAIN
      );
    };
    charger();
  }, [personnageId, reset]);

  const onSubmit = async (values: Etape1Form) => {
    // M3a PR-C1 : en campagne, l'identité (6 champs INV-4) est figée et provient
    // STRICTEMENT de la DB. On ignore les valeurs du formulaire pour ces champs,
    // et on saute leurs validations (déjà valides à la finalisation).
    const figees = modeCampagne ? valeursFigees.current : null;

    if (!figees) {
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
    }

    const nom = figees ? figees.nom : values.nom.trim();
    const gnCompletes = figees ? figees.gn_completes : Number(values.gn_completes) || 0;
    const miniGnCompletesV = figees ? figees.mini_gn_completes : Number(values.mini_gn_completes) || 0;
    const ouverturesV = figees ? figees.ouvertures_terrain : Number(values.ouvertures_terrain) || 0;
    const croyant = figees ? figees.est_croyant === true : values.est_croyant === "oui";
    const religionId = figees
      ? figees.religion_id
      : croyant
      ? values.religion_id
      : null;

    setSubmitting(true);
    const { data, error } = await supabase.rpc("sauvegarder_etape_1", {
      p_personnage_id: personnageId,
      p_nom: nom,
      p_gn_completes: gnCompletes,
      p_mini_gn_completes: miniGnCompletesV,
      p_ouvertures_terrain: ouverturesV,
      p_est_croyant: croyant,
      p_religion_id: religionId as unknown as string,
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

    toast.success("Identité enregistrée.");
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

      {modeCampagne && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          L'identité de ton personnage est figée. Son histoire, elle, continue de
          s'écrire.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="nom" className="flex items-center gap-1.5 text-base text-gold">
          {modeCampagne && <Lock className="h-3.5 w-3.5" />}
          Nom du personnage
        </Label>
        <Input
          id="nom"
          {...register("nom", { required: !modeCampagne })}
          readOnly={modeCampagne}
          placeholder="Ex : Valerius l'Ancien"
          className={`bg-white/5 border-white/10 ${
            modeCampagne ? "opacity-60 pointer-events-none" : ""
          }`}
        />
        {errors.nom && (
          <p className="text-xs text-red-400">Le nom est requis.</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="gn" className="flex items-center gap-1.5 text-sm text-white/70">
            {modeCampagne && <Lock className="h-3 w-3" />}
            GN réguliers complétés{" "}
            <span className="text-white/40">(+15 XP et +1 niveau par GN)</span>
          </Label>
          <Input
            id="gn"
            type="number"
            min={0}
            readOnly={modeCampagne}
            {...register("gn_completes", {
              valueAsNumber: true,
              min: 0,
              setValueAs: (v) => {
                const n = Number(v);
                if (Number.isNaN(n) || n < 0) return 0;
                return Math.floor(n);
              },
            })}
            className={`bg-white/5 border-white/10 ${
              modeCampagne ? "opacity-60 pointer-events-none" : ""
            }`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mini" className="flex items-center gap-1.5 text-sm text-white/70">
            {modeCampagne && <Lock className="h-3 w-3" />}
            Mini-GN complétés{" "}
            <span className="text-white/40">(+15 XP par mini-GN)</span>
          </Label>
          <Input
            id="mini"
            type="number"
            min={0}
            readOnly={modeCampagne}
            {...register("mini_gn_completes", {
              valueAsNumber: true,
              min: 0,
              setValueAs: (v) => {
                const n = Number(v);
                if (Number.isNaN(n) || n < 0) return 0;
                return Math.floor(n);
              },
            })}
            className={`bg-white/5 border-white/10 ${
              modeCampagne ? "opacity-60 pointer-events-none" : ""
            }`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ouv" className="flex items-center gap-1.5 text-sm text-white/70">
            {modeCampagne && <Lock className="h-3 w-3" />}
            Ouvertures de terrain{" "}
            <span className="text-white/40">(+10 XP par ouverture)</span>
          </Label>
          <Input
            id="ouv"
            type="number"
            min={0}
            readOnly={modeCampagne}
            {...register("ouvertures_terrain", {
              valueAsNumber: true,
              min: 0,
              setValueAs: (v) => {
                const n = Number(v);
                if (Number.isNaN(n) || n < 0) return 0;
                return Math.floor(n);
              },
            })}
            className={`bg-white/5 border-white/10 ${
              modeCampagne ? "opacity-60 pointer-events-none" : ""
            }`}
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
        <Label className="flex items-center gap-1.5 text-base text-gold">
          {modeCampagne && <Lock className="h-3.5 w-3.5" />}
          Ton personnage est-il croyant ?
        </Label>
        <Controller
          control={control}
          name="est_croyant"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              disabled={modeCampagne}
              className={`flex gap-6 ${modeCampagne ? "opacity-60" : ""}`}
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
          <Label className="flex items-center gap-1.5 text-base text-gold">
            {modeCampagne && <Lock className="h-3.5 w-3.5" />}
            Religion
          </Label>
          <Controller
            control={control}
            name="religion_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={modeCampagne}>
                <SelectTrigger className={`bg-white/5 border-white/10 ${modeCampagne ? "opacity-60" : ""}`}>
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
          {(() => {
            const relChoisie = religions.find((r: any) => r.id === watch("religion_id"));
            if (!relChoisie) return null;
            return (
              <div className="rounded-lg border border-gold/20 bg-card p-4">
                <ReligionDetails
                  religion={relChoisie}
                  isManuelOpen={religionManuelOpen}
                  onToggleManuel={() => setReligionManuelOpen((v) => !v)}
                />
              </div>
            );
          })()}
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

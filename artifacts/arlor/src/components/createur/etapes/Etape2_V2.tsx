import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Info, Loader2 } from "lucide-react";

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
const JUSTIFICATION_MIN = 100;

interface Etape2Form {
  race_id: string;
  sous_type_chimeride: "carnivore" | "herbivore" | "";
  justification: string;
}

interface Race {
  id: string;
  nom: string;
  nom_latin: string | null;
  description: string | null;
  xp_depart: number | null;
  image_url: string | null;
  emoji: string | null;
  esperance_vie: string | null;
  exigences_costume: string | null;
  restrictions_classes: string[] | null;
  est_jouable: boolean;
}

const Etape2_V2 = ({ personnageId, onSuccess, onPrevious }: EtapeProps) => {
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, watch, reset, register } =
    useForm<Etape2Form>({
      defaultValues: {
        race_id: "",
        sous_type_chimeride: "",
        justification: "",
      },
    });

  const raceId = watch("race_id");
  const justification = watch("justification");

  const estChimeride = raceId === CHIMERIDE_ID;
  const estNonRace = raceId === NON_RACES_ID;
  const necessiteJustification = estChimeride || estNonRace;

  const justificationLength = (justification ?? "").trim().length;
  const justificationValide = justificationLength >= JUSTIFICATION_MIN;

  const { data: races = [], isLoading } = useQuery({
    queryKey: ["v2-races"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("races")
        .select(
          "id, nom, nom_latin, description, xp_depart, image_url, emoji, esperance_vie, exigences_costume, restrictions_classes, est_jouable"
        )
        .eq("est_actif", true)
        .eq("est_jouable", true)
        .order("nom");
      if (error) throw error;
      return (data ?? []) as Race[];
    },
  });

  const { data: parametres } = useQuery({
    queryKey: ["v2-parametres-jeu"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parametres_jeu")
        .select("lien_facebook, lien_discord, texte_envoi_photos_race")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const raceSelectionnee = races.find((r) => r.id === raceId) ?? null;

  useEffect(() => {
    const charger = async () => {
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
      reset({
        race_id: perso.race_id ?? "",
        sous_type_chimeride:
          (perso.sous_type_chimeride as "carnivore" | "herbivore" | null) ??
          "",
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
    if (
      necessiteJustification &&
      values.justification.trim().length < JUSTIFICATION_MIN
    ) {
      toast.error(
        `La justification doit faire au moins ${JUSTIFICATION_MIN} caractères.`
      );
      return;
    }

    setSubmitting(true);
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

    // Avertissements éventuels (ex. justification_race_speciale_requise,
    // demande_race_echec quand on choisit Chiméride ou Les Non-Races)
    avertissements.forEach((a) => {
      if (a.message) toast.info(a.message);
    });

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
                {races.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.emoji ? `${r.emoji} ` : ""}
                    {r.nom}
                    {r.xp_depart != null ? ` — ${r.xp_depart} XP` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Carte de détails de la race sélectionnée */}
      {raceSelectionnee && (
        <div className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-5">
          <div className="flex items-start gap-4">
            {raceSelectionnee.image_url && (
              <img
                src={raceSelectionnee.image_url}
                alt={raceSelectionnee.nom}
                className="h-24 w-24 rounded-md border border-white/10 object-cover"
              />
            )}
            <div className="flex-1 space-y-1">
              <h3 className="flex items-center gap-2 font-heading text-xl text-gold">
                {raceSelectionnee.emoji && (
                  <span>{raceSelectionnee.emoji}</span>
                )}
                <span>{raceSelectionnee.nom}</span>
              </h3>
              {raceSelectionnee.nom_latin && (
                <p className="text-xs italic text-white/50">
                  {raceSelectionnee.nom_latin}
                </p>
              )}
              {raceSelectionnee.xp_depart != null && (
                <span className="inline-block rounded-full bg-gold/15 px-3 py-0.5 text-xs text-gold">
                  XP de départ : {raceSelectionnee.xp_depart}
                </span>
              )}
            </div>
          </div>

          {(estChimeride || estNonRace) && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Race spéciale — nécessite l'approbation de l'équipe d'animation
                (voir plus bas).
              </p>
            </div>
          )}

          {raceSelectionnee.description && (
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-white/60">
                Description
              </Label>
              <p className="whitespace-pre-wrap text-sm text-white/80">
                {raceSelectionnee.description}
              </p>
            </div>
          )}

          {raceSelectionnee.esperance_vie && (
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-white/60">
                Espérance de vie
              </Label>
              <p className="text-sm text-white/80">
                {raceSelectionnee.esperance_vie}
              </p>
            </div>
          )}

          {raceSelectionnee.exigences_costume && (
            <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
              <Label className="flex items-center gap-1 text-xs uppercase tracking-wide text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                Exigences de costume
              </Label>
              <p className="whitespace-pre-wrap text-sm text-amber-100/90">
                {raceSelectionnee.exigences_costume}
              </p>
            </div>
          )}

          {raceSelectionnee.restrictions_classes &&
            raceSelectionnee.restrictions_classes.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-white/60">
                  Classes interdites
                </Label>
                <div className="flex flex-wrap gap-1">
                  {raceSelectionnee.restrictions_classes.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-200"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

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

      {/* Bloc d'approbation unifié pour Chiméride ET Non-Races */}
      {necessiteJustification && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="justif" className="text-base text-gold">
              Justification & background
            </Label>
            <p className="text-xs text-white/50">
              Cette race nécessite l'accord de l'équipe d'animation. Décris ton
              concept, ton background, ce qui motive ce choix.
            </p>
            <Textarea
              id="justif"
              rows={6}
              {...register("justification")}
              placeholder="Décris pourquoi tu choisis cette race et le background associé…"
              className="bg-white/5 border-white/10"
            />
            <div
              className={`text-xs ${
                justificationValide ? "text-emerald-400" : "text-white/50"
              }`}
            >
              {justificationLength} / {JUSTIFICATION_MIN} caractères minimum
              {justificationValide && " ✓"}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-100">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-2">
              <p>
                Ta demande sera revue par l'équipe d'animation après soumission
                de la fiche. Tu peux continuer à compléter les autres étapes en
                attendant.
              </p>
              {parametres?.texte_envoi_photos_race && (
                <p className="text-sky-100/80">
                  {parametres.texte_envoi_photos_race}
                </p>
              )}
              {(parametres?.lien_facebook || parametres?.lien_discord) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {parametres.lien_facebook && (
                    <a
                      href={parametres.lien_facebook}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs text-sky-100 transition hover:bg-sky-400/20"
                    >
                      Facebook
                    </a>
                  )}
                  {parametres.lien_discord && (
                    <a
                      href={parametres.lien_discord}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs text-sky-100 transition hover:bg-sky-400/20"
                    >
                      Discord
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
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

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Sparkles, ExternalLink, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import RaceCard from "@/components/encyclopedie/RaceCard";
import type { EtapeProps } from "@/pages/PersonnageNouveauV2";

const CHIMERIDE_ID = "926b6948-e192-4d41-9909-efabaa3059b5";
const NON_RACES_ID = "4d7e2226-76cb-4b94-9df4-b8f12ff486e1";
const RACES_VALIDATION_IDS = [CHIMERIDE_ID, NON_RACES_ID];

interface RaceRow {
  id: string;
  nom: string | null;
  nom_latin: string | null;
  emoji: string | null;
  esperance_vie: string | null;
  xp_depart: number | null;
  description: string | null;
  exigences_costume: string | null;
  nb_traits_raciaux: number | null;
  est_jouable: boolean | null;
}

interface ParametresJeu {
  lien_facebook: string | null;
  lien_discord: string | null;
  texte_envoi_photos_race: string | null;
}

interface Etape2Form {
  race_id: string;
  sous_type_chimeride: "carnivore" | "herbivore" | "";
  justification: string;
}

const Etape2_V2 = ({ personnageId, onSuccess, onPrevious }: EtapeProps) => {
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, watch, reset, setValue, register } =
    useForm<Etape2Form>({
      defaultValues: { race_id: "", sous_type_chimeride: "", justification: "" },
    });

  const raceId = watch("race_id");
  const sousTypeChimeride = watch("sous_type_chimeride");
  const justification = watch("justification");
  const estChimeride = raceId === CHIMERIDE_ID;
  const raceSpecialeSelectionnee = raceId
    ? RACES_VALIDATION_IDS.includes(raceId)
    : false;

  const { data: races = [], isLoading } = useQuery<RaceRow[]>({
    queryKey: ["v2-races"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("races")
        .select(
          "id, nom, nom_latin, emoji, esperance_vie, xp_depart, description, exigences_costume, nb_traits_raciaux, est_jouable"
        )
        .eq("est_actif", true)
        .eq("est_jouable", true)
        .order("nom");
      if (error) throw error;
      return (data ?? []) as RaceRow[];
    },
  });

  const { data: parametres } = useQuery<ParametresJeu | null>({
    queryKey: ["parametres-jeu"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("parametres_jeu")
        .select("lien_facebook, lien_discord, texte_envoi_photos_race")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ParametresJeu | null;
    },
  });

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
    const estRaceSpeciale = RACES_VALIDATION_IDS.includes(values.race_id);
    const estChimerideLocal = values.race_id === CHIMERIDE_ID;

    if (estChimerideLocal && !values.sous_type_chimeride) {
      toast.error("Choisis le sous-type Chiméride (carnivore ou herbivore).");
      return;
    }
    if (estRaceSpeciale && values.justification.trim().length < 100) {
      toast.error("La justification doit faire au moins 100 caractères.");
      return;
    }

    setSubmitting(true);
    const sousType = estChimerideLocal ? values.sous_type_chimeride : null;
    const justif = estRaceSpeciale ? values.justification.trim() : null;
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
      const erreurs =
        (payload.erreurs as Array<Record<string, unknown>> | undefined) ?? [];
      const premiereErreur = erreurs[0] ?? {};
      const code =
        (premiereErreur.code as string) ?? (payload.code as string) ?? "erreur";
      const message =
        (premiereErreur.message as string) ??
        (payload.message as string) ??
        "Sauvegarde refusée.";
      toast.error(`[${code}] ${message}`);
      return;
    }

    toast.success("Race enregistrée.");
    onSuccess();
  };

  const handleSelectRace = (id: string) => {
    setValue("race_id", id, { shouldDirty: true });
    if (id !== CHIMERIDE_ID) {
      setValue("sous_type_chimeride", "", { shouldDirty: true });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="space-y-2">
        <h2 className="font-heading text-2xl text-gold">
          Choisis la race de ton personnage
        </h2>
        <p className="text-sm text-white/50">
          Clique sur une carte pour la sélectionner.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement des races…
        </div>
      )}

      <Controller
        control={control}
        name="race_id"
        render={() => (
          <div className="grid gap-6">
            {races.map((race) => {
              const estSpeciale = RACES_VALIDATION_IDS.includes(race.id);
              const estSelectionnee = raceId === race.id;
              const estChimerideCard = race.id === CHIMERIDE_ID;

              return (
                <div key={race.id} className="space-y-0">
                  <div
                    className={`relative rounded-lg overflow-hidden transition-all cursor-pointer ${
                      estSelectionnee ? "ring-2 ring-gold" : ""
                    }`}
                    onClick={() => handleSelectRace(race.id)}
                  >
                    <RaceCard
                      id={race.id}
                      nom={race.nom ?? ""}
                      nom_latin={race.nom_latin ?? null}
                      emoji={race.emoji ?? "?"}
                      esperance_vie={race.esperance_vie ?? null}
                      xp_depart={race.xp_depart ?? 0}
                      description={race.description ?? null}
                      exigences_costume={race.exigences_costume ?? null}
                      nb_traits_raciaux={race.nb_traits_raciaux ?? 0}
                    />
                    {estSpeciale && (
                      <div className="flex items-start gap-2 border-x border-b border-red-500/60 bg-red-500/10 px-4 py-3 text-red-400 rounded-b-lg">
                        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium">
                          ⚠️ Ce concept nécessite une validation obligatoire par
                          l'organisation avant le jeu.
                        </p>
                      </div>
                    )}
                    {estSelectionnee && (
                      <div className="absolute top-2 right-2 bg-gold text-black rounded-full p-1 pointer-events-none">
                        <Sparkles size={16} />
                      </div>
                    )}
                  </div>

                  {estSelectionnee && estChimerideCard && (
                    <div className="mt-2 p-4 border border-amber-700 rounded bg-amber-900/20">
                      <p className="text-amber-300 font-semibold mb-3">
                        Choisis le type de ton Chiméride :
                      </p>
                      <p className="text-gray-400 text-sm mb-3">
                        Ce choix détermine quels traits raciaux seront
                        disponibles pour ton personnage.
                      </p>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          onClick={() =>
                            setValue("sous_type_chimeride", "carnivore", {
                              shouldDirty: true,
                            })
                          }
                          className={`px-4 py-2 rounded border font-medium transition-all ${
                            sousTypeChimeride === "carnivore"
                              ? "bg-red-900/50 border-red-500 text-red-300"
                              : "bg-transparent border-gray-600 text-gray-400 hover:border-gray-400"
                          }`}
                        >
                          🥩 Carnivore
                        </Button>
                        <Button
                          type="button"
                          onClick={() =>
                            setValue("sous_type_chimeride", "herbivore", {
                              shouldDirty: true,
                            })
                          }
                          className={`px-4 py-2 rounded border font-medium transition-all ${
                            sousTypeChimeride === "herbivore"
                              ? "bg-green-900/50 border-green-500 text-green-300"
                              : "bg-transparent border-gray-600 text-gray-400 hover:border-gray-400"
                          }`}
                        >
                          🌿 Herbivore
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      />

      {raceSpecialeSelectionnee && (
        <div className="space-y-4 rounded-lg border border-red-500/40 bg-red-900/10 p-5">
          <div className="flex items-start gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold">
              Approbation requise — remplis les informations ci-dessous avant
              de continuer.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="justif" className="text-sm font-medium">
              Background du personnage <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="justif"
              {...register("justification")}
              placeholder="Décris le background de ton personnage (minimum 100 caractères)…"
              className="min-h-[120px] bg-background/50 border-white/20 text-foreground"
            />
            <p
              className={`text-xs ${
                justification.length < 100
                  ? "text-amber-400"
                  : "text-green-400"
              }`}
            >
              {justification.length} / 100 caractères minimum
            </p>
          </div>

          <div className="rounded border border-amber-700/50 bg-amber-900/20 p-3 space-y-2 text-sm">
            <p className="font-semibold text-amber-300">
              Photos de costume requises
            </p>
            {parametres?.texte_envoi_photos_race && (
              <p className="text-amber-200/80">
                {parametres.texte_envoi_photos_race}
              </p>
            )}
            <div className="flex gap-4 flex-wrap">
              {parametres?.lien_facebook && (
                <a
                  href={parametres.lien_facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Facebook
                </a>
              )}
              {parametres?.lien_discord && (
                <a
                  href={parametres.lien_discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-indigo-400 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Discord
                </a>
              )}
            </div>
          </div>

          <div className="rounded border border-blue-500/40 bg-blue-900/20 p-3 text-sm text-blue-200">
            ℹ️ Tu pourras finaliser ton personnage, mais tu ne pourras pas
            l'inscrire à un événement tant que ta demande de race n'aura pas
            été approuvée par l'équipe d'animation.
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

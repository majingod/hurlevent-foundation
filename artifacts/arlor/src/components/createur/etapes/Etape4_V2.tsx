import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EtapeProps } from "@/pages/PersonnageNouveauV2";

interface Etape4Form {
  classe_id: string;
}

interface CompetenceGratuite {
  niveau: number;
  competence_id: string;
}

interface CompetenceInfo {
  id: string;
  nom: string;
  type_choix: string | null;
}

const Etape4_V2 = ({ personnageId, onSuccess, onPrevious }: EtapeProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [choixParCompetence, setChoixParCompetence] = useState<
    Record<string, string>
  >({});
  const [devenirCroyant, setDevenirCroyant] = useState(true);

  const { control, handleSubmit, reset, watch } = useForm<Etape4Form>({
    defaultValues: { classe_id: "" },
  });

  const classeIdSelectionnee = watch("classe_id");

  const { data: perso } = useQuery({
    queryKey: ["v2-perso-classe", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnages")
        .select("classe_id, race_id, religion_id, est_croyant")
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
        .select(
          "id, nom, description, emoji, role_combat, pv_depart, ps_depart, competences_gratuites"
        )
        .eq("est_actif", true)
        .order("nom");
      if (error) throw error;
      return data ?? [];
    },
  });

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
        (c: any) =>
          !restrictions.includes(c.id) && !restrictions.includes(c.nom)
      )
    : classes;

  const classeSelectionnee = useMemo(
    () => classes.find((c: any) => c.id === classeIdSelectionnee) ?? null,
    [classes, classeIdSelectionnee]
  );

  const competencesGratuites: CompetenceGratuite[] = useMemo(() => {
    const raw = (classeSelectionnee as any)?.competences_gratuites;
    return Array.isArray(raw) ? (raw as CompetenceGratuite[]) : [];
  }, [classeSelectionnee]);

  const competencesGratuitesIds = useMemo(
    () => competencesGratuites.map((g) => g.competence_id),
    [competencesGratuites]
  );

  const { data: infosCompetences = [] } = useQuery({
    queryKey: ["v2-infos-comp-gratuites", competencesGratuitesIds.join(",")],
    enabled: competencesGratuitesIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competences")
        .select("id, nom, type_choix")
        .in("id", competencesGratuitesIds);
      if (error) throw error;
      return (data ?? []) as CompetenceInfo[];
    },
  });

  const competencesAvecChoix = useMemo(
    () => infosCompetences.filter((c) => c.type_choix !== null),
    [infosCompetences]
  );

  const aBesoinChoixReligion = competencesAvecChoix.some(
    (c) => c.type_choix === "religion"
  );
  const aBesoinChoixLangueAncienne = competencesAvecChoix.some(
    (c) => c.type_choix === "langue_ancienne"
  );

  const { data: languesAnciennes = [] } = useQuery({
    queryKey: ["v2-langues-anciennes"],
    enabled: aBesoinChoixLangueAncienne,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("langues")
        .select("id, nom, ordre")
        .eq("est_ancienne", true)
        .eq("est_actif", true)
        .order("ordre", { ascending: true })
        .order("nom");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: religions = [] } = useQuery({
    queryKey: ["v2-religions"],
    enabled: aBesoinChoixReligion,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("religions")
        .select("id, nom")
        .eq("est_actif", true)
        .order("nom");
      if (error) throw error;
      return data ?? [];
    },
  });

  const dejaCroyant = !!perso?.est_croyant && !!perso?.religion_id;

  // Auto-remplir le choix religion si déjà croyant
  useEffect(() => {
    if (dejaCroyant && perso?.religion_id) {
      const compReligion = competencesAvecChoix.find(
        (c) => c.type_choix === "religion"
      );
      if (compReligion) {
        setChoixParCompetence((prev) => ({
          ...prev,
          [compReligion.id]: perso.religion_id!,
        }));
      }
    }
  }, [dejaCroyant, perso?.religion_id, competencesAvecChoix]);

  useEffect(() => {
    if (perso?.classe_id) reset({ classe_id: perso.classe_id });
  }, [perso, reset]);

  const onSubmit = async (values: Etape4Form) => {
    if (!values.classe_id) {
      toast.error("Choisis une classe.");
      return;
    }

    // Valider les choix obligatoires
    for (const c of competencesAvecChoix) {
      if (!choixParCompetence[c.id]) {
        const typeNom =
          c.type_choix === "religion" ? "religion" : "langue ancienne";
        toast.error(`Un choix de ${typeNom} est requis pour : ${c.nom}.`);
        return;
      }
    }

    setSubmitting(true);

    // UPDATE personnage si Prêtre + nouveau croyant
    const compReligion = competencesAvecChoix.find(
      (c) => c.type_choix === "religion"
    );
    const religionChoisie = compReligion
      ? choixParCompetence[compReligion.id]
      : null;

    if (compReligion && religionChoisie && !dejaCroyant && devenirCroyant) {
      const { error: errUpdate } = await supabase
        .from("personnages")
        .update({ religion_id: religionChoisie, est_croyant: true })
        .eq("id", personnageId);
      if (errUpdate) {
        setSubmitting(false);
        console.error("[V2 Etape4] UPDATE personnage error:", errUpdate);
        toast.error(`Erreur : ${errUpdate.message}`);
        return;
      }
    }

    // Construire un objet de choix propre (filtré sur les compétences pertinentes)
    const choixFinaux: Record<string, string> = {};
    for (const c of competencesAvecChoix) {
      if (choixParCompetence[c.id]) {
        choixFinaux[c.id] = choixParCompetence[c.id];
      }
    }

    const { data, error } = await supabase.rpc("sauvegarder_etape_4", {
      p_personnage_id: personnageId,
      p_classe_id: values.classe_id,
      p_choix_par_competence: choixFinaux,
    });
    setSubmitting(false);

    if (error) {
      console.error("[V2 Etape4] RPC error:", error);
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    const payload = (data ?? {}) as Record<string, unknown>;
    if (payload.succes === false) {
      const erreurs = (payload.erreurs as Array<any>) ?? [];
      const code = erreurs[0]?.code ?? "erreur";
      const message = erreurs[0]?.message ?? "Sauvegarde refusée.";
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
                        <p className="whitespace-pre-wrap text-sm text-white/70">
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

      {/* Bloc Choix requis (conditionnel) */}
      {competencesAvecChoix.length > 0 && (
        <div className="space-y-4 rounded-lg border border-gold/20 bg-gold/5 p-4">
          <div className="space-y-1">
            <h3 className="font-heading text-lg text-gold">Choix requis</h3>
            <p className="text-xs text-white/60">
              Cette classe vous attribue gratuitement des compétences.
              Certaines nécessitent un choix.
            </p>
          </div>

          {competencesAvecChoix.map((c) => {
            if (c.type_choix === "langue_ancienne") {
              return (
                <div key={c.id} className="space-y-2">
                  <Label className="text-sm text-gold">
                    {c.nom} — langue ancienne
                  </Label>
                  <Select
                    value={choixParCompetence[c.id] ?? ""}
                    onValueChange={(v) =>
                      setChoixParCompetence((prev) => ({
                        ...prev,
                        [c.id]: v,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue placeholder="Choisis une langue ancienne" />
                    </SelectTrigger>
                    <SelectContent>
                      {languesAnciennes.map((l: any) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            if (c.type_choix === "religion") {
              return (
                <div key={c.id} className="space-y-3">
                  <Label className="text-sm text-gold">
                    {c.nom} — religion
                  </Label>
                  {dejaCroyant ? (
                    <p className="rounded-md border border-sky-500/30 bg-sky-500/10 p-2 text-xs text-sky-100">
                      Ta religion actuelle sera utilisée automatiquement.
                    </p>
                  ) : (
                    <>
                      <Select
                        value={choixParCompetence[c.id] ?? ""}
                        onValueChange={(v) =>
                          setChoixParCompetence((prev) => ({
                            ...prev,
                            [c.id]: v,
                          }))
                        }
                      >
                        <SelectTrigger className="bg-white/5 border-white/10">
                          <SelectValue placeholder="Choisis une religion" />
                        </SelectTrigger>
                        <SelectContent>
                          {religions.map((r: any) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.nom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <label className="flex items-start gap-2 text-xs text-white/70">
                        <Checkbox
                          checked={devenirCroyant}
                          onCheckedChange={(v) =>
                            setDevenirCroyant(v === true)
                          }
                          className="mt-0.5"
                        />
                        <span>
                          Mon personnage devient croyant de cette religion
                          (modifie aussi son statut de croyance).
                        </span>
                      </label>
                    </>
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>
      )}

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

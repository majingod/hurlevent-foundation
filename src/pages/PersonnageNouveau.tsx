import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronLeft, ChevronRight, Shield, Sparkles } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import Step3Classe from "@/components/creation/Step3Classe";
import Step4Competences from "@/components/creation/Step4Competences";
import Step5Sorts from "@/components/creation/Step5Sorts";
import Step6Prieres from "@/components/creation/Step6Prieres";
import Step7Artisanat from "@/components/creation/Step7Artisanat";
import Step8Runes from "@/components/creation/Step8Runes";
import Step9Historique from "@/components/creation/Step9Historique";
import Step10Recapitulatif from "@/components/creation/Step10Recapitulatif";

const TOTAL_STEPS = 10;
const CHIMERIDE_NOM = "Chiméride";

interface TraitChoisi {
  id: string;
  nom: string;
  gratuit: boolean;
  xp_depense: number;
}

const PersonnageNouveau = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [etape, setEtape] = useState(1);
  const [saving, setSaving] = useState(false);
  const [personnageId, setPersonnageId] = useState<string | null>(null);

  // Step 1 fields
  const [nomPersonnage, setNomPersonnage] = useState("");
  const [estCroyant, setEstCroyant] = useState(false);
  const [religionId, setReligionId] = useState<string | null>(null);
  const [gnCompletes, setGnCompletes] = useState(0);
  const [miniGnCompletes, setMiniGnCompletes] = useState(0);
  const [ouverturesTerrain, setOuverturesTerrain] = useState(0);

  // Step 2 fields
  const [raceId, setRaceId] = useState<string | null>(null);
  const [sousTypeChimeride, setSousTypeChimeride] = useState<string | null>(null);
  const [traitObligatoireId, setTraitObligatoireId] = useState<string | null>(null);
  const [traitsOptionnels, setTraitsOptionnels] = useState<string[]>([]);

  // Step 3 fields
  const [classeId, setClasseId] = useState<string | null>(null);
  const [pvMax, setPvMax] = useState(4);
  const [psMax, setPsMax] = useState(5);
  const [familleCriminelleId, setFamilleCriminelleId] = useState<string | null>(null);

  // Step 4-6 XP tracking
  const [step4XpSpent, setStep4XpSpent] = useState(0);
  const [step5XpSpent, setStep5XpSpent] = useState(0);
  const [step6XpSpent, setStep6XpSpent] = useState(0);

  // Step 7-8 XP tracking
  const [step7XpSpent, setStep7XpSpent] = useState(0);
  const [step8XpSpent, setStep8XpSpent] = useState(0);

  // Step 9 fields (Historique et Âme)
  const [historique, setHistorique] = useState("");
  const [amePersonnage, setAmePersonnage] = useState("");

  // Step 10 fields (loaded from DB)
  const [step10Data, setStep10Data] = useState<any>(null);

  // Profile
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nom_affichage")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Religions
  const { data: religions } = useQuery({
    queryKey: ["religions-actives"],
    queryFn: async () => {
      const { data } = await supabase
        .from("religions")
        .select("*")
        .eq("est_actif", true)
        .order("nom");
      return data ?? [];
    },
  });

  // Classes
  const { data: classes } = useQuery({
    queryKey: ["classes-actives"],
    queryFn: async () => {
      const { data } = await supabase
        .from("classes")
        .select("*")
        .eq("est_actif", true)
        .order("nom");
      return data ?? [];
    },
  });

  // Races
  const { data: races } = useQuery({
    queryKey: ["races-actives"],
    queryFn: async () => {
      const { data } = await supabase
        .from("races")
        .select("*")
        .eq("est_actif", true)
        .order("nom");
      return data ?? [];
    },
  });

  // Traits raciaux via vue
  const selectedRace = races?.find((r) => r.id === raceId);
  const isChimeride = selectedRace?.nom === CHIMERIDE_NOM;

  const { data: traitsRaciaux } = useQuery({
    queryKey: ["traits-raciaux", raceId, sousTypeChimeride],
    queryFn: async () => {
      let query = supabase
        .from("vue_traits_par_race")
        .select("*")
        .eq("race_id", raceId!)
        .eq("est_actif", true);

      if (isChimeride && sousTypeChimeride) {
        query = query.eq("sous_type", sousTypeChimeride);
      }

      const { data } = await query;
      return data ?? [];
    },
    enabled: !!raceId && (!isChimeride || !!sousTypeChimeride),
  });

  // Reset traits when race changes
  useEffect(() => {
    setTraitObligatoireId(null);
    setTraitsOptionnels([]);
    setSousTypeChimeride(null);
  }, [raceId]);

  useEffect(() => {
    setTraitObligatoireId(null);
    setTraitsOptionnels([]);
  }, [sousTypeChimeride]);

  // Reset religion when toggle off
  useEffect(() => {
    if (!estCroyant) setReligionId(null);
  }, [estCroyant]);

  // XP calculations
  const niveau = 1 + gnCompletes;
  const xpFromExperience = gnCompletes * 15 + miniGnCompletes * 15 + ouverturesTerrain * 10;
  const xpDepart = selectedRace?.xp_depart ?? 0;
  const xpTotal = etape >= 2 && raceId ? xpDepart + xpFromExperience : 0;
  const xpTraitsOptionnels = traitsOptionnels.length * 10;
  const xpDepense = xpTraitsOptionnels + step4XpSpent + step5XpSpent + step6XpSpent + step7XpSpent + step8XpSpent;
  const xpDisponible = xpTotal - xpDepense;

  // Selected class info
  const selectedClasse = classes?.find((c) => c.id === classeId);
  const classeNom = selectedClasse?.nom ?? "";
  const competencesGratuites: string[] = selectedClasse?.competences_gratuites
    ? (Array.isArray(selectedClasse.competences_gratuites)
      ? selectedClasse.competences_gratuites.map(String)
      : [])
    : [];

  // Update PV/PS when class changes
  useEffect(() => {
    if (selectedClasse) {
      setPvMax(selectedClasse.pv_depart ?? 4);
      setPsMax(selectedClasse.ps_depart ?? 5);
    }
  }, [classeId, selectedClasse]);

  // État magie/divin du personnage (pour conditionner étapes 5, 6 et 8)
  const { data: etatPersonnage } = useQuery({
    queryKey: ["etat-personnage-magie", personnageId, etape],
    queryFn: async () => {
      if (!personnageId) return null;
      const { data } = await supabase
        .from("vue_personnage_etat")
        .select("niveau_cercle, niveau_domaine, niveau_runes, quota_assemblages_total")
        .eq("personnage_id", personnageId)
        .maybeSingle();
      return data;
    },
    enabled: !!personnageId && etape >= 4,
  });

  const aCercle = (etatPersonnage?.niveau_cercle ?? 0) >= 1;
  const aDomaine = (etatPersonnage?.niveau_domaine ?? 0) >= 1;
  const niveauRunes = (etatPersonnage?.niveau_runes ?? 0) >= 1;

  // Validation
  const isStep1Valid = nomPersonnage.trim().length >= 2 && nomPersonnage.trim().length <= 50 && (!estCroyant || religionId);
  const isStep2Valid = raceId && (!isChimeride || sousTypeChimeride) && traitObligatoireId && selectedRace?.est_jouable !== false;
  const isStep3Valid = !!classeId && (classeNom !== "Prêtre" || !!religionId);
  const isStep4Valid = true; // Purchases are optional
  const isStep5Valid = true;
  const isStep6Valid = true;
  const isStep7Valid = true; // Artisanat is optional
  const isStep8Valid = true; // Runes are optional
  const isStep9Valid = true; // Historique is optional
  const isStep10Valid = true; // Recap is always valid

  const canGoNext =
    etape === 1 ? isStep1Valid :
    etape === 2 ? isStep2Valid :
    etape === 3 ? isStep3Valid :
    etape === 4 ? isStep4Valid :
    etape === 5 ? isStep5Valid :
    etape === 6 ? isStep6Valid :
    etape === 7 ? isStep7Valid :
    etape === 8 ? isStep8Valid :
    etape === 9 ? isStep9Valid :
    etape === 10 ? isStep10Valid :
    false;

  // Auto-skip étape 5 si pas de cercle, étape 6 si pas de domaine, étape 8 si pas de runes
  useEffect(() => {
    if (etape === 5 && etatPersonnage && !aCercle) {
      setEtape(aDomaine ? 6 : 7);
    } else if (etape === 6 && etatPersonnage && !aDomaine) {
      setEtape(7);
    } else if (etape === 8 && etatPersonnage && !niveauRunes) {
      setEtape(9);
    }
  }, [etape, etatPersonnage, aCercle, aDomaine, niveauRunes]);

  const buildTraitsJson = (): TraitChoisi[] => {
    const result: TraitChoisi[] = [];
    if (traitObligatoireId) {
      const t = traitsRaciaux?.find((tr) => tr.trait_id === traitObligatoireId);
      if (t) result.push({ id: t.trait_id!, nom: t.trait_nom!, gratuit: true, xp_depense: 0 });
    }
    traitsOptionnels.forEach((tid) => {
      const t = traitsRaciaux?.find((tr) => tr.trait_id === tid);
      if (t) result.push({ id: t.trait_id!, nom: t.trait_nom!, gratuit: false, xp_depense: 10 });
    });
    return result;
  };

  const saveStep = async (step: number) => {
    if (!user) return;
    setSaving(true);

    try {
      if (step === 1) {
        // Create or update personnage
        if (personnageId) {
          const { error } = await supabase
            .from("personnages")
            .update({
              nom: nomPersonnage.trim(),
              religion_id: religionId,
              gn_completes: gnCompletes,
              mini_gn_completes: miniGnCompletes,
              ouvertures_terrain: ouverturesTerrain,
              niveau,
              etape_creation: 1,
            })
            .eq("id", personnageId);
          if (error) throw error;
        } else {
          const newId = crypto.randomUUID();
          const { error } = await supabase.from("personnages").insert({
            id: newId,
            joueur_id: user.id,
            nom: nomPersonnage.trim(),
            religion_id: religionId,
            gn_completes: gnCompletes,
            mini_gn_completes: miniGnCompletes,
            ouvertures_terrain: ouverturesTerrain,
            niveau,
            etape_creation: 1,
          });
          if (error) throw error;
          setPersonnageId(newId);
        }
      } else if (step === 2) {
        if (!personnageId) throw new Error("Personnage non créé");
        const traitsJson = buildTraitsJson();
        const { error } = await supabase
          .from("personnages")
          .update({
            race_id: raceId,
            traits_raciaux_choisis: traitsJson as unknown as Json,
            xp_total: xpTotal,
            xp_depense: xpDepense,
            etape_creation: 2,
          })
          .eq("id", personnageId);
        if (error) throw error;
      } else if (step === 3) {
        if (!personnageId) throw new Error("Personnage non créé");
        const { error } = await supabase
          .from("personnages")
          .update({
            classe_id: classeId,
            religion_id: religionId,
            pv_max: pvMax,
            ps_max: psMax,
            etape_creation: 3,
          })
          .eq("id", personnageId);
        if (error) throw error;
      } else if (step === 4) {
        if (!personnageId) throw new Error("Personnage non créé");
        const { error } = await supabase
          .from("personnages")
          .update({
            xp_depense: xpDepense,
            ps_max: psMax,
            famille_criminelle_id: familleCriminelleId,
            religion_id: religionId,
            etape_creation: 4,
          })
          .eq("id", personnageId);
        if (error) throw error;
      } else if (step === 5 || step === 6) {
        if (!personnageId) throw new Error("Personnage non créé");
        const { error } = await supabase
          .from("personnages")
          .update({
            xp_depense: xpDepense,
            etape_creation: step,
          })
          .eq("id", personnageId);
        if (error) throw error;
      } else if (step === 7 || step === 8) {
        if (!personnageId) throw new Error("Personnage non créé");
        const { error } = await supabase
          .from("personnages")
          .update({
            xp_depense: xpDepense,
            etape_creation: step,
          })
          .eq("id", personnageId);
        if (error) throw error;
      } else if (step === 9) {
        if (!personnageId) throw new Error("Personnage non créé");
        const { error } = await supabase
          .from("personnages")
          .update({
            historique: historique.trim(),
            ame_personnage: amePersonnage.trim(),
            etape_creation: 9,
          })
          .eq("id", personnageId);
        if (error) throw error;
      } else if (step === 10) {
        if (!personnageId) throw new Error("Personnage non créé");
        const { error } = await supabase
          .from("personnages")
          .update({
            est_actif: true,
            etape_creation: 10,
          })
          .eq("id", personnageId);
        if (error) throw error;
        toast.success("Personnage créé avec succès !");
        setTimeout(() => navigate(`/personnage/${personnageId}`), 1500);
        return;
      }

      setEtape(step + 1);
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de la sauvegarde. Veuillez réessayer.");
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (!canGoNext) return;
    saveStep(etape);
  };

  const handlePrevious = () => {
    if (etape > 1) setEtape(etape - 1);
  };

  // Unique trait ids (deduplicate by trait_id)
  const uniqueTraits = useMemo(() => {
    if (!traitsRaciaux) return [];
    const seen = new Set<string>();
    return traitsRaciaux.filter((t) => {
      if (!t.trait_id || seen.has(t.trait_id)) return false;
      seen.add(t.trait_id);
      return true;
    });
  }, [traitsRaciaux]);

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <h1 className="font-heading text-3xl font-bold text-primary">Créateur de personnage</h1>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Étape {etape} sur {TOTAL_STEPS}</span>
          <span>{Math.round((etape / TOTAL_STEPS) * 100)}%</span>
        </div>
        <Progress value={(etape / TOTAL_STEPS) * 100} />
      </div>

      {/* XP counter */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-card p-4 text-sm">
        <span>
          <Sparkles className="inline h-4 w-4 text-primary mr-1" />
          XP disponible : <strong className="text-primary">{xpTotal > 0 ? xpDisponible : "—"}</strong>
        </span>
        <span>XP dépensé : <strong>{xpDepense}</strong></span>
        <span>XP total : <strong>{xpTotal > 0 ? xpTotal : "—"}</strong></span>
      </div>

      {/* Steps */}
      {etape === 1 && (
        <Step1
          nomAffichage={profile?.nom_affichage ?? ""}
          nomPersonnage={nomPersonnage}
          setNomPersonnage={setNomPersonnage}
          estCroyant={estCroyant}
          setEstCroyant={setEstCroyant}
          religionId={religionId}
          setReligionId={setReligionId}
          religions={religions ?? []}
          gnCompletes={gnCompletes}
          setGnCompletes={setGnCompletes}
          miniGnCompletes={miniGnCompletes}
          setMiniGnCompletes={setMiniGnCompletes}
          ouverturesTerrain={ouverturesTerrain}
          setOuverturesTerrain={setOuverturesTerrain}
          niveau={niveau}
        />
      )}

      {etape === 2 && (
        <Step2
          races={races ?? []}
          raceId={raceId}
          setRaceId={setRaceId}
          isChimeride={isChimeride}
          sousTypeChimeride={sousTypeChimeride}
          setSousTypeChimeride={setSousTypeChimeride}
          uniqueTraits={uniqueTraits}
          traitObligatoireId={traitObligatoireId}
          setTraitObligatoireId={setTraitObligatoireId}
          traitsOptionnels={traitsOptionnels}
          setTraitsOptionnels={setTraitsOptionnels}
          xpDisponible={xpDisponible}
          xpTotal={xpTotal}
          xpFromExperience={xpFromExperience}
        />
      )}

      {etape === 3 && (
        <Step3Classe
          classes={classes ?? []}
          classeId={classeId}
          setClasseId={setClasseId}
          religions={religions ?? []}
          religionId={religionId}
          setReligionId={setReligionId}
          estCroyant={estCroyant}
        />
      )}

      {etape === 4 && personnageId && classeId && (
        <Step4Competences
          personnageId={personnageId}
          classeNom={classeNom}
          classeId={classeId}
          religionId={religionId}
          setReligionId={setReligionId}
          familleCriminelleId={familleCriminelleId}
          setFamilleCriminelleId={setFamilleCriminelleId}
          xpDisponible={xpDisponible}
          xpDepense={xpDepense}
          onXpSpent={(amount) => setStep4XpSpent((prev) => prev + amount)}
          psMax={psMax}
          onPsMaxChange={setPsMax}
          competencesGratuites={competencesGratuites}
          religions={religions ?? []}
        />
      )}

      {etape === 5 && personnageId && aCercle && (
        <Step5Sorts
          personnageId={personnageId}
          niveauPersonnage={niveau}
          xpDisponible={xpDisponible}
          onXpSpent={(amount) => setStep5XpSpent((prev) => prev + amount)}
        />
      )}

      {etape === 6 && personnageId && aDomaine && (
        <Step6Prieres
          personnageId={personnageId}
          niveauPersonnage={niveau}
          xpDisponible={xpDisponible}
          religionId={religionId}
          onXpSpent={(amount) => setStep6XpSpent((prev) => prev + amount)}
        />
      )}

      {etape === 7 && personnageId && etatPersonnage && (
        <Step7Artisanat
          personnageId={personnageId}
          xpDisponible={xpDisponible}
          xpDepense={xpDepense}
          onXpSpent={(amount) => setStep7XpSpent((prev) => prev + amount)}
        />
      )}

      {etape === 8 && personnageId && niveauRunes && etatPersonnage && (
        <Step8Runes
          personnageId={personnageId}
          niveauRunes={etatPersonnage.niveau_runes ?? 0}
          quotaAssemblages={etatPersonnage.quota_assemblages_total ?? 0}
          xpDisponible={xpDisponible}
          xpDepense={xpDepense}
          onXpSpent={(amount) => setStep8XpSpent((prev) => prev + amount)}
        />
      )}

      {etape === 9 && (
        <Step9Historique
          historique={historique}
          setHistorique={setHistorique}
          amePersonnage={amePersonnage}
          setAmePersonnage={setAmePersonnage}
        />
      )}

      {etape === 10 && personnageId && selectedRace && selectedClasse && (
        <Step10Recapitulatif
          personnageId={personnageId}
          nomPersonnage={nomPersonnage}
          raceNom={selectedRace.nom ?? ""}
          raceNomLatin={selectedRace.nom_latin ?? null}
          classeNom={classeNom}
          niveau={niveau}
          xpTotal={xpTotal}
          xpDepense={xpDepense}
          religionNom={religions?.find((r) => r.id === religionId)?.nom ?? null}
          familleCriminelleNom={null}
          gnCompletes={gnCompletes}
          miniGnCompletes={miniGnCompletes}
          ouverturesTerrain={ouverturesTerrain}
          pvMax={pvMax}
          psMax={psMax}
          historique={historique}
          amePersonnage={amePersonnage}
          traitObligatoire={traitsRaciaux?.find((t) => t.trait_id === traitObligatoireId)}
          traitsOptionnels={traitsOptionnels.map((tid) => traitsRaciaux?.find((t) => t.trait_id === tid)).filter(Boolean)}
        />
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handlePrevious} disabled={etape <= 1}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Précédent
        </Button>
        <Button onClick={handleNext} disabled={!canGoNext || saving}>
          {saving ? "Sauvegarde…" : "Suivant"} <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

/* ============== STEP 1 ============== */

interface Step1Props {
  nomAffichage: string;
  nomPersonnage: string;
  setNomPersonnage: (v: string) => void;
  estCroyant: boolean;
  setEstCroyant: (v: boolean) => void;
  religionId: string | null;
  setReligionId: (v: string | null) => void;
  religions: any[];
  gnCompletes: number;
  setGnCompletes: (v: number) => void;
  miniGnCompletes: number;
  setMiniGnCompletes: (v: number) => void;
  ouverturesTerrain: number;
  setOuverturesTerrain: (v: number) => void;
  niveau: number;
}

const Step1 = ({
  nomAffichage, nomPersonnage, setNomPersonnage,
  estCroyant, setEstCroyant, religionId, setReligionId, religions,
  gnCompletes, setGnCompletes, miniGnCompletes, setMiniGnCompletes,
  ouverturesTerrain, setOuverturesTerrain, niveau,
}: Step1Props) => (
  <div className="space-y-6">
    <h2 className="font-heading text-xl font-semibold text-foreground">
      Étape 1 — Nom, religion et expérience
    </h2>

    {/* Nom utilisateur */}
    <div className="space-y-2">
      <Label>Nom d'utilisateur</Label>
      <Input value={nomAffichage} readOnly className="opacity-60" />
    </div>

    {/* Nom personnage */}
    <div className="space-y-2">
      <Label htmlFor="nom-personnage">Nom du personnage *</Label>
      <Input
        id="nom-personnage"
        value={nomPersonnage}
        onChange={(e) => setNomPersonnage(e.target.value)}
        placeholder="Ex: Aldric le Brave"
        maxLength={50}
      />
      {nomPersonnage.length > 0 && nomPersonnage.trim().length < 2 && (
        <p className="text-sm text-destructive">Minimum 2 caractères.</p>
      )}
    </div>

    {/* Croyant */}
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch checked={estCroyant} onCheckedChange={setEstCroyant} />
        <Label>Croyant ?</Label>
      </div>

      {estCroyant && (
        <div className="grid gap-3 sm:grid-cols-2">
          {religions.map((rel) => (
            <Card
              key={rel.id}
              className={`cursor-pointer transition-all hover:border-primary/50 ${
                religionId === rel.id ? "border-2 border-primary ring-2 ring-primary/20" : ""
              }`}
              onClick={() => setReligionId(rel.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading">{rel.nom}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {rel.domaines_principaux && (
                  <p className="text-muted-foreground">
                    Domaines : {rel.domaines_principaux.join(", ")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground italic">
                  Le pouvoir du symbole n'est accessible qu'à la classe Prêtre.
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Attention : certains domaines de prière sont proscrits par cette religion.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>

    {/* GN / Mini-GN / Ouvertures */}
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="gn">GN complétés</Label>
        <Input
          id="gn"
          type="number"
          min={0}
          value={gnCompletes}
          onChange={(e) => setGnCompletes(Math.max(0, parseInt(e.target.value) || 0))}
        />
        <p className="text-xs text-muted-foreground">+15 XP et +1 niveau par GN</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="mini-gn">Mini-GN complétés</Label>
        <Input
          id="mini-gn"
          type="number"
          min={0}
          value={miniGnCompletes}
          onChange={(e) => setMiniGnCompletes(Math.max(0, parseInt(e.target.value) || 0))}
        />
        <p className="text-xs text-muted-foreground">+15 XP seulement</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ouvertures">Ouvertures de terrain</Label>
        <Input
          id="ouvertures"
          type="number"
          min={0}
          value={ouverturesTerrain}
          onChange={(e) => setOuverturesTerrain(Math.max(0, parseInt(e.target.value) || 0))}
        />
        <p className="text-xs text-muted-foreground">+10 XP seulement</p>
      </div>
    </div>

    <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-1">
      <p>Niveau : <strong className="text-primary">{niveau}</strong></p>
      <p className="text-muted-foreground">XP total : sera calculé à l'étape 2 après le choix de la race.</p>
    </div>
  </div>
);

/* ============== STEP 2 ============== */

interface Step2Props {
  races: any[];
  raceId: string | null;
  setRaceId: (v: string | null) => void;
  isChimeride: boolean;
  sousTypeChimeride: string | null;
  setSousTypeChimeride: (v: string | null) => void;
  uniqueTraits: any[];
  traitObligatoireId: string | null;
  setTraitObligatoireId: (v: string | null) => void;
  traitsOptionnels: string[];
  setTraitsOptionnels: (v: string[]) => void;
  xpDisponible: number;
  xpTotal: number;
  xpFromExperience: number;
}

const Step2 = ({
  races, raceId, setRaceId, isChimeride, sousTypeChimeride, setSousTypeChimeride,
  uniqueTraits, traitObligatoireId, setTraitObligatoireId,
  traitsOptionnels, setTraitsOptionnels, xpDisponible, xpTotal, xpFromExperience,
}: Step2Props) => {
  const selectedRace = races.find((r) => r.id === raceId);

  const toggleOptional = (traitId: string) => {
    if (traitsOptionnels.includes(traitId)) {
      setTraitsOptionnels(traitsOptionnels.filter((id) => id !== traitId));
    } else {
      // Check XP
      if (xpDisponible < 10) {
        toast.error("XP insuffisant pour ce trait (10 XP requis).");
        return;
      }
      setTraitsOptionnels([...traitsOptionnels, traitId]);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold text-foreground">
        Étape 2 — Choix de la race et traits raciaux
      </h2>

      {/* Race selection */}
      <div className="grid gap-3 sm:grid-cols-2">
        {races.map((race) => {
          const jouable = race.est_jouable !== false;
          return (
            <Card
              key={race.id}
              className={`transition-all ${
                jouable ? "cursor-pointer hover:border-primary/50" : "opacity-50 cursor-not-allowed"
              } ${raceId === race.id ? "border-2 border-primary ring-2 ring-primary/20" : ""}`}
              onClick={() => jouable && setRaceId(race.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-heading">{race.nom}</CardTitle>
                  {!jouable && <Badge variant="secondary">Non jouable</Badge>}
                </div>
                {race.nom_latin && (
                  <CardDescription className="italic">{race.nom_latin}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {race.esperance_vie && (
                  <p className="text-muted-foreground">Espérance de vie : {race.esperance_vie}</p>
                )}
                <p>XP de départ : <strong className="text-primary">{race.xp_depart}</strong></p>
                {race.exigences_costume && (
                  <Badge className="mt-1 bg-orange-600/20 text-orange-400 border-orange-600/30">
                    Costume requis : {race.exigences_costume}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chiméride sub-type */}
      {isChimeride && raceId && (
        <div className="space-y-3">
          <Label className="text-base">Type de Chiméride *</Label>
          <div className="flex gap-3">
            {["carnivore", "herbivore"].map((type) => (
              <Button
                key={type}
                variant={sousTypeChimeride === type ? "default" : "outline"}
                onClick={() => setSousTypeChimeride(type)}
                className="capitalize"
              >
                {type}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* XP summary after race selection */}
      {raceId && selectedRace && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <p>
            XP total : <strong className="text-primary">{xpTotal}</strong>{" "}
            <span className="text-muted-foreground">
              ({selectedRace.xp_depart} de départ + {xpFromExperience} d'expérience)
            </span>
          </p>
        </div>
      )}

      {/* Racial traits */}
      {uniqueTraits.length > 0 && (
        <div className="space-y-6">
          {/* Obligatory trait */}
          <div className="space-y-3">
            <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Trait racial obligatoire (gratuit)
            </h3>
            <RadioGroup
              value={traitObligatoireId ?? ""}
              onValueChange={setTraitObligatoireId}
              className="space-y-2"
            >
              {uniqueTraits.map((t) => (
                <label
                  key={t.trait_id}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all hover:border-primary/50 ${
                    traitObligatoireId === t.trait_id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <RadioGroupItem value={t.trait_id!} className="mt-1" />
                  <div className="space-y-1">
                    <p className="font-medium">{t.trait_nom}</p>
                    <p className="text-sm text-muted-foreground">{t.trait_description}</p>
                    <Badge variant="secondary">Gratuit</Badge>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Optional traits */}
          <div className="space-y-3">
            <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Traits optionnels (10 XP chacun)
            </h3>
            <div className="space-y-2">
              {uniqueTraits
                .filter((t) => t.trait_id !== traitObligatoireId)
                .map((t) => {
                  const checked = traitsOptionnels.includes(t.trait_id!);
                  return (
                    <label
                      key={`opt-${t.trait_id}`}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all hover:border-primary/50 ${
                        checked ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleOptional(t.trait_id!)}
                        className="mt-1"
                      />
                      <div className="space-y-1">
                        <p className="font-medium">{t.trait_nom}</p>
                        <p className="text-sm text-muted-foreground">{t.trait_description}</p>
                        <Badge variant="outline">10 XP</Badge>
                      </div>
                    </label>
                  );
                })}
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>
              Attention : une fois le personnage finalisé, vous ne pourrez plus modifier ni ajouter de traits raciaux.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonnageNouveau;

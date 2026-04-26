import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import ReligionCard from "@/components/encyclopedie/ReligionCard";

// Imports des étapes séparées
import Step2Race from "@/components/creation/Step2Race";
import Step3TraitsRaciaux from "@/components/creation/Step3TraitsRaciaux";
import Step3Classe from "@/components/creation/Step3Classe";
import Step4Competences from "@/components/creation/Step4Competences";
import Step5Sorts from "@/components/creation/Step5Sorts";
import Step6Prieres from "@/components/creation/Step6Prieres";
import Step7Artisanat from "@/components/creation/Step7Artisanat";
import Step8Runes from "@/components/creation/Step8Runes";
import Step9Historique from "@/components/creation/Step9Historique";
import Step10Recap from "@/components/creation/Step10Recap";

const TOTAL_STEPS = 11;

const PersonnageNouveau = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idParam = searchParams.get("id");
  const etapeParam = searchParams.get("etape");

  // États de base
  const [etape, setEtape] = useState(etapeParam ? Math.max(1, Math.min(parseInt(etapeParam), TOTAL_STEPS)) : 1);
  const [chargementDonnees, setChargementDonnees] = useState(!!idParam);
  const [personnageId, setPersonnageId] = useState<string | null>(null);

  // Étape 1 : Identité & Religion
  const [nom, setNom] = useState("");
  const [estCroyant, setEstCroyant] = useState<boolean | null>(null);
  const [religionId, setReligionId] = useState<string | null>(null);

  // Étape 2 : Race
  const [raceId, setRaceId] = useState<string | null>(null);

  // Chargement des données si ID présent (Modification/Reprise)
  useEffect(() => {
    if (idParam) {
      const fetchInitialData = async () => {
        try {
          const { data, error } = await supabase
            .from("personnages")
            .select("*")
            .eq("id", idParam)
            .single();

          if (error) throw error;
          if (data) {
            setPersonnageId(data.id);
            setNom(data.nom);
            setReligionId(data.religion_id);
            setEstCroyant((data as any).est_croyant ?? !!data.religion_id);
            setRaceId(data.race_id);
            if (!etapeParam) {
              const etapeDb = data.etape_creation ?? 0;
              setEtape(Math.min(Math.max(etapeDb + 1, 1), TOTAL_STEPS));
            }
          }
        } catch (err) {
          console.error("Erreur reprise personnage:", err);
          toast.error("Impossible de charger le personnage");
        } finally {
          setChargementDonnees(false);
        }
      };
      fetchInitialData();
    }
  }, [idParam]);

  // Requêtes pour les données d'encyclopédie
  const { data: religions = [] } = useQuery({
    queryKey: ["religions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("religions").select("*").eq("est_actif", true).order("nom");
      if (error) throw error;
      return data;
    },
  });

  // Sauvegarde automatique de l'étape en base de données
  const sauvegarderEtape = async (nouvelleEtape: number) => {
    if (!user) return;

    try {
      const payload: any = {
        nom,
        joueur_id: user.id,
        est_croyant: estCroyant,
        religion_id: religionId,
        race_id: raceId,
        etape_creation: nouvelleEtape,
        updated_at: new Date().toISOString(),
      };

      if (personnageId) {
        await supabase.from("personnages").update(payload).eq("id", personnageId);
      } else {
        const { data, error } = await supabase.from("personnages").insert([payload]).select().single();
        if (error) throw error;
        setPersonnageId(data.id);
      }
    } catch (err) {
      console.error("Erreur sauvegarde étape:", err);
    }
  };

  const sauvegarderCroyance = async (croyant: boolean | null, relId: string | null) => {
    if (!personnageId || !user) return;
    try {
      await (supabase.from("personnages") as any)
        .update({ est_croyant: croyant, religion_id: relId, updated_at: new Date().toISOString() })
        .eq("id", personnageId);
    } catch (err) {
      console.error("Erreur sauvegarde croyance:", err);
    }
  };

  const etapeSuivante = () => {
    sauvegarderEtape(etape);
    setEtape(Math.min(etape + 1, TOTAL_STEPS));
    window.scrollTo(0, 0);
  };

  const etapePrecedente = () => {
    setEtape(Math.max(etape - 1, 1));
    window.scrollTo(0, 0);
  };

  // Rendu des étapes
  const renderStep = () => {
    switch (etape) {
      case 1:
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="space-y-4">
              <Label htmlFor="nom" className="text-xl font-heading text-gold">Comment se nomme ton personnage ?</Label>
              <Input
                id="nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex: Valerius l'Ancien"
                className="text-lg bg-white/5 border-white/10"
              />
            </div>

            <div className="space-y-4">
              <Label className="text-xl font-heading text-gold block">Est-ce que ton personnage croit en une religion ?</Label>
              <div className="flex gap-4">
                <Button
                  variant={estCroyant === true ? "default" : "outline"}
                  onClick={() => { setEstCroyant(true); sauvegarderCroyance(true, religionId); }}
                  className={`flex-1 h-14 text-lg ${estCroyant === true ? 'bg-gold text-black hover:bg-gold/90' : ''}`}
                >Oui</Button>
                <Button
                  variant={estCroyant === false ? "default" : "outline"}
                  onClick={() => { setEstCroyant(false); setReligionId(null); sauvegarderCroyance(false, null); }}
                  className={`flex-1 h-14 text-lg ${estCroyant === false ? 'bg-gold text-black hover:bg-gold/90' : ''}`}
                >Non</Button>
              </div>
            </div>

            {estCroyant && (
              <div className="space-y-6 pt-6 border-t border-white/5 animate-in zoom-in-95">
                <h3 className="text-lg font-heading text-white/70">Choisis la religion de ton personnage :</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {religions.map((rel) => (
                    <ReligionCard
                      key={rel.id}
                      religion={rel}
                      isSelected={religionId === rel.id}
                      onClick={() => {
                        const newId = religionId === rel.id ? null : rel.id;
                        setReligionId(newId);
                        sauvegarderCroyance(true, newId);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <Step2Race
            raceId={raceId}
            onRaceSelect={setRaceId}
            personnageId={personnageId}
            nomPersonnage={nom}
          />
        );

      case 3:
        return <Step3TraitsRaciaux personnageId={personnageId} />;
      case 4: return <Step3Classe data={{}} onUpdate={() => {}} />; // À décaler
      // Les étapes suivantes devront être décalées d'un cran...
      default:
        return <div className="text-white">En construction...</div>;
    }
  };

  if (chargementDonnees) {
    return <div className="flex h-screen items-center justify-center bg-black"><Loader2 className="h-12 w-12 animate-spin text-gold" /></div>;
  }

  return (
    <div className="min-h-screen bg-black pb-20 pt-10 px-4 md:px-8">
      <div className="mx-auto max-w-6xl">
        {/* En-tête / Progress */}
        <div className="mb-10 space-y-4">
          <div className="flex items-center justify-between text-sm uppercase tracking-widest text-gold/60">
            <span>Étape {etape} sur {TOTAL_STEPS}</span>
            <span className="font-heading">{Math.round((etape / TOTAL_STEPS) * 100)}% complété</span>
          </div>
          <Progress value={(etape / TOTAL_STEPS) * 100} className="h-2 bg-white/10" />
        </div>

        {/* Contenu de l'étape */}
        <div className="min-h-[500px]">
          {renderStep()}
        </div>

        {/* Barre de navigation */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-black/80 p-4 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl justify-between gap-4">
            <Button
              variant="outline"
              onClick={etapePrecedente}
              disabled={etape === 1}
              className="border-white/10 text-white"
            >
              <ChevronLeft className="mr-2 h-4 w-4" /> Précédent
            </Button>

            <Button
              onClick={etapeSuivante}
              disabled={!nom || (etape === 1 && estCroyant === null) || (etape === 2 && !raceId)}
              className="bg-gold font-bold text-black hover:bg-gold/80 px-8"
            >
              Suivant <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonnageNouveau;

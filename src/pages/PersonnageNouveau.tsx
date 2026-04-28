import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Imports des étapes séparées
import EtapeInfosBase from "@/components/creation/Etape_InfosBase";
import Step2Race, { RACES_VALIDATION_IDS } from "@/components/creation/Etape_Race";
import Step3TraitsRaciaux from "@/components/creation/Etape_TraitsRaciaux";
import EtapeClasse from "@/components/creation/Etape_Classe";
import Step4Competences from "@/components/creation/Etape_Competences";
import Step5Sorts from "@/components/creation/Etape_SortsArcaniques";
import Step6Prieres from "@/components/creation/Etape_PrieresDivines";
import Step7Artisanat from "@/components/creation/Etape_Artisanat";
import Step8Runes from "@/components/creation/Etape_AssemblagesRunes";
import Step9Historique from "@/components/creation/Etape_HistoriqueAme";
import Step10Recapitulatif from "@/components/creation/Etape_Recapitulatif";

const TOTAL_STEPS = 11;
const CHIMERIDE_ID = "926b6948-e192-4d41-9909-efabaa3059b5";

const PersonnageNouveau = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const idParam = searchParams.get("id");
  const etapeParam = searchParams.get("etape");

  // États de base
  const [etape, setEtape] = useState(etapeParam ? Math.max(1, Math.min(parseInt(etapeParam), TOTAL_STEPS)) : 1);
  const [chargementDonnees, setChargementDonnees] = useState(!!idParam);
  const [personnageId, setPersonnageId] = useState<string | null>(null);

  // Étape 1 : Identité & Religion
  const [nom, setNom] = useState("");
  const [gnCompletes, setGnCompletes] = useState(0);
  const [miniGnCompletes, setMiniGnCompletes] = useState(0);
  const [ouverturesTerrain, setOuverturesTerrain] = useState(0);
  const [estCroyant, setEstCroyant] = useState<boolean | null>(null);
  const [religionId, setReligionId] = useState<string | null>(null);

  // Étape 2 : Race
  const [raceId, setRaceId] = useState<string | null>(null);
  const [raceNom, setRaceNom] = useState<string>("");
  const [raceNomLatin, setRaceNomLatin] = useState<string | null>(null);
  const [sousTypeChimeride, setSousTypeChimeride] = useState<"carnivore" | "herbivore" | null>(null);
  const [showRaceValidationPopup, setShowRaceValidationPopup] = useState(false);
  const [backgroundDemande, setBackgroundDemande] = useState("");
  const [configJeu, setConfigJeu] = useState<Record<string, string>>({});

  // Étape 3 : Traits raciaux
  const [etape3PeutPasser, setEtape3PeutPasser] = useState(false);

  // Étape 10 : Historique et âme
  const [historique, setHistorique] = useState("");
  const [amePersonnage, setAmePersonnage] = useState("");

  // Étape 4 : Classe
  const [classeId, setClasseId] = useState<string | null>(null);
  const [etape4PeutPasser, setEtape4PeutPasser] = useState(false);

  // Étape 5 : Compétences
  const [classeNom, setClasseNom] = useState<string>('');
  const [familleCriminelleId, setFamilleCriminelleId] = useState<string | null>(null);
  const [familleCriminelleNom, setFamilleCriminelleNom] = useState<string | null>(null);
  const [psMax, setPsMax] = useState<number>(0);
  const [pvMax, setPvMax] = useState<number>(0);
  const [competencesGratuites, setCompetencesGratuites] = useState<string[]>([]);

  // XP global
  const [xpDepart, setXpDepart] = useState<number | null>(null);
  const [xpDepense, setXpDepense] = useState(0);

  const xpTotal = useMemo(() => {
    if (xpDepart == null) return null;
    return xpDepart + gnCompletes * 15 + miniGnCompletes * 15 + ouverturesTerrain * 10;
  }, [xpDepart, gnCompletes, miniGnCompletes, ouverturesTerrain]);

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
            setGnCompletes(data.gn_completes ?? 0);
            setMiniGnCompletes(data.mini_gn_completes ?? 0);
            setOuverturesTerrain(data.ouvertures_terrain ?? 0);
            setReligionId(data.religion_id);
            setEstCroyant((data as any).est_croyant ?? !!data.religion_id);
            setRaceId(data.race_id);
            setClasseId(data.classe_id);
            setXpDepense(data.xp_depense ?? 0);
            setSousTypeChimeride((data as any).sous_type_chimeride ?? null);
            setHistorique(data.historique ?? "");
            setAmePersonnage((data as any).ame_personnage ?? "");
            if ((data as any).famille_criminelle_id) {
              setFamilleCriminelleId((data as any).famille_criminelle_id);
            }
            if (!etapeParam) {
              const etapeDb = data.etape_creation ?? 0;
              setEtape(Math.min(Math.max(etapeDb + 1, 1), TOTAL_STEPS));
            }
            // Charger les données de la classe si elle est déjà choisie
            if (data.classe_id) {
              const { data: classe } = await supabase
                .from('classes')
                .select('nom, pv_depart, ps_depart, competences_gratuites')
                .eq('id', data.classe_id)
                .single();
              if (classe) {
                setClasseNom((classe as any).nom);
                setCompetencesGratuites(((classe as any).competences_gratuites as string[]) ?? []);
                setPsMax((data as any).ps_max ?? (classe as any).ps_depart ?? 0);
                setPvMax((data as any).pv_max ?? (classe as any).pv_depart ?? 0);
              }
            }
            // Charger xp_depart, nom et nom_latin de la race si elle est déjà choisie
            if (data.race_id) {
              const { data: raceData } = await supabase
                .from("races")
                .select("xp_depart, nom, nom_latin")
                .eq("id", data.race_id)
                .single();
              if (raceData) {
                setXpDepart(raceData.xp_depart);
                setRaceNom(raceData.nom ?? "");
                setRaceNomLatin(raceData.nom_latin ?? null);
              }
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

  // Quand la race change, charger ses données
  useEffect(() => {
    if (!raceId) {
      setXpDepart(null);
      setRaceNom("");
      setRaceNomLatin(null);
      return;
    }
    const fetchRaceData = async () => {
      const { data } = await supabase
        .from("races")
        .select("xp_depart, nom, nom_latin")
        .eq("id", raceId)
        .single();
      if (data) {
        setXpDepart(data.xp_depart);
        setRaceNom(data.nom ?? "");
        setRaceNomLatin(data.nom_latin ?? null);
      }
    };
    fetchRaceData();
  }, [raceId]);

  // Quand la classe change, charger ses données pour l'étape 5
  useEffect(() => {
    if (!classeId) {
      setClasseNom('');
      if (!idParam) {
        setPsMax(0);
        setCompetencesGratuites([]);
      }
      return;
    }
    const fetchClasseData = async () => {
      const { data } = await supabase
        .from('classes')
        .select('nom, pv_depart, ps_depart, competences_gratuites')
        .eq('id', classeId)
        .single();
      if (data) {
        setClasseNom((data as any).nom);
        setCompetencesGratuites(((data as any).competences_gratuites as string[]) ?? []);
        if (!idParam) {
          setPsMax((data as any).ps_depart ?? 0);
          setPvMax((data as any).pv_depart ?? 0);
        }
      }
    };
    fetchClasseData();
  }, [classeId, idParam]);

  // Charger la config_jeu (liens FB/Discord + texte photos)
  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase
        .from("config_jeu")
        .select("cle, valeur")
        .in("cle", ["lien_facebook_hurlevent", "lien_discord_hurlevent", "texte_envoi_photos_race"]);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((row: any) => { map[row.cle] = String(row.valeur ?? ""); });
        setConfigJeu(map);
      }
    };
    fetchConfig();
  }, []);

  // Quand la famille criminelle change, charger son nom
  useEffect(() => {
    if (!familleCriminelleId) {
      setFamilleCriminelleNom(null);
      return;
    }
    const fetchFamille = async () => {
      const { data } = await supabase
        .from("familles_criminelles")
        .select("nom")
        .eq("id", familleCriminelleId)
        .single();
      if (data) setFamilleCriminelleNom((data as any).nom ?? null);
    };
    fetchFamille();
  }, [familleCriminelleId]);

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
        gn_completes: gnCompletes,
        mini_gn_completes: miniGnCompletes,
        ouvertures_terrain: ouverturesTerrain,
        joueur_id: user.id,
        est_croyant: estCroyant,
        religion_id: religionId,
        race_id: raceId,
        classe_id: classeId,
        historique,
        ame_personnage: amePersonnage,
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

  const creerDemandeRace = async (): Promise<boolean> => {
    if (!personnageId) return false;
    const { data, error } = await supabase.rpc("creer_demande_race", {
      p_personnage_id: personnageId,
      p_background: backgroundDemande,
    });
    if (error) {
      toast.error("Erreur lors de la soumission de la demande.");
      return false;
    }
    const result = data as any;
    if (result?.succes === false) {
      toast.error(result.erreur ?? "Erreur lors de la soumission.");
      return false;
    }
    toast.success(result?.message ?? "Demande soumise avec succès !");
    return true;
  };

  const naviguerEtapeSuivante = () => {
    sauvegarderEtape(etape);
    setEtape(Math.min(etape + 1, TOTAL_STEPS));
    window.scrollTo(0, 0);
  };

  const etapeSuivante = async () => {
    // Étape 2 + race spéciale → popup de validation avant navigation
    if (etape === 2 && raceId && RACES_VALIDATION_IDS.includes(raceId)) {
      setShowRaceValidationPopup(true);
      return;
    }
    naviguerEtapeSuivante();
  };

  const handleConfirmerRaceSpeciale = async () => {
    const ok = await creerDemandeRace();
    if (!ok) return;
    setShowRaceValidationPopup(false);
    setBackgroundDemande("");
    naviguerEtapeSuivante();
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
          <EtapeInfosBase
            nom={nom}
            setNom={setNom}
            gnCompletes={gnCompletes}
            setGnCompletes={setGnCompletes}
            miniGnCompletes={miniGnCompletes}
            setMiniGnCompletes={setMiniGnCompletes}
            ouverturesTerrain={ouverturesTerrain}
            setOuverturesTerrain={setOuverturesTerrain}
            estCroyant={estCroyant}
            setEstCroyant={setEstCroyant}
            religionId={religionId}
            setReligionId={setReligionId}
            religions={religions}
            onCroyanceChange={sauvegarderCroyance}
          />
        );

      case 2:
        return (
          <Step2Race
            raceId={raceId}
            onRaceSelect={setRaceId}
            personnageId={personnageId}
            nomPersonnage={nom}
            sousTypeChimeride={sousTypeChimeride}
            onSousTypeChange={setSousTypeChimeride}
            backgroundDemande={backgroundDemande}
            onBackgroundChange={setBackgroundDemande}
            configJeu={configJeu}
          />
        );

      case 3:
        return (
          <Step3TraitsRaciaux
            personnageId={personnageId}
            onPeutPasser={setEtape3PeutPasser}
            onXpDepenseChange={setXpDepense}
          />
        );
      case 4:
        return (
          <EtapeClasse
            personnageId={personnageId}
            classeId={classeId}
            onClasseSelect={setClasseId}
            estCroyant={estCroyant}
            religionId={religionId}
            onReligionChange={(id, croyant) => {
              setReligionId(id);
              if (croyant !== undefined) setEstCroyant(croyant);
            }}
            onPeutPasser={setEtape4PeutPasser}
          />
        );
      case 6:
        if (!personnageId) return <div className="text-white">Sauvegarde en cours...</div>;
        return (
          <Step5Sorts
            personnageId={personnageId}
            niveauPersonnage={1 + gnCompletes}
            xpDisponible={xpTotal != null ? xpTotal - xpDepense : 0}
            onXpSpent={(amount) => setXpDepense((prev) => prev + amount)}
          />
        );
      case 7:
        if (!personnageId) return <div className="text-white">Sauvegarde en cours...</div>;
        return (
          <Step6Prieres
            personnageId={personnageId}
            niveauPersonnage={1 + gnCompletes}
            xpDisponible={xpTotal != null ? xpTotal - xpDepense : 0}
            religionId={religionId}
            onXpSpent={(amount) => setXpDepense((prev) => prev + amount)}
          />
        );
      case 8:
        if (!personnageId) return <div className="text-white">Sauvegarde en cours...</div>;
        return (
          <Step7Artisanat
            personnageId={personnageId}
            xpDisponible={xpTotal != null ? xpTotal - xpDepense : 0}
            xpDepense={xpDepense}
            onXpSpent={(amount) => setXpDepense((prev) => prev + amount)}
          />
        );
      case 9:
        if (!personnageId) return <div className="text-white">Sauvegarde en cours...</div>;
        return (
          <Step8Runes
            personnageId={personnageId}
            xpDisponible={xpTotal != null ? xpTotal - xpDepense : 0}
            xpDepense={xpDepense}
            onXpSpent={(amount) => setXpDepense((prev) => prev + amount)}
          />
        );
      case 10:
        return (
          <Step9Historique
            historique={historique}
            setHistorique={setHistorique}
            amePersonnage={amePersonnage}
            setAmePersonnage={setAmePersonnage}
          />
        );
      case 5:
        if (!personnageId || !classeId) return <div className="text-white">En construction...</div>;
        return (
          <Step4Competences
            personnageId={personnageId}
            classeId={classeId}
            classeNom={classeNom}
            religionId={religionId}
            setReligionId={setReligionId}
            familleCriminelleId={familleCriminelleId}
            setFamilleCriminelleId={setFamilleCriminelleId}
            xpDisponible={xpTotal != null ? xpTotal - xpDepense : 0}
            xpDepense={xpDepense}
            onXpSpent={(amount) => setXpDepense((prev) => prev + amount)}
            psMax={psMax}
            onPsMaxChange={setPsMax}
            competencesGratuites={competencesGratuites}
            religions={religions}
          />
        );
      case 11:
      default: {
        if (!personnageId) return <div className="text-white">Sauvegarde en cours...</div>;
        const religionNom = religions.find((r) => r.id === religionId)?.nom ?? null;
        return (
          <Step10Recapitulatif
            personnageId={personnageId}
            nomPersonnage={nom}
            raceNom={raceNom}
            raceNomLatin={raceNomLatin}
            classeNom={classeNom}
            niveau={1 + gnCompletes}
            xpTotal={xpTotal ?? 0}
            xpDepense={xpDepense}
            religionNom={religionNom}
            familleCriminelleNom={familleCriminelleNom}
            gnCompletes={gnCompletes}
            miniGnCompletes={miniGnCompletes}
            ouverturesTerrain={ouverturesTerrain}
            pvMax={pvMax}
            psMax={psMax}
            historique={historique}
            amePersonnage={amePersonnage}
            traitObligatoire={null}
            traitsOptionnels={[]}
          />
        );
      }
    }
  };

  if (chargementDonnees) {
    return <div className="flex h-screen items-center justify-center bg-black"><Loader2 className="h-12 w-12 animate-spin text-gold" /></div>;
  }

  const suivantDisabled =
    !nom ||
    (etape === 1 && estCroyant === null) ||
    (etape === 2 && !raceId) ||
    (etape === 2 && raceId === CHIMERIDE_ID && !sousTypeChimeride) ||
    (etape === 3 && !etape3PeutPasser) ||
    (etape === 4 && !etape4PeutPasser);

  return (
    <div className="min-h-screen bg-black pb-20 pt-10 px-4 md:px-8">
      <div className="mx-auto max-w-6xl">
        {/* En-tête / Progress */}
        <div className="mb-4 space-y-4">
          <div className="flex items-center justify-between text-sm uppercase tracking-widest text-gold/60">
            <span>Étape {etape} sur {TOTAL_STEPS}</span>
            <span className="font-heading">{Math.round((etape / TOTAL_STEPS) * 100)}% complété</span>
          </div>
          <Progress value={(etape / TOTAL_STEPS) * 100} className="h-2 bg-white/10" />
        </div>

        {/* Correctif 1 : barre XP permanente */}
        <div className="flex gap-6 text-sm py-2 px-4 mb-6 bg-gray-900/50 border border-gray-800 rounded">
          <span className="text-amber-400">
            XP total : <strong>{xpTotal ?? "—"}</strong>
          </span>
          <span className="text-red-400">
            XP dépensé : <strong>{xpDepense}</strong>
          </span>
          <span className="text-green-400">
            XP disponible : <strong>{xpTotal != null ? xpTotal - xpDepense : "—"}</strong>
          </span>
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
              disabled={suivantDisabled}
              className="bg-gold font-bold text-black hover:bg-gold/80 px-8"
            >
              Suivant <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog validation race spéciale — appelle creer_demande_race */}
      <Dialog open={showRaceValidationPopup} onOpenChange={(open) => { if (!open) { setShowRaceValidationPopup(false); setBackgroundDemande(""); } }}>
        <DialogContent className="sm:max-w-lg bg-card border-gold/40">
          <DialogHeader>
            <DialogTitle className="font-heading text-gold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Approbation obligatoire
            </DialogTitle>
            <DialogDescription className="text-foreground/80 pt-2">
              Cette race nécessite une approbation de l'organisation. Tu peux continuer la création,
              mais l'inscription à un événement sera bloquée jusqu'à l'approbation.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-sm text-foreground/70">
            Background rempli à l'étape 2 ({backgroundDemande.length} caractères).
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => { setShowRaceValidationPopup(false); setBackgroundDemande(""); }}
              className="border-white/20"
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirmerRaceSpeciale}
              disabled={backgroundDemande.length < 100}
              className="bg-gold text-black hover:bg-gold/80 font-bold"
            >
              Soumettre la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonnageNouveau;

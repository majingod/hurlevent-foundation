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
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReligionCard from "@/components/encyclopedie/ReligionCard";

// Imports des étapes séparées
import Step2Race, { RACES_VALIDATION_IDS } from "@/components/creation/Etape_Race";
import Step3TraitsRaciaux from "@/components/creation/Etape_TraitsRaciaux";
import EtapeClasse from "@/components/creation/Etape_Classe";
import Step4Competences from "@/components/creation/Etape_Competences";
import Step5Sorts from "@/components/creation/Etape_SortsArcaniques";
import Step6Prieres from "@/components/creation/Etape_PrieresDivines";
import Step7Artisanat from "@/components/creation/Etape_Artisanat";
import Step8Runes from "@/components/creation/Etape_AssemblagesRunes";
import Step9Historique from "@/components/creation/Etape_HistoriqueAme";
import Step10Recap from "@/components/creation/Etape_Recapitulatif";

const TOTAL_STEPS = 11;
const CHIMERIDE_ID = "926b6948-e192-4d41-9909-efabaa3059b5";

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
  const [gnCompletes, setGnCompletes] = useState(0);
  const [miniGnCompletes, setMiniGnCompletes] = useState(0);
  const [ouverturesTerrain, setOuverturesTerrain] = useState(0);
  const [estCroyant, setEstCroyant] = useState<boolean | null>(null);
  const [religionId, setReligionId] = useState<string | null>(null);

  // Étape 2 : Race
  const [raceId, setRaceId] = useState<string | null>(null);
  const [sousTypeChimeride, setSousTypeChimeride] = useState<"carnivore" | "herbivore" | null>(null);
  const [showRaceValidationPopup, setShowRaceValidationPopup] = useState(false);

  // Étape 3 : Traits raciaux
  const [etape3PeutPasser, setEtape3PeutPasser] = useState(false);

  // Étape 4 : Classe
  const [classeId, setClasseId] = useState<string | null>(null);
  const [etape4PeutPasser, setEtape4PeutPasser] = useState(false);

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
            if (!etapeParam) {
              const etapeDb = data.etape_creation ?? 0;
              setEtape(Math.min(Math.max(etapeDb + 1, 1), TOTAL_STEPS));
            }
            // Charger xp_depart de la race si elle est déjà choisie
            if (data.race_id) {
              const { data: raceData } = await supabase
                .from("races")
                .select("xp_depart")
                .eq("id", data.race_id)
                .single();
              if (raceData) setXpDepart(raceData.xp_depart);
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

  // Quand la race change, charger son xp_depart
  useEffect(() => {
    if (!raceId) {
      setXpDepart(null);
      return;
    }
    const fetchRaceXp = async () => {
      const { data } = await supabase
        .from("races")
        .select("xp_depart")
        .eq("id", raceId)
        .single();
      if (data) setXpDepart(data.xp_depart);
    };
    fetchRaceXp();
  }, [raceId]);

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

  const creerNotificationRaceSpeciale = async () => {
    if (!personnageId || !user || !raceId) return;

    const { data: existant } = await (supabase as any)
      .from("notifications")
      .select("id")
      .eq("type", "validation_race")
      .eq("reference_id", personnageId)
      .eq("statut", "non_traite")
      .maybeSingle();

    if (!existant) {
      await (supabase as any).from("notifications").insert({
        user_id: user.id,
        message: `Demande de validation de race pour le personnage "${nom}".`,
        lu: false,
        type: "validation_race",
        reference_id: personnageId,
        statut: "non_traite",
      });
    }
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
    await creerNotificationRaceSpeciale();
    setShowRaceValidationPopup(false);
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gn_completes" className="text-sm font-semibold text-white/70">GN réguliers complétés</Label>
                <Input
                  id="gn_completes"
                  type="number"
                  min={0}
                  value={gnCompletes}
                  onChange={(e) => setGnCompletes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mini_gn_completes" className="text-sm font-semibold text-white/70">Mini-GN complétés</Label>
                <Input
                  id="mini_gn_completes"
                  type="number"
                  min={0}
                  value={miniGnCompletes}
                  onChange={(e) => setMiniGnCompletes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ouvertures_terrain" className="text-sm font-semibold text-white/70">Ouvertures de terrain</Label>
                <Input
                  id="ouvertures_terrain"
                  type="number"
                  min={0}
                  value={ouverturesTerrain}
                  onChange={(e) => setOuverturesTerrain(Math.max(0, parseInt(e.target.value) || 0))}
                  className="bg-white/5 border-white/10"
                />
              </div>
            </div>

            {/* Correctif 2 : affichage niveau + détail XP en temps réel */}
            <div className="mt-4 p-3 rounded bg-gray-900/50 border border-gray-700 text-sm space-y-1">
              <p className="text-gray-400">
                Niveau actuel : <strong className="text-amber-300">{1 + gnCompletes}</strong>
                <span className="text-gray-500 ml-2">
                  (1 niveau de base + {gnCompletes} GN régulier{gnCompletes > 1 ? "s" : ""})
                </span>
              </p>
              <p className="text-gray-400">
                XP de GN : <strong className="text-green-400">+{gnCompletes * 15}</strong>
                {gnCompletes > 0 && <span className="text-gray-500 ml-1">({gnCompletes} × 15 xp)</span>}
              </p>
              <p className="text-gray-400">
                XP de mini-GN : <strong className="text-green-400">+{miniGnCompletes * 15}</strong>
                {miniGnCompletes > 0 && <span className="text-gray-500 ml-1">({miniGnCompletes} × 15 xp)</span>}
              </p>
              <p className="text-gray-400">
                XP d'ouvertures : <strong className="text-green-400">+{ouverturesTerrain * 10}</strong>
                {ouverturesTerrain > 0 && <span className="text-gray-500 ml-1">({ouverturesTerrain} × 10 xp)</span>}
              </p>
              <p className="text-gray-500 italic text-xs mt-2">
                XP total : sera calculé à l'étape suivante après le choix de la race.
              </p>
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
                <p className="text-sm font-semibold mt-4 mb-2 text-amber-200">Choisis la religion de ton personnage :</p>
                {/* Correctif 3 : mentions sous chaque carte */}
                <div className="grid gap-4 md:grid-cols-2">
                  {religions.map((rel) => (
                    <div key={rel.id} className="space-y-1">
                      <ReligionCard
                        religion={rel}
                        isSelected={religionId === rel.id}
                        onClick={() => {
                          const newId = religionId === rel.id ? null : rel.id;
                          setReligionId(newId);
                          sauvegarderCroyance(true, newId);
                        }}
                      />
                      <p className="text-xs text-white/40 italic px-1">
                        Le pouvoir du symbole n'est accessible qu'à la classe Prêtre.
                      </p>
                      {(rel as any).domaines_proscrits?.length > 0 && (
                        <p className="text-xs text-amber-500/70 italic px-1">
                          Attention : certains domaines de prière sont proscrits par cette religion.
                        </p>
                      )}
                    </div>
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
            sousTypeChimeride={sousTypeChimeride}
            onSousTypeChange={setSousTypeChimeride}
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
      case 9:
        if (!personnageId) return <div className="text-white">En construction...</div>;
        return (
          <Step8Runes
            personnageId={personnageId}
            xpDisponible={xpTotal != null ? xpTotal - xpDepense : 0}
            xpDepense={xpDepense}
            onXpSpent={(amount) => setXpDepense((prev) => prev + amount)}
          />
        );
      case 5:
      case 6:
      case 7:
      case 8:
      case 10:
      case 11:
      default:
        return <div className="text-white">En construction...</div>;
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

      {/* Correctif 4 : Dialog validation race spéciale (déclenché au clic Suivant) */}
      <Dialog open={showRaceValidationPopup} onOpenChange={(open) => { if (!open) setShowRaceValidationPopup(false); }}>
        <DialogContent className="sm:max-w-md bg-card border-gold/40">
          <DialogHeader>
            <DialogTitle className="font-heading text-gold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Validation obligatoire
            </DialogTitle>
            <DialogDescription className="text-foreground/80 pt-2">
              En choisissant cette race, ton personnage devra être validé par l'organisation
              avant de pouvoir jouer. Une demande sera automatiquement envoyée à l'équipe.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowRaceValidationPopup(false)}
              className="border-white/20"
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirmerRaceSpeciale}
              className="bg-gold text-black hover:bg-gold/80 font-bold"
            >
              Je comprends, continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonnageNouveau;

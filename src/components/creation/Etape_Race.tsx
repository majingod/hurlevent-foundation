import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import RaceCard from "@/components/encyclopedie/RaceCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const RACES_VALIDATION_IDS = [
  "926b6948-e192-4d41-9909-efabaa3059b5", // Chiméride
  "4d7e2226-76cb-4b94-9df4-b8f12ff486e1", // Les Non-Races
];

interface Step2RaceProps {
  raceId: string | null;
  onRaceSelect: (id: string | null) => void;
  personnageId: string | null;
  nomPersonnage: string;
}

const Step2Race = ({ raceId, onRaceSelect, personnageId, nomPersonnage }: Step2RaceProps) => {
  const { user } = useAuth();
  const [modalRace, setModalRace] = useState<{ id: string; nom: string } | null>(null);

  const { data: races = [] } = useQuery({
    queryKey: ["races-creation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("races")
        .select("*")
        .eq("est_actif", true)
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  const sauvegarderRace = async (id: string) => {
    if (!personnageId || !user) return;
    await supabase
      .from("personnages")
      .update({ race_id: id, updated_at: new Date().toISOString() })
      .eq("id", personnageId);
  };

  const creerNotificationValidation = async (id: string, nomRace: string) => {
    if (!personnageId || !user) return;

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
        message: `Demande de validation de race "${nomRace}" pour le personnage "${nomPersonnage}".`,
        lu: false,
        type: "validation_race",
        reference_id: personnageId,
        statut: "non_traite",
      });
    }
  };

  const handleCardClick = (race: { id: string; nom: string | null }) => {
    const nom = race.nom ?? "";
    if (RACES_VALIDATION_IDS.includes(race.id)) {
      setModalRace({ id: race.id, nom });
    } else {
      onRaceSelect(race.id);
      sauvegarderRace(race.id);
    }
  };

  const handleConfirmer = async () => {
    if (!modalRace) return;
    onRaceSelect(modalRace.id);
    await sauvegarderRace(modalRace.id);
    await creerNotificationValidation(modalRace.id, modalRace.nom);
    setModalRace(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <h2 className="text-2xl font-heading text-gold">Choisis la race de ton personnage</h2>

      <div className="grid gap-6">
        {races.map((race) => {
          const estSpeciale = RACES_VALIDATION_IDS.includes(race.id);
          const estSelectionnee = raceId === race.id;

          return (
            <div
              key={race.id}
              className={`relative rounded-lg overflow-hidden transition-all cursor-pointer ${
                estSelectionnee ? "ring-2 ring-gold" : ""
              }`}
              onClick={() => handleCardClick(race)}
            >
              <RaceCard
                id={race.id}
                nom={race.nom ?? ""}
                nom_latin={race.nom_latin ?? null}
                emoji={(race as any).emoji ?? "?"}
                esperance_vie={race.esperance_vie ?? null}
                xp_depart={race.xp_depart}
                description={race.description ?? null}
                exigences_costume={race.exigences_costume ?? null}
                nb_traits_raciaux={race.nb_traits_raciaux}
              />
              {estSpeciale && (
                <div className="flex items-start gap-2 border-x border-b border-red-500/60 bg-red-500/10 px-4 py-3 text-red-400 rounded-b-lg">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">
                    ⚠️ Ce concept nécessite une validation obligatoire par l'organisation avant le jeu.
                  </p>
                </div>
              )}
              {estSelectionnee && (
                <div className="absolute top-2 right-2 bg-gold text-black rounded-full p-1 pointer-events-none">
                  <Sparkles size={16} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!modalRace} onOpenChange={(open) => { if (!open) setModalRace(null); }}>
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
              onClick={() => setModalRace(null)}
              className="border-white/20"
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirmer}
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

export default Step2Race;

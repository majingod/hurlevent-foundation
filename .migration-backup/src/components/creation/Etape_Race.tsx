import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import RaceCard from "@/components/encyclopedie/RaceCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const RACES_VALIDATION_IDS = [
  "926b6948-e192-4d41-9909-efabaa3059b5", // Chiméride
  "4d7e2226-76cb-4b94-9df4-b8f12ff486e1", // Les Non-Races
];

const CHIMERIDE_ID = "926b6948-e192-4d41-9909-efabaa3059b5";

interface Step2RaceProps {
  raceId: string | null;
  onRaceSelect: (id: string | null) => void;
  personnageId: string | null;
  nomPersonnage: string;
  sousTypeChimeride: "carnivore" | "herbivore" | null;
  onSousTypeChange: (t: "carnivore" | "herbivore") => void;
  backgroundDemande: string;
  onBackgroundChange: (v: string) => void;
  configJeu: Record<string, string>;
}

const Step2Race = ({
  raceId,
  onRaceSelect,
  personnageId,
  nomPersonnage,
  sousTypeChimeride,
  onSousTypeChange,
  backgroundDemande,
  onBackgroundChange,
  configJeu,
}: Step2RaceProps) => {
  const { user } = useAuth();

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

  const sauvegarderSousType = async (type: "carnivore" | "herbivore") => {
    if (!personnageId || !user) return;
    await supabase
      .from("personnages")
      .update({ sous_type_chimeride: type, updated_at: new Date().toISOString() })
      .eq("id", personnageId);
  };

  const handleCardClick = (race: { id: string; nom: string | null }) => {
    onRaceSelect(race.id);
    sauvegarderRace(race.id);
  };

  const raceSpecialeSelectionnee = raceId ? RACES_VALIDATION_IDS.includes(raceId) : false;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <h2 className="text-2xl font-heading text-gold">Choisis la race de ton personnage</h2>

      <div className="grid gap-6">
        {races.map((race) => {
          const estSpeciale = RACES_VALIDATION_IDS.includes(race.id);
          const estSelectionnee = raceId === race.id;
          const estChimeride = race.id === CHIMERIDE_ID;

          return (
            <div key={race.id} className="space-y-0">
              <div
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

              {/* Sélecteur sous-type Chiméride */}
              {estSelectionnee && estChimeride && (
                <div className="mt-2 p-4 border border-amber-700 rounded bg-amber-900/20">
                  <p className="text-amber-300 font-semibold mb-3">
                    Choisis le type de ton Chiméride :
                  </p>
                  <p className="text-gray-400 text-sm mb-3">
                    Ce choix détermine quels traits raciaux seront disponibles pour ton personnage.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={() => {
                        onSousTypeChange("carnivore");
                        sauvegarderSousType("carnivore");
                      }}
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
                      onClick={() => {
                        onSousTypeChange("herbivore");
                        sauvegarderSousType("herbivore");
                      }}
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

      {/* Formulaire d'approbation — affiché dès qu'une race spéciale est sélectionnée */}
      {raceSpecialeSelectionnee && (
        <div className="space-y-4 rounded-lg border border-red-500/40 bg-red-900/10 p-5">
          <div className="flex items-start gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold">Approbation requise — remplis les informations ci-dessous avant de continuer.</p>
          </div>

          {/* TextArea background */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Background du personnage <span className="text-red-400">*</span>
            </label>
            <Textarea
              value={backgroundDemande}
              onChange={(e) => onBackgroundChange(e.target.value)}
              placeholder="Décris le background de ton personnage (minimum 100 caractères)..."
              className="min-h-[120px] bg-background/50 border-white/20 text-foreground"
            />
            <p className={`text-xs ${backgroundDemande.length < 100 ? "text-amber-400" : "text-green-400"}`}>
              {backgroundDemande.length} / 100 caractères minimum
            </p>
          </div>

          {/* Liens et instructions photos */}
          <div className="rounded border border-amber-700/50 bg-amber-900/20 p-3 space-y-2 text-sm">
            <p className="font-semibold text-amber-300">Photos de costume requises</p>
            {configJeu.texte_envoi_photos_race && (
              <p className="text-amber-200/80">{configJeu.texte_envoi_photos_race}</p>
            )}
            <div className="flex gap-4 flex-wrap">
              {configJeu.lien_facebook_hurlevent && (
                <a
                  href={configJeu.lien_facebook_hurlevent}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Facebook
                </a>
              )}
              {configJeu.lien_discord_hurlevent && (
                <a
                  href={configJeu.lien_discord_hurlevent}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-indigo-400 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Discord
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step2Race;

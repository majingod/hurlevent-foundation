import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ReligionCard from "@/components/encyclopedie/ReligionCard";

interface InfosBaseProps {
  nom: string;
  setNom: (v: string) => void;
  gnCompletes: number;
  setGnCompletes: (v: number) => void;
  miniGnCompletes: number;
  setMiniGnCompletes: (v: number) => void;
  ouverturesTerrain: number;
  setOuverturesTerrain: (v: number) => void;
  estCroyant: boolean | null;
  setEstCroyant: (v: boolean | null) => void;
  religionId: string | null;
  setReligionId: (v: string | null) => void;
  religions: any[];
  onCroyanceChange: (croyant: boolean | null, relId: string | null) => void;
}

const EtapeInfosBase = ({
  nom, setNom,
  gnCompletes, setGnCompletes,
  miniGnCompletes, setMiniGnCompletes,
  ouverturesTerrain, setOuverturesTerrain,
  estCroyant, setEstCroyant,
  religionId, setReligionId,
  religions,
  onCroyanceChange,
}: InfosBaseProps) => {
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
            onClick={() => { setEstCroyant(true); onCroyanceChange(true, religionId); }}
            className={`flex-1 h-14 text-lg ${estCroyant === true ? 'bg-gold text-black hover:bg-gold/90' : ''}`}
          >Oui</Button>
          <Button
            variant={estCroyant === false ? "default" : "outline"}
            onClick={() => { setEstCroyant(false); setReligionId(null); onCroyanceChange(false, null); }}
            className={`flex-1 h-14 text-lg ${estCroyant === false ? 'bg-gold text-black hover:bg-gold/90' : ''}`}
          >Non</Button>
        </div>
      </div>

      {estCroyant && (
        <div className="space-y-6 pt-6 border-t border-white/5 animate-in zoom-in-95">
          <p className="text-sm font-semibold mt-4 mb-2 text-amber-200">Choisis la religion de ton personnage :</p>
          <div className="grid gap-4 md:grid-cols-2">
            {religions.map((rel) => (
              <div key={rel.id} className="space-y-1">
                <ReligionCard
                  religion={rel}
                  isSelected={religionId === rel.id}
                  onClick={() => {
                    const newId = religionId === rel.id ? null : rel.id;
                    setReligionId(newId);
                    onCroyanceChange(true, newId);
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
};

export default EtapeInfosBase;

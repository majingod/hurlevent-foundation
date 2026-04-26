import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface ReligionCardProps {
  religion: any;
  isSelected?: boolean; // Optionnel car l'encyclopédie n'a pas forcément d'état "sélectionné"
  onClick?: () => void;
}

const ReligionCard = ({ religion, isSelected, onClick }: ReligionCardProps) => {
  return (
    <Card 
      className={`cursor-pointer transition-all duration-300 hover:border-gold/50 ${
        isSelected 
          ? "border-2 border-gold ring-2 ring-gold/20 bg-gold/5" 
          : "border-white/10 bg-white/5"
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-heading text-gold text-center">
          {religion.nom}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Domaines autorisés */}
        <div className="space-y-2">
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Domaines de la religion</p>
          <div className="flex flex-wrap gap-2">
            {religion.domaines_principaux?.map((d: string) => (
              <Badge key={d} className="bg-green-950/40 text-green-400 border-green-500/30 hover:bg-green-500/20 px-3 py-1">
                {d}
              </Badge>
            ))}
          </div>
        </div>

        {/* Domaines proscrits */}
        {religion.domaines_proscrits?.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Domaines proscrits</p>
            <div className="flex flex-wrap gap-2">
              {religion.domaines_proscrits.map((d: string) => (
                <Badge key={d} className="bg-red-950/40 text-red-500 border-red-500/30 font-bold px-3 py-1">
                  <X size={12} className="mr-1 inline" /> {d}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReligionCard;

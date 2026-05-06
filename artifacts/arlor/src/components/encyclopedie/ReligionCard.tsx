import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, ChevronDown, ChevronUp, BookOpen, Crown, User, Sparkles } from "lucide-react";

interface ReligionCardProps {
  religion: any;
  isSelected?: boolean;
  onClick?: () => void;
}

const ReligionCard = ({ religion, isSelected, onClick }: ReligionCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCardClick = (e: React.MouseEvent) => {
    // Si on est dans le créateur, on sélectionne la religion
    if (onClick) onClick();
    // On bascule l'affichage des détails
    setIsExpanded(!isExpanded);
  };

  return (
    <Card 
      className={`cursor-pointer transition-all duration-300 border-gold/60 hover:border-gold bg-card shadow-lg overflow-hidden ${
        isSelected 
          ? "ring-2 ring-gold bg-gold/5 border-gold" 
          : "border-white/10"
      }`}
      onClick={handleCardClick}
    >
      {/* En-tête de la carte - Toujours visible */}
      <CardHeader className="pb-3 border-b border-gold/10">
        <div className="flex justify-between items-center">
          <div className="text-center w-full">
            <CardTitle className="text-2xl font-heading text-gold">
              {religion.nom}
            </CardTitle>
            {religion.surnom && (
              <p className="text-sm italic text-gold/60">"{religion.surnom}"</p>
            )}
          </div>
          {isExpanded ? <ChevronUp className="text-gold" /> : <ChevronDown className="text-gold" />}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Informations de base (Visibles même si réduit) */}
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Domaines de la religion</p>
            <div className="flex flex-wrap gap-2">
              {religion.domaines_principaux?.map((d: string) => (
                <Badge key={d} className="bg-green-900/50 text-green-300 border border-green-700 px-3 py-1">
                  {d}
                </Badge>
              ))}
            </div>
          </div>

          {religion.domaines_proscrits?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Domaines proscrits</p>
              <div className="flex flex-wrap gap-2">
                {religion.domaines_proscrits.map((d: string) => (
                  <Badge key={d} className="bg-red-950/40 text-red-400 border border-red-700 font-bold px-3 py-1">
                    <X size={12} className="mr-1 inline" /> {d}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section Détails - Visible uniquement si isExpanded est vrai */}
        {isExpanded && (
          <div className="mt-6 space-y-6 pt-6 border-t border-gold/20 animate-in fade-in zoom-in-95 duration-300">
            
            {/* Symbole Sacré */}
            {(religion.symbole_sacre || religion.pouvoir_symbole) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gold">
                  <Sparkles size={16} />
                  <h4 className="font-bold text-sm uppercase">Symbole Sacré</h4>
                </div>
                <div className="bg-white/5 p-3 rounded-md border border-white/10">
                  <p className="text-sm font-semibold text-white/90">{religion.symbole_sacre}</p>
                  <p className="text-xs text-white/60 mt-1">{religion.pouvoir_symbole}</p>
                </div>
              </div>
            )}

            {/* Dirigeants et Fondateurs */}
            <div className="grid grid-cols-2 gap-4">
              {religion.dirigeant && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gold">
                    <Crown size={14} />
                    <h4 className="font-bold text-[10px] uppercase">Dirigeant</h4>
                  </div>
                  <p className="text-xs text-white/80">{religion.dirigeant}</p>
                </div>
              )}
              {religion.fondateur && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gold">
                    <User size={14} />
                    <h4 className="font-bold text-[10px] uppercase">Fondateur</h4>
                  </div>
                  <p className="text-xs text-white/80">{religion.fondateur}</p>
                </div>
              )}
            </div>

            {/* Description / Lore */}
            {religion.description && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gold">
                  <BookOpen size={16} />
                  <h4 className="font-bold text-sm uppercase">Description</h4>
                </div>
                <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                  {religion.description}
                </p>
              </div>
            )}

            {/* Rituels et Habitudes */}
            {religion.rituels_habitudes && (
              <div className="space-y-2 bg-gold/5 p-4 rounded-lg border border-gold/10">
                <h4 className="text-gold font-bold text-xs uppercase tracking-tighter text-center">Rituels & Habitudes</h4>
                <p className="text-sm text-white/70 italic leading-relaxed">
                  {religion.rituels_habitudes}
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Petit indicateur visuel en bas si non sélectionné */}
        {!isExpanded && (
          <div className="text-center pt-2">
            <p className="text-[9px] text-gold/40 uppercase font-bold tracking-widest">Cliquer pour en savoir plus</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReligionCard;

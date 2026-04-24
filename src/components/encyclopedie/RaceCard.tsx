import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface RaceCardProps {
  id: string;
  nom: string;
  nom_latin: string | null;
  emoji: string;
  esperance_vie: string | null;
  xp_depart: number;
  description: string | null;
  exigences_costume: string | null;
}

const RaceCard: React.FC<RaceCardProps> = ({
  nom,
  nom_latin,
  emoji,
  esperance_vie,
  xp_depart,
  description,
  exigences_costume,
}) => {
  const [costumeOuvert, setCostumeOuvert] = useState(false);

  return (
    <div className="w-full border border-gold/60 rounded-lg bg-card hover:border-gold transition-all duration-300 overflow-hidden shadow-lg">

      {/* Header */}
      <div className="px-6 py-5 border-b border-gold/40">
        <div className="flex items-start gap-4">
          <div className="text-5xl flex-shrink-0">{emoji}</div>
          <div className="flex-grow">
            <h2 className="text-3xl font-heading font-bold text-gold mb-1">
              {nom}
            </h2>
            {nom_latin && (
              <p className="text-foreground/70 italic text-sm">
                {nom_latin}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {description && (
        <div className="px-6 py-5 border-b border-gold/40">
          <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
            {description}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="px-6 py-5 border-b border-gold/40">
        <div className="grid grid-cols-2 gap-4">
          {esperance_vie && (
            <div className="border border-gold/50 rounded-lg p-4 bg-card/50">
              <p className="text-foreground/60 text-xs uppercase tracking-wider mb-1">
                ⏳ Longévité
              </p>
              <p className="text-gold font-heading text-sm font-semibold">
                {esperance_vie}
              </p>
            </div>
          )}
          <div className="border border-gold/50 rounded-lg p-4 bg-card/50">
            <p className="text-foreground/60 text-xs uppercase tracking-wider mb-1">
              ⭐ XP de départ
            </p>
            <p className="text-gold font-heading text-sm font-semibold">
              {xp_depart} XP
            </p>
          </div>
        </div>
      </div>

      {/* Costume requis */}
      {exigences_costume && (
        <div>
          <button
            onClick={() => setCostumeOuvert(!costumeOuvert)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-card/80 transition-colors duration-200"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎭</span>
              <span className="text-gold font-heading font-bold text-lg">
                Costume requis
              </span>
            </div>
            <ChevronDown
              size={20}
              className={`text-gold transition-transform duration-300 ${
                costumeOuvert ? 'rotate-180' : ''
              }`}
            />
          </button>

          {costumeOuvert && (
            <div className="px-6 pb-5 border-t border-gold/30">
              <p className="text-foreground/85 text-sm leading-relaxed whitespace-pre-wrap pt-4">
                {exigences_costume}
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default RaceCard;

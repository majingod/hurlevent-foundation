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
  nb_traits_raciaux: number;
}

const RaceCard: React.FC<RaceCardProps> = ({
  nom,
  nom_latin,
  emoji,
  esperance_vie,
  xp_depart,
  description,
  exigences_costume,
  nb_traits_raciaux,
}) => {
  const [ouvert, setOuvert] = useState(false);

  return (
    <div
      className="w-full border border-gold/60 rounded-lg bg-card hover:border-gold transition-colors duration-300 overflow-hidden shadow-lg cursor-pointer"
      onClick={() => setOuvert(!ouvert)}
    >
      {/* Header — toujours visible */}
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-3xl flex-shrink-0">{emoji}</span>
          <div className="min-w-0">
            <h2 className="text-2xl font-heading font-bold text-gold">
              {nom}
            </h2>
            <p className="text-sm text-foreground/70 mt-0.5">
              XP de départ : {xp_depart}
            </p>
          </div>
        </div>
        <ChevronDown
          size={20}
          className={`text-gold flex-shrink-0 transition-transform duration-300 ${ouvert ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Section dépliable */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: ouvert ? '1500px' : '0', opacity: ouvert ? 1 : 0 }}
      >
        <div className="px-6 pb-4 border-t border-gold/30 pt-4 space-y-3 text-sm text-foreground/85">
          {description && (
            <p className="leading-relaxed whitespace-pre-wrap">{description}</p>
          )}
          <dl className="space-y-1.5 mt-1">
            {esperance_vie && (
              <div className="flex flex-wrap gap-1">
                <dt className="font-semibold text-gold/80">Espérance de vie :</dt>
                <dd>{esperance_vie}</dd>
              </div>
            )}
            {exigences_costume && (
              <div className="flex flex-wrap gap-1">
                <dt className="font-semibold text-gold/80">Exigences de costume :</dt>
                <dd className="leading-relaxed">{exigences_costume}</dd>
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              <dt className="font-semibold text-gold/80">Traits raciaux :</dt>
              <dd>{nb_traits_raciaux}</dd>
            </div>
            {nom_latin && (
              <div className="flex flex-wrap gap-1">
                <dt className="font-semibold text-gold/80">Nom latin :</dt>
                <dd className="italic">{nom_latin}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Pied de carte */}
      <div className="px-6 py-2 flex justify-end">
        <span className="text-xs" style={{ color: '#c9a84c' }}>
          {ouvert ? 'Voir moins' : 'Voir plus'}
        </span>
      </div>
    </div>
  );
};

export default RaceCard;

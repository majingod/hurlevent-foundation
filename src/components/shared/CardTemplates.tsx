import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Composants existants — réexportés depuis encyclopedie/
export { default as RaceCard } from '@/components/encyclopedie/RaceCard';
export { default as ReligionCard } from '@/components/encyclopedie/ReligionCard';

// ─── Props communes ───────────────────────────────────────────────────────────

interface CardBaseProps {
  isSelected?: boolean;
  onSelect?: () => void;
  showSelectButton?: boolean;
}

// ─── Carte générique réutilisée par les stubs ─────────────────────────────────

const StubCard: React.FC<{
  titre: string;
  sousTitre?: string | null;
  isSelected?: boolean;
  onSelect?: () => void;
  children?: React.ReactNode;
}> = ({ titre, sousTitre, isSelected, onSelect, children }) => {
  const [ouvert, setOuvert] = useState(false);

  return (
    <div
      className={`w-full border rounded-lg bg-card shadow-lg cursor-pointer transition-colors duration-300 overflow-hidden ${
        isSelected ? 'border-gold ring-2 ring-gold' : 'border-gold/60 hover:border-gold'
      }`}
      onClick={() => { setOuvert(!ouvert); onSelect?.(); }}
    >
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-heading font-bold text-gold text-lg leading-tight">{titre}</p>
          {sousTitre && <p className="text-xs text-foreground/60 mt-0.5">{sousTitre}</p>}
        </div>
        <ChevronDown
          size={18}
          className={`text-gold flex-shrink-0 transition-transform duration-300 ${ouvert ? 'rotate-180' : ''}`}
        />
      </div>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: ouvert ? '9999px' : '0', opacity: ouvert ? 1 : 0 }}
      >
        {children && (
          <div className="px-5 pb-4 border-t border-gold/30 pt-4 text-sm text-foreground/80 space-y-2">
            {children}
          </div>
        )}
      </div>

      <div className="px-5 py-2 flex justify-between items-center">
        {isSelected && (
          <span className="text-xs font-semibold text-gold">✓ Sélectionné</span>
        )}
        <span className="text-xs text-gold/60 ml-auto">{ouvert ? 'Voir moins' : 'Voir plus'}</span>
      </div>
    </div>
  );
};

// ─── TraitRacialCard ──────────────────────────────────────────────────────────

export interface TraitRacialCardProps extends CardBaseProps {
  data: {
    id: string;
    nom: string;
    description?: string | null;
    cout_xp?: number | null;
    race?: string | null;
  };
}

export const TraitRacialCard: React.FC<TraitRacialCardProps> = ({ data, isSelected, onSelect }) => (
  <StubCard
    titre={data.nom}
    sousTitre={data.race ?? undefined}
    isSelected={isSelected}
    onSelect={onSelect}
  >
    {data.description && <p className="leading-relaxed whitespace-pre-wrap">{data.description}</p>}
    {data.cout_xp != null && <p className="text-gold/80 font-semibold">Coût XP : {data.cout_xp}</p>}
  </StubCard>
);

// ─── ClasseCard ───────────────────────────────────────────────────────────────

export interface ClasseCardProps extends CardBaseProps {
  data: {
    id: string;
    nom: string | null;
    emoji?: string | null;
    description?: string | null;
    pv_depart?: number | null;
    ps_depart?: number | null;
  };
}

export const ClasseCard: React.FC<ClasseCardProps> = ({ data, isSelected, onSelect }) => (
  <StubCard
    titre={`${data.emoji ?? ''} ${data.nom ?? ''}`.trim()}
    sousTitre={data.pv_depart != null ? `❤️ ${data.pv_depart} PV  ✨ ${data.ps_depart ?? '—'} PS` : undefined}
    isSelected={isSelected}
    onSelect={onSelect}
  >
    {data.description && <p className="leading-relaxed whitespace-pre-wrap">{data.description}</p>}
  </StubCard>
);

// ─── CompetenceCard ───────────────────────────────────────────────────────────

export interface CompetenceCardProps extends CardBaseProps {
  data: {
    id: string;
    nom: string | null;
    description?: string | null;
    categorie?: string | null;
  };
}

export const CompetenceCard: React.FC<CompetenceCardProps> = ({ data, isSelected, onSelect }) => (
  <StubCard
    titre={data.nom ?? ''}
    sousTitre={data.categorie ?? undefined}
    isSelected={isSelected}
    onSelect={onSelect}
  >
    {data.description && <p className="leading-relaxed">{data.description}</p>}
  </StubCard>
);

// ─── AssemblageCard ───────────────────────────────────────────────────────────

export interface AssemblageCardProps extends CardBaseProps {
  data: {
    id: string;
    nom: string | null;
    effet?: string | null;
    cible?: string | null;
    cout_ps?: number | null;
  };
}

export const AssemblageCard: React.FC<AssemblageCardProps> = ({ data, isSelected, onSelect }) => (
  <StubCard
    titre={data.nom ?? ''}
    sousTitre={data.cible ?? undefined}
    isSelected={isSelected}
    onSelect={onSelect}
  >
    {data.effet && <p className="leading-relaxed">{data.effet}</p>}
    {data.cout_ps != null && <p className="text-gold/80 font-semibold">Coût PS : {data.cout_ps}</p>}
  </StubCard>
);

// ─── RecetteAlchimieCard ──────────────────────────────────────────────────────

export interface RecetteAlchimieCardProps extends CardBaseProps {
  data: {
    id: string;
    nom: string | null;
    type?: string | null;
    niveau_requis?: number | null;
    effet?: string | null;
  };
}

export const RecetteAlchimieCard: React.FC<RecetteAlchimieCardProps> = ({ data, isSelected, onSelect }) => (
  <StubCard
    titre={data.nom ?? ''}
    sousTitre={data.type ?? undefined}
    isSelected={isSelected}
    onSelect={onSelect}
  >
    {data.effet && <p className="leading-relaxed">{data.effet}</p>}
    {data.niveau_requis != null && <p className="text-gold/80 font-semibold">Niveau requis : {data.niveau_requis}</p>}
  </StubCard>
);

// ─── SortArcanCard ────────────────────────────────────────────────────────────

export interface SortArcanCardProps extends CardBaseProps {
  data: {
    id: string;
    nom: string;
    cercle?: string | null;
    niveau?: number | null;
    description?: string | null;
    type_sort?: string | null;
    portee?: string | null;
    duree?: string | null;
  };
}

export const SortArcanCard: React.FC<SortArcanCardProps> = ({ data, isSelected, onSelect }) => (
  <StubCard
    titre={data.nom}
    sousTitre={data.cercle ? `${data.cercle} — Niveau ${data.niveau ?? '?'}` : undefined}
    isSelected={isSelected}
    onSelect={onSelect}
  >
    {data.description && <p className="leading-relaxed">{data.description}</p>}
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/60">
      {data.type_sort && <span>Type : {data.type_sort}</span>}
      {data.portee && <span>Portée : {data.portee}</span>}
      {data.duree && <span>Durée : {data.duree}</span>}
    </div>
  </StubCard>
);

// ─── PriereCard ───────────────────────────────────────────────────────────────

export interface PriereCardProps extends CardBaseProps {
  data: {
    id: string;
    nom: string;
    domaine?: string | null;
    niveau?: number | null;
    description?: string | null;
    type_priere?: string | null;
    portee?: string | null;
    duree?: string | null;
  };
}

export const PriereCard: React.FC<PriereCardProps> = ({ data, isSelected, onSelect }) => (
  <StubCard
    titre={data.nom}
    sousTitre={data.domaine ? `${data.domaine} — Niveau ${data.niveau ?? '?'}` : undefined}
    isSelected={isSelected}
    onSelect={onSelect}
  >
    {data.description && <p className="leading-relaxed">{data.description}</p>}
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/60">
      {data.type_priere && <span>Type : {data.type_priere}</span>}
      {data.portee && <span>Portée : {data.portee}</span>}
      {data.duree && <span>Durée : {data.duree}</span>}
    </div>
  </StubCard>
);

// ─── ForgeCard ────────────────────────────────────────────────────────────────

export interface ForgeCardProps extends CardBaseProps {
  data: {
    id: string;
    nom: string | null;
    type?: string | null;
    difficulte?: number | null;
    description?: string | null;
  };
}

export const ForgeCard: React.FC<ForgeCardProps> = ({ data, isSelected, onSelect }) => (
  <StubCard
    titre={data.nom ?? ''}
    sousTitre={data.type ?? undefined}
    isSelected={isSelected}
    onSelect={onSelect}
  >
    {data.description && <p className="leading-relaxed">{data.description}</p>}
    {data.difficulte != null && <p className="text-gold/80 font-semibold">Difficulté : {data.difficulte}</p>}
  </StubCard>
);

// ─── ReparationForgeCard ──────────────────────────────────────────────────────

export interface ReparationForgeCardProps extends CardBaseProps {
  data: {
    id: string;
    nom_affichage: string;
    categorie?: string;
    temps_minutes?: number;
    materiaux?: string | null;
  };
}

export const ReparationForgeCard: React.FC<ReparationForgeCardProps> = ({ data, isSelected, onSelect }) => (
  <StubCard
    titre={data.nom_affichage}
    sousTitre={data.categorie ?? undefined}
    isSelected={isSelected}
    onSelect={onSelect}
  >
    {data.materiaux && <p className="leading-relaxed">Matériaux : {data.materiaux}</p>}
    {data.temps_minutes != null && <p className="text-gold/80 font-semibold">Temps : {data.temps_minutes} min</p>}
  </StubCard>
);

// ─── JoaillerieCard ───────────────────────────────────────────────────────────

export interface JoaillerieCardProps extends CardBaseProps {
  data: {
    id: string;
    nom: string | null;
    effet?: string | null;
    difficulte?: number | null;
  };
}

export const JoaillerieCard: React.FC<JoaillerieCardProps> = ({ data, isSelected, onSelect }) => (
  <StubCard
    titre={data.nom ?? ''}
    isSelected={isSelected}
    onSelect={onSelect}
  >
    {data.effet && <p className="leading-relaxed">{data.effet}</p>}
    {data.difficulte != null && <p className="text-gold/80 font-semibold">Difficulté : {data.difficulte}</p>}
  </StubCard>
);

// ─── PiegeCard ────────────────────────────────────────────────────────────────

export interface PiegeCardProps extends CardBaseProps {
  data: {
    id: string;
    nom: string;
    type_piege?: string;
    niveau?: number | null;
    effets?: string | null;
    cible?: string | null;
    duree?: string | null;
  };
}

export const PiegeCard: React.FC<PiegeCardProps> = ({ data, isSelected, onSelect }) => (
  <StubCard
    titre={data.nom}
    sousTitre={data.type_piege ?? undefined}
    isSelected={isSelected}
    onSelect={onSelect}
  >
    {data.effets && <p className="leading-relaxed">{data.effets}</p>}
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/60">
      {data.cible && <span>Cible : {data.cible}</span>}
      {data.duree && <span>Durée : {data.duree}</span>}
    </div>
  </StubCard>
);

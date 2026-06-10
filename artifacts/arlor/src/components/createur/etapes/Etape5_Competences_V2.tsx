import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import ReligionDetails from "@/components/shared/ReligionDetails";
import { BadgeAcquis } from "@/components/createur/BadgeAcquis";
import { useDernierePhotoCompo } from "@/hooks/useDernierePhotoCompo";
import { estNiveauCompetenceAcquis } from "@/lib/acquisCampagne";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Loader2, Lock, Minus, Plus } from "lucide-react";

// =========================================================================
// TYPES
// =========================================================================

type CompetenceRow = Database["public"]["Tables"]["competences"]["Row"];
type PersonnageCompetenceRow =
  Database["public"]["Tables"]["personnage_competences"]["Row"];
type PersonnageRow = Database["public"]["Tables"]["personnages"]["Row"];
type ClasseRow = Database["public"]["Tables"]["classes"]["Row"];
type LangueRow = Database["public"]["Tables"]["langues"]["Row"];
type ReligionRow = Database["public"]["Tables"]["religions"]["Row"];
type CategorieCreatureRow =
  Database["public"]["Tables"]["categories_creatures"]["Row"];
type FamilleCriminelleRow =
  Database["public"]["Tables"]["familles_criminelles"]["Row"];

interface NiveauInfo {
  niveau: number;
  cout_xp: number;
  description?: string;
}

interface CompetenceWithNiveaux extends CompetenceRow {
  niveaux_parsed: NiveauInfo[];
  // La colonne existe en base (text[] nullable) mais n'est pas encore reflétée
  // dans les types Supabase générés. Le `select("*")` la ramène déjà.
  classes_requises: string[] | null;
}

interface AcheterCompetenceParams {
  p_personnage_id: string;
  p_competence_id: string;
  p_niveau_desire: number;
  p_appris_via_maitre?: boolean;
  p_nom_maitre?: string;
  p_choix_achat?: string;
}

interface CascadeItem {
  type: string;
  type_label: string;
  nom: string;
  quantite: number;
  xp_total: number;
  niveaux?: number[];
}

interface CascadeContext {
  competence: CompetenceWithNiveaux;
  achatCibleId: string;
  items: CascadeItem[];
  xpTotalRembourse: number;
}

interface Etape5Props {
  personnageId: string;
  /**
   * XP encore disponibles pour le personnage (xp_total - xp_depense).
   * Sert au grisage UI des contrôles d'achat quand le budget est insuffisant.
   * Le serveur reste l'arbitre final de la validation.
   */
  xpDisponible?: number;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onPrevious?: () => void;
  onXpDeltaChange?: (delta: number) => void;
  /**
   * Mode campagne (évolution) : verrouille visuellement les désachats d'acquis
   * (PR-C2). Miroir d'INV-3 backend, qui reste l'autorité.
   */
  modeCampagne?: boolean;
}

// =========================================================================
// CONSTANTES
// =========================================================================

const TAB_CONFIG: { key: string; label: string; categories: string[] }[] = [
  { key: "generale", label: "Générales", categories: ["generale", "générale"] },
  { key: "guerrier", label: "Guerrier", categories: ["guerrier"] },
  { key: "voleur", label: "Voleur", categories: ["voleur"] },
  { key: "mage", label: "Mage", categories: ["mage"] },
  { key: "pretre", label: "Prêtre", categories: ["pretre", "prêtre"] },
];

/**
 * Filtres de statut de l'étape 5 (C3c). Filtre GLOBAL partagé entre onglets.
 * Sémantique non-exclusive : une compétence partiellement achetée apparaît
 * à la fois dans "acquises" et "disponibles".
 */
type FiltreCompetence = "toutes" | "acquises" | "disponibles" | "bloquees";

const FILTRE_OPTIONS: { key: FiltreCompetence; label: string }[] = [
  { key: "toutes", label: "Toutes" },
  { key: "acquises", label: "Acquises" },
  { key: "disponibles", label: "Disponibles" },
  { key: "bloquees", label: "Bloquées" },
];

/**
 * Libellés affichés pour les classes dans les pastilles (PR C2 session 48).
 * Source : décision design Hybride 2 + icônes par classe.
 * Synchroniser ces clés avec normalizeCategorie() (minuscule, sans accent).
 */
const CLASSE_LABELS: Record<string, string> = {
  guerrier: "Classe Guerrier ⚔️",
  voleur: "Classe Voleur 🗡️",
  mage: "Classe Mage 🔮",
  pretre: "Classe Prêtre ⚜️",
};

/** Catégories qui correspondent à une classe jouable (pour BlocClasses). */
const CLASSES_JOUABLES = ["guerrier", "voleur", "mage", "pretre"] as const;

// type_achat qui cascade en DB (suppression ascendante des niveaux >= N)
// Compétences dupliquées mage/pretre en DB, soumises au trigger
// verifier_verrous_competences. Verrou mutuel : ne peut pas acheter
// les 2 versions sur le même personnage.
const COMP_VERROUS_MUTUELS = new Set([
  "Assemblage de Runes",
  "Canalisation",
  "Développement Spirituel",
  "Développement Spirituel Supérieur",
]);

// =========================================================================
// HELPERS
// =========================================================================

function parseNiveaux(raw: Json | null): NiveauInfo[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const obj = entry as Record<string, unknown>;
      return {
        niveau: typeof obj.niveau === "number" ? obj.niveau : Number(obj.niveau ?? 1),
        cout_xp: typeof obj.cout_xp === "number" ? obj.cout_xp : Number(obj.cout_xp ?? 0),
        description:
          typeof obj.description === "string" ? obj.description : undefined,
      } as NiveauInfo;
    })
    .filter((n): n is NiveauInfo => n !== null)
    .sort((a, b) => a.niveau - b.niveau);
}

function normalizeCategorie(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}


/**
 * Statut d'une pastille pour afficher le contexte d'un prérequis ou d'une classe.
 * - acquis : vert (✓) — la condition est remplie
 * - manquant : rouge (✗) — la condition n'est pas remplie (bloquant)
 * - restriction : orange (⚠) — accessible mais avec limitation (ex: hors classe max 2)
 */
type StatusPastille = "acquis" | "manquant" | "restriction";

const PASTILLE_STYLES: Record<StatusPastille, string> = {
  acquis: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  manquant: "border-red-500/40 bg-red-500/10 text-red-300",
  restriction: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

const PASTILLE_MARKERS: Record<StatusPastille, string> = {
  acquis: "✓",
  manquant: "✗",
  restriction: "⚠",
};

/** Pastille colorée avec marker pour afficher un statut (acquis / manquant / restriction). */
function PastilleStatus({
  status,
  children,
}: {
  status: StatusPastille;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${PASTILLE_STYLES[status]}`}
    >
      <span aria-hidden>{PASTILLE_MARKERS[status]}</span>
      {children}
    </span>
  );
}

/**
 * Pastille rouge legacy pour les blocages (prérequis manquants, verrous mutuels).
 * Conservée pour compatibilité avec MessageBlocage existant. À terme (PR C3),
 * MessageBlocage sera refondu pour utiliser PastilleStatus directement.
 */
function PastilleBlocage({ children }: { children: ReactNode }) {
  return <PastilleStatus status="manquant">{children}</PastilleStatus>;
}

/** Bloc message de blocage : un libellé + une ou plusieurs pastilles rouges. */
function MessageBlocage({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-xs text-red-400">
        <Lock className="h-3 w-3" />
        {label}
      </span>
      {items.map((item) => {
        // Mapping : si l'item est une catégorie de classe (guerrier/voleur/mage/pretre),
        // l'afficher avec le label complet (CLASSE_LABELS). Sinon, tel quel.
        const display = CLASSE_LABELS[item] ?? item;
        return <PastilleBlocage key={item}>{display}</PastilleBlocage>;
      })}
    </div>
  );
}

/**
 * Bloc "Classes" affiché en permanence sur chaque card de compétence.
 * Reflète la sémantique métier de classes_requises et categorie :
 *
 * - Compétence générale (est_general=true OU categorie='generale')
 *   → pastille verte "Toutes les Classes ✨"
 *
 * - classes_requises set (STRICTEMENT réservée)
 *   → pastille verte (joueur dans la liste) ou rouge (joueur exclu) par classe listée
 *
 * - classes_requises NULL + categorie ∈ {guerrier, voleur, mage, pretre}
 *   → compétence rattachée à la catégorie mais ACCESSIBLE hors classe au max niveau 2
 *   → si joueur match catégorie : pastille verte
 *   → si joueur ≠ catégorie : pastille orange + pastille "Accessible max niveau 2"
 *
 * - Cas non couvert (fallback) : ne rien afficher
 */
function BlocClasses({
  comp,
  classeJoueur,
  normalizeCategorieFn,
}: {
  comp: CompetenceWithNiveaux;
  classeJoueur: string;
  normalizeCategorieFn: (cat: string | null) => string;
}) {
  const cat = normalizeCategorieFn(comp.categorie);
  const isGenerale = comp.est_general || cat === "generale";

  const sectionLabel = (
    <span className="flex items-center gap-1 text-xs text-foreground/70">
      <span aria-hidden>🛡️</span> Classes :
    </span>
  );

  // Cas 1 : compétence générale (accessible à toutes les classes)
  if (isGenerale) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {sectionLabel}
        <PastilleStatus status="acquis">Toutes les Classes ✨</PastilleStatus>
      </div>
    );
  }

  // Cas 2 : classes_requises set (strictement réservée)
  if (comp.classes_requises && comp.classes_requises.length > 0) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {sectionLabel}
        {comp.classes_requises.map((c) => (
          <PastilleStatus
            key={c}
            status={c === classeJoueur ? "acquis" : "manquant"}
          >
            {CLASSE_LABELS[c] ?? c}
          </PastilleStatus>
        ))}
      </div>
    );
  }

  // Cas 3 : classes_requises NULL + catégorie de classe (accessible hors classe max 2)
  // La pastille de limite n'est affichée que si le joueur est HORS de cette classe
  // (pour sa propre classe, il n'y a pas de limite de niveau).
  if ((CLASSES_JOUABLES as readonly string[]).includes(cat)) {
    const joueurMatch = cat === classeJoueur;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {sectionLabel}
        <PastilleStatus status="acquis">Toutes les Classes ✨</PastilleStatus>
        {!joueurMatch && comp.niveaux_parsed.some((n) => n.niveau > 2) && (
          <PastilleStatus status="restriction">
            Accessible max niveau 2 sauf pour {CLASSE_LABELS[cat] ?? cat}
          </PastilleStatus>
        )}
      </div>
    );
  }

  // Fallback : pas d'info de classe à afficher
  return null;
}

// =========================================================================
// BLOC PRÉREQUIS (C3b)
// =========================================================================

/** Une pastille de prérequis : statut + libellé (+ competence_id si cliquable). */
type PastillePrereq = {
  statut: StatusPastille;
  label: string;
  /**
   * Présent (non-NULL) pour les prérequis inter-compétences (`type='competence'`) :
   * permet le badge cliquable (scroll+highlight). NULL pour les `special`
   * (Premiers Soins, 20 PS, etc.) → pastille non cliquable.
   */
  competenceId?: string | null;
};

/** Une ligne du bloc Prérequis : un niveau + ses pastilles. */
type LignePrereq = {
  niveau: number;
  /** Affiche le préfixe "Niv N :" devant les pastilles. */
  prefixe: boolean;
  pastilles: PastillePrereq[];
};

/** Données calculées du bloc Prérequis pour une compétence. */
type BlocPrerequisData = { afficher: boolean; lignes: LignePrereq[] };

// =========================================================================
// WIDGETS PURS PURE1a (props-in, zéro métier — extraction-ready)
// =========================================================================

/**
 * Statut d'une compétence au niveau de l'en-tête d'accordéon (NOUVEAU Pure1a).
 * Dérivé côté composant (pas de 5ᵉ état XP) :
 * - bloque      : classeBloque (classe / verrou mutuel) → gris + 🔒
 * - prereq      : !classeBloque && prereqBloqueTotal     → orange ●
 * - maitrisee   : dernier niveau acheté >= max niveaux   → vert ✓ (non répétable)
 * - disponible  : prochain niveau achetable              → vert ●
 */
type StatutCompetence = "bloque" | "prereq" | "maitrisee" | "disponible";

const STATUT_COMP_STYLES: Record<StatutCompetence, string> = {
  bloque: "border-zinc-600/50 bg-zinc-700/30 text-zinc-300",
  prereq: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  maitrisee: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  disponible: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

const STATUT_COMP_LABEL: Record<StatutCompetence, string> = {
  bloque: "Bloquée",
  prereq: "Prérequis manquant",
  maitrisee: "Maîtrisée",
  disponible: "Disponible",
};

/** Pastille de statut affichée sur l'en-tête de chaque compétence (4 états). */
function PastilleStatutCompetence({ statut }: { statut: StatutCompetence }) {
  const marker =
    statut === "bloque" ? (
      <Lock className="h-3 w-3" aria-hidden />
    ) : statut === "maitrisee" ? (
      <span aria-hidden>✓</span>
    ) : (
      <span aria-hidden>●</span>
    );
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${STATUT_COMP_STYLES[statut]}`}
    >
      {marker}
      {STATUT_COMP_LABEL[statut]}
    </span>
  );
}

/**
 * Badge prérequis cliquable (l'aspect le plus apprécié des testeurs).
 * - Rendu en `<button>` (scroll+highlight) si `competenceId` ET `onGo` fournis.
 * - Sinon pastille statique (cas `special`, competence_id NULL).
 * `stopPropagation` impératif : le clic ne doit pas toggler l'accordéon parent.
 */
function BadgePrereqCliquable({
  statut,
  label,
  competenceId,
  onGo,
}: {
  statut: StatusPastille;
  label: string;
  competenceId?: string | null;
  onGo?: (competenceId: string) => void;
}) {
  const cliquable = !!competenceId && !!onGo;
  const contenu = (
    <>
      <span aria-hidden>{PASTILLE_MARKERS[statut]}</span>
      {label}
      {cliquable && <span aria-hidden>↗</span>}
    </>
  );
  const cls = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${PASTILLE_STYLES[statut]}`;
  if (cliquable) {
    return (
      <button
        type="button"
        className={`${cls} cursor-pointer transition hover:brightness-125 focus:outline-none focus:ring-1 focus:ring-amber-400`}
        onClick={(e) => {
          e.stopPropagation();
          onGo!(competenceId!);
        }}
      >
        {contenu}
      </button>
    );
  }
  return <span className={cls}>{contenu}</span>;
}

/**
 * Légende repliable des pastilles de statut, sous la barre de filtres.
 * Repliée par défaut (état + toggle gérés par le parent).
 */
function LegendePastilles({
  ouvert,
  onToggle,
}: {
  ouvert: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 text-xs">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1 px-3 py-2 text-muted-foreground"
      >
        {ouvert ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        Légende des statuts
      </button>
      {ouvert && (
        <div className="flex flex-col gap-1.5 px-3 pb-3">
          <PastilleStatutCompetence statut="disponible" />
          <span className="text-muted-foreground">
            Achetable maintenant (prochain niveau disponible).
          </span>
          <PastilleStatutCompetence statut="maitrisee" />
          <span className="text-muted-foreground">
            Tous les niveaux acquis.
          </span>
          <PastilleStatutCompetence statut="prereq" />
          <span className="text-muted-foreground">
            Une autre compétence est requise — touchez le badge ⚠ pour y aller.
          </span>
          <PastilleStatutCompetence statut="bloque" />
          <span className="text-muted-foreground">
            Réservée à une autre classe (ou verrou mutuel).
          </span>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// COMPOSANT
// =========================================================================

const Etape5_Competences_V2 = ({
  personnageId,
  xpDisponible = 0,
  onSuccess,
  onError,
  onPrevious,
  onXpDeltaChange,
  modeCampagne = false,
}: Etape5Props) => {
  const queryClient = useQueryClient();

  // PR-C2 : photo de compo (frontière des acquis). Fetch seulement en campagne.
  const { data: photo } = useDernierePhotoCompo(personnageId, modeCampagne);

  // =======================================================================
  // ÉTATS LOCAUX
  // =======================================================================

  // Dialog "apprentissage avec maître" (existant)
  const [masterDialog, setMasterDialog] = useState<{
    competence: CompetenceWithNiveaux;
    niveau: NiveauInfo;
    choixAchat?: string;
  } | null>(null);
  const [masterName, setMasterName] = useState("");

  // Sous-accordéons des options à choix (Pure1b). Clé absente => repli par
  // défaut sauf si l'option a un achat (D2 : auto-ouverture). Valeur explicite
  // présente => respecte le pliage manuel choisi par l'utilisateur.
  const [optionsOuvertes, setOptionsOuvertes] = useState<Record<string, boolean>>({});
  const toggleOption = (key: string, ouvertActuel: boolean) =>
    setOptionsOuvertes((s) => ({ ...s, [key]: !ouvertActuel }));
  // Confirmation cascade de décochage
  const [cascadeDialog, setCascadeDialog] = useState<CascadeContext | null>(null);

  // Filtre de statut global (C3c) — partagé entre tous les onglets.
  const [filtre, setFiltre] = useState<FiltreCompetence>("toutes");

  // -- Pure1a : shell accordéon (pattern manuel Set + Chevrons, pas de Radix) --

  // Catégories dépliées (accordéon de 1er niveau). Toutes FERMÉES au départ :
  // le joueur ouvre lui-même la catégorie qu'il souhaite consulter en premier.
  const [categoriesOuvertes, setCategoriesOuvertes] = useState<Set<string>>(
    new Set<string>(),
  );
  const toggleCategorie = (key: string) => {
    setCategoriesOuvertes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Compétences dépliées (item accordéon de 2ᵉ niveau), par id.
  const [compsDepliees, setCompsDepliees] = useState<Set<string>>(new Set());
  const toggleComp = (compId: string) => {
    setCompsDepliees((prev) => {
      const next = new Set(prev);
      if (next.has(compId)) next.delete(compId);
      else next.add(compId);
      return next;
    });
  };

  // Sous-accordéons de niveau (multi-niveau), clé `${compId}-${niveau}`.
  const [niveauxDeplies, setNiveauxDeplies] = useState<Set<string>>(new Set());
  const toggleNiveau = (key: string) => {
    setNiveauxDeplies((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Légende des pastilles : repliée par défaut.
  const [legendeOuverte, setLegendeOuverte] = useState(false);

  // Infra scroll + highlight pour le badge prérequis cliquable.
  const compRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // Évite de ré-appliquer l'init des catégories par défaut une fois fait.

  // =======================================================================
  // QUERIES
  // =======================================================================

  const { data: personnage } = useQuery({
    queryKey: ["personnage", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnages")
        .select("*")
        .eq("id", personnageId)
        .single();
      if (error) throw error;
      return data as PersonnageRow;
    },
  });

  const { data: classe, isLoading: loadingClasse } = useQuery({
    queryKey: ["classe", personnage?.classe_id],
    queryFn: async () => {
      if (!personnage?.classe_id) return null;
      const { data, error } = await supabase
        .from("classes")
        .select("id, nom")
        .eq("id", personnage.classe_id)
        .single();
      if (error) throw error;
      return data as Pick<ClasseRow, "id" | "nom">;
    },
    enabled: !!personnage?.classe_id,
  });

  const classeNom = normalizeCategorie(classe?.nom ?? null);

  const { data: competences, isLoading: loadingCompetences } = useQuery({
    queryKey: ["competences-actives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competences")
        .select("*")
        .eq("est_actif", true)
        .order("nom");
      if (error) throw error;
      return (data ?? []).map<CompetenceWithNiveaux>((c) => ({
        ...c,
        niveaux_parsed: parseNiveaux(c.niveaux),
        // classes_requises est présent en base mais pas dans les types Supabase
        // générés (à régénérer). Le `select("*")` le ramène en runtime.
        classes_requises:
          (c as { classes_requises?: string[] | null }).classes_requises ?? null,
      }));
    },
  });

  const { data: achats, isLoading: loadingAchats } = useQuery({
    queryKey: ["personnage-competences", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnage_competences")
        .select("*")
        .eq("personnage_id", personnageId);
      if (error) throw error;
      return (data ?? []) as PersonnageCompetenceRow[];
    },
    enabled: !!personnageId,
  });

  const { data: prerequisMap } = useQuery({
    queryKey: ["prerequis-competences", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "verifier_prerequis_competences",
        { p_personnage_id: personnageId },
      );
      if (error) throw error;
      return (data ?? {}) as Record<
        string,
        {
          niveau_max_achetable: number;
          raisons_par_niveau: Record<string, string>;
          // C3b : typé manuellement (signature RPC inchangée, pas de regen types.ts)
          prereqs_par_niveau?: Record<
            string,
            Array<{
              label: string;
              statut: "acquis" | "manquant";
              competence_id?: string | null;
            }>
          >;
        }
      >;
    },
    enabled: !!personnageId,
  });

  const { data: langues } = useQuery({
    queryKey: ["langues-actives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("langues")
        .select("id, nom, est_ancienne")
        .eq("est_actif", true)
        .order("ordre");
      if (error) throw error;
      return (data ?? []) as Pick<LangueRow, "id" | "nom" | "est_ancienne">[];
    },
  });

  const { data: religions } = useQuery({
    queryKey: ["religions-actives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("religions")
        .select(
          "id, nom, dirigeant, fondateur, symbole_sacre, pouvoir_symbole, domaines_principaux, domaines_proscrits, lore_fiche, rituels_fiche, lore_manuel, rituels_manuel",
        )
        .eq("est_actif", true);
      if (error) throw error;
      return (data ?? []) as Pick<
        ReligionRow,
        | "id"
        | "nom"
        | "dirigeant"
        | "fondateur"
        | "symbole_sacre"
        | "pouvoir_symbole"
        | "domaines_principaux"
        | "domaines_proscrits"
        | "lore_fiche"
        | "rituels_fiche"
        | "lore_manuel"
        | "rituels_manuel"
      >[];
    },
  });

  const { data: categoriesCreatures } = useQuery({
    queryKey: ["categories-creatures-actives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories_creatures")
        .select("id, nom, ordre")
        .eq("est_actif", true)
        .order("ordre");
      if (error) throw error;
      return (data ?? []) as Pick<CategorieCreatureRow, "id" | "nom" | "ordre">[];
    },
  });

  const { data: famillesCriminelles } = useQuery({
    queryKey: ["familles-criminelles-actives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familles_criminelles")
        .select("id, nom")
        .eq("est_actif", true)
        .order("nom");
      if (error) throw error;
      return (data ?? []) as Pick<FamilleCriminelleRow, "id" | "nom">[];
    },
  });

  const { data: cercles } = useQuery({
    queryKey: ["cercles-actifs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sorts")
        .select("cercle")
        .eq("est_actif", true)
        .not("cercle", "is", null);
      if (error) throw error;
      const unique = Array.from(new Set((data ?? []).map((r) => r.cercle as string)));
      unique.sort((a, b) => a.localeCompare(b, "fr"));
      return unique;
    },
  });

  const { data: domaines } = useQuery({
    queryKey: ["domaines-actifs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prieres")
        .select("domaine")
        .eq("est_actif", true)
        .not("domaine", "is", null);
      if (error) throw error;
      const unique = Array.from(new Set((data ?? []).map((r) => r.domaine as string)));
      unique.sort((a, b) => a.localeCompare(b, "fr"));
      return unique;
    },
  });

  // =======================================================================
  // DÉRIVÉES MEMOIZED
  // =======================================================================

  const niveauxAchetes = useMemo(() => {
    const map = new Map<string, Set<number>>();
    (achats ?? []).forEach((a) => {
      if (!map.has(a.competence_id)) map.set(a.competence_id, new Set());
      map.get(a.competence_id)!.add(a.niveau_acquis);
    });
    return map;
  }, [achats]);

  const achatsParCompetence = useMemo(() => {
    const map = new Map<string, PersonnageCompetenceRow[]>();
    (achats ?? []).forEach((a) => {
      if (!map.has(a.competence_id)) map.set(a.competence_id, []);
      map.get(a.competence_id)!.push(a);
    });
    return map;
  }, [achats]);

  // L'achat est immédiat (RPC + refetch parent), le delta XP de cette étape
  // reste à 0. On reset à l'arrivée et au démontage.
  useEffect(() => {
    onXpDeltaChange?.(0);
    return () => {
      onXpDeltaChange?.(0);
    };
  }, [onXpDeltaChange]);

  // Clear du highlight ~2 s après son déclenchement.
  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => setHighlightId(null), 2000);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  /**
   * Navigue vers une compétence-prérequis : ouvre sa catégorie, déplie la
   * compétence, scrolle au centre et la met en surbrillance ~2 s.
   */
  const goToComp = (compId: string) => {
    const cible = (competences ?? []).find((c) => c.id === compId);
    if (cible) {
      const cat = normalizeCategorie(cible.categorie);
      const tab = TAB_CONFIG.find((t) => t.categories.includes(cat));
      const tabKey = tab?.key ?? (cible.est_general ? "generale" : null);
      if (tabKey) {
        setCategoriesOuvertes((prev) => {
          if (prev.has(tabKey)) return prev;
          const next = new Set(prev);
          next.add(tabKey);
          return next;
        });
      }
    }
    setCompsDepliees((prev) => {
      if (prev.has(compId)) return prev;
      const next = new Set(prev);
      next.add(compId);
      return next;
    });
    // Laisse le DOM se mettre à jour (catégorie/compétence dépliées) avant scroll.
    window.setTimeout(() => {
      const el = compRefs.current.get(compId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(compId);
    }, 60);
  };

  const competencesParTab = useMemo(() => {
    const grouped: Record<string, CompetenceWithNiveaux[]> = {};
    TAB_CONFIG.forEach((t) => (grouped[t.key] = []));
    (competences ?? []).forEach((c) => {
      const cat = normalizeCategorie(c.categorie);
      const tab = TAB_CONFIG.find((t) => t.categories.includes(cat));
      if (tab) grouped[tab.key].push(c);
      else if (c.est_general) grouped.generale.push(c);
    });
    // Sprint 5.5 Section 2.2 : tri alphabétique stable par catégorie.
    // localeCompare("fr", { sensitivity: "base" }) ignore accents et casse,
    // garantit un ordre prévisible indépendant de la collation Postgres.
    Object.keys(grouped).forEach((k) => {
      grouped[k].sort((a, b) =>
        (a.nom ?? "").localeCompare(b.nom ?? "", "fr", { sensitivity: "base" })
      );
    });
    return grouped;
  }, [competences]);

  const needsMaster = (comp: CompetenceWithNiveaux, niveau: number): boolean => {
    const cat = normalizeCategorie(comp.categorie);
    const isGenerale = comp.est_general || cat === "generale";
    const isOwnClass = !!classeNom && cat === classeNom;
    if (isGenerale || isOwnClass) return niveau >= 3;
    return niveau >= 2;
  };

  /**
   * Niveau maximum achetable selon la classe du personnage.
   * - Compétences générales OU de la classe du perso : max niveau 3
   * - Compétences hors classe et non générales : max niveau 2
   */
  const niveauMaxAccessible = (comp: CompetenceWithNiveaux): number => {
    const cat = normalizeCategorie(comp.categorie);
    const isGenerale = comp.est_general || cat === "generale";
    const isOwnClass = !!classeNom && cat === classeNom;
    if (isGenerale || isOwnClass) return 3;
    return 2;
  };

  /**
   * Calcule les données du bloc Prérequis (C3b) pour une compétence.
   * Option 2 exhaustive : on liste TOUS les niveaux de la compétence.
   *
   * Sources fusionnées :
   * - prereqs_par_niveau (RPC) : prérequis inter-compétences (✓/✗), couvre
   *   aussi les cas spéciaux Dépeçage et DSS. La RPC ne renvoie que les niveaux
   *   contraints, d'où l'itération sur comp.niveaux_parsed.
   * - needsMaster(comp, N) (frontend) : pastille "Maître Requis" (orange).
   * - niveauMaxAccessible(comp) (frontend) : un niveau au-delà du max est
   *   "Inaccessible hors de votre classe" (rouge, écrase tout).
   *
   * Le bloc s'affiche dès qu'au moins un niveau a une contrainte réelle
   * (un prérequis, un maître, ou une inaccessibilité hors-classe).
   */
  const buildPrerequisBloc = (
    comp: CompetenceWithNiveaux,
  ): BlocPrerequisData => {
    const niveaux = comp.niveaux_parsed;
    if (niveaux.length === 0) return { afficher: false, lignes: [] };

    const niveauMax = niveauMaxAccessible(comp);
    const prereqsParNiveau = prerequisMap?.[comp.id]?.prereqs_par_niveau ?? {};

    // Pas de préfixe "Niv N :" si la compétence n'a qu'un seul niveau (niv 1).
    const skipPrefixe = niveaux.length === 1 && niveaux[0].niveau === 1;

    let auMoinsUneContrainte = false;

    const lignes: LignePrereq[] = niveaux.map((niv) => {
      const N = niv.niveau;
      const pastilles: PastillePrereq[] = [];

      if (N > niveauMax) {
        // Hors-classe : écrase tout le reste pour ce niveau.
        pastilles.push({
          statut: "manquant",
          label: "Inaccessible hors de votre classe",
        });
        auMoinsUneContrainte = true;
      } else {
        // Prérequis inter-compétences depuis la RPC (peut être absent).
        for (const p of prereqsParNiveau[String(N)] ?? []) {
          pastilles.push({
            statut: p.statut === "acquis" ? "acquis" : "manquant",
            label: p.label,
            competenceId: p.competence_id ?? null,
          });
          auMoinsUneContrainte = true;
        }
        // Pastille "Maître Requis" (frontend).
        if (needsMaster(comp, N)) {
          pastilles.push({ statut: "restriction", label: "Maître Requis" });
          auMoinsUneContrainte = true;
        }
        // Aucune contrainte sur ce niveau → pastille verte neutre.
        if (pastilles.length === 0) {
          pastilles.push({ statut: "acquis", label: "Aucun Prérequis" });
        }
      }

      return { niveau: N, prefixe: !skipPrefixe, pastilles };
    });

    return { afficher: auMoinsUneContrainte, lignes };
  };

  /**
   * Pour les compétences à verrou mutuel mage/pretre : si la classe du perso
   * est mage ou pretre, l'autre version est réservée à la classe opposée.
   * Renvoie le nom de la classe réservataire à afficher, ou null si pas concerné.
   */
  const classeReservataireOpposee = (
    comp: CompetenceWithNiveaux,
  ): string | null => {
    if (!comp.nom || !COMP_VERROUS_MUTUELS.has(comp.nom)) return null;
    const cat = normalizeCategorie(comp.categorie);
    if (cat !== "mage" && cat !== "pretre") return null;
    if (classeNom !== "mage" && classeNom !== "pretre") return null;
    if (cat === classeNom) return null;
    return cat; // 'mage' ou 'pretre' — la classe à laquelle la version est réservée
  };

  /**
   * Pour les compétences à verrou mutuel : retourne le nom de la catégorie
   * opposée si la version opposée a déjà été achetée par le perso. Sinon null.
   */
  const versionOpposeeAchetee = (
    comp: CompetenceWithNiveaux,
  ): string | null => {
    if (!comp.nom || !COMP_VERROUS_MUTUELS.has(comp.nom)) return null;
    const cat = normalizeCategorie(comp.categorie);
    if (cat !== "mage" && cat !== "pretre") return null;
    const opposingCat = cat === "mage" ? "pretre" : "mage";
    const opposingComp = (competences ?? []).find(
      (c) =>
        c.nom === comp.nom && normalizeCategorie(c.categorie) === opposingCat,
    );
    if (!opposingComp) return null;
    const achatsOp = achatsParCompetence.get(opposingComp.id) ?? [];
    return achatsOp.length > 0 ? opposingCat : null;
  };

  /**
   * Calcule le détail du blocage tout-ou-rien pour la compétence : retourne
   * le contenu de MessageBlocage à afficher, ou null si pas bloquée.
   * Priorités :
   * 1. classes_requises explicite (ex: Bâton de Sorcier)
   * 2. Réservation classe mage/pretre opposée (verrous mutuels pour mage/pretre)
   * 3. Version opposée déjà achetée (verrou mutuel actif)
   */
  const blocageDetail = (
    comp: CompetenceWithNiveaux,
  ): { label: string; items: string[] } | null => {
    const requises = comp.classes_requises;
    if (requises && requises.length > 0 && !requises.includes(classeNom)) {
      return { label: "Réservé aux classes :", items: requises };
    }
    const classeOpposee = classeReservataireOpposee(comp);
    if (classeOpposee) {
      return { label: "Réservé aux classes :", items: [classeOpposee] };
    }
    const versionOp = versionOpposeeAchetee(comp);
    if (versionOp) {
      const labelCat = versionOp === "mage" ? "Mage" : "Prêtre";
      return {
        label: "Déjà acquise via :",
        items: [`Onglet ${labelCat}`],
      };
    }
    return null;
  };

  /**
   * True si la compétence est bloquée tout-ou-rien. Combine classes_requises,
   * réservation mage/pretre, et verrou mutuel.
   */
  const classeBloque = (comp: CompetenceWithNiveaux): boolean => {
    return blocageDetail(comp) !== null;
  };

  /**
   * Infos de blocage par prérequis inter-compétences pour une compétence donnée.
   * Retourne null si la compétence n'a aucun blocage (absente du map RPC).
   * `niveauMaxAchetable` = niveau le plus haut achetable côté prérequis (0, 1 ou 2).
   * `raisonPourNiveau(n)` = message à afficher pour le niveau n, avec fallback si
   * le niveau n est absent de `raisons_par_niveau` mais reste > niveauMaxAchetable.
   */
  const getPrereqInfo = (comp: CompetenceWithNiveaux) => {
    const entry = prerequisMap?.[comp.id];
    if (!entry) return null;
    return {
      niveauMaxAchetable: entry.niveau_max_achetable,
      raisonPourNiveau: (niveau: number): string | null => {
        if (niveau <= entry.niveau_max_achetable) return null;
        return (
          entry.raisons_par_niveau?.[String(niveau)] ??
          "Prérequis non rempli pour ce niveau."
        );
      },
    };
  };

  /**
   * True si TOUS les niveaux de la compétence sont bloqués par un prérequis
   * inter-compétence manquant (niveau_max_achetable === 0). Dans ce cas, la
   * compétence est traitée comme un blocage tout-ou-rien, comme classeBloque.
   * Un blocage PARTIEL (certains niveaux achetables) renvoie false ici : il
   * est géré ligne par ligne.
   */
  const prereqBloqueTotal = (comp: CompetenceWithNiveaux): boolean => {
    const info = getPrereqInfo(comp);
    return !!info && info.niveauMaxAchetable === 0;
  };

  // =======================================================================
  // PRÉDICATS DE FILTRE (C3c)
  // =======================================================================

  /** Au moins un niveau a été acheté. */
  const estAcquiseFiltre = (comp: CompetenceWithNiveaux): boolean =>
    (achatsParCompetence.get(comp.id) ?? []).length > 0;

  /**
   * Totalement bloquée : aucun niveau n'est achetable.
   * - classeBloque : blocage tout-ou-rien (classe / verrou mutuel)
   * - prereqBloqueTotal : niveau_max_achetable === 0
   * - tous les niveaux au-delà du plafond de classe (cas "entièrement
   *   hors-classe", rarissime mais correct)
   */
  const estBloqueeFiltre = (comp: CompetenceWithNiveaux): boolean => {
    if (classeBloque(comp) || prereqBloqueTotal(comp)) return true;
    const plafondClasse = niveauMaxAccessible(comp);
    return (
      comp.niveaux_parsed.length > 0 &&
      comp.niveaux_parsed.every((niv) => niv.niveau > plafondClasse)
    );
  };

  /**
   * Au moins un niveau encore achetable : non bloquée, et au moins un niveau
   * sous les plafonds classe ET prereq qui n'est pas déjà acheté.
   * Sémantique non-exclusive : peut être vraie en même temps qu'estAcquiseFiltre.
   */
  const estDisponibleFiltre = (comp: CompetenceWithNiveaux): boolean => {
    if (estBloqueeFiltre(comp)) return false;
    const achetes = new Set(
      (achatsParCompetence.get(comp.id) ?? []).map((a) => a.niveau_acquis),
    );
    const plafondPrereq =
      getPrereqInfo(comp)?.niveauMaxAchetable ?? Number.POSITIVE_INFINITY;
    const plafond = Math.min(niveauMaxAccessible(comp), plafondPrereq);
    return comp.niveaux_parsed.some(
      (niv) => niv.niveau <= plafond && !achetes.has(niv.niveau),
    );
  };

  /** Applique le filtre courant à une compétence. */
  const matchFiltre = (comp: CompetenceWithNiveaux): boolean => {
    switch (filtre) {
      case "acquises":
        return estAcquiseFiltre(comp);
      case "disponibles":
        return estDisponibleFiltre(comp);
      case "bloquees":
        return estBloqueeFiltre(comp);
      default:
        return true;
    }
  };

  // =======================================================================
  // OPTIONS À CHOIX (Pure1b) — univers complet + état par couple choix/niveau
  // =======================================================================

  type OptionChecklist = { value: string; label: string; accessible: boolean };

  /**
   * Univers COMPLET d'options pour un `type_choix`, SANS filtrer le déjà-pris
   * (la checklist affiche tout, coché = acheté). `accessible=false` => option
   * verrouillée (ex. Dépeçage d'une catégorie dont le perso n'a pas
   * Connaissances des Créatures) : affichée mais non dépliable.
   */
  const getToutesOptions = (comp: CompetenceWithNiveaux): OptionChecklist[] => {
    const t = comp.type_choix;
    if (!t) return [];
    if (t === "religion") {
      return (religions ?? [])
        .filter((r): r is typeof r & { nom: string } => r.nom !== null)
        .map((r) => ({ value: r.id, label: r.nom, accessible: true }));
    }
    if (t === "langue") {
      return (langues ?? [])
        .filter((l) => !l.est_ancienne)
        .map((l) => ({ value: l.id, label: l.nom, accessible: true }));
    }
    if (t === "langue_ancienne") {
      return (langues ?? [])
        .filter((l) => l.est_ancienne)
        .map((l) => ({ value: l.id, label: l.nom, accessible: true }));
    }
    if (t === "categorie_creature") {
      return (categoriesCreatures ?? []).map((c) => ({
        value: c.nom,
        label: c.nom,
        accessible: true,
      }));
    }
    if (t === "categorie_depecage") {
      // Accessible uniquement pour les catégories où le perso possède
      // Connaissances des Créatures (D1 : on affiche tout, le reste verrouillé).
      const connais = (achats ?? []).filter(
        (a) =>
          (competences ?? []).find((cc) => cc.id === a.competence_id)?.nom ===
          "Connaissances des Créatures",
      );
      const acc = new Set(
        connais.map((a) => a.choix_achat).filter(Boolean) as string[],
      );
      return (categoriesCreatures ?? []).map((c) => ({
        value: c.nom,
        label: c.nom,
        accessible: acc.has(c.nom),
      }));
    }
    if (t === "cercle") {
      return (cercles ?? []).map((c) => ({ value: c, label: c, accessible: true }));
    }
    if (t === "domaine") {
      return (domaines ?? []).map((d) => ({ value: d, label: d, accessible: true }));
    }
    if (t === "famille_criminelle") {
      return (famillesCriminelles ?? [])
        .filter((f): f is typeof f & { nom: string } => f.nom !== null)
        .map((f) => ({ value: f.nom, label: f.nom, accessible: true }));
    }
    return [];
  };

  type NiveauChoixState = {
    achat: PersonnageCompetenceRow | undefined;
    dejaAchete: boolean;
    estGratuit: boolean;
    disabled: boolean;
    niveauPrecedentRequis: boolean;
    bloque: boolean;
    xpInsuffisants: boolean;
    /** PR-C2 : niveau (pour ce choix) scellé par la photo de compo. */
    acquis: boolean;
  };

  /**
   * État d'achat d'un niveau POUR UN CHOIX donné (cercle/famille/catégorie...).
   * Miroir de `niveauAchatState` mais cadencé sur le `choix_achat` (le max
   * acheté est calculé par choix, pas globalement). Connaissances Criminelles :
   * le 1er niveau avec choix est le niveau 2 (le niveau 1 est un savoir général
   * sans choix géré à part) => la cascade « niveau précédent requis » démarre à 3.
   */
  const niveauChoixState = (
    comp: CompetenceWithNiveaux,
    niv: NiveauInfo,
    choixValue: string,
  ): NiveauChoixState => {
    const achatsDuChoix = (achatsParCompetence.get(comp.id) ?? []).filter(
      (a) => a.choix_achat === choixValue,
    );
    const maxAcheteChoix = achatsDuChoix.length
      ? Math.max(...achatsDuChoix.map((a) => a.niveau_acquis))
      : 0;
    const niveauPrecedentMin = comp.nom === "Connaissances Criminelles" ? 2 : 1;
    const achat = achatsDuChoix.find((a) => a.niveau_acquis === niv.niveau);
    const dejaAchete = !!achat;
    const estGratuit = achat?.xp_depense === 0;
    const niveauPrecedentRequis =
      niv.niveau > niveauPrecedentMin && niv.niveau - 1 > maxAcheteChoix;
    const niveauHorsClasse = niv.niveau > niveauMaxAccessible(comp);
    const prereqInfo = getPrereqInfo(comp);
    const prereqBloque =
      !!prereqInfo && niv.niveau > prereqInfo.niveauMaxAchetable;
    const compBloqueeClasse = classeBloque(comp);
    const xpInsuffisants =
      !dejaAchete && niv.cout_xp > 0 && niv.cout_xp > xpDisponible;
    const acquis = estNiveauCompetenceAcquis(
      modeCampagne,
      photo,
      comp.id,
      choixValue,
      niv.niveau,
    );
    const disabled =
      compBloqueeClasse ||
      niveauHorsClasse ||
      prereqBloque ||
      (!dejaAchete && niveauPrecedentRequis) ||
      mutationEnCours ||
      (dejaAchete && estGratuit) ||
      xpInsuffisants ||
      acquis;
    return {
      achat,
      dejaAchete,
      estGratuit,
      disabled,
      niveauPrecedentRequis,
      bloque: compBloqueeClasse || niveauHorsClasse || prereqBloque,
      xpInsuffisants,
      acquis,
    };
  };

  // =======================================================================
  // MUTATIONS
  // =======================================================================

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
    });
  };

  const acheterMutation = useMutation({
    mutationFn: async (params: AcheterCompetenceParams) => {
      const { data, error } = await supabase.rpc("acheter_competence", params);
      if (error) throw error;
      const payload = (data ?? {}) as Record<string, any>;
      if (payload.succes !== true) {
        const msg =
          (payload.erreurs?.[0]?.message as string | undefined) ??
          (payload.erreurs?.[0]?.code as string | undefined) ??
          "L'achat a échoué.";
        throw new Error(msg);
      }
      return payload;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Compétence achetée !");
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const desacheterMutation = useMutation({
    mutationFn: async (params: { p_personnage_competence_id: string }) => {
      const { data, error } = await supabase.rpc("desacheter_competence", params);
      if (error) throw error;
      const payload = (data ?? {}) as Record<string, any>;
      if (payload.succes !== true) {
        const msg =
          (payload.erreurs?.[0]?.message as string | undefined) ??
          (payload.erreurs?.[0]?.code as string | undefined) ??
          "L'annulation a échoué.";
        throw new Error(msg);
      }
      return payload;
    },
    onSuccess: (data) => {
      invalidateAll();
      const d = (data?.donnees ?? {}) as Record<string, number>;
      const nbComp = d.count_competences ?? 0;
      const nbSorts = d.count_sorts ?? 0;
      const nbPrieres = d.count_prieres ?? 0;
      const xpRembourse = d.xp_rembourse ?? 0;
      const parts: string[] = [];
      if (nbComp > 0)
        parts.push(`${nbComp} niveau${nbComp > 1 ? "x" : ""} de compétence`);
      if (nbSorts > 0) parts.push(`${nbSorts} sort${nbSorts > 1 ? "s" : ""}`);
      if (nbPrieres > 0)
        parts.push(`${nbPrieres} prière${nbPrieres > 1 ? "s" : ""}`);
      const resume = parts.length > 0 ? parts.join(", ") : "achat";
      toast.success(`${resume} annulé(s) — ${xpRembourse} XP remboursés`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  // Avance etape_creation de 5 a 6 cote serveur. Les etapes 5-9 n'ont pas
  // de sauvegarder_etape_N : sans cet appel, le bouton « Suivant » ne ferait
  // que relire etape_creation et resterait bloque sur l'etape courante.
  const avancerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("avancer_etape", {
        p_personnage_id: personnageId,
        p_etape_courante: 5,
      });
      if (error) throw error;
      const payload = (data ?? {}) as Record<string, any>;
      if (payload.succes !== true) {
        const msg =
          (payload.erreurs?.[0]?.message as string | undefined) ??
          (payload.erreurs?.[0]?.code as string | undefined) ??
          "Impossible de passer a l'etape suivante.";
        throw new Error(msg);
      }
      return payload;
    },
    onSuccess: (payload) => {
      const avertissements =
        (payload?.avertissements as Array<{ message?: string }> | undefined) ??
        [];
      if (avertissements[0]?.message) toast.info(avertissements[0].message);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const mutationEnCours = acheterMutation.isPending || desacheterMutation.isPending;

  // =======================================================================
  // HANDLERS
  // =======================================================================

  const handleBuy = (
    comp: CompetenceWithNiveaux,
    niveau: NiveauInfo,
    choixAchat?: string,
  ) => {
    if (needsMaster(comp, niveau.niveau)) {
      setMasterDialog({ competence: comp, niveau, choixAchat });
      setMasterName("");
      return;
    }
    acheterMutation.mutate({
      p_personnage_id: personnageId,
      p_competence_id: comp.id,
      p_niveau_desire: niveau.niveau,
      ...(choixAchat ? { p_choix_achat: choixAchat } : {}),
    });
  };

  const confirmMaster = () => {
    if (!masterDialog) return;
    const trimmed = masterName.trim();
    if (!trimmed) {
      toast.error("Le nom du maître est obligatoire.");
      return;
    }
    acheterMutation.mutate({
      p_personnage_id: personnageId,
      p_competence_id: masterDialog.competence.id,
      p_niveau_desire: masterDialog.niveau.niveau,
      p_appris_via_maitre: true,
      p_nom_maitre: trimmed,
      ...(masterDialog.choixAchat ? { p_choix_achat: masterDialog.choixAchat } : {}),
    });
    setMasterDialog(null);
  };

  /**
   * Décochage d'un achat. On demande au serveur un APERÇU (dry-run) de la
   * cascade complète (niveaux supérieurs de la même compétence + dépendants
   * inter-compétences + sorts/prières si un enabler est touché). Si la cascade
   * ne retire qu'un seul niveau d'une seule compétence (aucun sort/prière), on
   * supprime directement ; sinon on ouvre la modale de confirmation.
   */
  const handleUncheck = (
    comp: CompetenceWithNiveaux,
    achat: PersonnageCompetenceRow,
  ) => {
    // PR-C2 : garde défensive — un acquis scellé par la photo ne peut être
    // retiré (miroir d'INV-3 backend, qui refuse de toute façon le désachat).
    if (
      estNiveauCompetenceAcquis(
        modeCampagne,
        photo,
        comp.id,
        achat.choix_achat ?? null,
        achat.niveau_acquis,
      )
    ) {
      toast.error(
        "Cet acquis a été joué en événement — il ne peut plus être retiré.",
      );
      return;
    }
    if (achat.xp_depense === 0 && !comp.desachat_force) {
      toast.error("Une compétence gratuite ne peut pas être désachetée.");
      return;
    }

    void (async () => {
      let donnees: Record<string, unknown>;
      try {
        const { data, error } = await supabase.rpc("desacheter_competence", {
          p_personnage_competence_id: achat.id,
          p_dry_run: true,
        });
        if (error) throw error;
        const payload = (data ?? {}) as Record<string, any>;
        if (payload.succes !== true) {
          throw new Error(
            (payload.erreurs?.[0]?.message as string | undefined) ??
              "Impossible de calculer l'aperçu du retrait.",
          );
        }
        donnees = (payload.donnees ?? {}) as Record<string, unknown>;
      } catch (e) {
        toast.error((e as Error).message);
        return;
      }

      const items = (donnees.items_detail ?? []) as CascadeItem[];
      const nbLignes = (donnees.count_competences as number) ?? 0;
      const aDesSortsOuPrieres =
        ((donnees.count_sorts as number) ?? 0) > 0 ||
        ((donnees.count_prieres as number) ?? 0) > 0;

      // Pas de cascade réelle (1 seul niveau d'1 seule compétence, aucun
      // sort/prière) → suppression directe sans modale.
      if (nbLignes <= 1 && !aDesSortsOuPrieres) {
        desacheterMutation.mutate({ p_personnage_competence_id: achat.id });
        return;
      }

      setCascadeDialog({
        competence: comp,
        achatCibleId: achat.id,
        items,
        xpTotalRembourse: (donnees.xp_rembourse as number) ?? 0,
      });
    })();
  };

  const confirmCascade = () => {
    if (!cascadeDialog) return;
    desacheterMutation.mutate({
      p_personnage_competence_id: cascadeDialog.achatCibleId,
    });
    setCascadeDialog(null);
  };

  /**
   * Confirme l'achat depuis le panneau "+ Ajouter une autre" (multiple_*).
   * Le niveau visé est : pour multiple_choix_distinct = 1 ; pour
   * multiple_avec_choix_par_niveau = max+1 (achat séquentiel par choix global).
   */
  /**
   * Trouve la ligne d'achat à supprimer pour un (comp, niveau) donné.
   * Pour `simple`, il n'y a qu'une ligne par niveau.
   * Pour `multiple_*`, le décochage passe par la section "Achats existants",
   * jamais par les niveaux globaux (donc cette fonction n'est pas appelée).
   */
  const findAchatPourNiveau = (
    comp: CompetenceWithNiveaux,
    niveau: number,
  ): PersonnageCompetenceRow | undefined => {
    const list = achatsParCompetence.get(comp.id) ?? [];
    return list.find((a) => a.niveau_acquis === niveau);
  };

  // =======================================================================
  // RENDER : helpers de statut (Pure1a)
  // =======================================================================

  /**
   * Statut de la compétence pour la pastille d'en-tête (4 états).
   * Priorité : bloque > prereq (total) > maitrisee > disponible.
   * Les types répétables (sans_choix / multiple_*) ne sont jamais « maîtrisés ».
   * Le plafond « maîtrisée » combine le max des niveaux et le plafond de classe
   * (statiques) ; on n'utilise PAS le plafond prérequis (dynamique) pour ne pas
   * marquer « maîtrisée » une compétence qui se débloquera plus tard.
   */
  const calcStatutCompetence = (
    comp: CompetenceWithNiveaux,
  ): StatutCompetence => {
    if (classeBloque(comp)) return "bloque";
    if (prereqBloqueTotal(comp)) return "prereq";

    const repeatable =
      comp.type_achat === "multiple_sans_choix" ||
      comp.type_achat === "multiple_choix_distinct" ||
      comp.type_achat === "multiple_avec_choix_par_niveau";

    if (!repeatable) {
      const achetes = niveauxAchetes.get(comp.id) ?? new Set<number>();
      const maxAchete = achetes.size ? Math.max(...achetes) : 0;
      const niveaux = comp.niveaux_parsed.map((n) => n.niveau);
      if (niveaux.length > 0) {
        const plafond = Math.min(
          Math.max(...niveaux),
          niveauMaxAccessible(comp),
        );
        if (maxAchete > 0 && maxAchete >= plafond) return "maitrisee";
      }
    }
    return "disponible";
  };

  /**
   * Badge prérequis cliquable d'en-tête : pointe vers le 1ᵉʳ niveau bloqué et
   * son 1ᵉʳ prérequis manquant. Affiché uniquement quand statut === "prereq".
   */
  const headerPrereqBadge = (
    comp: CompetenceWithNiveaux,
    statut: StatutCompetence,
    blocData: BlocPrerequisData,
  ): ReactNode => {
    if (statut !== "prereq") return null;
    for (const ligne of blocData.lignes) {
      const avecId = ligne.pastilles.find(
        (p) => p.statut === "manquant" && p.competenceId,
      );
      const choisi = avecId ?? ligne.pastilles.find((p) => p.statut === "manquant");
      if (choisi) {
        return (
          <BadgePrereqCliquable
            statut="manquant"
            label={`Pour Niv ${ligne.niveau} : ${choisi.label}`}
            competenceId={choisi.competenceId}
            onGo={goToComp}
          />
        );
      }
    }
    return null;
  };

  /**
   * Badge de coût d'en-tête « Niv X → Y XP », pour les `simple` disponibles.
   * Les autres types (choix, sans_choix) montrent leur coût dans le corps.
   */
  const headerCoutBadge = (
    comp: CompetenceWithNiveaux,
    statut: StatutCompetence,
  ): ReactNode => {
    if (statut !== "disponible" || comp.type_achat !== "simple") return null;
    const niveauxDispo = comp.niveaux_parsed.map((n) => n.niveau);
    if (niveauxDispo.length === 0) return null;
    const niveauMaxComp = Math.max(...niveauxDispo);
    const prereqInfo = getPrereqInfo(comp);
    const niveauMaxEffectif = Math.min(
      niveauMaxAccessible(comp),
      prereqInfo?.niveauMaxAchetable ?? Infinity,
      niveauMaxComp,
    );
    const achetes = niveauxAchetes.get(comp.id) ?? new Set<number>();
    const dernierAchete = achetes.size ? Math.max(...achetes) : 0;
    const prochain = dernierAchete + 1;
    if (prochain > niveauMaxEffectif) return null;
    const niveauInfo = comp.niveaux_parsed.find((n) => n.niveau === prochain);
    if (!niveauInfo) return null;
    return (
      <Badge variant="outline" className="whitespace-nowrap text-xs">
        Niv {prochain} → {niveauInfo.cout_xp} XP
      </Badge>
    );
  };

  // =======================================================================
  // RENDER : état d'achat d'un niveau (logique partagée mono/multi)
  // =======================================================================

  type NiveauAchatState = {
    dejaAchete: boolean;
    achat: PersonnageCompetenceRow | undefined;
    estGratuit: boolean;
    niveauHorsClasse: boolean;
    prereqBloque: boolean;
    compBloqueeClasse: boolean;
    xpInsuffisants: boolean;
    niveauPrecedentRequis: boolean;
    /** PR-C2 : niveau scellé par la photo de compo (acquis, désachat refusé). */
    acquis: boolean;
    disabled: boolean;
  };

  const niveauAchatState = (
    comp: CompetenceWithNiveaux,
    niv: NiveauInfo,
    maxAchete: number,
  ): NiveauAchatState => {
    const dejaAchete = (niveauxAchetes.get(comp.id) ?? new Set<number>()).has(
      niv.niveau,
    );
    const niveauPrecedentRequis = niv.niveau > 1 && niv.niveau - 1 > maxAchete;
    const achat = findAchatPourNiveau(comp, niv.niveau);
    const estGratuit = achat?.xp_depense === 0;
    const niveauHorsClasse = niv.niveau > niveauMaxAccessible(comp);
    const prereqInfo = getPrereqInfo(comp);
    const prereqBloque =
      !!prereqInfo && niv.niveau > prereqInfo.niveauMaxAchetable;
    const compBloqueeClasse = classeBloque(comp);
    const xpInsuffisants =
      !dejaAchete && niv.cout_xp > 0 && niv.cout_xp > xpDisponible;
    // PR-C2 : les renderers `simple` n'ont pas de choix → choixAchat = null.
    const acquis = estNiveauCompetenceAcquis(
      modeCampagne,
      photo,
      comp.id,
      null,
      niv.niveau,
    );
    const disabled =
      compBloqueeClasse ||
      niveauHorsClasse ||
      prereqBloque ||
      niveauPrecedentRequis ||
      mutationEnCours ||
      (dejaAchete && estGratuit && !comp.desachat_force) ||
      xpInsuffisants ||
      acquis;
    return {
      dejaAchete,
      achat,
      estGratuit,
      niveauHorsClasse,
      prereqBloque,
      compBloqueeClasse,
      xpInsuffisants,
      niveauPrecedentRequis,
      acquis,
      disabled,
    };
  };

  /** Case à cocher d'un niveau (achat/désachat direct). stopPropagation pour
   *  ne pas toggler le sous-accordéon de niveau qui l'enveloppe (cas multi). */
  const renderCheckboxNiveau = (
    comp: CompetenceWithNiveaux,
    niv: NiveauInfo,
    st: NiveauAchatState,
  ) => (
    <Checkbox
      id={`${comp.id}-${niv.niveau}`}
      checked={st.dejaAchete}
      disabled={st.disabled}
      title={
        st.xpInsuffisants
          ? `XP insuffisants (manque ${niv.cout_xp - xpDisponible} XP)`
          : undefined
      }
      onClick={(e) => e.stopPropagation()}
      onCheckedChange={(checked) => {
        if (checked) {
          handleBuy(comp, niv);
        } else if (st.achat) {
          handleUncheck(comp, st.achat);
        }
      }}
    />
  );

  /**
   * Libellé VISIBLE « Manque X XP ». Le tooltip `title` des cases ne s'affiche
   * pas au survol sur mobile : sans ce libellé, une case grisée faute d'XP
   * paraît cassée. À afficher uniquement quand `xpInsuffisants` est vrai.
   */
  const renderManqueXp = (coutXp: number): ReactNode => (
    <span className="flex items-center gap-1 text-xs text-amber-400">
      <Lock className="h-3 w-3" /> Manque {coutXp - xpDisponible} XP
    </span>
  );

  /** Ligne « Prérequis » d'un niveau donné (vert ✓ rempli / orange ⚠ cliquable). */
  const renderLignePrereqNiveau = (
    niv: NiveauInfo,
    blocData: BlocPrerequisData,
  ): ReactNode => {
    const ligne = blocData.lignes.find((l) => l.niveau === niv.niveau);
    if (!ligne || ligne.pastilles.length === 0) return null;
    return (
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1 text-xs text-foreground/70">
          <span aria-hidden>🔒</span> Prérequis :
        </span>
        <div className="flex flex-col items-start gap-1 pl-1">
          {ligne.pastilles.map((p, i) => (
            <BadgePrereqCliquable
              key={i}
              statut={p.statut}
              label={p.label}
              competenceId={p.statut === "manquant" ? p.competenceId : undefined}
              onGo={p.statut === "manquant" ? goToComp : undefined}
            />
          ))}
        </div>
      </div>
    );
  };

  // =======================================================================
  // RENDER : corps `simple` — mono (1 niveau) / multi (≥2 niveaux)
  // =======================================================================

  /** Corps mono-niveau : détail direct (description + case), pas de sous-accordéon. */
  const renderBodyMono = (
    comp: CompetenceWithNiveaux,
    blocData: BlocPrerequisData,
  ): ReactNode => {
    const niv = comp.niveaux_parsed[0];
    if (!niv) {
      return (
        <p className="text-xs italic text-muted-foreground">
          Aucun niveau défini pour cette compétence.
        </p>
      );
    }
    const achetes = niveauxAchetes.get(comp.id) ?? new Set<number>();
    const maxAchete = achetes.size ? Math.max(...achetes) : 0;
    const st = niveauAchatState(comp, niv, maxAchete);
    return (
      <div className="space-y-2">
        <div
          className={`flex items-center gap-3 rounded border p-2 ${
            st.acquis ? "border-gold/40 bg-gold/10" : "border-border"
          } ${
            !st.acquis &&
            (st.compBloqueeClasse || st.niveauHorsClasse || st.prereqBloque)
              ? "opacity-50"
              : ""
          }`}
        >
          {renderCheckboxNiveau(comp, niv, st)}
          <Label
            htmlFor={`${comp.id}-${niv.niveau}`}
            className="flex flex-1 cursor-pointer flex-wrap items-center gap-2 text-xs"
          >
            <Badge variant="secondary" className="text-xs">
              {niv.cout_xp} XP
            </Badge>
            {st.acquis && <BadgeAcquis />}
            {st.estGratuit && (
              <Badge className="border border-green-600/30 bg-green-600/20 text-xs text-green-400">
                Acquis gratuitement
              </Badge>
            )}
            {st.xpInsuffisants && renderManqueXp(niv.cout_xp)}
          </Label>
        </div>
        {niv.description && (
          <p className="text-xs text-muted-foreground">{niv.description}</p>
        )}
        {renderLignePrereqNiveau(niv, blocData)}
      </div>
    );
  };

  /** Corps multi-niveaux : un sous-accordéon par niveau (case sur l'en-tête). */
  const renderBodyMulti = (
    comp: CompetenceWithNiveaux,
    blocData: BlocPrerequisData,
  ): ReactNode => {
    const niveaux = comp.niveaux_parsed;
    const achetes = niveauxAchetes.get(comp.id) ?? new Set<number>();
    const maxAchete = achetes.size ? Math.max(...achetes) : 0;
    return (
      <div className="space-y-1.5">
        {niveaux.map((niv) => {
          const st = niveauAchatState(comp, niv, maxAchete);
          const key = `${comp.id}-${niv.niveau}`;
          const open = niveauxDeplies.has(key);
          return (
            <div
              key={niv.niveau}
              className={`rounded border ${
                st.acquis ? "border-gold/40 bg-gold/10" : "border-border"
              } ${
                !st.acquis &&
                (st.compBloqueeClasse || st.niveauHorsClasse || st.prereqBloque)
                  ? "opacity-50"
                  : ""
              }`}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleNiveau(key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleNiveau(key);
                  }
                }}
                className="flex cursor-pointer items-center gap-3 p-2 text-xs"
              >
                {open ? (
                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
                {renderCheckboxNiveau(comp, niv, st)}
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <strong>Niveau {niv.niveau}</strong>
                  <Badge variant="secondary" className="text-xs">
                    {niv.cout_xp} XP
                  </Badge>
                  {st.acquis && <BadgeAcquis />}
                  {st.estGratuit && (
                    <Badge className="border border-green-600/30 bg-green-600/20 text-xs text-green-400">
                      Acquis gratuitement
                    </Badge>
                  )}
                  {st.dejaAchete && !st.estGratuit && (
                    <span className="text-xs text-emerald-400" aria-hidden>
                      ✓
                    </span>
                  )}
                  {st.xpInsuffisants && renderManqueXp(niv.cout_xp)}
                </div>
              </div>
              {open && (
                <div className="space-y-2 border-t border-border/60 px-3 py-2 text-xs">
                  {niv.description && (
                    <p className="text-muted-foreground">{niv.description}</p>
                  )}
                  {st.acquis && (
                    <p className="flex items-center gap-1 text-[11px] text-gold-accent">
                      <Lock className="h-2.5 w-2.5" /> Joué en événement —
                      conservé définitivement.
                    </p>
                  )}
                  {st.niveauPrecedentRequis &&
                    !st.dejaAchete &&
                    !st.niveauHorsClasse &&
                    !st.compBloqueeClasse && (
                      <p className="flex items-center gap-1 text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        Acheter d'abord le niveau {niv.niveau - 1}
                      </p>
                    )}
                  {renderLignePrereqNiveau(niv, blocData)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // =======================================================================
  // RENDER : corps `multiple_sans_choix` — stepper « Acquis ×N [−][+] »
  // =======================================================================

  const renderSansChoixStepper = (comp: CompetenceWithNiveaux): ReactNode => {
    const achatsPourComp = achatsParCompetence.get(comp.id) ?? [];
    const nbAchats = achatsPourComp.length;
    const niv1 = comp.niveaux_parsed.find((n) => n.niveau === 1);
    if (!niv1) return null;

    const compBloqueeClasse = classeBloque(comp);
    const prereqCompBloquee = prereqBloqueTotal(comp);

    // Dév. Spirituel basique vs Supérieur : on ne peut pas redescendre le
    // basique sous 20 PS si le Supérieur est acquis (la RPC refuserait).
    const estBasique = comp.nom === "Développement Spirituel";
    const compSuperieur = (competences ?? []).find(
      (c) => c.nom === "Développement Spirituel Supérieur",
    );
    const aSuperieurAcquis = compSuperieur
      ? (achatsParCompetence.get(compSuperieur.id) ?? []).length > 0
      : false;

    const minusDisabled =
      compBloqueeClasse ||
      nbAchats === 0 ||
      mutationEnCours ||
      (estBasique && aSuperieurAcquis);

    const xpInsuffisants = niv1.cout_xp > 0 && niv1.cout_xp > xpDisponible;

    const handlePlus = () => handleBuy(comp, niv1);
    const handleMinus = () => {
      const dernier = achatsPourComp[achatsPourComp.length - 1];
      if (dernier) handleUncheck(comp, dernier);
    };

    return (
      <div
        className={`flex flex-wrap items-center gap-3 rounded border border-border p-2 ${
          compBloqueeClasse || prereqCompBloquee ? "opacity-50" : ""
        }`}
      >
        <Button
          size="sm"
          variant="outline"
          onClick={handleMinus}
          disabled={minusDisabled}
          title={
            estBasique && aSuperieurAcquis
              ? "Désachetez d'abord Développement Spirituel Supérieur"
              : undefined
          }
        >
          <Minus className="h-3 w-3" />
        </Button>
        <div className="flex-1 text-xs">
          <strong>Acquis ×{nbAchats}</strong>
          <span className="ml-2 text-muted-foreground">
            ({niv1.cout_xp} XP / achat)
          </span>
          {xpInsuffisants && renderManqueXp(niv1.cout_xp)}
        </div>
        <Button
          size="sm"
          onClick={handlePlus}
          disabled={
            compBloqueeClasse ||
            prereqCompBloquee ||
            mutationEnCours ||
            xpInsuffisants
          }
          title={
            xpInsuffisants
              ? `XP insuffisants (manque ${niv1.cout_xp - xpDisponible} XP)`
              : undefined
          }
          className={xpInsuffisants ? "opacity-50" : ""}
        >
          {mutationEnCours && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  // =======================================================================
  // RENDER : types à choix (Pure1b) — checklists + sous-accordéons
  // =======================================================================

  /**
   * Sous-accordéon d'UNE option (cercle, domaine, catégorie, famille...) pour
   * `multiple_avec_choix_par_niveau`. En-tête = nom de l'option (repliable, D2 :
   * auto-ouvert si un niveau est déjà acquis). Corps = checklist des niveaux
   * passés en `niveauxAMontrer`. `accessible=false` => verrouillé (D1 Dépeçage).
   */
  const renderOptionAccordion = (
    comp: CompetenceWithNiveaux,
    opt: OptionChecklist,
    niveauxAMontrer: NiveauInfo[],
  ): ReactNode => {
    const achatsDuChoix = (achatsParCompetence.get(comp.id) ?? []).filter(
      (a) => a.choix_achat === opt.value,
    );
    const aAchat = achatsDuChoix.length > 0;
    const maxAcheteChoix = aAchat
      ? Math.max(...achatsDuChoix.map((a) => a.niveau_acquis))
      : 0;
    const key = `opt-${comp.id}-${opt.value}`;
    // D2 : repli par défaut, mais auto-ouverture si un niveau est acquis.
    const open = opt.accessible ? optionsOuvertes[key] ?? aAchat : false;

    return (
      <div
        key={opt.value}
        className={`rounded border border-border ${opt.accessible ? "" : "opacity-50"}`}
      >
        <div
          role={opt.accessible ? "button" : undefined}
          tabIndex={opt.accessible ? 0 : undefined}
          onClick={opt.accessible ? () => toggleOption(key, open) : undefined}
          onKeyDown={
            opt.accessible
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleOption(key, open);
                  }
                }
              : undefined
          }
          className={`flex items-center gap-2 p-2 text-xs ${
            opt.accessible ? "cursor-pointer" : ""
          }`}
        >
          {!opt.accessible ? (
            <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : open ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <strong className="flex-1">{opt.label}</strong>
          {aAchat && (
            <Badge variant="secondary" className="text-xs">
              Niv. {maxAcheteChoix} acquis
            </Badge>
          )}
          {!opt.accessible && (
            <Badge variant="outline" className="text-xs">
              Verrouillé
            </Badge>
          )}
        </div>

        {!opt.accessible && (
          <p className="px-3 pb-2 pl-8 text-xs text-muted-foreground">
            Achetez d'abord Connaissances des Créatures « {opt.label} ».
          </p>
        )}

        {open && opt.accessible && (
          <div className="space-y-1.5 border-t border-border/60 px-3 py-2">
            {niveauxAMontrer.map((niv) => {
              const st = niveauChoixState(comp, niv, opt.value);
              return (
                <div
                  key={niv.niveau}
                  className={`flex flex-wrap items-center gap-3 ${
                    st.acquis
                      ? "rounded border border-gold/40 bg-gold/10 p-1"
                      : "pl-1"
                  } ${!st.acquis && st.bloque ? "opacity-50" : ""}`}
                >
                  <Checkbox
                    id={`${comp.id}-${opt.value}-${niv.niveau}`}
                    checked={st.dejaAchete}
                    disabled={st.disabled}
                    title={
                      st.xpInsuffisants
                        ? `XP insuffisants (manque ${niv.cout_xp - xpDisponible} XP)`
                        : undefined
                    }
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleBuy(comp, niv, opt.value);
                      } else if (st.achat) {
                        handleUncheck(comp, st.achat);
                      }
                    }}
                  />
                  <Label
                    htmlFor={`${comp.id}-${opt.value}-${niv.niveau}`}
                    className="flex flex-1 cursor-pointer flex-wrap items-center gap-2 text-xs"
                  >
                    <span>Niveau {niv.niveau}</span>
                    <Badge variant="secondary" className="text-xs">
                      {niv.cout_xp} XP
                    </Badge>
                    {st.acquis && <BadgeAcquis />}
                    {st.estGratuit && (
                      <Badge className="border border-green-600/30 bg-green-600/20 text-xs text-green-400">
                        Gratuit
                      </Badge>
                    )}
                    {st.niveauPrecedentRequis && !st.dejaAchete && !st.bloque && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Lock className="h-3 w-3" /> Niv. {niv.niveau - 1} requis
                      </span>
                    )}
                    {st.xpInsuffisants && renderManqueXp(niv.cout_xp)}
                  </Label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /**
   * `multiple_choix_distinct` (Langue supplémentaire, Décryptage, Connaissances
   * des Religions). Mono-niveau, répétable : checklist directe de TOUTES les
   * options, une case par option (cochée = achetée, décocher = désachat).
   */
  const renderMultipleChoixDistinct = (
    comp: CompetenceWithNiveaux,
    blocData: BlocPrerequisData,
  ): ReactNode => {
    const niv1 = comp.niveaux_parsed.find((n) => n.niveau === 1);
    if (!niv1) return null;
    const compBloqueeClasse = classeBloque(comp);
    const prereqCompBloquee = prereqBloqueTotal(comp);
    const achatsPourComp = achatsParCompetence.get(comp.id) ?? [];
    const options = getToutesOptions(comp);
    const estReligion = comp.type_choix === "religion";

    return (
      <div
        className={`space-y-2 ${
          compBloqueeClasse || prereqCompBloquee ? "opacity-50" : ""
        }`}
      >
        {renderLignePrereqNiveau(niv1, blocData)}
        {options.map((opt) => {
          const achat = achatsPourComp.find((a) => a.choix_achat === opt.value);
          const dejaAchete = !!achat;
          const estGratuit = achat?.xp_depense === 0;
          const xpInsuffisants =
            !dejaAchete && niv1.cout_xp > 0 && niv1.cout_xp > xpDisponible;
          const acquis = estNiveauCompetenceAcquis(
            modeCampagne,
            photo,
            comp.id,
            opt.value,
            1,
          );
          const disabled =
            compBloqueeClasse ||
            prereqCompBloquee ||
            mutationEnCours ||
            (dejaAchete && estGratuit) ||
            xpInsuffisants ||
            acquis;
          const religionObj = estReligion
            ? (religions ?? []).find((r) => r.id === opt.value)
            : undefined;
          const detKey = `reldet-${comp.id}-${opt.value}`;
          const manKey = `relman-${comp.id}-${opt.value}`;
          const detOuvert = !!optionsOuvertes[detKey];
          return (
            <div
              key={opt.value}
              className={`rounded border ${
                acquis ? "border-gold/40 bg-gold/10" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-center gap-3 p-2">
                <Checkbox
                  id={`${comp.id}-${opt.value}`}
                  checked={dejaAchete}
                  disabled={disabled}
                  title={
                    xpInsuffisants
                      ? `XP insuffisants (manque ${niv1.cout_xp - xpDisponible} XP)`
                      : undefined
                  }
                  onCheckedChange={(checked) => {
                    if (checked) {
                      handleBuy(comp, niv1, opt.value);
                    } else if (achat) {
                      handleUncheck(comp, achat);
                    }
                  }}
                />
                <Label
                  htmlFor={`${comp.id}-${opt.value}`}
                  className="flex flex-1 cursor-pointer flex-wrap items-center gap-2 text-xs"
                >
                  <strong>{opt.label}</strong>
                  {acquis && <BadgeAcquis />}
                  {estGratuit ? (
                    <Badge className="border border-green-600/30 bg-green-600/20 text-xs text-green-400">
                      Acquis gratuitement
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {niv1.cout_xp} XP
                    </Badge>
                  )}
                  {xpInsuffisants && renderManqueXp(niv1.cout_xp)}
                </Label>
                {estReligion && religionObj && (
                  <button
                    type="button"
                    onClick={() => toggleOption(detKey, detOuvert)}
                    aria-expanded={detOuvert}
                    className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {detOuvert ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Détails
                  </button>
                )}
              </div>
              {estReligion && religionObj && detOuvert && (
                <div className="border-t border-border/60 p-3">
                  <ReligionDetails
                    religion={religionObj}
                    isManuelOpen={!!optionsOuvertes[manKey]}
                    onToggleManuel={() =>
                      toggleOption(manKey, !!optionsOuvertes[manKey])
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
        {options.length === 0 && (
          <p className="text-xs italic text-muted-foreground">
            Aucune option disponible pour le moment.
          </p>
        )}
      </div>
    );
  };

  /**
   * `multiple_avec_choix_par_niveau`. Checklist d'options ; chaque option =
   * sous-accordéon dépliable en niveaux (D2). Cas spécial Connaissances
   * Criminelles : niveau 1 = case isolée (savoir général sans choix) ; niveaux
   * 2-3 = un accordéon « Familles criminelles » verrouillé tant que le niveau 1
   * n'est pas pris, contenant la checklist des familles.
   */
  const renderMultipleAvecChoixParNiveau = (
    comp: CompetenceWithNiveaux,
  ): ReactNode => {
    const compBloqueeClasse = classeBloque(comp);
    const prereqCompBloquee = prereqBloqueTotal(comp);
    const achatsPourComp = achatsParCompetence.get(comp.id) ?? [];
    const options = getToutesOptions(comp);
    const niveaux = comp.niveaux_parsed;

    // ---- Cas spécial : Connaissances Criminelles ----
    if (comp.nom === "Connaissances Criminelles") {
      const niv1 = niveaux.find((n) => n.niveau === 1);
      const niveaux23 = niveaux.filter((n) => n.niveau >= 2);
      const achatNiv1 = achatsPourComp.find(
        (a) => a.niveau_acquis === 1 && !a.choix_achat,
      );
      const niv1Acquis = !!achatNiv1;
      const estGratuit1 = achatNiv1?.xp_depense === 0;
      const xpInsuff1 =
        !niv1Acquis && !!niv1 && niv1.cout_xp > 0 && niv1.cout_xp > xpDisponible;
      // PR-C2 : niveau 1 = savoir général sans choix → choixAchat = null.
      const niv1Scelle = estNiveauCompetenceAcquis(
        modeCampagne,
        photo,
        comp.id,
        null,
        1,
      );
      const accKey = `crimfam-${comp.id}`;
      const famOpen = optionsOuvertes[accKey] ?? niv1Acquis;

      return (
        <div
          className={`space-y-3 ${
            compBloqueeClasse || prereqCompBloquee ? "opacity-50" : ""
          }`}
        >
          {niv1 && (
            <div
              className={`flex flex-wrap items-center gap-3 rounded border p-2 ${
                niv1Scelle ? "border-gold/40 bg-gold/10" : "border-border"
              }`}
            >
              <Checkbox
                id={`${comp.id}-crim-niv1`}
                checked={niv1Acquis}
                disabled={
                  compBloqueeClasse ||
                  prereqCompBloquee ||
                  mutationEnCours ||
                  (niv1Acquis && estGratuit1) ||
                  xpInsuff1 ||
                  niv1Scelle
                }
                title={
                  xpInsuff1
                    ? `XP insuffisants (manque ${niv1.cout_xp - xpDisponible} XP)`
                    : undefined
                }
                onCheckedChange={(checked) => {
                  if (checked) {
                    handleBuy(comp, niv1);
                  } else if (achatNiv1) {
                    handleUncheck(comp, achatNiv1);
                  }
                }}
              />
              <Label
                htmlFor={`${comp.id}-crim-niv1`}
                className="flex flex-1 cursor-pointer flex-col gap-1 text-xs"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <strong>Niveau 1</strong>
                  <Badge variant="secondary" className="text-xs">
                    {niv1.cout_xp} XP
                  </Badge>
                  {niv1Scelle && <BadgeAcquis />}
                  {estGratuit1 && (
                    <Badge className="border border-green-600/30 bg-green-600/20 text-xs text-green-400">
                      Acquis gratuitement
                    </Badge>
                  )}
                  {xpInsuff1 && renderManqueXp(niv1.cout_xp)}
                </span>
                {niv1.description && (
                  <span className="text-muted-foreground">{niv1.description}</span>
                )}
              </Label>
            </div>
          )}

          <div
            className={`rounded border border-border ${
              niv1Acquis ? "" : "opacity-50"
            }`}
          >
            <div
              role={niv1Acquis ? "button" : undefined}
              tabIndex={niv1Acquis ? 0 : undefined}
              onClick={niv1Acquis ? () => toggleOption(accKey, famOpen) : undefined}
              onKeyDown={
                niv1Acquis
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleOption(accKey, famOpen);
                      }
                    }
                  : undefined
              }
              className={`flex items-center gap-2 p-2 text-xs ${
                niv1Acquis ? "cursor-pointer" : ""
              }`}
            >
              {!niv1Acquis ? (
                <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
              ) : famOpen ? (
                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
              <strong className="flex-1">Familles criminelles (Niv. 2-3)</strong>
              {!niv1Acquis && (
                <Badge variant="outline" className="text-xs">
                  Niv. 1 requis
                </Badge>
              )}
            </div>
            {niv1Acquis && famOpen && (
              <div className="space-y-1.5 border-t border-border/60 px-3 py-2">
                {options.map((opt) => renderOptionAccordion(comp, opt, niveaux23))}
                {options.length === 0 && (
                  <p className="text-xs italic text-muted-foreground">
                    Aucune famille disponible pour le moment.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // ---- Cas normal : Créatures, Dépeçage, Cercle, Domaine ----
    return (
      <div
        className={`space-y-2 ${
          compBloqueeClasse || prereqCompBloquee ? "opacity-50" : ""
        }`}
      >
        {options.map((opt) => renderOptionAccordion(comp, opt, niveaux))}
        {options.length === 0 && (
          <p className="text-xs italic text-muted-foreground">
            {comp.type_choix === "categorie_depecage"
              ? "Achetez d'abord Connaissances des Créatures pour au moins une catégorie."
              : "Aucune option disponible pour le moment."}
          </p>
        )}
      </div>
    );
  };

  // =======================================================================
  // RENDER : dispatch du corps par type_achat
  // =======================================================================

  const renderBody = (
    comp: CompetenceWithNiveaux,
    blocData: BlocPrerequisData,
  ): ReactNode => {
    switch (comp.type_achat) {
      case "multiple_choix_distinct":
        return renderMultipleChoixDistinct(comp, blocData);
      case "multiple_avec_choix_par_niveau":
        return renderMultipleAvecChoixParNiveau(comp);
      case "multiple_sans_choix":
        return renderSansChoixStepper(comp);
      case "simple":
      default:
        return comp.niveaux_parsed.length <= 1
          ? renderBodyMono(comp, blocData)
          : renderBodyMulti(comp, blocData);
    }
  };

  // =======================================================================
  // RENDER : item accordéon d'une compétence
  // =======================================================================

  const renderCompetenceItem = (comp: CompetenceWithNiveaux): ReactNode => {
    const statut = calcStatutCompetence(comp);
    const blocData = buildPrerequisBloc(comp);
    const ouvert = compsDepliees.has(comp.id);
    const estAcquise = (achatsParCompetence.get(comp.id) ?? []).length > 0;
    const badgePrereq = headerPrereqBadge(comp, statut, blocData);
    const coutBadge = headerCoutBadge(comp, statut);
    const surbrillance = highlightId === comp.id;

    // Verrou mutuel « Déjà acquise via » : conservé via MessageBlocage.
    // Les « Réservé aux classes » sont déjà couverts par BlocClasses.
    const detailBlocage = classeBloque(comp) ? blocageDetail(comp) : null;
    const messageBlocage =
      detailBlocage && !detailBlocage.label.startsWith("Réservé")
        ? detailBlocage
        : null;

    return (
      <div
        key={comp.id}
        ref={(el) => {
          compRefs.current.set(comp.id, el);
        }}
        className={`scroll-mt-20 rounded-lg border transition-shadow ${
          surbrillance
            ? "border-amber-400 ring-2 ring-amber-400/70"
            : estAcquise
              ? "border-emerald-500/40"
              : "border-border"
        }`}
      >
        {/* En-tête repliable (div, pas <button> : enfants interactifs autorisés) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleComp(comp.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleComp(comp.id);
            }
          }}
          className="flex cursor-pointer flex-col gap-2 p-3"
        >
          <div className="flex items-start gap-2">
            {ouvert ? (
              <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-base font-bold leading-tight">
                  {comp.nom}
                </span>
                <PastilleStatutCompetence statut={statut} />
                {coutBadge}
              </div>
              {comp.description && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {comp.description}
                </p>
              )}
            </div>
          </div>

          {badgePrereq && <div className="pl-6">{badgePrereq}</div>}

          <div className="pl-6">
            <BlocClasses
              comp={comp}
              classeJoueur={classeNom}
              normalizeCategorieFn={normalizeCategorie}
            />
          </div>

          {messageBlocage && (
            <div className="pl-6">
              <MessageBlocage {...messageBlocage} />
            </div>
          )}
        </div>

        {/* Corps déplié */}
        {ouvert && (
          <div className="space-y-2 border-t border-border/60 px-3 pb-3 pt-2">
            {renderBody(comp, blocData)}
          </div>
        )}
      </div>
    );
  };

  // =======================================================================
  // RENDER : Page complète (accordéons par catégorie)
  // =======================================================================

  if (loadingCompetences || loadingAchats || loadingClasse) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Chargement des compétences…
      </div>
    );
  }

  const messageVideFiltre =
    filtre === "acquises"
      ? "Aucune compétence acquise dans cette catégorie."
      : filtre === "disponibles"
        ? "Aucune compétence disponible dans cette catégorie."
        : filtre === "bloquees"
          ? "Aucune compétence bloquée dans cette catégorie."
          : "Aucune compétence dans cette catégorie.";

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-xl font-semibold text-foreground">
        Étape 5 — Achat de compétences
      </h2>

      {/* Filtres de statut (C3c) — barre globale. */}
      <div className="flex flex-wrap gap-1.5">
        {FILTRE_OPTIONS.map((f) => (
          <Button
            key={f.key}
            type="button"
            size="sm"
            variant={filtre === f.key ? "default" : "outline"}
            onClick={() => setFiltre(f.key)}
            className="flex-shrink-0"
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Légende des pastilles : repliable, repliée par défaut. */}
      <LegendePastilles
        ouvert={legendeOuverte}
        onToggle={() => setLegendeOuverte((v) => !v)}
      />

      {/* Accordéons par catégorie (remplacent les Radix Tabs). */}
      <div className="space-y-2">
        {TAB_CONFIG.map((t) => {
          const comps = (competencesParTab[t.key] ?? []).filter(matchFiltre);
          const open = categoriesOuvertes.has(t.key);
          return (
            <div key={t.key} className="rounded-lg border border-border">
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleCategorie(t.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCategorie(t.key);
                  }
                }}
                className="flex cursor-pointer items-center justify-between gap-2 px-3 py-3"
              >
                <span className="flex items-center gap-2 font-heading font-semibold text-foreground">
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  {t.label}
                </span>
                <Badge variant="outline" className="text-xs">
                  {comps.length}
                </Badge>
              </div>

              {open && (
                <div className="space-y-2 border-t border-border/60 px-3 pb-3 pt-3">
                  {(t.key === "mage" || t.key === "pretre") && (
                    <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      💡{" "}
                      {t.key === "mage"
                        ? "Achetez « Acquisition de Sort » pour créer vos sorts à l'étape 6."
                        : "Achetez « Acquisition de Prière » pour créer vos prières à l'étape 7."}
                    </p>
                  )}
                  {comps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {messageVideFiltre}
                    </p>
                  ) : (
                    comps.map((c) => renderCompetenceItem(c))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialog maître requis */}
      <Dialog
        open={!!masterDialog}
        onOpenChange={(open) => {
          if (!open) setMasterDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apprentissage avec un maître</DialogTitle>
            <DialogDescription>
              {masterDialog && (
                <>
                  L'achat du niveau {masterDialog.niveau.niveau} de{" "}
                  <strong>{masterDialog.competence.nom}</strong> nécessite
                  l'apprentissage auprès d'un maître. Indiquez son nom — la
                  demande sera soumise à validation.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="master-name">Nom du maître</Label>
            <Input
              id="master-name"
              value={masterName}
              onChange={(e) => setMasterName(e.target.value)}
              placeholder="Nom du personnage maître"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMasterDialog(null)}>
              Annuler
            </Button>
            <Button onClick={confirmMaster} disabled={mutationEnCours}>
              {mutationEnCours && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirmer l'achat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog cascade décochage */}
      <Dialog
        open={!!cascadeDialog}
        onOpenChange={(open) => {
          if (!open) setCascadeDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler cet achat ?</DialogTitle>
            <DialogDescription>
              {cascadeDialog && (
                <>
                  Retirer <strong>{cascadeDialog.competence.nom}</strong>{" "}
                  annulera aussi tout ce qui en dépend. Voici le détail :
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {cascadeDialog && (
            <div className="space-y-2 py-2 text-sm">
              <p className="font-semibold">
                Ce qui sera annulé ({cascadeDialog.items.length}) :
              </p>
              <ul className="ml-4 list-disc space-y-1 text-xs">
                {cascadeDialog.items.map((it, idx) => (
                  <li key={`${it.type}-${it.nom}-${idx}`}>
                    <span className="text-muted-foreground">
                      {it.type_label} :
                    </span>{" "}
                    {it.nom}
                    {it.niveaux && it.niveaux.length > 0
                      ? ` (niv ${it.niveaux.join(", ")})`
                      : ""}{" "}
                    — {it.xp_total} XP
                  </li>
                ))}
              </ul>
              <p className="pt-2 font-semibold text-green-500">
                Total remboursé : {cascadeDialog.xpTotalRembourse} XP
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCascadeDialog(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCascade}
              disabled={mutationEnCours}
            >
              {mutationEnCours && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirmer l'annulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between pt-4">
        {onPrevious && (
          <Button variant="outline" onClick={onPrevious}>
            ← Précédent
          </Button>
        )}
        <Button
          className="ml-auto"
          onClick={() => avancerMutation.mutate()}
          disabled={avancerMutation.isPending}
        >
          {avancerMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Suivant →
        </Button>
      </div>
    </div>
  );
};

export default Etape5_Competences_V2;

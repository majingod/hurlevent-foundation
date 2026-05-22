import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Lock, Minus, Plus, X } from "lucide-react";

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
  description_niveau?: string;
  prerequis?: string | null;
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

interface DropdownOption {
  value: string;
  label: string;
}

interface CascadeContext {
  competence: CompetenceWithNiveaux;
  achatCible: PersonnageCompetenceRow;
  achatsAnnules: PersonnageCompetenceRow[];
  xpTotalRembourse: number;
}

interface Etape5Props {
  personnageId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onPrevious?: () => void;
  onXpDeltaChange?: (delta: number) => void;
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

// type_achat qui cascade en DB (suppression ascendante des niveaux >= N)
const TYPES_ACHAT_CASCADE = new Set([
  "simple",
  "unique_avec_choix",
  "multiple_avec_choix_par_niveau",
]);

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
        description_niveau:
          typeof obj.description_niveau === "string" ? obj.description_niveau : undefined,
        prerequis: typeof obj.prerequis === "string" ? obj.prerequis : null,
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
    .replace(/[\u0300-\u036f]/g, "");
}

function resoudreChoixAffichage(
  choixAchat: string | null,
  typeChoix: string | null,
  religions: Pick<ReligionRow, "id" | "nom">[],
  langues: Pick<LangueRow, "id" | "nom" | "est_ancienne">[],
): string | null {
  if (!choixAchat || !typeChoix) return null;
  if (typeChoix === "religion") {
    return religions.find((r) => r.id === choixAchat)?.nom ?? choixAchat;
  }
  if (typeChoix === "langue" || typeChoix === "langue_ancienne") {
    return langues.find((l) => l.id === choixAchat)?.nom ?? choixAchat;
  }
  // categorie_creature, cercle, domaine, famille_criminelle, categorie_depecage :
  // valeur stockée directement affichable (nom littéral).
  return choixAchat;
}

// raison vient de la RPC sous la forme "Prérequis manquant(s) : A niveau 1, B niveau 2".
// On découpe sur le premier ":" pour séparer le label des items, puis sur les
// virgules pour les items. Fallback : tout en un seul item.
function parsePrereqRaison(raison: string): { label: string; items: string[] } {
  const colonIdx = raison.indexOf(":");
  if (colonIdx === -1) return { label: "Prérequis manquant :", items: [raison] };
  const label = raison.slice(0, colonIdx + 1).trim();
  const rest = raison.slice(colonIdx + 1).trim();
  const items = rest
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { label, items: items.length > 0 ? items : [rest] };
}

/** Pastille rouge pour afficher un prérequis / blocage de façon lisible. */
function PastilleBlocage({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs text-red-300">
      {children}
    </span>
  );
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
      {items.map((item) => (
        <PastilleBlocage key={item}>{item}</PastilleBlocage>
      ))}
    </div>
  );
}

// =========================================================================
// COMPOSANT
// =========================================================================

const Etape5_Competences_V2 = ({
  personnageId,
  onSuccess,
  onError,
  onPrevious,
  onXpDeltaChange,
}: Etape5Props) => {
  const queryClient = useQueryClient();

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

  // Pré-sélection de choix dans les dropdowns avant validation
  // Clé : `${comp.id}_${niveau}` pour validation directe au cochage
  //   ou : `${comp.id}_add` pour le panneau "+ Ajouter une autre"
  const [pendingChoix, setPendingChoix] = useState<Record<string, string>>({});

  // Compétence dont le panneau "+ Ajouter une autre" est ouvert
  const [pendingAddCompId, setPendingAddCompId] = useState<string | null>(null);

  // Confirmation cascade de décochage
  const [cascadeDialog, setCascadeDialog] = useState<CascadeContext | null>(null);

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
        .select("id, nom")
        .eq("est_actif", true);
      if (error) throw error;
      return (data ?? []) as Pick<ReligionRow, "id" | "nom">[];
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
  // OPTIONS DE DROPDOWN PAR type_choix
  // =======================================================================

  /**
   * Retourne les options disponibles pour le dropdown selon `type_choix`.
   * Filtre les options déjà choisies (pour multiple_choix_distinct et
   * multiple_avec_choix_par_niveau au niveau 1, où un choix doit être unique).
   * `categorie_depecage` est filtrée aux catégories où le perso a déjà acheté
   * Connaissance des Créatures.
   */
  const getOptionsDropdown = (
    comp: CompetenceWithNiveaux,
    niveau: number,
  ): DropdownOption[] => {
    const typeChoix = comp.type_choix;
    if (!typeChoix) return [];

    const achatsPourComp = achatsParCompetence.get(comp.id) ?? [];
    const dejaPris = new Set(
      achatsPourComp.map((a) => a.choix_achat).filter(Boolean) as string[],
    );

    if (typeChoix === "religion") {
      // Manuel des règles 2026 (édition 6 mai 2026) : plusieurs achats
      // autorisés, un par religion différente. La consécration unique
      // reste gérée via personnages.religion_id + est_croyant,
      // indépendamment de cette compétence.
      return (religions ?? [])
        .filter((r): r is typeof r & { nom: string } => r.nom !== null)
        .filter((r) => !dejaPris.has(r.id))
        .map((r) => ({ value: r.id, label: r.nom }));
    }

    if (typeChoix === "langue") {
      return (langues ?? [])
        .filter((l) => !dejaPris.has(l.id))
        .map((l) => ({ value: l.id, label: l.nom }));
    }

    if (typeChoix === "langue_ancienne") {
      return (langues ?? [])
        .filter((l) => l.est_ancienne)
        .filter((l) => !dejaPris.has(l.id))
        .map((l) => ({ value: l.id, label: l.nom }));
    }

    if (typeChoix === "categorie_creature") {
      // Au niveau 1 d'un multiple_avec_choix_par_niveau, le choix doit être nouveau.
      // Au niveau N>1, le choix doit être parmi ceux déjà pris au niveau N-1
      // (logique gérée par la RPC, mais on aide l'utilisateur côté UI).
      if (comp.type_achat === "multiple_avec_choix_par_niveau" && niveau > 1) {
        const choixDejaAuNiveauPrecedent = new Set(
          achatsPourComp
            .filter((a) => a.niveau_acquis === niveau - 1)
            .map((a) => a.choix_achat)
            .filter(Boolean) as string[],
        );
        const dejaPrisAuNiveau = new Set(
          achatsPourComp
            .filter((a) => a.niveau_acquis === niveau)
            .map((a) => a.choix_achat)
            .filter(Boolean) as string[],
        );
        return (categoriesCreatures ?? [])
          .filter((c) => choixDejaAuNiveauPrecedent.has(c.nom))
          .filter((c) => !dejaPrisAuNiveau.has(c.nom))
          .map((c) => ({ value: c.nom, label: c.nom }));
      }
      // Niveau 1 : filtrer ce qui est déjà pris au niveau 1
      const dejaPrisAuNiv1 = new Set(
        achatsPourComp
          .filter((a) => a.niveau_acquis === 1)
          .map((a) => a.choix_achat)
          .filter(Boolean) as string[],
      );
      return (categoriesCreatures ?? [])
        .filter((c) => !dejaPrisAuNiv1.has(c.nom))
        .map((c) => ({ value: c.nom, label: c.nom }));
    }

    if (typeChoix === "categorie_depecage") {
      // Liste filtrée aux catégories où le perso a Connaissance des Créatures.
      const connaissanceCreatures = (achats ?? []).filter((a) => {
        const c = (competences ?? []).find((cc) => cc.id === a.competence_id);
        return c?.nom === "Connaissance des Créatures";
      });
      const categoriesAccessibles = new Set(
        connaissanceCreatures.map((a) => a.choix_achat).filter(Boolean) as string[],
      );
      const dejaPrisAuNiveau = new Set(
        achatsPourComp
          .filter((a) => a.niveau_acquis === niveau)
          .map((a) => a.choix_achat)
          .filter(Boolean) as string[],
      );
      return (categoriesCreatures ?? [])
        .filter((c) => categoriesAccessibles.has(c.nom))
        .filter((c) => !dejaPrisAuNiveau.has(c.nom))
        .map((c) => ({ value: c.nom, label: c.nom }));
    }

    if (typeChoix === "cercle") {
      const dejaPrisAuNiveau = new Set(
        achatsPourComp
          .filter((a) => a.niveau_acquis === niveau)
          .map((a) => a.choix_achat)
          .filter(Boolean) as string[],
      );
      return (cercles ?? [])
        .filter((c) => !dejaPrisAuNiveau.has(c))
        .map((c) => ({ value: c, label: c }));
    }

    if (typeChoix === "domaine") {
      const dejaPrisAuNiveau = new Set(
        achatsPourComp
          .filter((a) => a.niveau_acquis === niveau)
          .map((a) => a.choix_achat)
          .filter(Boolean) as string[],
      );
      return (domaines ?? [])
        .filter((d) => !dejaPrisAuNiveau.has(d))
        .map((d) => ({ value: d, label: d }));
    }

    if (typeChoix === "famille_criminelle") {
      const dejaPrisAuNiveau = new Set(
        achatsPourComp
          .filter((a) => a.niveau_acquis === niveau)
          .map((a) => a.choix_achat)
          .filter(Boolean) as string[],
      );
      return (famillesCriminelles ?? [])
        .filter((f): f is typeof f & { nom: string } => f.nom !== null)
        .filter((f) => !dejaPrisAuNiveau.has(f.nom))
        .map((f) => ({ value: f.nom, label: f.nom }));
    }

    return [];
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
      const nbLignes = (data?.donnees?.nb_lignes_supprimees as number) ?? 1;
      const xpRembourse = (data?.donnees?.xp_total_rembourse as number) ?? 0;
      toast.success(
        `${nbLignes} niveau${nbLignes > 1 ? "x" : ""} annulé${nbLignes > 1 ? "s" : ""} (${xpRembourse} XP remboursés)`,
      );
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
   * Décochage d'un achat. Si la compétence cascade et qu'il y a des niveaux
   * > N à supprimer aussi, on ouvre la modale de confirmation. Sinon
   * (ligne unique : multiple_choix_distinct/multiple_sans_choix, ou dernier niveau
   * d'une séquence), on supprime direct sans modale.
   */
  const handleUncheck = (
    comp: CompetenceWithNiveaux,
    achat: PersonnageCompetenceRow,
  ) => {
    if (achat.xp_depense === 0) {
      toast.error("Une compétence gratuite ne peut pas être désachetée.");
      return;
    }

    if (!TYPES_ACHAT_CASCADE.has(comp.type_achat ?? "")) {
      // multiple_choix_distinct ou multiple_sans_choix : suppression unique, pas de cascade
      desacheterMutation.mutate({ p_personnage_competence_id: achat.id });
      return;
    }

    // Calcul des achats cascade (niveau >= achat.niveau_acquis sur cette compétence)
    const achatsCompetence = achatsParCompetence.get(comp.id) ?? [];
    const aSupprimer = achatsCompetence.filter(
      (a) => a.niveau_acquis >= achat.niveau_acquis,
    );
    const xpRembourse = aSupprimer.reduce((sum, a) => sum + (a.xp_depense ?? 0), 0);

    if (aSupprimer.length === 1) {
      // Pas de cascade réelle → suppression directe
      desacheterMutation.mutate({ p_personnage_competence_id: achat.id });
      return;
    }

    setCascadeDialog({
      competence: comp,
      achatCible: achat,
      achatsAnnules: aSupprimer,
      xpTotalRembourse: xpRembourse,
    });
  };

  const confirmCascade = () => {
    if (!cascadeDialog) return;
    desacheterMutation.mutate({
      p_personnage_competence_id: cascadeDialog.achatCible.id,
    });
    setCascadeDialog(null);
  };

  /**
   * Confirme l'achat depuis le panneau "+ Ajouter une autre" (multiple_*).
   * Le niveau visé est : pour multiple_choix_distinct = 1 ; pour
   * multiple_avec_choix_par_niveau = max+1 (achat séquentiel par choix global).
   */
  const handleConfirmAdd = (comp: CompetenceWithNiveaux) => {
    const key = `${comp.id}_add`;
    const choix = pendingChoix[key];
    if (!choix) {
      toast.error("Veuillez sélectionner une option.");
      return;
    }
    const achatsPourComp = achatsParCompetence.get(comp.id) ?? [];

    let niveauCible = 1;
    if (comp.type_achat === "multiple_avec_choix_par_niveau") {
      // Au niveau 1 toujours pour un nouveau choix. Pour reprendre un choix
      // existant à un niveau supérieur, l'utilisateur cochera le niveau dans
      // la section principale (pas via "+ Ajouter").
      niveauCible = 1;
    }
    const niveauInfo = comp.niveaux_parsed.find((n) => n.niveau === niveauCible);
    if (!niveauInfo) {
      toast.error("Niveau introuvable pour cette compétence.");
      return;
    }
    handleBuy(comp, niveauInfo, choix);
    setPendingChoix((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPendingAddCompId(null);
  };

  /**
   * Confirme l'achat pour les compétences à choix avec checkbox directe
   * (unique_avec_choix uniquement). Ferme le panneau et reset le pending.
   */
  const handleConfirmChoix = (comp: CompetenceWithNiveaux, niveau: NiveauInfo) => {
    const key = `${comp.id}_${niveau.niveau}`;
    const choix = pendingChoix[key];
    if (!choix) {
      toast.error("Veuillez sélectionner une option.");
      return;
    }
    handleBuy(comp, niveau, choix);
    setPendingChoix((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /**
   * Trouve la ligne d'achat à supprimer pour un (comp, niveau) donné.
   * Pour `simple`, il n'y a qu'une ligne par niveau.
   * Pour `unique_avec_choix`, idem.
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
  // RENDER : compétences par type_achat
  // =======================================================================

  /**
   * Rangée d'un niveau pour `simple` (case à cocher directe, pas de choix).
   */
  const renderNiveauSimple = (
    comp: CompetenceWithNiveaux,
    niv: NiveauInfo,
    maxAchete: number,
  ) => {
    const dejaAchete = (niveauxAchetes.get(comp.id) ?? new Set()).has(niv.niveau);
    const niveauPrecedentRequis = niv.niveau > 1 && niv.niveau - 1 > maxAchete;
    const requiresMaster = needsMaster(comp, niv.niveau);
    const achat = findAchatPourNiveau(comp, niv.niveau);
    const estGratuit = achat?.xp_depense === 0;
    const niveauMax = niveauMaxAccessible(comp);
    const niveauHorsClasse = niv.niveau > niveauMax;
    const prereqInfo = getPrereqInfo(comp);
    const prereqBloque =
      !!prereqInfo && niv.niveau > prereqInfo.niveauMaxAchetable;
    const raisonPrereq = prereqInfo?.raisonPourNiveau(niv.niveau) ?? null;
    const compBloqueeClasse = classeBloque(comp);
    const disabled =
      compBloqueeClasse ||
      niveauHorsClasse ||
      prereqBloque ||
      niveauPrecedentRequis ||
      mutationEnCours ||
      (dejaAchete && estGratuit);

    return (
      <div
        key={niv.niveau}
        className={`flex flex-wrap items-center gap-3 rounded border border-border p-2 ${
          compBloqueeClasse || niveauHorsClasse || prereqBloque ? "opacity-50" : ""
        }`}
      >
        <Checkbox
          id={`${comp.id}-${niv.niveau}`}
          checked={dejaAchete}
          disabled={disabled}
          onCheckedChange={(checked) => {
            if (checked) {
              handleBuy(comp, niv);
            } else if (achat) {
              handleUncheck(comp, achat);
            }
          }}
        />
        <Label
          htmlFor={`${comp.id}-${niv.niveau}`}
          className="flex-1 cursor-pointer space-y-1 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2">
            <strong>Niveau {niv.niveau}</strong>
            <Badge variant="secondary" className="text-xs">
              {niv.cout_xp} XP
            </Badge>
            {requiresMaster && !niveauHorsClasse && !compBloqueeClasse && (
              <Badge
                variant="outline"
                className="text-xs border-amber-600/40 text-amber-500"
              >
                Maître requis
              </Badge>
            )}
            {estGratuit && (
              <Badge className="bg-green-600/20 text-green-400 border border-green-600/30 text-xs">
                Acquis gratuitement
              </Badge>
            )}
          </div>
          {niv.description_niveau && (
            <p className="text-muted-foreground">{niv.description_niveau}</p>
          )}
          {!compBloqueeClasse && niveauHorsClasse && (
            <p className="flex items-center gap-1 text-red-400">
              <Lock className="h-3 w-3" />
              Niveau {niv.niveau} inaccessible hors de votre classe (max : {niveauMax})
            </p>
          )}
          {!compBloqueeClasse && !prereqBloqueTotal(comp) && prereqBloque && !niveauHorsClasse && !dejaAchete && raisonPrereq && (
            <MessageBlocage
              {...parsePrereqRaison(raisonPrereq)}
            />
          )}
          {niveauPrecedentRequis && !dejaAchete && !niveauHorsClasse && !compBloqueeClasse && (
            <p className="flex items-center gap-1 text-muted-foreground">
              <Lock className="h-3 w-3" />
              Acheter d'abord le niveau {niv.niveau - 1}
            </p>
          )}
        </Label>
      </div>
    );
  };

  /**
   * `unique_avec_choix` (Connaissances des Religions). 1 seule case à
   * cocher (niveau 1). Cocher → expand un dropdown + bouton Confirmer.
   */
  const renderUniqueAvecChoix = (comp: CompetenceWithNiveaux) => {
    const achatsPourComp = achatsParCompetence.get(comp.id) ?? [];
    const dejaAchete = achatsPourComp.length > 0;
    const achat = achatsPourComp[0];
    const estGratuit = achat?.xp_depense === 0;
    const niv1 = comp.niveaux_parsed.find((n) => n.niveau === 1);
    if (!niv1) return null;

    const prereqInfo = getPrereqInfo(comp);
    const prereqBloque = !!prereqInfo && prereqInfo.niveauMaxAchetable < 1;
    const compBloqueeClasse = classeBloque(comp);
    const prereqCompBloquee = prereqBloqueTotal(comp);

    const key = `${comp.id}_1`;
    const panneauOuvert = key in pendingChoix;
    const choixSelectionne = pendingChoix[key] ?? "";
    const options = getOptionsDropdown(comp, 1);

    return (
      <div
        className={`flex flex-col gap-2 rounded border border-border p-2 ${
          compBloqueeClasse || prereqCompBloquee ? "opacity-50" : ""
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Checkbox
            id={`${comp.id}-uac`}
            checked={dejaAchete || panneauOuvert}
            disabled={
              compBloqueeClasse ||
              mutationEnCours ||
              prereqBloque ||
              (dejaAchete && estGratuit)
            }
            onCheckedChange={(checked) => {
              if (checked) {
                // Pré-sélectionner automatiquement si une seule option est
                // disponible (cas : Connaissance des Religions pour un perso
                // déjà croyant — sa religion est la seule option).
                const defaultValue = options.length === 1 ? options[0].value : "";
                setPendingChoix((p) => ({ ...p, [key]: defaultValue }));
              } else if (dejaAchete && achat) {
                handleUncheck(comp, achat);
              } else {
                // Annule l'ouverture du panneau
                setPendingChoix((p) => {
                  const next = { ...p };
                  delete next[key];
                  return next;
                });
              }
            }}
          />
          <Label
            htmlFor={`${comp.id}-uac`}
            className="flex-1 cursor-pointer space-y-1 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              {dejaAchete && achat ? (
                <>
                  <strong>
                    {resoudreChoixAffichage(
                      achat.choix_achat,
                      comp.type_choix,
                      religions ?? [],
                      langues ?? [],
                    ) ?? "—"}
                  </strong>
                  {estGratuit ? (
                    <Badge className="bg-green-600/20 text-green-400 border border-green-600/30 text-xs">
                      Acquis gratuitement
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {achat.xp_depense} XP
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <strong>Niveau 1</strong>
                  <Badge variant="secondary" className="text-xs">
                    {niv1.cout_xp} XP
                  </Badge>
                </>
              )}
            </div>
            {niv1.description_niveau && (
              <p className="text-muted-foreground">{niv1.description_niveau}</p>
            )}
          </Label>
        </div>
        {!dejaAchete && panneauOuvert && !compBloqueeClasse && !prereqCompBloquee && (
          <div className="flex flex-wrap items-center gap-2 pl-7">
            <Select
              value={choixSelectionne}
              onValueChange={(v) => setPendingChoix((p) => ({ ...p, [key]: v }))}
            >
              <SelectTrigger className="h-8 max-w-xs text-xs">
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!choixSelectionne || mutationEnCours || compBloqueeClasse}
              onClick={() => handleConfirmChoix(comp, niv1)}
            >
              {mutationEnCours && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirmer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPendingChoix((p) => {
                  const next = { ...p };
                  delete next[key];
                  return next;
                });
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  /**
   * `multiple_choix_distinct` (Décryptage, Langue supplémentaire). Liste des achats
   * existants + bouton "+ Ajouter une autre" qui révèle un dropdown.
   */
  const renderMultipleChoixDistinct = (comp: CompetenceWithNiveaux) => {
    const achatsPourComp = achatsParCompetence.get(comp.id) ?? [];
    const niv1 = comp.niveaux_parsed.find((n) => n.niveau === 1);
    if (!niv1) return null;
    const compBloqueeClasse = classeBloque(comp);
    const prereqCompBloquee = prereqBloqueTotal(comp);
    const addOpen = pendingAddCompId === comp.id;
    const keyAdd = `${comp.id}_add`;
    const choixAdd = pendingChoix[keyAdd] ?? "";
    const options = getOptionsDropdown(comp, 1);

    return (
      <div className={`space-y-2 ${compBloqueeClasse || prereqCompBloquee ? "opacity-50" : ""}`}>
        {/* Liste des achats existants : chacun avec checkbox cochée et décrochable */}
        {achatsPourComp.map((achat) => {
          const choixAffiche = resoudreChoixAffichage(
            achat.choix_achat,
            comp.type_choix,
            religions ?? [],
            langues ?? [],
          );
          const estGratuit = achat.xp_depense === 0;
          return (
            <div
              key={achat.id}
              className="flex flex-wrap items-center gap-3 rounded border border-border p-2"
            >
              <Checkbox
                checked
                disabled={compBloqueeClasse || mutationEnCours || estGratuit}
                onCheckedChange={(checked) => {
                  if (!checked) handleUncheck(comp, achat);
                }}
              />
              <div className="flex-1 space-y-1 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{choixAffiche ?? "—"}</strong>
                  {estGratuit ? (
                    <Badge className="bg-green-600/20 text-green-400 border border-green-600/30 text-xs">
                      Acquis gratuitement
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {achat.xp_depense} XP
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Panneau "+ Ajouter une autre" */}
        {!addOpen && !prereqCompBloquee && !compBloqueeClasse && options.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPendingAddCompId(comp.id)}
            disabled={compBloqueeClasse || prereqCompBloquee || mutationEnCours}
            className="text-xs"
          >
            <Plus className="mr-1 h-3 w-3" />
            Ajouter une autre ({niv1.cout_xp} XP)
          </Button>
        )}
        {addOpen && !compBloqueeClasse && !prereqCompBloquee && (
          <div className="flex flex-wrap items-center gap-2 rounded border border-dashed border-border p-2">
            <Select
              value={choixAdd}
              onValueChange={(v) => setPendingChoix((p) => ({ ...p, [keyAdd]: v }))}
            >
              <SelectTrigger className="h-8 max-w-xs text-xs">
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!choixAdd || mutationEnCours || compBloqueeClasse}
              onClick={() => handleConfirmAdd(comp)}
            >
              {mutationEnCours && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirmer ({niv1.cout_xp} XP)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPendingAddCompId(null);
                setPendingChoix((p) => {
                  const next = { ...p };
                  delete next[keyAdd];
                  return next;
                });
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        {options.length === 0 && achatsPourComp.length > 0 && !addOpen && (
          <p className="text-xs italic text-muted-foreground">
            Toutes les options disponibles ont été choisies.
          </p>
        )}
      </div>
    );
  };

  /**
   * `multiple_avec_choix_par_niveau`. Pour chaque "choix" (catégorie, cercle...),
   * affiche les niveaux 1, 2, 3 en checkboxes. Bouton "+ Ajouter une autre"
   * en bas pour démarrer un nouveau choix au niveau 1.
   */
  const renderMultipleAvecChoixParNiveau = (comp: CompetenceWithNiveaux) => {
    const achatsPourComp = achatsParCompetence.get(comp.id) ?? [];
    // Grouper par choix_achat
    const parChoix = new Map<string, PersonnageCompetenceRow[]>();
    achatsPourComp.forEach((a) => {
      const k = a.choix_achat ?? "(sans choix)";
      if (!parChoix.has(k)) parChoix.set(k, []);
      parChoix.get(k)!.push(a);
    });

    const addOpen = pendingAddCompId === comp.id;
    const keyAdd = `${comp.id}_add`;
    const choixAdd = pendingChoix[keyAdd] ?? "";
    const optionsAdd = getOptionsDropdown(comp, 1);
    const niv1 = comp.niveaux_parsed.find((n) => n.niveau === 1);
    const compBloqueeClasse = classeBloque(comp);
    const prereqCompBloquee = prereqBloqueTotal(comp);

    return (
      <div className={`space-y-3 ${compBloqueeClasse || prereqCompBloquee ? "opacity-50" : ""}`}>
        {/* Pour chaque choix existant, afficher les niveaux possibles */}
        {Array.from(parChoix.entries()).map(([choixKey, achatsDuChoix]) => {
          const niveauxDuChoix = new Set(achatsDuChoix.map((a) => a.niveau_acquis));
          const maxAchete = Math.max(...niveauxDuChoix);
          const choixAffiche = resoudreChoixAffichage(
            choixKey,
            comp.type_choix,
            religions ?? [],
            langues ?? [],
          );

          return (
            <div key={choixKey} className="rounded border border-border p-2">
              <p className="mb-2 text-xs font-semibold text-foreground">
                {choixAffiche}
              </p>
              <div className="space-y-1.5">
                {comp.niveaux_parsed.map((niv) => {
                  const dejaAchete = niveauxDuChoix.has(niv.niveau);
                  const niveauPrecedentRequis =
                    niv.niveau > 1 && niv.niveau - 1 > maxAchete;
                  const requiresMaster = needsMaster(comp, niv.niveau);
                  const achatCible = achatsDuChoix.find(
                    (a) => a.niveau_acquis === niv.niveau,
                  );
                  const estGratuit = achatCible?.xp_depense === 0;
                  const niveauMax = niveauMaxAccessible(comp);
                  const niveauHorsClasse = niv.niveau > niveauMax;
                  const prereqInfo = getPrereqInfo(comp);
                  const prereqBloque =
                    !!prereqInfo && niv.niveau > prereqInfo.niveauMaxAchetable;
                  const raisonPrereq =
                    prereqInfo?.raisonPourNiveau(niv.niveau) ?? null;
                  const disabled =
                    compBloqueeClasse ||
                    niveauHorsClasse ||
                    prereqBloque ||
                    (!dejaAchete && niveauPrecedentRequis) ||
                    mutationEnCours ||
                    (dejaAchete && estGratuit);

                  return (
                    <div
                      key={niv.niveau}
                      className={`flex flex-wrap items-center gap-3 pl-2 ${
                        compBloqueeClasse || niveauHorsClasse || prereqBloque ? "opacity-50" : ""
                      }`}
                    >
                      <Checkbox
                        id={`${comp.id}-${choixKey}-${niv.niveau}`}
                        checked={dejaAchete}
                        disabled={disabled}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleBuy(comp, niv, choixKey);
                          } else if (achatCible) {
                            handleUncheck(comp, achatCible);
                          }
                        }}
                      />
                      <Label
                        htmlFor={`${comp.id}-${choixKey}-${niv.niveau}`}
                        className="flex-1 cursor-pointer space-y-1 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span>Niveau {niv.niveau}</span>
                          <Badge variant="secondary" className="text-xs">
                            {niv.cout_xp} XP
                          </Badge>
                          {requiresMaster && !niveauHorsClasse && !compBloqueeClasse && (
                            <Badge
                              variant="outline"
                              className="text-xs border-amber-600/40 text-amber-500"
                            >
                              Maître
                            </Badge>
                          )}
                          {estGratuit && (
                            <Badge className="bg-green-600/20 text-green-400 border border-green-600/30 text-xs">
                              Gratuit
                            </Badge>
                          )}
                          {!compBloqueeClasse && niveauHorsClasse && (
                            <span className="flex items-center gap-1 text-red-400">
                              <Lock className="h-3 w-3" /> Hors classe (max : {niveauMax})
                            </span>
                          )}
                          {niveauPrecedentRequis && !dejaAchete && !niveauHorsClasse && !compBloqueeClasse && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Lock className="h-3 w-3" /> Niveau {niv.niveau - 1} requis
                            </span>
                          )}
                        </div>
                        {!compBloqueeClasse && !prereqCompBloquee && prereqBloque && !niveauHorsClasse && !dejaAchete && raisonPrereq && (
                          <MessageBlocage {...parsePrereqRaison(raisonPrereq)} />
                        )}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* "+ Ajouter une autre" */}
        {!addOpen && !compBloqueeClasse && !prereqCompBloquee && optionsAdd.length > 0 && niv1 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPendingAddCompId(comp.id)}
            disabled={compBloqueeClasse || prereqCompBloquee || mutationEnCours}
            className="text-xs"
          >
            <Plus className="mr-1 h-3 w-3" />
            Ajouter une autre ({niv1.cout_xp} XP)
          </Button>
        )}
        {addOpen && !compBloqueeClasse && !prereqCompBloquee && niv1 && (
          <div className="flex flex-wrap items-center gap-2 rounded border border-dashed border-border p-2">
            <Select
              value={choixAdd}
              onValueChange={(v) => setPendingChoix((p) => ({ ...p, [keyAdd]: v }))}
            >
              <SelectTrigger className="h-8 max-w-xs text-xs">
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                {optionsAdd.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!choixAdd || mutationEnCours || compBloqueeClasse}
              onClick={() => handleConfirmAdd(comp)}
            >
              {mutationEnCours && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirmer ({niv1.cout_xp} XP)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPendingAddCompId(null);
                setPendingChoix((p) => {
                  const next = { ...p };
                  delete next[keyAdd];
                  return next;
                });
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        {optionsAdd.length === 0 && achatsPourComp.length > 0 && !addOpen && (
          <p className="text-xs italic text-muted-foreground">
            Toutes les options disponibles ont été choisies.
          </p>
        )}
        {comp.type_choix === "categorie_depecage" &&
          optionsAdd.length === 0 &&
          achatsPourComp.length === 0 && (
            <p className="text-xs italic text-muted-foreground">
              Achetez d'abord Connaissance des Créatures pour au moins une
              catégorie.
            </p>
          )}
      </div>
    );
  };

  /**
   * `multiple_sans_choix` (Dév. Spirituel + Supérieur). Compteur `[-] X [+]`.
   * Chaque clic = 1 RPC.
   */
  const renderMultipleSansChoix = (comp: CompetenceWithNiveaux) => {
    const achatsPourComp = achatsParCompetence.get(comp.id) ?? [];
    const nbAchats = achatsPourComp.length;
    const niv1 = comp.niveaux_parsed.find((n) => n.niveau === 1);
    if (!niv1) return null;

    const compBloqueeClasse = classeBloque(comp);
    const prereqCompBloquee = prereqBloqueTotal(comp);

    // Détection Dév. Spirituel basique vs Supérieur
    const estBasique = comp.nom === "Développement Spirituel";
    const compSuperieur = (competences ?? []).find(
      (c) => c.nom === "Développement Spirituel Supérieur",
    );
    const aSuperieurAcquis = compSuperieur
      ? (achatsParCompetence.get(compSuperieur.id) ?? []).length > 0
      : false;

    // [-] désactivé si pas d'achat OU si on est sur le basique et que
    // le supérieur a déjà été acheté (la RPC refuserait de baisser sous 20 PS).
    const minusDisabled =
      compBloqueeClasse ||
      nbAchats === 0 ||
      mutationEnCours ||
      (estBasique && aSuperieurAcquis);

    const handlePlus = () => {
      handleBuy(comp, niv1);
    };

    const handleMinus = () => {
      // Décocher le dernier achat (le plus récent). La RPC supprime cette
      // ligne unique (type multiple_sans_choix → pas de cascade).
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
          <strong>Acheté {nbAchats} fois</strong>
          <span className="ml-2 text-muted-foreground">
            ({niv1.cout_xp} XP / achat)
          </span>
        </div>
        <Button
          size="sm"
          onClick={handlePlus}
          disabled={compBloqueeClasse || prereqCompBloquee || mutationEnCours}
        >
          {mutationEnCours && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  /**
   * `simple` : checkbox par niveau (refactor du flow existant).
   */
  const renderSimple = (comp: CompetenceWithNiveaux) => {
    const niveauxAchetesPourComp = niveauxAchetes.get(comp.id) ?? new Set<number>();
    const maxAchete = niveauxAchetesPourComp.size
      ? Math.max(...niveauxAchetesPourComp)
      : 0;
    return (
      <div className="space-y-2">
        {comp.niveaux_parsed.length === 0 && (
          <p className="text-xs italic text-muted-foreground">
            Aucun niveau défini pour cette compétence.
          </p>
        )}
        {comp.niveaux_parsed.map((niv) => renderNiveauSimple(comp, niv, maxAchete))}
      </div>
    );
  };

  // =======================================================================
  // RENDER : Carte compétence (dispatch par type_achat)
  // =======================================================================

  const renderCompetence = (comp: CompetenceWithNiveaux) => {
    let body: ReactNode = null;
    switch (comp.type_achat) {
      case "unique_avec_choix":
        body = renderUniqueAvecChoix(comp);
        break;
      case "multiple_choix_distinct":
        body = renderMultipleChoixDistinct(comp);
        break;
      case "multiple_avec_choix_par_niveau":
        body = renderMultipleAvecChoixParNiveau(comp);
        break;
      case "multiple_sans_choix":
        body = renderMultipleSansChoix(comp);
        break;
      case "simple":
      default:
        body = renderSimple(comp);
    }

    const compBloqueeClasse = classeBloque(comp);
    const prereqCompBloquee = prereqBloqueTotal(comp);
    const raisonPrereqGlobal =
      prereqCompBloquee
        ? getPrereqInfo(comp)?.raisonPourNiveau(1) ?? "Prérequis non rempli."
        : null;

    return (
      <Card key={comp.id}>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-heading">{comp.nom}</CardTitle>
            {comp.est_general && (
              <Badge variant="outline" className="text-xs">
                Générale
              </Badge>
            )}
          </div>
          {comp.description && (
            <p className="text-xs text-muted-foreground">{comp.description}</p>
          )}
          {compBloqueeClasse && (() => {
            const detail = blocageDetail(comp);
            return detail ? <MessageBlocage {...detail} /> : null;
          })()}
          {!compBloqueeClasse && prereqCompBloquee && raisonPrereqGlobal && (
            <MessageBlocage {...parsePrereqRaison(raisonPrereqGlobal)} />
          )}
        </CardHeader>
        <CardContent className="space-y-2">{body}</CardContent>
      </Card>
    );
  };

  // =======================================================================
  // RENDER : Page complète
  // =======================================================================

  if (loadingCompetences || loadingAchats || loadingClasse) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Chargement des compétences…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="generale" className="w-full">
        {/* Sprint 5.5 Section 2.3 : sous-menu scrollable horizontalement
            sur mobile. Pattern aligné sur Encyclopedie.tsx (cercles de
            magie, domaines de prière). Conserve Radix Tabs (state +
            accessibilité), ne change que le style. */}
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {TAB_CONFIG.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className="flex-shrink-0 whitespace-nowrap"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TAB_CONFIG.map((t) => (
          <TabsContent key={t.key} value={t.key} className="space-y-3">
            {(competencesParTab[t.key] ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune compétence dans cette catégorie.
              </p>
            ) : (
              competencesParTab[t.key].map((c) => renderCompetence(c))
            )}
          </TabsContent>
        ))}
      </Tabs>

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
                  Annuler le niveau {cascadeDialog.achatCible.niveau_acquis} de{" "}
                  <strong>{cascadeDialog.competence.nom}</strong>
                  {cascadeDialog.achatCible.choix_achat && (
                    <>
                      {" "}
                      ({" "}
                      <em>
                        {resoudreChoixAffichage(
                          cascadeDialog.achatCible.choix_achat,
                          cascadeDialog.competence.type_choix,
                          religions ?? [],
                          langues ?? [],
                        )}
                      </em>
                      )
                    </>
                  )}{" "}
                  annulera aussi tous les niveaux supérieurs de cette
                  compétence.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {cascadeDialog && (
            <div className="space-y-2 py-2 text-sm">
              <p className="font-semibold">
                Achats qui seront annulés ({cascadeDialog.achatsAnnules.length}) :
              </p>
              <ul className="ml-4 list-disc space-y-1 text-xs">
                {cascadeDialog.achatsAnnules
                  .sort((a, b) => a.niveau_acquis - b.niveau_acquis)
                  .map((a) => {
                    const choix = resoudreChoixAffichage(
                      a.choix_achat,
                      cascadeDialog.competence.type_choix,
                      religions ?? [],
                      langues ?? [],
                    );
                    return (
                      <li key={a.id}>
                        Niveau {a.niveau_acquis}
                        {choix ? ` (${choix})` : ""} — {a.xp_depense} XP
                      </li>
                    );
                  })}
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

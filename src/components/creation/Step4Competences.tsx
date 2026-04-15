import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Lock, ShieldAlert, Clock, ChevronDown, ChevronUp } from "lucide-react";

// ---- Types ----
interface NiveauInfo {
  niveau: number;
  cout_xp: number;
  description_niveau?: string;
  prerequis?: string | null;
}

interface Competence {
  id: string;
  nom: string;
  description: string | null;
  categorie: string;
  est_general: boolean;
  niveaux: NiveauInfo[];
}

interface PurchasedComp {
  id: string;
  competence_id: string;
  niveau_acquis: number;
  xp_depense: number;
  appris_via_maitre: boolean;
  nom_maitre: string | null;
  statut_maitre: string | null;
  choix_achat: string | null;
}

// ---- Constants ----
const CROSS_LOCK_SKILLS = ["Assemblage de Runes", "Développement Spirituel", "Développement Spirituel Supérieur"];
const CC_CATEGORIES = ["Nature", "Artificielles", "Montagnes", "Rêves", "Mythiques", "Profondeurs", "Tombes", "Mers", "Cauchemars", "Rakashans", "Déserts", "Néant"];
const LANGUES = ["Le Démoniaque", "Le Drow", "L'Elfique", "Le Nain", "L'Orc", "L'Ancien"];
const LANGUES_ANCIENNES = ["L'Ancien Commun", "L'Ancien Démoniaque", "L'Ancien Drow", "L'Ancien Elfique", "L'Ancien Nain"];
const CERCLES = ["Air", "Altération", "Charmes", "Combat", "Divination", "Eau", "Feu", "Illusion", "Magie Pure", "Magie Noire", "Nécromancie", "Protection", "Terre"];
const DOMAINES = ["Bénédiction", "Chaos", "Connaissance", "Éléments", "Guerre", "Nature", "Nécromancie", "Ordre"];

const TAB_MAP: Record<string, string> = {
  generale: "Générales",
  guerrier: "Guerrier",
  voleur: "Voleur",
  mage: "Mage",
  pretre: "Prêtre",
};

const TAB_KEYS = ["generale", "guerrier", "voleur", "mage", "pretre"];

// ---- Helpers ----
function parseNiveaux(raw: any): NiveauInfo[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((n: any) => ({
    niveau: n.niveau ?? 1,
    cout_xp: n.cout_xp ?? 0,
    description_niveau: n.description_niveau ?? "",
    prerequis: n.prerequis ?? null,
  }));
  return [];
}

function isMultiBuy(nom: string): boolean {
  const multi = [
    "Connaissance des Créatures", "Langue supplémentaire", "Décryptage",
    "Développement Spirituel", "Développement Spirituel Supérieur",
    "Acquisition de Cercle", "Acquisition de Domaine", "Dépeçage",
  ];
  return multi.includes(nom);
}

// ---- Props ----
interface Step4Props {
  personnageId: string;
  classeNom: string;
  classeId: string;
  religionId: string | null;
  setReligionId: (v: string | null) => void;
  familleCriminelleId: string | null;
  setFamilleCriminelleId: (v: string | null) => void;
  xpDisponible: number;
  xpDepense: number;
  onXpSpent: (amount: number) => void;
  psMax: number;
  onPsMaxChange: (newPs: number) => void;
  competencesGratuites: string[];
  religions: any[];
}

const Step4Competences = ({
  personnageId, classeNom, classeId, religionId, setReligionId,
  familleCriminelleId, setFamilleCriminelleId,
  xpDisponible, xpDepense, onXpSpent,
  psMax, onPsMaxChange, competencesGratuites,
  religions,
}: Step4Props) => {
  // Data
  const { data: allCompetences } = useQuery({
    queryKey: ["competences-actives"],
    queryFn: async () => {
      const { data } = await supabase
        .from("competences")
        .select("*")
        .eq("est_actif", true)
        .order("nom");
      return (data ?? []).map((c: any) => ({
        ...c,
        niveaux: parseNiveaux(c.niveaux),
      })) as Competence[];
    },
  });

  const { data: familles } = useQuery({
    queryKey: ["familles-actives"],
    queryFn: async () => {
      const { data } = await supabase
        .from("familles_criminelles")
        .select("*")
        .eq("est_actif", true)
        .order("nom");
      return data ?? [];
    },
  });

  const { data: religionData } = useQuery({
    queryKey: ["religion-detail", religionId],
    queryFn: async () => {
      if (!religionId) return null;
      const { data } = await supabase
        .from("religions")
        .select("*")
        .eq("id", religionId)
        .single();
      return data;
    },
    enabled: !!religionId,
  });

  // Purchased competences (local + DB)
  const [purchased, setPurchased] = useState<PurchasedComp[]>([]);
  const [loadedFromDb, setLoadedFromDb] = useState(false);

  useEffect(() => {
    if (!personnageId) return;
    const load = async () => {
      const { data } = await supabase
        .from("personnage_competences")
        .select("*")
        .eq("personnage_id", personnageId);
      setPurchased((data ?? []) as PurchasedComp[]);
      setLoadedFromDb(true);
    };
    load();
  }, [personnageId]);

  // Modal state
  const [masterModal, setMasterModal] = useState<{
    competence: Competence;
    niveau: number;
    coutXp: number;
    choixAchat: string | null;
  } | null>(null);
  const [masterName, setMasterName] = useState("");

  const [choiceModal, setChoiceModal] = useState<{
    competence: Competence;
    niveau: number;
    coutXp: number;
    needsMaster: boolean;
    options: { value: string; label: string }[];
    title: string;
  } | null>(null);
  const [choiceValue, setChoiceValue] = useState("");

  // Expanded descriptions
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ---- Derived ----
  const competencesByTab = useMemo(() => {
    if (!allCompetences) return {};
    const map: Record<string, Competence[]> = {};
    TAB_KEYS.forEach((k) => (map[k] = []));
    allCompetences.forEach((c) => {
      const cat = c.categorie?.toLowerCase() || "generale";
      if (map[cat]) map[cat].push(c);
    });
    return map;
  }, [allCompetences]);

  const getPurchases = useCallback(
    (compId: string) => purchased.filter((p) => p.competence_id === compId),
    [purchased]
  );

  const getMaxLevel = useCallback(
    (compId: string) => {
      const ps = getPurchases(compId);
      if (ps.length === 0) return 0;
      return Math.max(...ps.map((p) => p.niveau_acquis));
    },
    [getPurchases]
  );

  const hasSkill = useCallback(
    (nom: string, minLevel = 1) => {
      if (!allCompetences) return false;
      const comp = allCompetences.find((c) => c.nom === nom);
      if (!comp) return false;
      return getPurchases(comp.id).some((p) => p.niveau_acquis >= minLevel);
    },
    [allCompetences, getPurchases]
  );

  const getChoices = useCallback(
    (compId: string, niveau?: number) => {
      return getPurchases(compId)
        .filter((p) => (niveau != null ? p.niveau_acquis === niveau : true))
        .map((p) => p.choix_achat)
        .filter(Boolean) as string[];
    },
    [getPurchases]
  );

  const getCrossLockMessage = useCallback(
    (comp: Competence, tabCategory: string): string | null => {
      if (!CROSS_LOCK_SKILLS.includes(comp.nom)) return null;
      const classeNomLower = classeNom.toLowerCase();
      if (classeNomLower === "mage" && tabCategory === "pretre") return "Déjà disponible dans les compétences de votre classe — achetez-les dans la catégorie Mage.";
      if (classeNomLower === "prêtre" && tabCategory === "mage") return "Déjà disponible dans les compétences de votre classe — achetez-les dans la catégorie Prêtre.";
      if (classeNomLower !== "mage" && classeNomLower !== "prêtre") {
        if (comp.nom === "Assemblage de Runes") {
          const allComps = allCompetences ?? [];
          const mageVersion = allComps.find((c) => c.nom === "Assemblage de Runes" && c.categorie === "mage");
          const pretreVersion = allComps.find((c) => c.nom === "Assemblage de Runes" && c.categorie === "pretre");
          if (tabCategory === "pretre" && mageVersion && getPurchases(mageVersion.id).length > 0) return "Disponible dans les compétences de la catégorie Mage.";
          if (tabCategory === "mage" && pretreVersion && getPurchases(pretreVersion.id).length > 0) return "Disponible dans les compétences de la catégorie Prêtre.";
        }
        if (comp.nom === "Développement Spirituel" || comp.nom === "Développement Spirituel Supérieur") {
          const allComps = allCompetences ?? [];
          const mageDS = allComps.find((c) => c.nom === "Développement Spirituel" && c.categorie === "mage");
          const pretreDS = allComps.find((c) => c.nom === "Développement Spirituel" && c.categorie === "pretre");
          if (tabCategory === "pretre" && mageDS && getPurchases(mageDS.id).length > 0) return "Disponible dans les compétences de la catégorie Mage.";
          if (tabCategory === "mage" && pretreDS && getPurchases(pretreDS.id).length > 0) return "Disponible dans les compétences de la catégorie Prêtre.";
        }
      }
      return null;
    },
    [classeNom, allCompetences, getPurchases]
  );

  const isFreeSkill = useCallback(
    (nom: string) => competencesGratuites.some((g) => g.toLowerCase() === nom.toLowerCase()),
    [competencesGratuites]
  );

  const needsMaster = useCallback(
    (comp: Competence, niveau: number, tabCategory: string): boolean => {
      const classeNomLower = classeNom.toLowerCase();
      const isOwnClass = comp.categorie === classeNomLower || (comp.categorie === "pretre" && classeNomLower === "prêtre");
      const isGeneral = comp.est_general;
      if (isGeneral || isOwnClass) return niveau >= 3;
      return niveau >= 2;
    },
    [classeNom]
  );

  const isImpossible = useCallback(
    (comp: Competence, niveau: number): boolean => {
      const classeNomLower = classeNom.toLowerCase();
      const isOwnClass = comp.categorie === classeNomLower || (comp.categorie === "pretre" && classeNomLower === "prêtre");
      const isGeneral = comp.est_general;
      if (isGeneral || isOwnClass) return false;
      return niveau >= 3;
    },
    [classeNom]
  );

  const doPurchase = async (
    comp: Competence,
    niveau: number,
    coutXp: number,
    viaMaitre: boolean,
    nomMaitre: string | null,
    choixAchat: string | null,
  ) => {
    try {
      const { data, error } = await supabase
        .from("personnage_competences")
        .insert({
          personnage_id: personnageId,
          competence_id: comp.id,
          niveau_acquis: niveau,
          xp_depense: coutXp,
          appris_via_maitre: viaMaitre,
          nom_maitre: nomMaitre,
          statut_maitre: viaMaitre ? "en_attente" : "non_requis",
          choix_achat: choixAchat,
        })
        .select()
        .single();
      if (error) throw error;
      setPurchased((prev) => [...prev, data as PurchasedComp]);
      onXpSpent(coutXp);
      if (comp.nom === "Développement Spirituel" || comp.nom === "Développement Spirituel Supérieur") {
        const newPs = psMax + 1;
        onPsMaxChange(newPs);
        await supabase.from("personnages").update({ ps_max: newPs, xp_depense: xpDepense + coutXp }).eq("id", personnageId);
      } else {
        await supabase.from("personnages").update({ xp_depense: xpDepense + coutXp }).eq("id", personnageId);
      }
      toast.success(`${comp.nom}${choixAchat ? ` (${choixAchat})` : ""} acheté !`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'achat.");
    }
  };

  const handleBuy = (comp: Competence, niveau: number, coutXp: number, tabCategory: string) => {
    if (xpDisponible < coutXp) { toast.error("XP insuffisant."); return; }
    const requiresMaster = needsMaster(comp, niveau, tabCategory);
    if (comp.nom === "Connaissance des Créatures") {
      const existingChoices = getChoices(comp.id, niveau);
      const allCats = niveau === 1 ? CC_CATEGORIES : getChoices(comp.id, 1);
      const available = allCats.filter((c) => !existingChoices.includes(c));
      if (available.length === 0) { toast.error("Toutes les catégories ont déjà été choisies."); return; }
      setChoiceModal({ competence: comp, niveau, coutXp, needsMaster: requiresMaster, options: available.map((v) => ({ value: v, label: v })), title: `Choisir une catégorie de créatures (niveau ${niveau})` });
      setChoiceValue(""); return;
    }
    if (comp.nom === "Langue supplémentaire") {
      const existingChoices = getChoices(comp.id);
      const available = LANGUES.filter((l) => !existingChoices.includes(l));
      if (available.length === 0) { toast.error("Toutes les langues ont déjà été choisies."); return; }
      setChoiceModal({ competence: comp, niveau, coutXp, needsMaster: requiresMaster, options: available.map((v) => ({ value: v, label: v })), title: "Choisir une langue" });
      setChoiceValue(""); return;
    }
    if (comp.nom === "Décryptage") {
      const existingChoices = getChoices(comp.id);
      const available = LANGUES_ANCIENNES.filter((l) => !existingChoices.includes(l));
      if (available.length === 0) { toast.error("Toutes les langues anciennes ont déjà été choisies."); return; }
      setChoiceModal({ competence: comp, niveau, coutXp, needsMaster: requiresMaster, options: available.map((v) => ({ value: v, label: v })), title: "Choisir une langue ancienne" });
      setChoiceValue(""); return;
    }
    if (comp.nom === "Acquisition de Cercle") {
      const choicesAtLevel = getChoices(comp.id, niveau);
      const available = niveau === 1 ? CERCLES.filter((c) => !choicesAtLevel.includes(c)) : getChoices(comp.id, niveau - 1).filter((c) => !choicesAtLevel.includes(c));
      if (available.length === 0) { toast.error("Aucun cercle disponible."); return; }
      setChoiceModal({ competence: comp, niveau, coutXp, needsMaster: requiresMaster, options: available.map((v) => ({ value: v, label: v })), title: `Choisir un cercle (niveau ${niveau})` });
      setChoiceValue(""); return;
    }
    if (comp.nom === "Acquisition de Domaine") {
      const choicesAtLevel = getChoices(comp.id, niveau);
      const proscrits = religionData?.domaines_proscrits ?? [];
      const available = niveau === 1 ? DOMAINES.filter((d) => !choicesAtLevel.includes(d) && !proscrits.includes(d)) : getChoices(comp.id, niveau - 1).filter((d) => !choicesAtLevel.includes(d));
      if (available.length === 0) { toast.error("Aucun domaine disponible."); return; }
      setChoiceModal({ competence: comp, niveau, coutXp, needsMaster: requiresMaster, options: available.map((v) => ({ value: v, label: v })), title: `Choisir un domaine (niveau ${niveau})` });
      setChoiceValue(""); return;
    }
    if (comp.nom === "Dépeçage") {
      const ccComp = allCompetences?.find((c) => c.nom === "Connaissance des Créatures");
      if (!ccComp) return;
      const ccChoices = getChoices(ccComp.id, niveau);
      const existingChoices = getChoices(comp.id, niveau);
      const available = ccChoices.filter((c) => !existingChoices.includes(c));
      if (available.length === 0) { toast.error("Aucune catégorie disponible pour le dépeçage."); return; }
      setChoiceModal({ competence: comp, niveau, coutXp, needsMaster: requiresMaster, options: available.map((v) => ({ value: v, label: v })), title: `Choisir une catégorie de dépeçage (niveau ${niveau})` });
      setChoiceValue(""); return;
    }
    if (comp.nom === "Connaissances des Religions" && !religionId) {
      setChoiceModal({ competence: comp, niveau, coutXp, needsMaster: requiresMaster, options: (religions ?? []).map((r: any) => ({ value: r.id, label: r.nom })), title: "Choisir une religion" });
      setChoiceValue(""); return;
    }
    if (comp.nom.toLowerCase().includes("connaissance criminelle") && niveau === 2) {
      setChoiceModal({ competence: comp, niveau, coutXp, needsMaster: requiresMaster, options: (familles ?? []).map((f: any) => ({ value: f.id, label: f.nom })), title: "Choisir une famille criminelle" });
      setChoiceValue(""); return;
    }
    if (requiresMaster) { setMasterModal({ competence: comp, niveau, coutXp, choixAchat: null }); setMasterName(""); } else { doPurchase(comp, niveau, coutXp, false, null, null); }
  };

  const confirmChoice = async () => {
    if (!choiceModal || !choiceValue) return;
    const { competence, niveau, coutXp, needsMaster: reqMaster } = choiceModal;
    if (competence.nom === "Connaissances des Religions" && !religionId) { setReligionId(choiceValue); await supabase.from("personnages").update({ religion_id: choiceValue }).eq("id", personnageId); }
    if (competence.nom.toLowerCase().includes("connaissance criminelle") && niveau === 2) { setFamilleCriminelleId(choiceValue); await supabase.from("personnages").update({ famille_criminelle_id: choiceValue }).eq("id", personnageId); }
    const choixAchat = competence.nom === "Connaissances des Religions" || competence.nom.toLowerCase().includes("connaissance criminelle") ? null : choiceValue;
    if (reqMaster) { setChoiceModal(null); setMasterModal({ competence, niveau, coutXp, choixAchat }); setMasterName(""); } else { await doPurchase(competence, niveau, coutXp, false, null, choixAchat); setChoiceModal(null); }
  };

  const confirmMaster = async () => {
    if (!masterModal || !masterName.trim()) return;
    const { competence, niveau, coutXp, choixAchat } = masterModal;
    await doPurchase(competence, niveau, coutXp, true, masterName.trim(), choixAchat);
    setMasterModal(null);
  };

  const renderCompetence = (comp: Competence, tabCategory: string) => {
    const crossLock = getCrossLockMessage(comp, tabCategory);
    const isFree = isFreeSkill(comp.nom);
    const isExp = expanded.has(comp.id);
    const desc = comp.description ?? "";
    const truncated = desc.length > 150 ? desc.slice(0, 150) : desc;
    const multi = isMultiBuy(comp.nom);
    const isDS = comp.nom === "Développement Spirituel";
    const isDSS = comp.nom === "Développement Spirituel Supérieur";
    return (
      <Card key={`${comp.id}-${tabCategory}`} className={`${crossLock || isFree ? "opacity-60" : ""}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-heading flex items-center gap-2">
              {comp.nom}
              {isFree && <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-xs">Déjà acquise gratuitement</Badge>}
              {multi && <Badge variant="outline" className="text-xs">Achat multiple</Badge>}
            </CardTitle>
            <button onClick={() => toggleExpand(comp.id)} className="text-muted-foreground hover:text-foreground">
              {isExp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {crossLock ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>{crossLock}</span>
            </div>
          ) : isFree ? null : (
            <>
              <p className="text-muted-foreground">
                {isExp ? desc : truncated}
                {desc.length > 150 && !isExp && (
                  <button className="text-primary ml-1" onClick={() => toggleExpand(comp.id)}>... Voir plus</button>
                )}
              </p>
              {isDS && <p className="text-xs text-primary">PS actuels : {psMax} / 20</p>}
              {isDSS && <p className="text-xs text-primary">PS actuels : {psMax} / 30</p>}
              {comp.niveaux.map((niv) => {
                const levelKey = `${comp.id}-${niv.niveau}`;
                const impossible = isImpossible(comp, niv.niveau);
                const reqMaster = needsMaster(comp, niv.niveau, tabCategory);
                let sequentialBlocked = !multi && niv.niveau > 1 && getMaxLevel(comp.id) < niv.niveau - 1;
                let multiBuyBlocked = false;
                let multiBuyMessage = "";
                if (isDS && psMax >= 20) { multiBuyBlocked = true; multiBuyMessage = "Maximum atteint — achetez Développement Spirituel Supérieur"; }
                if (isDSS) { if (psMax < 20) { multiBuyBlocked = true; multiBuyMessage = "Nécessite 20 PS"; } else if (psMax >= 30) { multiBuyBlocked = true; multiBuyMessage = "Maximum absolu atteint (30 PS)"; } }
                if (comp.nom === "Dépeçage") {
                  if (niv.niveau === 1 && (!hasSkill("Connaissance des Créatures", 1) || !hasSkill("Premiers Soins", 1))) { multiBuyBlocked = true; multiBuyMessage = "Nécessite Connaissance des Créatures 1 et Premiers Soins 1"; }
                  if (niv.niveau === 2 && !hasSkill("Connaissance des Créatures", 2)) { multiBuyBlocked = true; multiBuyMessage = "Nécessite Connaissance des Créatures 2"; }
                }
                if (comp.nom === "Acquisition de Domaine" && !hasSkill("Connaissances des Religions")) { multiBuyBlocked = true; multiBuyMessage = "Nécessite Connaissances des Religions"; }
                if (multi && (comp.nom === "Acquisition de Cercle" || comp.nom === "Acquisition de Domaine" || comp.nom === "Assemblage de Runes" || comp.nom === "Alchimie") && niv.niveau > 1 && getMaxLevel(comp.id) < niv.niveau - 1) sequentialBlocked = true;
                const disabled = impossible || sequentialBlocked || multiBuyBlocked || xpDisponible < niv.cout_xp || isFree || !!crossLock;
                const alreadyBought = !multi && getPurchases(comp.id).some((p) => p.niveau_acquis === niv.niveau);
                const pendingApproval = getPurchases(comp.id).some((p) => p.niveau_acquis === niv.niveau && p.statut_maitre === "en_attente");
                return (
                  <div key={levelKey} className="flex items-center justify-between gap-2 rounded border border-border p-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-xs">Niveau {niv.niveau}</span>
                        <span className="text-xs text-muted-foreground">({niv.cout_xp} XP)</span>
                        {reqMaster && !impossible && <Badge className="bg-orange-600/20 text-orange-400 border-orange-600/30 text-xs"><ShieldAlert className="h-3 w-3 mr-1" /> Maître requis</Badge>}
                        {pendingApproval && <Badge className="bg-orange-600/20 text-orange-400 border-orange-600/30 text-xs"><Clock className="h-3 w-3 mr-1" /> En attente</Badge>}
                        {alreadyBought && !pendingApproval && !multi && <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-xs">Acquise</Badge>}
                      </div>
                      {isExp && niv.description_niveau && <p className="text-xs text-muted-foreground mt-1">{niv.description_niveau}</p>}
                    </div>
                    {impossible ? (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><span><Button size="sm" variant="outline" disabled className="text-xs"><Lock className="h-3 w-3 mr-1" /> Impossible</Button></span></TooltipTrigger><TooltipContent>Inaccessible hors de votre classe</TooltipContent></Tooltip></TooltipProvider>
                    ) : alreadyBought && !multi ? null : (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><span><Button size="sm" variant="outline" disabled={disabled} onClick={() => handleBuy(comp, niv.niveau, niv.cout_xp, tabCategory)} className="text-xs whitespace-nowrap">Acheter ({niv.cout_xp} XP)</Button></span></TooltipTrigger>{disabled && <TooltipContent>{xpDisponible < niv.cout_xp ? "XP insuffisant" : sequentialBlocked ? `Niveau ${niv.niveau - 1} requis` : multiBuyMessage || "Indisponible"}</TooltipContent>}</Tooltip></TooltipProvider>
                    )}
                  </div>
                );
              })}
              {multi && getPurchases(comp.id).length > 0 && (
                <div className="space-y-1 pt-1 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground">Achats effectués :</p>
                  {getPurchases(comp.id).map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary" className="text-xs">Niv. {p.niveau_acquis}{p.choix_achat ? ` — ${p.choix_achat}` : ""}</Badge>
                      {p.statut_maitre === "en_attente" && <Badge className="bg-orange-600/20 text-orange-400 border-orange-600/30 text-xs">En attente</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!loadedFromDb || !allCompetences) return <p className="text-muted-foreground text-center py-8">Chargement des compétences…</p>;
  const classeTabKey = classeNom.toLowerCase() === "prêtre" ? "pretre" : classeNom.toLowerCase();

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold text-foreground">Étape 4 — Achat de compétences</h2>
      <Tabs defaultValue="generale" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {TAB_KEYS.map((key) => <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">{TAB_MAP[key]}{key === classeTabKey ? " *" : ""}</TabsTrigger>)}
        </TabsList>
        {TAB_KEYS.map((key) => (
          <TabsContent key={key} value={key} className="space-y-3 mt-4">
            {(competencesByTab[key] ?? []).map((comp) => renderCompetence(comp, key))}
            {(competencesByTab[key] ?? []).length === 0 && <p className="text-muted-foreground text-center py-4">Aucune compétence dans cette catégorie.</p>}
          </TabsContent>
        ))}
      </Tabs>
      <Dialog open={!!masterModal} onOpenChange={(open) => !open && setMasterModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Maître requis en jeu</DialogTitle><DialogDescription>Cette compétence nécessite un maître en jeu. Indiquez le nom de votre maître.</DialogDescription></DialogHeader>
          <div className="space-y-3"><Label htmlFor="master-name">Nom du maître *</Label><Input id="master-name" value={masterName} onChange={(e) => setMasterName(e.target.value)} placeholder="Nom du maître en jeu" /></div>
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setMasterModal(null)}>Annuler</Button><Button disabled={!masterName.trim()} onClick={confirmMaster}>Confirmer l'achat ({masterModal?.coutXp} XP)</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!choiceModal} onOpenChange={(open) => !open && setChoiceModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{choiceModal?.title}</DialogTitle><DialogDescription>Sélectionnez une option pour cet achat.</DialogDescription></DialogHeader>
          <Select value={choiceValue} onValueChange={setChoiceValue}>
            <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
            <SelectContent>{choiceModal?.options.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setChoiceModal(null)}>Annuler</Button><Button disabled={!choiceValue} onClick={confirmChoice}>Confirmer ({choiceModal?.coutXp} XP)</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Step4Competences;

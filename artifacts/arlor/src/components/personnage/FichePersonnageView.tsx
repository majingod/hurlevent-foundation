import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Printer, X, Check, Hammer, Gem, FlaskConical, Bomb } from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { calculerCoutPS, calculerCoutXP } from "@/utils/calculsMagie";
import { parseIngredientsRecette, formaterComposant } from "@/utils/alchimie";
import { STATUT_MAITRE_LABELS } from "@/constants/labels";
import type { Database } from "@/integrations/supabase/types";
import type {
  FichePersonnage,
  Trait,
  Competence,
  Sort,
  Priere,
  Assemblage,
  Recette,
  ArtisanatEtat,
  ManipulationAlchimique,
  ObjetForge,
  ReparationForge,
  ObjetJoaillerie,
  CompetenceGroupee,
  PiegeRow,
  PersonnagePiegeRow,
} from "./sections/types";
import { InfosCard } from "./sections/InfosCard";
import { HistoriqueAmeCard } from "./sections/HistoriqueAmeCard";
import { TraitsSection } from "./sections/TraitsSection";
import { SortsSection } from "./sections/SortsSection";
import { PrieresSection } from "./sections/PrieresSection";
import { AssemblagesSection } from "./sections/AssemblagesSection";
import { CompetencesSection } from "./sections/CompetencesSection";
import { AlchimieSection } from "./sections/AlchimieSection";
import { ForgeSection } from "./sections/ForgeSection";
import { JoaillerieSection } from "./sections/JoaillerieSection";
import { PiegesSection } from "./sections/PiegesSection";
import { resoudreChoixAffichage } from "./sections/helpers";

type LangueRow = Database["public"]["Tables"]["langues"]["Row"];
type ReligionRow = Database["public"]["Tables"]["religions"]["Row"];

type FichePersonnageViewMode = 'route' | 'wizard-preview';

interface FichePersonnageViewProps {
  personnageId: string;
  mode: FichePersonnageViewMode;
}

const FichePersonnageView = ({ personnageId, mode }: FichePersonnageViewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingHistorique, setEditingHistorique] = useState(false);
  const [historiqueTmp, setHistoriqueTmp] = useState("");
  const [ameTmp, setAmeTmp] = useState("");
  const [saving, setSaving] = useState(false);

  // DATA-FIRST : vue_fiche_personnage joint personnages + races + classes + religions
  // Remplace 3 requêtes en cascade (personnage → race → classe → religion)
  const { data: fiche, isLoading: ficheLoading } = useQuery({
    queryKey: ["fiche-personnage", personnageId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_fiche_personnage")
        .select("*")
        .eq("id", personnageId!)
        .single();
      return data as FichePersonnage;
    },
    enabled: !!personnageId,
  });

  // Toutes les requêtes suivantes dépendent uniquement de l'id URL (connu immédiatement),
  // elles démarrent toutes en parallèle sans attendre la fiche.

  // DATA-FIRST : vue_competences_personnage — plus de jointure ni de .map() frontend
  const { data: competences } = useQuery({
    queryKey: ["competences-personnage", personnageId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_competences_personnage")
        .select("*")
        .eq("personnage_id", personnageId!)
        .order("categorie")
        .order("nom");
      return (data ?? []) as Competence[];
    },
    enabled: !!personnageId,
  });

  // DATA-FIRST : vue_sorts_personnage — plus de jointure ni de .map() frontend
  const { data: sorts } = useQuery({
    queryKey: ["sorts-personnage", personnageId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_sorts_personnage")
        .select("*")
        .eq("personnage_id", personnageId!)
        .order("cercle")
        .order("nom_personnalise");
      return (data ?? []) as Sort[];
    },
    enabled: !!personnageId,
  });

  // DATA-FIRST : vue_prieres_personnage — plus de jointure ni de .map() frontend
  const { data: prieres } = useQuery({
    queryKey: ["prieres-personnage", personnageId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_prieres_personnage")
        .select("*")
        .eq("personnage_id", personnageId!)
        .order("domaine")
        .order("nom_personnalise");
      return (data ?? []) as Priere[];
    },
    enabled: !!personnageId,
  });

  // DATA-FIRST : vue_assemblages_personnage — plus de jointure ni de .map() frontend
  const { data: assemblages } = useQuery({
    queryKey: ["assemblages-personnage", personnageId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_assemblages_personnage")
        .select("*")
        .eq("personnage_id", personnageId!)
        .order("nom");
      return (data ?? []) as Assemblage[];
    },
    enabled: !!personnageId,
  });

  // DATA-FIRST : vue_recettes_personnage — plus de jointure ni de .map() frontend
  const { data: recettes } = useQuery({
    queryKey: ["recettes-personnage", personnageId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_recettes_personnage")
        .select("*")
        .eq("personnage_id", personnageId!)
        .order("type")
        .order("niveau_requis")
        .order("nom");
      return (data ?? []) as Recette[];
    },
    enabled: !!personnageId,
  });

  const { data: artisanatEtat } = useQuery({
    queryKey: ["artisanat-etat", personnageId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_artisanat_etat")
        .select("niveau_alchimie, niveau_forge, niveau_joaillerie, niveau_pieges")
        .eq("personnage_id", personnageId!)
        .maybeSingle();
      return (data as ArtisanatEtat) ?? null;
    },
    enabled: !!personnageId,
  });

  const { data: manipulations } = useQuery({
    queryKey: ["manipulations-alchimiques"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ingredients_alchimiques")
        .select("id, nom, niveau, manipulations")
        .order("niveau")
        .order("nom");
      return (data ?? []) as ManipulationAlchimique[];
    },
    enabled: !!(artisanatEtat?.niveau_alchimie && artisanatEtat.niveau_alchimie >= 1),
  });

  const { data: objetsForge } = useQuery({
    queryKey: ["objets-forge"],
    queryFn: async () => {
      const { data } = await supabase
        .from("objets_forge")
        .select("id, nom, description, type, temps_fabrication_minutes, materiaux_communs, materiaux_rares")
        .eq("est_actif", true)
        .order("temps_fabrication_minutes")
        .order("nom");
      return (data ?? []) as ObjetForge[];
    },
    enabled: !!(artisanatEtat?.niveau_forge && artisanatEtat.niveau_forge >= 1),
  });

  const { data: reparationsForge } = useQuery({
    queryKey: ["reparations-forge"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reparations_forge")
        .select("id, nom_affichage, categorie, materiaux, materiaux_rares, temps_minutes, temps_rare_minutes, notes")
        .eq("est_actif", true)
        .order("categorie")
        .order("nom_affichage");
      return (data ?? []) as ReparationForge[];
    },
    enabled: !!(artisanatEtat?.niveau_forge && artisanatEtat.niveau_forge >= 1),
  });

  const { data: objetsJoaillerie } = useQuery({
    queryKey: ["objets-joaillerie"],
    queryFn: async () => {
      const { data } = await supabase
        .from("objets_joaillerie")
        .select("id, nom, description, effet, temps_fabrication_minutes, temps_rare_minutes, materiaux_communs, materiaux_rares")
        .eq("est_actif", true)
        .order("temps_fabrication_minutes")
        .order("nom");
      return (data ?? []) as ObjetJoaillerie[];
    },
    enabled: !!(artisanatEtat?.niveau_joaillerie && artisanatEtat.niveau_joaillerie >= 1),
  });

  // PR-4 — Pièges : catalogue + possession (lecture seule, mirror étape 9)
  const { data: piegesCatalogue } = useQuery({
    queryKey: ["pieges-catalogue-fiche"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pieges")
        .select("*")
        .eq("est_actif", true)
        .order("nom")
        .order("niveau");
      return (data ?? []) as PiegeRow[];
    },
    enabled: !!(artisanatEtat?.niveau_pieges && artisanatEtat.niveau_pieges >= 1),
  });

  const { data: personnagePieges } = useQuery({
    queryKey: ["personnage-pieges-fiche", personnageId],
    queryFn: async () => {
      const { data } = await supabase
        .from("personnage_pieges")
        .select("*")
        .eq("personnage_id", personnageId!);
      return (data ?? []) as PersonnagePiegeRow[];
    },
    enabled: !!personnageId && !!(artisanatEtat?.niveau_pieges && artisanatEtat.niveau_pieges >= 1),
  });

  const { data: langues } = useQuery({
    queryKey: ["langues-fiche"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("langues")
        .select("id, nom");
      if (error) throw error;
      return (data ?? []) as Pick<LangueRow, "id" | "nom">[];
    },
  });

  const { data: religions } = useQuery({
    queryKey: ["religions-fiche"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("religions")
        .select("id, nom");
      if (error) throw error;
      return (data ?? []) as Pick<ReligionRow, "id" | "nom">[];
    },
  });

  const competencesGroupees = useMemo(() => {
    // Grouping par competence_id (PR2 v39).
    // Conserve les rows pour permettre un rendu spécifique selon type_achat :
    //   - Pattern 1 'simple' : sections par niveau acquis
    //   - Pattern 2 'multiple_sans_choix' : compteur + description générale
    //   - Pattern 3 'multiple_choix_distinct' : liste des choix avec XP par item
    //   - Pattern 4 + fallback : rendu row par row (sera refactoré PR3)
    const map = new Map<string, CompetenceGroupee>();

    (competences ?? []).forEach((c) => {
      const cle = c.competence_id;
      const existing = map.get(cle);
      if (existing) {
        existing.rows.push(c);
        existing.xp_total += c.xp_depense;
      } else {
        map.set(cle, {
          competence_id: c.competence_id,
          nom: c.nom,
          categorie: c.categorie,
          type_achat: c.type_achat,
          niveau_max_competence: c.niveau_max,
          competence_description: c.competence_description,
          statut_maitre: c.statut_maitre,
          xp_total: c.xp_depense,
          rows: [c],
        });
      }
    });

    // Tri des rows par niveau_acquis pour Pattern 1 (lecture naturelle 1 → 2 → 3)
    const groupes = Array.from(map.values());
    groupes.forEach((g) => g.rows.sort((a, b) => a.niveau_acquis - b.niveau_acquis));
    return groupes;
  }, [competences]);

  const isOwner = user?.id === fiche?.joueur_id;
  const xpDisponible = (fiche?.xp_total ?? 0) - (fiche?.xp_depense ?? 0);

  const traits = Array.isArray(fiche?.traits_raciaux_choisis)
    ? (fiche.traits_raciaux_choisis as unknown as Trait[])
    : [];

  // PR4b — Flags pour masquer les onglets/sous-onglets vides
  const hasTraits = traits.length > 0;
  const hasSorts = (sorts?.length ?? 0) > 0;
  const hasPrieres = (prieres?.length ?? 0) > 0;
  const hasAlchimie = (artisanatEtat?.niveau_alchimie ?? 0) >= 1;
  const hasForge = (artisanatEtat?.niveau_forge ?? 0) >= 1;
  const hasJoaillerie = (artisanatEtat?.niveau_joaillerie ?? 0) >= 1;
  const hasAssemblages = (assemblages?.length ?? 0) > 0;
  const hasPieges = (artisanatEtat?.niveau_pieges ?? 0) >= 1;
  const hasArtisanat = hasAlchimie || hasForge || hasJoaillerie || hasPieges;

  // PR4b — Sous-onglets Artisanat dynamiques
  type ArtisanatSubTab = { value: string; icon: typeof FlaskConical; label: string };
  const artisanatSubTabs: ArtisanatSubTab[] = [
    hasAlchimie && { value: "alchimie", icon: FlaskConical, label: "Alchimie" },
    hasPieges && { value: "pieges", icon: Bomb, label: "Pièges" },
    hasForge && { value: "forge", icon: Hammer, label: "Forge" },
    hasJoaillerie && { value: "joaillerie", icon: Gem, label: "Joaillerie" },
  ].filter((x): x is ArtisanatSubTab => Boolean(x));
  const artisanatColsClass: string = ({
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
  } as Record<number, string>)[artisanatSubTabs.length] ?? "grid-cols-4";
  const artisanatDefaultTab = artisanatSubTabs[0]?.value ?? "alchimie";

  const handleEditHistorique = () => {
    setHistoriqueTmp(fiche?.historique ?? "");
    setAmeTmp(fiche?.ame_personnage ?? "");
    setEditingHistorique(true);
  };

  const handleSaveHistorique = async () => {
    if (!fiche) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("personnages")
        .update({
          historique: historiqueTmp.trim(),
          ame_personnage: ameTmp.trim(),
        })
        .eq("id", fiche.id);

      if (error) throw error;
      await queryClient.invalidateQueries({
        predicate: (q) => q.queryKey.includes(personnageId),
      });
      toast.success("Historique et âme sauvegardés !");
      setEditingHistorique(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  const escapeHtml = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const handlePrint = () => {
    if (!fiche) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const niveauAlchimie = artisanatEtat?.niveau_alchimie ?? 0;
    const niveauForge = artisanatEtat?.niveau_forge ?? 0;
    const niveauJoaillerie = artisanatEtat?.niveau_joaillerie ?? 0;
    const niveauPieges = artisanatEtat?.niveau_pieges ?? 0;

    const sortsByCercle: Record<string, Sort[]> = {};
    (sorts ?? []).forEach((s) => {
      if (!sortsByCercle[s.cercle]) sortsByCercle[s.cercle] = [];
      sortsByCercle[s.cercle].push(s);
    });

    const prieresByDomaine: Record<string, Priere[]> = {};
    (prieres ?? []).forEach((p) => {
      if (!prieresByDomaine[p.domaine]) prieresByDomaine[p.domaine] = [];
      prieresByDomaine[p.domaine].push(p);
    });

    const recettesByNiveau: Record<number, Recette[]> = {};
    (recettes ?? []).forEach((r) => {
      if (!recettesByNiveau[r.niveau_requis]) recettesByNiveau[r.niveau_requis] = [];
      recettesByNiveau[r.niveau_requis].push(r);
    });

    const niveauLabels: Record<number, string> = {
      1: "Recettes mineures (Niv. 1)",
      2: "Recettes intermédiaires (Niv. 2)",
      3: "Recettes majeures (Niv. 3)",
    };

    // PR-4 — Pièges possédés pour l'impression
    const piegeCatPrint = new Map<string, PiegeRow>();
    (piegesCatalogue ?? []).forEach((p) => piegeCatPrint.set(`${p.nom}__${p.niveau}`, p));
    const famillesPiegesPrint: [string, number[]][] = (() => {
      const map = new Map<string, number[]>();
      (personnagePieges ?? []).forEach((pp) => {
        const arr = map.get(pp.piege_nom) ?? [];
        arr.push(pp.niveau_acquis);
        map.set(pp.piege_nom, arr);
      });
      map.forEach((a) => a.sort((x, y) => x - y));
      return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "fr"));
    })();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Fiche de ${escapeHtml(fiche.nom)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
          h1 { font-size: 24px; margin-bottom: 4px; }
          h2 { font-size: 18px; margin-top: 24px; margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 4px; }
          h3 { font-size: 15px; margin-top: 16px; margin-bottom: 8px; color: #444; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
          .item { margin-bottom: 6px; }
          .label { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 12px; }
          th { background-color: #f0f0f0; font-weight: bold; }
          .card { border: 1px solid #ccc; border-radius: 4px; padding: 10px; margin-bottom: 10px; page-break-inside: avoid; }
          .card-title { font-weight: bold; font-size: 14px; margin-bottom: 4px; }
          .card-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
          .badge { display: inline-block; background: #dbeafe; border: 1px solid #93c5fd; border-radius: 3px; padding: 1px 6px; font-size: 11px; white-space: nowrap; }
          .muted { color: #666; font-size: 11px; margin-top: 2px; }
          .desc { font-size: 12px; color: #333; margin-top: 6px; border-top: 1px solid #eee; padding-top: 4px; }
          .formula { font-family: monospace; background: #fef3c7; padding: 2px 6px; border-radius: 2px; font-size: 12px; margin-top: 4px; display: inline-block; }
          @media print {
            .card { page-break-inside: avoid; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            p, span, div { overflow: visible !important; max-height: none !important; }
          }
        </style>
      </head>
      <body>
        <h1>Fiche de ${escapeHtml(fiche.nom)}</h1>
        <p class="muted">${escapeHtml(fiche.race_nom ?? "")}${fiche.race_nom_latin ? ` (${escapeHtml(fiche.race_nom_latin)})` : ""} — ${escapeHtml(fiche.classe_nom ?? "")} — Niveau ${fiche.niveau}</p>

        <h2>Informations générales</h2>
        <div class="grid">
          <div class="item"><span class="label">PV Max :</span> ${fiche.pv_max}</div>
          <div class="item"><span class="label">PS Max :</span> ${fiche.ps_max}</div>
          <div class="item"><span class="label">XP Total :</span> ${fiche.xp_total}</div>
          <div class="item"><span class="label">XP Dépensé :</span> ${fiche.xp_depense}</div>
          <div class="item"><span class="label">XP Disponible :</span> ${xpDisponible}</div>
          ${fiche.religion_nom ? `<div class="item"><span class="label">Religion :</span> ${escapeHtml(fiche.religion_nom)}</div>` : ""}
          <div class="item"><span class="label">GN complétés :</span> ${fiche.gn_completes}</div>
          <div class="item"><span class="label">Mini-GN :</span> ${fiche.mini_gn_completes}</div>
          <div class="item"><span class="label">Ouvertures terrain :</span> ${fiche.ouvertures_terrain}</div>
        </div>

        ${traits && traits.length > 0 ? `
        <h2>Traits raciaux</h2>
        ${traits.map((t) => `
          <div class="card">
            <div class="card-title">${escapeHtml(t.nom)}</div>
            ${t.description ? `<div class="desc">${escapeHtml(t.description)}</div>` : ""}
          </div>
        `).join("")}
        ` : ""}

        ${competencesGroupees.length > 0 ? `
        <h2>Compétences</h2>
        <table>
          <tr><th>Compétence</th><th>Catégorie</th><th>Détail</th><th>XP total</th><th>Statut</th></tr>
          ${competencesGroupees.map((c) => {
            let detail = "";
            if (c.type_achat === "simple") {
              detail = c.rows.map((r) => `Niv. ${r.niveau_acquis}`).join(", ");
            } else if (c.type_achat === "multiple_sans_choix") {
              detail = `× ${c.rows.length} achats`;
            } else if (c.type_achat === "multiple_choix_distinct") {
              detail = c.rows.map((r) => escapeHtml(resoudreChoixAffichage(r.choix_achat, langues, religions) ?? r.choix_achat ?? "?")).join(", ");
            } else {
              detail = c.rows.map((r) => {
                const choix = resoudreChoixAffichage(r.choix_achat, langues, religions);
                return `Niv. ${r.niveau_acquis}${choix ? ` (${escapeHtml(choix)})` : ""}`;
              }).join(", ");
            }
            return `
            <tr>
              <td>${escapeHtml(c.nom)}</td>
              <td>${escapeHtml(c.categorie)}</td>
              <td>${detail}</td>
              <td>${c.xp_total === 0 ? "Gratuit" : c.xp_total}</td>
              <td>${escapeHtml(c.statut_maitre !== "non_requis" ? STATUT_MAITRE_LABELS[c.statut_maitre] || c.statut_maitre : "—")}</td>
            </tr>
          `;
          }).join("")}
        </table>
        ` : ""}

        ${(sorts ?? []).length > 0 ? `
        <h2>Sorts arcaniques</h2>
        ${Object.entries(sortsByCercle).map(([cercle, sortsDuCercle]) => `
          <h3>${escapeHtml(cercle)}</h3>
          ${sortsDuCercle.map((s) => `
            <div class="card">
              <div class="card-row">
                <div class="card-title">${escapeHtml(s.nom_personnalise)}</div>
                <span class="badge">${calculerCoutPS(calculerCoutXP(s.zone_choisie ?? "", s.portee_choisie ?? "", s.duree_choisie ?? "", s.niveau_sort, Number(s.cout_xp_base)))} PS</span>
              </div>
              ${s.sort_nom_base && s.sort_nom_base !== s.nom_personnalise ? `<div class="muted">Basé sur : ${escapeHtml(s.sort_nom_base)}</div>` : ""}
              ${s.formule_magique ? `<div class="formula">Formule : ${escapeHtml(s.formule_magique)}</div>` : ""}
              <div class="muted">
                ${s.zone_choisie ? `Zone : ${escapeHtml(s.zone_choisie)}` : ""}
                ${s.portee_choisie ? ` &bull; Portée : ${escapeHtml(s.portee_choisie)}` : ""}
                ${s.duree_choisie ? ` &bull; Durée : ${escapeHtml(s.duree_choisie)}` : ""}
              </div>
              ${s.sort_description ? `<div class="desc">${escapeHtml(s.sort_description)}</div>` : ""}
            </div>
          `).join("")}
        `).join("")}
        ` : ""}

        ${(prieres ?? []).length > 0 ? `
        <h2>Prières divines</h2>
        ${Object.entries(prieresByDomaine).map(([domaine, prieresDuDomaine]) => `
          <h3>${escapeHtml(domaine)}</h3>
          ${prieresDuDomaine.map((p) => `
            <div class="card">
              <div class="card-row">
                <div class="card-title">${escapeHtml(p.nom_personnalise)}</div>
                ${p.cout_xp_base != null ? `<span class="badge">${calculerCoutPS(calculerCoutXP(p.zone_choisie ?? "", p.portee_choisie ?? "", p.duree_choisie ?? "", p.niveau_priere, Number(p.cout_xp_base)))} PS</span>` : ""}
              </div>
              <div class="muted">
                ${p.duree_incantation ? `Incantation : ${escapeHtml(p.duree_incantation)}` : ""}
                ${p.zone_choisie ? ` &bull; Zone : ${escapeHtml(p.zone_choisie)}` : ""}
                ${p.portee_choisie ? ` &bull; Portée : ${escapeHtml(p.portee_choisie)}` : ""}
                ${p.duree_choisie ? ` &bull; Durée : ${escapeHtml(p.duree_choisie)}` : ""}
              </div>
              ${p.priere_description ? `<div class="desc">${escapeHtml(p.priere_description)}</div>` : ""}
            </div>
          `).join("")}
        `).join("")}
        ` : ""}

        ${(assemblages ?? []).length > 0 ? `
        <h2>Assemblages de runes</h2>
        ${(assemblages ?? []).map((a) => `
          <div class="card">
            <div class="card-row">
              <div class="card-title">${escapeHtml(a.nom)}</div>
              ${a.cout_ps != null ? `<span class="badge">${a.cout_ps} PS</span>` : ""}
            </div>
            ${a.cible ? `<div class="muted">Cible : ${escapeHtml(a.cible)}</div>` : ""}
            ${a.runes_requises && a.runes_requises.length > 0 ? `<div class="muted">Runes : ${a.runes_requises.map(escapeHtml).join(", ")}</div>` : ""}
            ${a.description ? `<div class="desc">${escapeHtml(a.description)}</div>` : ""}
            ${a.effet ? `<div class="desc"><strong>Effet :</strong> ${escapeHtml(a.effet)}</div>` : ""}
          </div>
        `).join("")}
        ` : ""}

        ${niveauAlchimie >= 1 ? `
        <h2>Alchimie (Niv. ${niveauAlchimie})</h2>
        ${[1, 2, 3].filter((n) => n <= niveauAlchimie && recettesByNiveau[n]?.length > 0).map((n) => `
          <h3>${niveauLabels[n]}</h3>
          ${(recettesByNiveau[n] ?? []).map((r) => {
            const { composants, manipulations } = parseIngredientsRecette(r.ingredients);
            return `
            <div class="card">
              <div class="card-title">${escapeHtml(r.nom)}</div>
              ${r.effet ? `<div class="desc"><strong>Effet :</strong> ${escapeHtml(r.effet)}</div>` : ""}
              ${r.formule ? `<div class="desc"><strong>Formule :</strong> ${escapeHtml(r.formule)}</div>` : ""}
              ${composants.length > 0 ? `<div class="desc"><strong>Ingrédients :</strong> ${escapeHtml(composants.map(formaterComposant).join(" · "))}</div>` : ""}
              ${manipulations.length > 0 ? `<div class="desc"><strong>Préparation :</strong> ${escapeHtml(manipulations.map((e, i) => `${i + 1}. ${e}`).join("  "))}</div>` : ""}
              ${r.description ? `<div class="desc">${escapeHtml(r.description)}</div>` : ""}
            </div>
          `;
          }).join("")}
        `).join("")}
        ${(manipulations ?? []).filter((m) => (m.niveau ?? 0) <= niveauAlchimie).length > 0 ? `
          <h3>Manipulations alchimiques</h3>
          ${(manipulations ?? []).filter((m) => (m.niveau ?? 0) <= niveauAlchimie).map((m) => `
            <div class="card">
              <div class="card-title">${escapeHtml(m.nom ?? "")}</div>
              ${m.manipulations ? `<div class="desc">${escapeHtml(m.manipulations)}</div>` : ""}
            </div>
          `).join("")}
        ` : ""}
        ` : ""}

        ${niveauForge >= 1 ? `
        <h2>Forge (Niv. ${niveauForge})</h2>
        ${(objetsForge ?? []).length > 0 ? `
          <h3>Fabrication</h3>
          ${(objetsForge ?? []).map((o) => `
            <div class="card">
              <div class="card-title">${escapeHtml(o.nom ?? "")}</div>
              ${o.description ? `<div class="desc">${escapeHtml(o.description)}</div>` : ""}
              ${o.type ? `<div class="muted">Type : ${escapeHtml(o.type)}</div>` : ""}
              ${o.temps_fabrication_minutes != null ? `<div class="muted"><strong>Temps de fabrication :</strong> ${o.temps_fabrication_minutes} min</div>` : ""}
              ${o.materiaux_communs ? `<div class="muted"><strong>Matériaux communs :</strong> ${escapeHtml(o.materiaux_communs)}</div>` : ""}
              ${niveauForge >= 2 && o.materiaux_rares ? `<div class="muted"><strong>Matériaux rares :</strong> ${escapeHtml(o.materiaux_rares)}</div>` : ""}
              ${niveauForge >= 3 ? `<div class="muted"><em>Accès aux matériaux légendaires disponible.</em></div>` : ""}
            </div>
          `).join("")}
        ` : ""}
        ${(reparationsForge ?? []).length > 0 ? `
          <h3>Réparation</h3>
          ${(reparationsForge ?? []).map((rep) => `
            <div class="card">
              <div class="card-title">${escapeHtml(rep.nom_affichage)}</div>
              <div class="muted">Catégorie : ${escapeHtml(rep.categorie)}</div>
              <div class="muted"><strong>Temps commun :</strong> ${rep.temps_minutes} min</div>
              ${niveauForge >= 2 ? `<div class="muted"><strong>Temps rare :</strong> ${rep.temps_rare_minutes} min</div>` : ""}
              <div class="muted"><strong>Matériaux communs :</strong> ${escapeHtml(rep.materiaux)}</div>
              ${niveauForge >= 2 ? `<div class="muted"><strong>Matériaux rares :</strong> ${escapeHtml(rep.materiaux_rares)}</div>` : ""}
              ${rep.notes ? `<div class="muted" style="font-style: italic; margin-top: 4px;">${escapeHtml(rep.notes)}</div>` : ""}
            </div>
          `).join("")}
        ` : ""}
        ` : ""}

        ${niveauJoaillerie >= 1 ? `
        <h2>Joaillerie (Niv. ${niveauJoaillerie})</h2>
        ${(objetsJoaillerie ?? []).length > 0 ? `
          <h3>Fabrication</h3>
          ${(objetsJoaillerie ?? []).map((o) => `
            <div class="card">
              <div class="card-title">${escapeHtml(o.nom ?? "")}</div>
              ${o.description ? `<div class="desc">${escapeHtml(o.description)}</div>` : ""}
              ${o.effet ? `<div class="desc"><strong>Effet :</strong> ${escapeHtml(o.effet)}</div>` : ""}
              ${o.temps_fabrication_minutes != null ? `<div class="muted"><strong>Temps de fabrication :</strong> ${o.temps_fabrication_minutes} min${niveauJoaillerie >= 2 && o.temps_rare_minutes != null ? ` (commun) — ${o.temps_rare_minutes} min (rare)` : ""}</div>` : ""}
              ${o.materiaux_communs ? `<div class="muted"><strong>Matériaux communs :</strong> ${escapeHtml(o.materiaux_communs)}</div>` : ""}
              ${niveauJoaillerie >= 2 && o.materiaux_rares ? `<div class="muted"><strong>Matériaux rares :</strong> ${escapeHtml(o.materiaux_rares)}</div>` : ""}
              ${niveauJoaillerie >= 3 ? `<div class="muted"><em>Accès aux matériaux légendaires disponible.</em></div>` : ""}
            </div>
          `).join("")}
        ` : ""}
        ` : ""}

        ${famillesPiegesPrint.length > 0 ? `
        <h2>Pièges (Niv. ${niveauPieges})</h2>
        ${famillesPiegesPrint.map(([nom, niveaux]) => {
          const nMax = niveaux[niveaux.length - 1];
          const pal = piegeCatPrint.get(`${nom}__${nMax}`);
          return `
          <div class="card">
            <div class="card-row">
              <div class="card-title">${escapeHtml(nom)}</div>
              <span class="badge">Niv. ${niveaux.join(", ")}</span>
            </div>
            ${pal?.niveau_effet != null ? `<div class="muted">Effet de niveau ${pal.niveau_effet}</div>` : ""}
            ${pal?.cible ? `<div class="muted">Cible : ${escapeHtml(pal.cible)}</div>` : ""}
            ${pal?.duree ? `<div class="muted">Durée : ${escapeHtml(pal.duree)}</div>` : ""}
            ${pal?.effets ? `<div class="desc">${escapeHtml(pal.effets)}</div>` : ""}
            ${piegeCatPrint.get(`${nom}__1`)?.construction ? `<div class="muted"><strong>Construction :</strong> ${escapeHtml(piegeCatPrint.get(`${nom}__1`)!.construction!)}</div>` : ""}
          </div>`;
        }).join("")}
        ` : ""}

        ${fiche.historique || fiche.ame_personnage ? `
        <h2>Historique et âme</h2>
        ${fiche.historique ? `<h3>Historique</h3><p>${escapeHtml(fiche.historique).replace(/\n/g, "<br>")}</p>` : ""}
        ${fiche.ame_personnage ? `<h3>Âme</h3><p>${escapeHtml(fiche.ame_personnage).replace(/\n/g, "<br>")}</p>` : ""}
        ` : ""}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (ficheLoading) {
    return <p className="text-center py-12 text-muted-foreground">Chargement…</p>;
  }

  if (!fiche) {
    return <p className="text-center py-12 text-muted-foreground">Personnage non trouvé.</p>;
  }

  return (
    <div className={mode === 'route' ? 'container max-w-6xl py-8 space-y-6' : 'space-y-6'}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-4xl font-bold text-primary">{fiche.nom}</h1>
          <p className="text-muted-foreground mt-1">
            {fiche.race_nom} {fiche.race_nom_latin && <span className="italic">({fiche.race_nom_latin})</span>} • {fiche.classe_nom} • Niveau {fiche.niveau}
          </p>
        </div>
        {mode === 'route' && (
          <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
        )}
      </div>

      <Tabs defaultValue="infos" className="w-full">
        <div className="overflow-x-auto -mx-2 px-2">
          <TabsList className="inline-flex w-max">
            <TabsTrigger value="infos">Infos</TabsTrigger>
            {hasTraits && <TabsTrigger value="traits">Traits</TabsTrigger>}
            <TabsTrigger value="competences">Compétences</TabsTrigger>
            {hasSorts && <TabsTrigger value="sorts">Sorts</TabsTrigger>}
            {hasPrieres && <TabsTrigger value="prieres">Prières</TabsTrigger>}
            {hasAssemblages && <TabsTrigger value="assemblages">Assemblages</TabsTrigger>}
            {hasArtisanat && <TabsTrigger value="artisanat">Artisanat</TabsTrigger>}
            {mode === 'route' && <TabsTrigger value="export">Export</TabsTrigger>}
          </TabsList>
        </div>

        {/* Infos générales */}
        <TabsContent value="infos" className="space-y-4 mt-6">
          <InfosCard fiche={fiche} xpDisponible={xpDisponible} />
          {editingHistorique && isOwner && mode === 'route' ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Modifier historique et âme</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Historique</label>
                  <Textarea
                    value={historiqueTmp}
                    onChange={(e) => setHistoriqueTmp(e.target.value)}
                    className="min-h-[150px]"
                    placeholder="Historique du personnage…"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Âme</label>
                  <Textarea
                    value={ameTmp}
                    onChange={(e) => setAmeTmp(e.target.value)}
                    className="min-h-[150px]"
                    placeholder="Âme du personnage…"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setEditingHistorique(false)}
                    disabled={saving}
                  >
                    <X className="h-4 w-4 mr-1" /> Annuler
                  </Button>
                  <Button
                    onClick={handleSaveHistorique}
                    disabled={saving}
                  >
                    <Check className="h-4 w-4 mr-1" /> {saving ? "Sauvegarde…" : "Sauvegarder"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <HistoriqueAmeCard
              historique={fiche.historique}
              ame_personnage={fiche.ame_personnage}
              canEdit={isOwner && mode === 'route'}
              isOwner={isOwner}
              onEdit={handleEditHistorique}
            />
          )}
        </TabsContent>

        {/* Traits raciaux */}
        <TabsContent value="traits" className="space-y-4 mt-6">
          <TraitsSection traits={traits} />
        </TabsContent>

        {/* Compétences */}
        <TabsContent value="competences" className="space-y-4 mt-6">
          <CompetencesSection
            competencesGroupees={competencesGroupees}
            langues={langues}
            religions={religions}
          />
        </TabsContent>

        {/* Sorts */}
        <TabsContent value="sorts" className="space-y-4 mt-6">
          <SortsSection sorts={sorts ?? []} />
        </TabsContent>

        {/* Prières */}
        <TabsContent value="prieres" className="space-y-4 mt-6">
          <PrieresSection prieres={prieres ?? []} />
        </TabsContent>

        {/* Assemblages de runes */}
        <TabsContent value="assemblages" className="space-y-4 mt-6">
          <AssemblagesSection assemblages={assemblages} />
        </TabsContent>

        {/* Artisanat */}
        <TabsContent value="artisanat" className="space-y-4 mt-6">
          <Tabs defaultValue={artisanatDefaultTab} className="w-full">
            <TabsList className={`grid w-full ${artisanatColsClass}`}>
              {artisanatSubTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.value} value={tab.value} className="gap-1">
                    <Icon className="h-3 w-3" /> {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Sous-onglet Alchimie */}
            <TabsContent value="alchimie" className="space-y-3 mt-4">
              <AlchimieSection
                artisanatEtat={artisanatEtat}
                recettes={recettes}
                manipulations={manipulations}
              />
            </TabsContent>

            {/* Sous-onglet Forge */}
            <TabsContent value="forge" className="space-y-6 mt-4">
              <ForgeSection
                artisanatEtat={artisanatEtat}
                objetsForge={objetsForge}
                reparationsForge={reparationsForge}
              />
            </TabsContent>

            {/* Sous-onglet Joaillerie */}
            <TabsContent value="joaillerie" className="space-y-3 mt-4">
              <JoaillerieSection
                artisanatEtat={artisanatEtat}
                objetsJoaillerie={objetsJoaillerie}
              />
            </TabsContent>

            {/* Sous-onglet Pièges (PR-4, lecture seule) */}
            <TabsContent value="pieges" className="space-y-3 mt-4">
              <PiegesSection
                piegesCatalogue={piegesCatalogue}
                personnagePieges={personnagePieges}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Export */}
        {mode === 'route' && (
          <TabsContent value="export" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Options d'export</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={handlePrint} className="w-full gap-2">
                  <Printer className="h-4 w-4" />
                  Imprimer / Exporter en PDF
                </Button>
                <p className="text-xs text-muted-foreground">
                  Cliquez sur le bouton ci-dessus pour imprimer la fiche complète du personnage au format PDF.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default FichePersonnageView;

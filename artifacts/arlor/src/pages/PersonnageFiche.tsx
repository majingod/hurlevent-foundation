import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Printer, Edit2, X, Check } from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { calculerCoutPS, calculerCoutXP } from "@/utils/calculsMagie";
import { STATUT_MAITRE_LABELS } from "@/constants/labels";
import type { Database, Json } from "@/integrations/supabase/types";

type LangueRow = Database["public"]["Tables"]["langues"]["Row"];
type ReligionRow = Database["public"]["Tables"]["religions"]["Row"];

// ── Interfaces alignées sur les vues SQL ──────────────────────

interface FichePersonnage {
  id: string;
  nom: string;
  niveau: number;
  xp_total: number;
  xp_depense: number;
  pv_max: number;
  ps_max: number;
  historique: string | null;
  ame_personnage: string | null;
  joueur_id: string;
  race_id: string;
  classe_id: string;
  religion_id: string | null;
  gn_completes: number;
  mini_gn_completes: number;
  ouvertures_terrain: number;
  traits_raciaux_choisis: Json | null;
  race_nom: string | null;
  race_nom_latin: string | null;
  classe_nom: string | null;
  religion_nom: string | null;
}

interface Trait {
  id: string;
  nom: string;
  description: string | null;
}

interface Competence {
  id: string;
  personnage_id: string;
  nom: string;
  niveau_acquis: number;
  xp_depense: number;
  choix_achat: string | null;
  appris_via_maitre: boolean;
  nom_maitre: string | null;
  statut_maitre: string;
  categorie: string;
}

interface Sort {
  id: string;
  personnage_id: string;
  nom_personnalise: string;
  formule_magique: string | null;
  niveau_sort: number;
  zone_choisie: string | null;
  portee_choisie: string | null;
  duree_choisie: string | null;
  cercle: string;
  cout_xp_base: number;
  sort_nom_base: string | null;
  sort_description: string | null;
}

interface Priere {
  id: string;
  personnage_id: string;
  nom_personnalise: string;
  niveau_priere: number;
  zone_choisie: string | null;
  portee_choisie: string | null;
  duree_choisie: string | null;
  domaine: string;
  priere_description: string | null;
  duree_incantation: string | null;
  cout_xp_base: number | null;
}

interface Assemblage {
  id: string;
  personnage_id: string;
  nom: string;
  cible: string | null;
  cout_ps: number | null;
  description: string | null;
  effet: string | null;
  runes_requises: string[] | null;
}

interface Recette {
  id: string;
  personnage_id: string;
  nom: string;
  type: string;
  niveau_requis: number;
  description: string | null;
  effet: string | null;
}

interface ArtisanatEtat {
  niveau_alchimie: number | null;
  niveau_forge: number | null;
  niveau_joaillerie: number | null;
}

interface ManipulationAlchimique {
  id: string;
  nom: string | null;
  niveau: number | null;
  manipulations: string | null;
}

interface ObjetForge {
  id: string;
  nom: string | null;
  description: string | null;
  type: string | null;
  difficulte: number | null;
  materiaux_communs: string | null;
  materiaux_rares: string | null;
}

interface ReparationForge {
  id: string;
  nom_affichage: string;
  categorie: string;
  materiaux: string;
  materiaux_rares: string;
  temps_minutes: number;
}

interface ObjetJoaillerie {
  id: string;
  nom: string | null;
  description: string | null;
  effet: string | null;
  difficulte: number | null;
  materiaux_communs: string | null;
  materiaux_rares: string | null;
}

const resoudreChoixAffichage = (
  choixAchat: string | null,
  langues: { id: string; nom: string | null }[] | undefined,
  religions: { id: string; nom: string | null }[] | undefined,
): string | null => {
  if (!choixAchat) return null;
  const enLangue = langues?.find((l) => l.id === choixAchat);
  if (enLangue?.nom) return enLangue.nom;
  const enReligion = religions?.find((r) => r.id === choixAchat);
  if (enReligion?.nom) return enReligion.nom;
  return choixAchat;
};

const PersonnageFiche = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [editingHistorique, setEditingHistorique] = useState(false);
  const [historiqueTmp, setHistoriqueTmp] = useState("");
  const [ameTmp, setAmeTmp] = useState("");
  const [saving, setSaving] = useState(false);

  // DATA-FIRST : vue_fiche_personnage joint personnages + races + classes + religions
  // Remplace 3 requêtes en cascade (personnage → race → classe → religion)
  const { data: fiche, isLoading: ficheLoading } = useQuery({
    queryKey: ["fiche-personnage", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_fiche_personnage")
        .select("*")
        .eq("id", id!)
        .single();
      return data as FichePersonnage;
    },
    enabled: !!id,
  });

  // Toutes les requêtes suivantes dépendent uniquement de l'id URL (connu immédiatement),
  // elles démarrent toutes en parallèle sans attendre la fiche.

  // DATA-FIRST : vue_competences_personnage — plus de jointure ni de .map() frontend
  const { data: competences } = useQuery({
    queryKey: ["competences-personnage", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_competences_personnage")
        .select("*")
        .eq("personnage_id", id!)
        .order("categorie")
        .order("nom");
      return (data ?? []) as Competence[];
    },
    enabled: !!id,
  });

  // DATA-FIRST : vue_sorts_personnage — plus de jointure ni de .map() frontend
  const { data: sorts } = useQuery({
    queryKey: ["sorts-personnage", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_sorts_personnage")
        .select("*")
        .eq("personnage_id", id!)
        .order("cercle")
        .order("nom_personnalise");
      return (data ?? []) as Sort[];
    },
    enabled: !!id,
  });

  // DATA-FIRST : vue_prieres_personnage — plus de jointure ni de .map() frontend
  const { data: prieres } = useQuery({
    queryKey: ["prieres-personnage", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_prieres_personnage")
        .select("*")
        .eq("personnage_id", id!)
        .order("domaine")
        .order("nom_personnalise");
      return (data ?? []) as Priere[];
    },
    enabled: !!id,
  });

  // DATA-FIRST : vue_assemblages_personnage — plus de jointure ni de .map() frontend
  const { data: assemblages } = useQuery({
    queryKey: ["assemblages-personnage", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_assemblages_personnage")
        .select("*")
        .eq("personnage_id", id!)
        .order("nom");
      return (data ?? []) as Assemblage[];
    },
    enabled: !!id,
  });

  // DATA-FIRST : vue_recettes_personnage — plus de jointure ni de .map() frontend
  const { data: recettes } = useQuery({
    queryKey: ["recettes-personnage", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_recettes_personnage")
        .select("*")
        .eq("personnage_id", id!)
        .order("type")
        .order("niveau_requis")
        .order("nom");
      return (data ?? []) as Recette[];
    },
    enabled: !!id,
  });

  const { data: artisanatEtat } = useQuery({
    queryKey: ["artisanat-etat", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_artisanat_etat")
        .select("niveau_alchimie, niveau_forge, niveau_joaillerie")
        .eq("personnage_id", id!)
        .maybeSingle();
      return (data as ArtisanatEtat) ?? null;
    },
    enabled: !!id,
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
        .select("id, nom, description, type, difficulte, materiaux_communs, materiaux_rares")
        .eq("est_actif", true)
        .order("difficulte")
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
        .select("id, nom_affichage, categorie, materiaux, materiaux_rares, temps_minutes")
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
        .select("id, nom, description, effet, difficulte, materiaux_communs, materiaux_rares")
        .eq("est_actif", true)
        .order("difficulte")
        .order("nom");
      return (data ?? []) as ObjetJoaillerie[];
    },
    enabled: !!(artisanatEtat?.niveau_joaillerie && artisanatEtat.niveau_joaillerie >= 1),
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
    const map = new Map<string, {
      nom: string;
      categorie: string;
      choix_achat: string | null;
      count: number;
      niveau_max: number;
      xp_total: number;
      statut_maitre: string;
      appris_via_maitre: boolean;
      nom_maitre: string | null;
    }>();

    (competences ?? []).forEach((c) => {
      const cle = `${c.nom}__${c.choix_achat ?? "none"}__${c.categorie}`;
      const existing = map.get(cle);
      if (existing) {
        existing.count += 1;
        existing.niveau_max = Math.max(existing.niveau_max, c.niveau_acquis);
        existing.xp_total += c.xp_depense;
      } else {
        map.set(cle, {
          nom: c.nom,
          categorie: c.categorie,
          choix_achat: c.choix_achat,
          count: 1,
          niveau_max: c.niveau_acquis,
          xp_total: c.xp_depense,
          statut_maitre: c.statut_maitre,
          appris_via_maitre: c.appris_via_maitre,
          nom_maitre: c.nom_maitre,
        });
      }
    });

    return Array.from(map.values());
  }, [competences]);

  const isOwner = user?.id === fiche?.joueur_id;
  const xpDisponible = (fiche?.xp_total ?? 0) - (fiche?.xp_depense ?? 0);

  const traits = Array.isArray(fiche?.traits_raciaux_choisis)
    ? (fiche.traits_raciaux_choisis as unknown as Trait[])
    : [];

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
          <tr><th>Compétence</th><th>Catégorie</th><th>Niveau</th><th>XP</th><th>Statut</th></tr>
          ${competencesGroupees.map((c) => `
            <tr>
              <td>${escapeHtml(c.nom)}${c.choix_achat ? ` (${escapeHtml(resoudreChoixAffichage(c.choix_achat, langues, religions) ?? c.choix_achat)})` : ""}${c.count > 1 && !c.choix_achat ? ` × ${c.count}` : ""}</td>
              <td>${escapeHtml(c.categorie)}</td>
              <td>${c.niveau_max}</td>
              <td>${c.xp_total === 0 ? "Gratuit" : c.xp_total}</td>
              <td>${escapeHtml(c.statut_maitre !== "non_requis" ? STATUT_MAITRE_LABELS[c.statut_maitre] || c.statut_maitre : "—")}</td>
            </tr>
          `).join("")}
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
          ${(recettesByNiveau[n] ?? []).map((r) => `
            <div class="card">
              <div class="card-title">${escapeHtml(r.nom)}</div>
              ${r.effet ? `<div class="desc"><strong>Effet :</strong> ${escapeHtml(r.effet)}</div>` : ""}
              ${r.description ? `<div class="desc">${escapeHtml(r.description)}</div>` : ""}
            </div>
          `).join("")}
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
        ${(objetsForge ?? []).filter((o) => (o.difficulte ?? 0) <= niveauForge).length > 0 ? `
          <h3>Fabrication</h3>
          ${(objetsForge ?? []).filter((o) => (o.difficulte ?? 0) <= niveauForge).map((o) => `
            <div class="card">
              <div class="card-title">${escapeHtml(o.nom ?? "")}</div>
              ${o.description ? `<div class="desc">${escapeHtml(o.description)}</div>` : ""}
              ${o.type ? `<div class="muted">Type : ${escapeHtml(o.type)}</div>` : ""}
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
              <div class="muted"><strong>Matériaux communs :</strong> ${escapeHtml(rep.materiaux)}</div>
              ${niveauForge >= 2 ? `<div class="muted"><strong>Matériaux rares :</strong> ${escapeHtml(rep.materiaux_rares)}</div>` : ""}
            </div>
          `).join("")}
        ` : ""}
        ` : ""}

        ${niveauJoaillerie >= 1 ? `
        <h2>Joaillerie (Niv. ${niveauJoaillerie})</h2>
        ${(objetsJoaillerie ?? []).filter((o) => (o.difficulte ?? 0) <= niveauJoaillerie).length > 0 ? `
          <h3>Fabrication</h3>
          ${(objetsJoaillerie ?? []).filter((o) => (o.difficulte ?? 0) <= niveauJoaillerie).map((o) => `
            <div class="card">
              <div class="card-title">${escapeHtml(o.nom ?? "")}</div>
              ${o.description ? `<div class="desc">${escapeHtml(o.description)}</div>` : ""}
              ${o.effet ? `<div class="desc"><strong>Effet :</strong> ${escapeHtml(o.effet)}</div>` : ""}
              ${o.materiaux_communs ? `<div class="muted"><strong>Matériaux communs :</strong> ${escapeHtml(o.materiaux_communs)}</div>` : ""}
              ${niveauJoaillerie >= 2 && o.materiaux_rares ? `<div class="muted"><strong>Matériaux rares :</strong> ${escapeHtml(o.materiaux_rares)}</div>` : ""}
              ${niveauJoaillerie >= 3 ? `<div class="muted"><em>Accès aux matériaux légendaires disponible.</em></div>` : ""}
            </div>
          `).join("")}
        ` : ""}
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
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-4xl font-bold text-primary">{fiche.nom}</h1>
          <p className="text-muted-foreground mt-1">
            {fiche.race_nom} {fiche.race_nom_latin && <span className="italic">({fiche.race_nom_latin})</span>} • {fiche.classe_nom} • Niveau {fiche.niveau}
          </p>
        </div>
        <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
          <Printer className="h-4 w-4" />
          Imprimer
        </Button>
      </div>

      <Tabs defaultValue="infos" className="w-full">
        <div className="overflow-x-auto -mx-2 px-2">
          <TabsList className="inline-flex w-max">
            <TabsTrigger value="infos">Infos</TabsTrigger>
            <TabsTrigger value="traits">Traits</TabsTrigger>
            <TabsTrigger value="competences">Compétences</TabsTrigger>
            <TabsTrigger value="sorts">Sorts</TabsTrigger>
            <TabsTrigger value="prieres">Prières</TabsTrigger>
            <TabsTrigger value="artisanat">Artisanat</TabsTrigger>
            <TabsTrigger value="historique">Historique</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>
        </div>

        {/* Infos générales */}
        <TabsContent value="infos" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Race</p>
                <p className="font-medium text-foreground">{fiche.race_nom}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Classe</p>
                <p className="font-medium text-foreground">{fiche.classe_nom}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Niveau</p>
                <p className="font-medium text-foreground">{fiche.niveau}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">XP Total</p>
                <p className="font-medium text-foreground">{fiche.xp_total}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">XP Dépensé</p>
                <p className="font-medium text-foreground">{fiche.xp_depense}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">XP Disponible</p>
                <p className="font-medium text-primary">{xpDisponible}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">PV Max</p>
                <p className="font-medium text-foreground">{fiche.pv_max}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">PS Max</p>
                <p className="font-medium text-foreground">{fiche.ps_max}</p>
              </div>
              {fiche.religion_nom && (
                <div>
                  <p className="text-xs text-muted-foreground">Religion</p>
                  <p className="font-medium text-foreground">{fiche.religion_nom}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">GN Complétés</p>
                <p className="font-medium text-foreground">{fiche.gn_completes}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Traits raciaux */}
        <TabsContent value="traits" className="space-y-4 mt-6">
          {traits && traits.length > 0 ? (
            <div className="space-y-3">
              {traits.map((trait) => (
                <Card key={trait.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{trait.nom}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{trait.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">Aucun trait racial.</p>
          )}
        </TabsContent>

        {/* Compétences */}
        <TabsContent value="competences" className="space-y-4 mt-6">
          {competencesGroupees.length > 0 ? (
            <div className="space-y-3">
              {competencesGroupees.map((comp, i) => {
                const choixResolu = resoudreChoixAffichage(comp.choix_achat, langues, religions);
                const afficherMultiplicateur = comp.count > 1 && !comp.choix_achat;
                return (
                  <Card key={`${comp.nom}-${comp.choix_achat ?? ""}-${i}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {comp.nom}
                            {choixResolu && <span className="text-muted-foreground ml-1">({choixResolu})</span>}
                            {afficherMultiplicateur && <span className="text-muted-foreground ml-1">× {comp.count}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{comp.categorie}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {comp.niveau_max > 1 && (
                            <Badge variant="secondary" className="text-xs">Niv. {comp.niveau_max}</Badge>
                          )}
                          {comp.xp_total === 0 ? (
                            <Badge variant="outline" className="text-xs">Gratuit</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">{comp.xp_total} XP</Badge>
                          )}
                          {comp.statut_maitre !== "non_requis" && (
                            <Badge className="text-xs">{STATUT_MAITRE_LABELS[comp.statut_maitre] || comp.statut_maitre}</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">Aucune compétence acquise.</p>
          )}
        </TabsContent>

        {/* Sorts */}
        <TabsContent value="sorts" className="space-y-4 mt-6">
          {sorts && sorts.length > 0 ? (
            <div className="space-y-3">
              {sorts.map((sort) => (
                <Card key={sort.id}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{sort.nom_personnalise}</p>
                        <p className="text-xs text-muted-foreground">{sort.cercle} • Niveau {sort.niveau_sort}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {calculerCoutPS(calculerCoutXP(
                          sort.zone_choisie ?? "",
                          sort.portee_choisie ?? "",
                          sort.duree_choisie ?? "",
                          sort.niveau_sort,
                          Number(sort.cout_xp_base),
                        ))} PS
                      </Badge>
                    </div>

                    {sort.sort_nom_base && sort.sort_nom_base !== sort.nom_personnalise && (
                      <p className="text-xs italic text-muted-foreground">Basé sur : {sort.sort_nom_base}</p>
                    )}

                    {sort.formule_magique && (
                      <div className="inline-block rounded bg-muted px-2 py-1 font-mono text-xs">
                        Formule : {sort.formule_magique}
                      </div>
                    )}

                    {(sort.zone_choisie || sort.portee_choisie || sort.duree_choisie) && (
                      <p className="text-xs text-muted-foreground">
                        {[
                          sort.zone_choisie && `Zone : ${sort.zone_choisie}`,
                          sort.portee_choisie && `Portée : ${sort.portee_choisie}`,
                          sort.duree_choisie && `Durée : ${sort.duree_choisie}`,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    )}

                    {sort.sort_description && (
                      <p className="border-t border-border/50 pt-2 text-sm text-foreground/90">
                        {sort.sort_description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">Aucun sort arcanique.</p>
          )}
        </TabsContent>

        {/* Prières */}
        <TabsContent value="prieres" className="space-y-4 mt-6">
          {prieres && prieres.length > 0 ? (
            <div className="space-y-3">
              {prieres.map((priere) => (
                <Card key={priere.id}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{priere.nom_personnalise}</p>
                        <p className="text-xs text-muted-foreground">{priere.domaine} • Niveau {priere.niveau_priere}</p>
                      </div>
                      {priere.cout_xp_base != null && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {calculerCoutPS(calculerCoutXP(priere.zone_choisie ?? "", priere.portee_choisie ?? "", priere.duree_choisie ?? "", priere.niveau_priere, Number(priere.cout_xp_base)))} PS
                        </Badge>
                      )}
                    </div>

                    {(priere.duree_incantation ||
                      priere.zone_choisie ||
                      priere.portee_choisie ||
                      priere.duree_choisie) && (
                      <p className="text-xs text-muted-foreground">
                        {[
                          priere.duree_incantation && `Incantation : ${priere.duree_incantation}`,
                          priere.zone_choisie && `Zone : ${priere.zone_choisie}`,
                          priere.portee_choisie && `Portée : ${priere.portee_choisie}`,
                          priere.duree_choisie && `Durée : ${priere.duree_choisie}`,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    )}

                    {priere.priere_description && (
                      <p className="border-t border-border/50 pt-2 text-sm text-foreground/90">
                        {priere.priere_description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">Aucune prière.</p>
          )}
        </TabsContent>

        {/* Artisanat */}
        <TabsContent value="artisanat" className="space-y-4 mt-6">
          {assemblages && assemblages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assemblages de runes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {assemblages.map((asm) => (
                  <div key={asm.id} className="space-y-1 rounded border border-border/50 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground">{asm.nom}</p>
                      {asm.cout_ps != null && (
                        <Badge variant="secondary" className="text-xs shrink-0">{asm.cout_ps} PS</Badge>
                      )}
                    </div>
                    {asm.cible && (
                      <p className="text-xs text-muted-foreground">Cible : {asm.cible}</p>
                    )}
                    {asm.runes_requises && asm.runes_requises.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Runes : {asm.runes_requises.join(", ")}
                      </p>
                    )}
                    {asm.description && (
                      <p className="border-t border-border/50 pt-2 text-foreground/90">{asm.description}</p>
                    )}
                    {asm.effet && (
                      <p className="text-foreground/90">
                        <strong>Effet :</strong> {asm.effet}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {recettes && recettes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recettes alchimiques</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {recettes.map((recette) => (
                  <div key={recette.id} className="space-y-1 rounded border border-border/50 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{recette.nom}</p>
                        <p className="text-xs text-muted-foreground">{recette.type}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        Niv. {recette.niveau_requis}
                      </Badge>
                    </div>
                    {recette.description && (
                      <p className="border-t border-border/50 pt-2 text-foreground/90">{recette.description}</p>
                    )}
                    {recette.effet && (
                      <p className="text-foreground/90">
                        <strong>Effet :</strong> {recette.effet}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {(!assemblages || assemblages.length === 0) && (!recettes || recettes.length === 0) && (
            <p className="text-center py-8 text-muted-foreground">Aucun artisanat acquis.</p>
          )}
        </TabsContent>

        {/* Historique et Âme */}
        <TabsContent value="historique" className="space-y-4 mt-6">
          {editingHistorique && isOwner ? (
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
            <>
              {fiche.historique && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Historique</CardTitle>
                    {isOwner && (
                      <Button size="sm" variant="outline" onClick={handleEditHistorique}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground whitespace-pre-line">{fiche.historique}</p>
                  </CardContent>
                </Card>
              )}

              {fiche.ame_personnage && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Âme</CardTitle>
                    {isOwner && !fiche.historique && (
                      <Button size="sm" variant="outline" onClick={handleEditHistorique}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground whitespace-pre-line">{fiche.ame_personnage}</p>
                  </CardContent>
                </Card>
              )}

              {!fiche.historique && !fiche.ame_personnage && (
                <p className="text-center py-8 text-muted-foreground">
                  {isOwner ? "Aucun historique ou âme renseigné. " : "Aucun historique ou âme renseigné."}
                  {isOwner && (
                    <Button size="sm" variant="link" onClick={handleEditHistorique}>
                      Ajouter
                    </Button>
                  )}
                </p>
              )}
            </>
          )}
        </TabsContent>

        {/* Export */}
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
      </Tabs>
    </div>
  );
};

export default PersonnageFiche;

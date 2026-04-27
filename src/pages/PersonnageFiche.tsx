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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { calculerCoutPS } from "@/utils/calculsMagie";
import { STATUT_MAITRE_LABELS } from "@/constants/labels";
import type { Json } from "@/integrations/supabase/types";

interface Personnage {
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
}

interface Race {
  id: string;
  nom: string;
  nom_latin: string | null;
}

interface Classe {
  id: string;
  nom: string;
}

interface Religion {
  id: string;
  nom: string;
}

interface Trait {
  id: string;
  nom: string;
  description: string | null;
}

interface Competence {
  id: string;
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
  nom: string;
  cible: string | null;
  cout_ps: number | null;
  description: string | null;
  effet: string | null;
  runes_requises: string[] | null;
}

interface Recette {
  id: string;
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

const PersonnageFiche = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [editingHistorique, setEditingHistorique] = useState(false);
  const [historiqueTmp, setHistoriqueTmp] = useState("");
  const [ameTmp, setAmeTmp] = useState("");
  const [saving, setSaving] = useState(false);

  // Personnage
  const { data: personnage, isLoading: personnageLoading } = useQuery({
    queryKey: ["personnage", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("personnages")
        .select("*")
        .eq("id", id!)
        .single();
      return data as Personnage;
    },
    enabled: !!id,
  });

  // Race
  const { data: race } = useQuery({
    queryKey: ["race", personnage?.race_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("races")
        .select("*")
        .eq("id", personnage!.race_id)
        .single();
      return data as Race;
    },
    enabled: !!personnage?.race_id,
  });

  // Classe
  const { data: classe } = useQuery({
    queryKey: ["classe", personnage?.classe_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("classes")
        .select("*")
        .eq("id", personnage!.classe_id)
        .single();
      return data as Classe;
    },
    enabled: !!personnage?.classe_id,
  });

  // Religion
  const { data: religion } = useQuery({
    queryKey: ["religion", personnage?.religion_id],
    queryFn: async () => {
      if (!personnage?.religion_id) return null;
      const { data } = await supabase
        .from("religions")
        .select("*")
        .eq("id", personnage.religion_id)
        .single();
      return data as Religion;
    },
    enabled: !!personnage?.religion_id,
  });

  const traits = Array.isArray(personnage?.traits_raciaux_choisis)
    ? (personnage.traits_raciaux_choisis as unknown as Trait[])
    : [];

  // Compétences
  const { data: competences } = useQuery({
    queryKey: ["competences-personnage", personnage?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("personnage_competences")
        .select(
          `
          id, niveau_acquis, xp_depense, choix_achat, appris_via_maitre, nom_maitre, statut_maitre,
          competences!inner(nom, categorie)
        `
        )
        .eq("personnage_id", personnage!.id)
        .order("competences.categorie")
        .order("competences.nom");
      return (data ?? []).map((c: any) => ({
        id: c.id,
        nom: c.competences.nom,
        niveau_acquis: c.niveau_acquis,
        xp_depense: c.xp_depense,
        choix_achat: c.choix_achat,
        appris_via_maitre: c.appris_via_maitre,
        nom_maitre: c.nom_maitre,
        statut_maitre: c.statut_maitre,
        categorie: c.competences.categorie,
      })) as Competence[];
    },
    enabled: !!personnage?.id,
  });

  // Sorts
  const { data: sorts } = useQuery({
    queryKey: ["sorts-personnage", personnage?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("personnage_sorts")
        .select(
          `
          id, nom_personnalise, formule_magique, niveau_sort, zone_choisie, portee_choisie, duree_choisie,
          sorts!inner(cercle, cout_xp_base, nom, description)
        `
        )
        .eq("personnage_id", personnage!.id)
        .order("sorts.cercle")
        .order("nom_personnalise");
      return (data ?? []).map((s: any) => ({
        id: s.id,
        nom_personnalise: s.nom_personnalise,
        formule_magique: s.formule_magique,
        niveau_sort: s.niveau_sort,
        zone_choisie: s.zone_choisie,
        portee_choisie: s.portee_choisie,
        duree_choisie: s.duree_choisie,
        cercle: s.sorts.cercle,
        cout_xp_base: s.sorts.cout_xp_base,
        sort_nom_base: s.sorts.nom,
        sort_description: s.sorts.description,
      })) as Sort[];
    },
    enabled: !!personnage?.id,
  });

  // Prières
  const { data: prieres } = useQuery({
    queryKey: ["prieres-personnage", personnage?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("personnage_prieres")
        .select(
          `
          id, nom_personnalise, niveau_priere, zone_choisie, portee_choisie, duree_choisie,
          prieres!inner(domaine, description, duree_incantation, cout_xp_base)
        `
        )
        .eq("personnage_id", personnage!.id)
        .order("prieres.domaine")
        .order("nom_personnalise");
      return (data ?? []).map((p: any) => ({
        id: p.id,
        nom_personnalise: p.nom_personnalise,
        niveau_priere: p.niveau_priere,
        zone_choisie: p.zone_choisie,
        portee_choisie: p.portee_choisie,
        duree_choisie: p.duree_choisie,
        domaine: p.prieres.domaine,
        priere_description: p.prieres.description,
        duree_incantation: p.prieres.duree_incantation,
        cout_xp_base: p.prieres.cout_xp_base,
      })) as Priere[];
    },
    enabled: !!personnage?.id,
  });

  // Assemblages
  const { data: assemblages } = useQuery({
    queryKey: ["assemblages-personnage", personnage?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("personnage_assemblages")
        .select(
          `
          id,
          assemblages_runes!inner(nom, cible, cout_ps, description, effet, runes_requises)
        `
        )
        .eq("personnage_id", personnage!.id)
        .order("assemblages_runes.nom");
      return (data ?? []).map((a: any) => ({
        id: a.id,
        nom: a.assemblages_runes.nom,
        cible: a.assemblages_runes.cible,
        cout_ps: a.assemblages_runes.cout_ps,
        description: a.assemblages_runes.description,
        effet: a.assemblages_runes.effet,
        runes_requises: a.assemblages_runes.runes_requises,
      })) as Assemblage[];
    },
    enabled: !!personnage?.id,
  });

  // Recettes
  const { data: recettes } = useQuery({
    queryKey: ["recettes-personnage", personnage?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("personnage_recettes")
        .select(
          `
          id,
          recettes_alchimie!inner(nom, type, niveau_requis, description, effet)
        `
        )
        .eq("personnage_id", personnage!.id)
        .order("recettes_alchimie.type")
        .order("recettes_alchimie.niveau_requis")
        .order("recettes_alchimie.nom");
      return (data ?? []).map((r: any) => ({
        id: r.id,
        nom: r.recettes_alchimie.nom,
        type: r.recettes_alchimie.type,
        niveau_requis: r.recettes_alchimie.niveau_requis,
        description: r.recettes_alchimie.description,
        effet: r.recettes_alchimie.effet,
      })) as Recette[];
    },
    enabled: !!personnage?.id,
  });

  // Artisanat
  const { data: artisanatEtat } = useQuery({
    queryKey: ["artisanat-etat", personnage?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_artisanat_etat")
        .select("niveau_alchimie, niveau_forge, niveau_joaillerie")
        .eq("personnage_id", personnage!.id)
        .maybeSingle();
      return (data as ArtisanatEtat) ?? null;
    },
    enabled: !!personnage?.id,
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

  const isOwner = user?.id === personnage?.joueur_id;
  const xpDisponible = (personnage?.xp_total ?? 0) - (personnage?.xp_depense ?? 0);

  const handleEditHistorique = () => {
    setHistoriqueTmp(personnage?.historique ?? "");
    setAmeTmp(personnage?.ame_personnage ?? "");
    setEditingHistorique(true);
  };

  const handleSaveHistorique = async () => {
    if (!personnage) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("personnages")
        .update({
          historique: historiqueTmp.trim(),
          ame_personnage: ameTmp.trim(),
        })
        .eq("id", personnage.id);

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
    if (!personnage) return;
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
        <title>Fiche de ${escapeHtml(personnage.nom)}</title>
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
        <h1>Fiche de ${escapeHtml(personnage.nom)}</h1>
        <p class="muted">${escapeHtml(race?.nom ?? "")}${race?.nom_latin ? ` (${escapeHtml(race.nom_latin)})` : ""} — ${escapeHtml(classe?.nom ?? "")} — Niveau ${personnage.niveau}</p>

        <h2>Informations générales</h2>
        <div class="grid">
          <div class="item"><span class="label">PV Max :</span> ${personnage.pv_max}</div>
          <div class="item"><span class="label">PS Max :</span> ${personnage.ps_max}</div>
          <div class="item"><span class="label">XP Total :</span> ${personnage.xp_total}</div>
          <div class="item"><span class="label">XP Dépensé :</span> ${personnage.xp_depense}</div>
          <div class="item"><span class="label">XP Disponible :</span> ${xpDisponible}</div>
          ${religion ? `<div class="item"><span class="label">Religion :</span> ${escapeHtml(religion.nom)}</div>` : ""}
          <div class="item"><span class="label">GN complétés :</span> ${personnage.gn_completes}</div>
          <div class="item"><span class="label">Mini-GN :</span> ${personnage.mini_gn_completes}</div>
          <div class="item"><span class="label">Ouvertures terrain :</span> ${personnage.ouvertures_terrain}</div>
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

        ${(competences ?? []).length > 0 ? `
        <h2>Compétences</h2>
        <table>
          <tr><th>Compétence</th><th>Catégorie</th><th>Niveau</th><th>XP</th><th>Statut</th></tr>
          ${(competences ?? []).map((c) => `
            <tr>
              <td>${escapeHtml(c.nom)}${c.choix_achat ? ` (${escapeHtml(c.choix_achat)})` : ""}</td>
              <td>${escapeHtml(c.categorie)}</td>
              <td>${c.niveau_acquis}</td>
              <td>${c.xp_depense === 0 ? "Gratuit" : c.xp_depense}</td>
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
                <span class="badge">${calculerCoutPS(s.cout_xp_base)} PS</span>
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
                ${p.cout_xp_base != null ? `<span class="badge">${calculerCoutPS(p.cout_xp_base)} PS</span>` : ""}
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

        ${personnage.historique || personnage.ame_personnage ? `
        <h2>Historique et âme</h2>
        ${personnage.historique ? `<h3>Historique</h3><p>${escapeHtml(personnage.historique).replace(/\n/g, "<br>")}</p>` : ""}
        ${personnage.ame_personnage ? `<h3>Âme</h3><p>${escapeHtml(personnage.ame_personnage).replace(/\n/g, "<br>")}</p>` : ""}
        ` : ""}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (personnageLoading) {
    return <p className="text-center py-12 text-muted-foreground">Chargement…</p>;
  }

  if (!personnage) {
    return <p className="text-center py-12 text-muted-foreground">Personnage non trouvé.</p>;
  }

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-4xl font-bold text-primary">{personnage.nom}</h1>
          <p className="text-muted-foreground mt-1">
            {race?.nom} {race?.nom_latin && <span className="italic">({race.nom_latin})</span>} • {classe?.nom} • Niveau {personnage.niveau}
          </p>
        </div>
        <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
          <Printer className="h-4 w-4" />
          Imprimer
        </Button>
      </div>

      <Tabs defaultValue="infos" className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="infos">Infos</TabsTrigger>
          <TabsTrigger value="traits">Traits</TabsTrigger>
          <TabsTrigger value="competences">Compétences</TabsTrigger>
          <TabsTrigger value="sorts">Sorts</TabsTrigger>
          <TabsTrigger value="prieres">Prières</TabsTrigger>
          <TabsTrigger value="artisanat">Artisanat</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        {/* Infos générales */}
        <TabsContent value="infos" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Race</p>
                <p className="font-medium text-foreground">{race?.nom}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Classe</p>
                <p className="font-medium text-foreground">{classe?.nom}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Niveau</p>
                <p className="font-medium text-foreground">{personnage.niveau}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">XP Total</p>
                <p className="font-medium text-foreground">{personnage.xp_total}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">XP Dépensé</p>
                <p className="font-medium text-foreground">{personnage.xp_depense}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">XP Disponible</p>
                <p className="font-medium text-primary">{xpDisponible}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">PV Max</p>
                <p className="font-medium text-foreground">{personnage.pv_max}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">PS Max</p>
                <p className="font-medium text-foreground">{personnage.ps_max}</p>
              </div>
              {religion && (
                <div>
                  <p className="text-xs text-muted-foreground">Religion</p>
                  <p className="font-medium text-foreground">{religion.nom}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">GN Complétés</p>
                <p className="font-medium text-foreground">{personnage.gn_completes}</p>
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
          {competences && competences.length > 0 ? (
            <div className="space-y-3">
              {competences.map((comp) => (
                <Card key={comp.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {comp.nom}
                          {comp.choix_achat && <span className="text-muted-foreground ml-1">({comp.choix_achat})</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{comp.categorie}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">Niv. {comp.niveau_acquis}</Badge>
                        {comp.xp_depense === 0 ? (
                          <Badge variant="outline" className="text-xs">Gratuit</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">{comp.xp_depense} XP</Badge>
                        )}
                        {comp.statut_maitre !== "non_requis" && (
                          <Badge className="text-xs">{STATUT_MAITRE_LABELS[comp.statut_maitre] || comp.statut_maitre}</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{sort.nom_personnalise}</p>
                        <p className="text-xs text-muted-foreground">{sort.cercle} • Niveau {sort.niveau_sort}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{calculerCoutPS(sort.cout_xp_base)} PS</Badge>
                    </div>
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
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{priere.nom_personnalise}</p>
                        <p className="text-xs text-muted-foreground">{priere.domaine} • Niveau {priere.niveau_priere}</p>
                      </div>
                    </div>
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
                  <div key={asm.id} className="p-2 rounded border border-border/50 text-sm">
                    <p className="font-medium text-foreground">{asm.nom}</p>
                    {asm.cout_ps && <p className="text-xs text-muted-foreground">Coût PS : {asm.cout_ps}</p>}
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
                  <div key={recette.id} className="p-2 rounded border border-border/50 text-sm">
                    <p className="font-medium text-foreground">{recette.nom}</p>
                    <p className="text-xs text-muted-foreground">{recette.type}</p>
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
              {personnage.historique && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Historique</CardTitle>
                    {isOwner && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleEditHistorique}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground whitespace-pre-line">{personnage.historique}</p>
                  </CardContent>
                </Card>
              )}

              {personnage.ame_personnage && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Âme</CardTitle>
                    {isOwner && !personnage.historique && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleEditHistorique}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground whitespace-pre-line">{personnage.ame_personnage}</p>
                  </CardContent>
                </Card>
              )}

              {!personnage.historique && !personnage.ame_personnage && (
                <p className="text-center py-8 text-muted-foreground">
                  {isOwner ? "Aucun historique ou âme renseigné. " : "Aucun historique ou âme renseigné."}
                  {isOwner && (
                    <Button
                      size="sm"
                      variant="link"
                      onClick={handleEditHistorique}
                    >
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

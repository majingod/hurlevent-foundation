import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { calculerCoutPS } from "@/utils/calculsMagie";
import { STATUT_MAITRE_LABELS } from "@/constants/labels";

interface Step10Props {
  personnageId: string;
  nomPersonnage: string;
  raceNom: string;
  raceNomLatin: string | null;
  classeNom: string;
  niveau: number;
  xpTotal: number;
  xpDepense: number;
  religionNom: string | null;
  familleCriminelleNom: string | null;
  gnCompletes: number;
  miniGnCompletes: number;
  ouverturesTerrain: number;
  pvMax: number;
  psMax: number;
  historique: string;
  amePersonnage: string;
  traitObligatoire: any;
  traitsOptionnels: any[];
}

interface PersonnageCompetence {
  id: string;
  niveau_acquis: number;
  appris_via_maitre: boolean;
  nom_maitre: string | null;
  statut_maitre: string;
  xp_depense: number;
  choix_achat: string | null;
  competence_nom: string;
  categorie: string;
  competence_description: string | null;
}

interface PersonnageSort {
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

interface PersonnagePriere {
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

interface PersonnageAssemblage {
  id: string;
  nom: string;
  cible: string | null;
  cout_ps: number | null;
  xp_depense: number;
  description: string | null;
  effet: string | null;
  runes_requises: string[] | null;
}

interface PersonnageRecette {
  id: string;
  nom: string;
  type: string;
  niveau_requis: number;
  xp_depense: number;
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

const Step10Recapitulatif = ({
  personnageId,
  nomPersonnage,
  raceNom,
  raceNomLatin,
  classeNom,
  niveau,
  xpTotal,
  xpDepense,
  religionNom,
  familleCriminelleNom,
  gnCompletes,
  miniGnCompletes,
  ouverturesTerrain,
  pvMax,
  psMax,
  historique,
  amePersonnage,
  traitObligatoire,
  traitsOptionnels,
}: Step10Props) => {
  const { toast } = useToast();
  const [competences, setCompetences] = useState<PersonnageCompetence[]>([]);
  const [sorts, setSorts] = useState<PersonnageSort[]>([]);
  const [prieres, setPrieres] = useState<PersonnagePriere[]>([]);
  const [assemblages, setAssemblages] = useState<PersonnageAssemblage[]>([]);
  const [recettes, setRecettes] = useState<PersonnageRecette[]>([]);
  const [loading, setLoading] = useState(true);
  const [artisanatEtat, setArtisanatEtat] = useState<ArtisanatEtat | null>(null);
  const [manipulations, setManipulations] = useState<ManipulationAlchimique[]>([]);
  const [objetsForge, setObjetsForge] = useState<ObjetForge[]>([]);
  const [reparationsForge, setReparationsForge] = useState<ReparationForge[]>([]);
  const [objetsJoaillerie, setObjetsJoaillerie] = useState<ObjetJoaillerie[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Récupérer les compétences
        const { data: compData, error: compError } = await supabase
          .from("personnage_competences")
          .select(
            `
            id, niveau_acquis, appris_via_maitre, nom_maitre, statut_maitre, xp_depense, choix_achat,
            competences!inner(nom, categorie, description)
          `
          )
          .eq("personnage_id", personnageId)
          .order("competences.categorie")
          .order("competences.nom");

        if (compError) throw compError;
        setCompetences(
          (compData ?? []).map((c: any) => ({
            ...c,
            competence_nom: c.competences.nom,
            categorie: c.competences.categorie,
            competence_description: c.competences.description,
          }))
        );

        // Récupérer les sorts
        const { data: sortData, error: sortError } = await supabase
          .from("personnage_sorts")
          .select(
            `
            id, nom_personnalise, formule_magique, niveau_sort, zone_choisie, portee_choisie, duree_choisie,
            sorts!inner(cercle, cout_xp_base, nom, description)
          `
          )
          .eq("personnage_id", personnageId)
          .order("sorts.cercle")
          .order("nom_personnalise");

        if (sortError) throw sortError;
        setSorts(
          (sortData ?? []).map((s: any) => ({
            ...s,
            cercle: s.sorts.cercle,
            cout_xp_base: s.sorts.cout_xp_base,
            sort_nom_base: s.sorts.nom,
            sort_description: s.sorts.description,
          }))
        );

        // Récupérer les prières
        const { data: prieData, error: prieError } = await supabase
          .from("personnage_prieres")
          .select(
            `
            id, nom_personnalise, niveau_priere, zone_choisie, portee_choisie, duree_choisie,
            prieres!inner(domaine, description, duree_incantation, cout_xp_base)
          `
          )
          .eq("personnage_id", personnageId)
          .order("prieres.domaine")
          .order("nom_personnalise");

        if (prieError) throw prieError;
        setPrieres(
          (prieData ?? []).map((p: any) => ({
            ...p,
            domaine: p.prieres.domaine,
            priere_description: p.prieres.description,
            duree_incantation: p.prieres.duree_incantation,
            cout_xp_base: p.prieres.cout_xp_base,
          }))
        );

        // Récupérer les assemblages
        const { data: assemData, error: assemError } = await supabase
          .from("personnage_assemblages")
          .select(
            `
            id, xp_depense,
            assemblages_runes!inner(nom, cible, cout_ps, description, effet, runes_requises)
          `
          )
          .eq("personnage_id", personnageId)
          .order("assemblages_runes.nom");

        if (assemError) throw assemError;
        setAssemblages(
          (assemData ?? []).map((a: any) => ({
            id: a.id,
            nom: a.assemblages_runes.nom,
            cible: a.assemblages_runes.cible,
            cout_ps: a.assemblages_runes.cout_ps,
            xp_depense: a.xp_depense,
            description: a.assemblages_runes.description,
            effet: a.assemblages_runes.effet,
            runes_requises: a.assemblages_runes.runes_requises,
          }))
        );

        // Récupérer les recettes
        const { data: recetData, error: recetError } = await supabase
          .from("personnage_recettes")
          .select(
            `
            id, xp_depense,
            recettes_alchimie!inner(nom, type, niveau_requis, description, effet)
          `
          )
          .eq("personnage_id", personnageId)
          .order("recettes_alchimie.type")
          .order("recettes_alchimie.niveau_requis")
          .order("recettes_alchimie.nom");

        if (recetError) throw recetError;
        setRecettes(
          (recetData ?? []).map((r: any) => ({
            id: r.id,
            nom: r.recettes_alchimie.nom,
            type: r.recettes_alchimie.type,
            niveau_requis: r.recettes_alchimie.niveau_requis,
            xp_depense: r.xp_depense,
            description: r.recettes_alchimie.description,
            effet: r.recettes_alchimie.effet,
          }))
        );

        // Récupérer l'état artisanat
        const { data: artisanatData } = await supabase
          .from("vue_artisanat_etat")
          .select("niveau_alchimie, niveau_forge, niveau_joaillerie")
          .eq("personnage_id", personnageId)
          .maybeSingle();
        if (artisanatData) setArtisanatEtat(artisanatData as ArtisanatEtat);

        // Récupérer les manipulations alchimiques
        const { data: manipData } = await supabase
          .from("ingredients_alchimiques")
          .select("id, nom, niveau, manipulations")
          .order("niveau")
          .order("nom");
        setManipulations((manipData ?? []) as ManipulationAlchimique[]);

        // Récupérer les objets de forge
        const { data: forgeData } = await supabase
          .from("objets_forge")
          .select("*")
          .eq("est_actif", true)
          .order("difficulte")
          .order("nom");
        setObjetsForge((forgeData ?? []) as ObjetForge[]);

        // Récupérer les réparations de forge
        const { data: repData } = await supabase
          .from("reparations_forge")
          .select("id, nom_affichage, categorie, materiaux, materiaux_rares, temps_minutes")
          .eq("est_actif", true)
          .order("categorie")
          .order("nom_affichage");
        setReparationsForge((repData ?? []) as ReparationForge[]);

        // Récupérer les objets de joaillerie
        const { data: joaillerieData } = await supabase
          .from("objets_joaillerie")
          .select("*")
          .eq("est_actif", true)
          .order("difficulte")
          .order("nom");
        setObjetsJoaillerie((joaillerieData ?? []) as ObjetJoaillerie[]);

        setLoading(false);
      } catch (err: any) {
        console.error(err);
        toast.error("Erreur lors du chargement du récapitulatif.");
        setLoading(false);
      }
    };

    fetchData();
  }, [personnageId, toast]);

  const escapeHtml = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const safeNomPersonnage = escapeHtml(nomPersonnage);
    const safeRaceNom = escapeHtml(raceNom);
    const safeRaceNomLatin = raceNomLatin ? escapeHtml(raceNomLatin) : "";
    const safeClasseNom = escapeHtml(classeNom);
    const safeReligionNom = religionNom ? escapeHtml(religionNom) : "";
    const safeFamilleCriminelleNom = familleCriminelleNom ? escapeHtml(familleCriminelleNom) : "";

    const niveauAlchimie = artisanatEtat?.niveau_alchimie ?? 0;
    const niveauForge = artisanatEtat?.niveau_forge ?? 0;
    const niveauJoaillerie = artisanatEtat?.niveau_joaillerie ?? 0;

    const sortsByCercle: Record<string, PersonnageSort[]> = {};
    sorts.forEach((s) => {
      if (!sortsByCercle[s.cercle]) sortsByCercle[s.cercle] = [];
      sortsByCercle[s.cercle].push(s);
    });

    const prieresByDomaine: Record<string, PersonnagePriere[]> = {};
    prieres.forEach((p) => {
      if (!prieresByDomaine[p.domaine]) prieresByDomaine[p.domaine] = [];
      prieresByDomaine[p.domaine].push(p);
    });

    const recettesByNiveau: Record<number, PersonnageRecette[]> = {};
    recettes.forEach((r) => {
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
        <title>Fiche de ${safeNomPersonnage}</title>
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
          .badge-gray { background: #f3f4f6; border-color: #d1d5db; }
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
        <h1>Fiche de ${safeNomPersonnage}</h1>
        <p class="muted">${safeRaceNom}${safeRaceNomLatin ? ` (${safeRaceNomLatin})` : ""} — ${safeClasseNom} — Niveau ${niveau}</p>

        <h2>Informations générales</h2>
        <div class="grid">
          <div class="item"><span class="label">PV Max :</span> ${pvMax}</div>
          <div class="item"><span class="label">PS Max :</span> ${psMax}</div>
          <div class="item"><span class="label">XP Total :</span> ${xpTotal}</div>
          <div class="item"><span class="label">XP Dépensé :</span> ${xpDepense}</div>
          ${safeReligionNom ? `<div class="item"><span class="label">Religion :</span> ${safeReligionNom}</div>` : ""}
          ${safeFamilleCriminelleNom ? `<div class="item"><span class="label">Famille criminelle :</span> ${safeFamilleCriminelleNom}</div>` : ""}
          <div class="item"><span class="label">GN complétés :</span> ${gnCompletes}</div>
          <div class="item"><span class="label">Mini-GN :</span> ${miniGnCompletes}</div>
          <div class="item"><span class="label">Ouvertures terrain :</span> ${ouverturesTerrain}</div>
        </div>

        ${(traitObligatoire || traitsOptionnels.length > 0) ? `
        <h2>Traits raciaux</h2>
        ${traitObligatoire ? `
          <div class="card">
            <div class="card-row">
              <div class="card-title">${escapeHtml(traitObligatoire.nom)}</div>
              <span class="badge badge-gray">Obligatoire</span>
            </div>
            ${traitObligatoire.description ? `<div class="desc">${escapeHtml(traitObligatoire.description)}</div>` : ""}
          </div>
        ` : ""}
        ${traitsOptionnels.map((t) => `
          <div class="card">
            <div class="card-row">
              <div class="card-title">${escapeHtml(t.nom)}</div>
              ${t.cout_xp ? `<span class="badge badge-gray">${t.cout_xp} XP</span>` : ""}
            </div>
            ${t.description ? `<div class="desc">${escapeHtml(t.description)}</div>` : ""}
          </div>
        `).join("")}
        ` : ""}

        <h2>Compétences</h2>
        ${competences.length === 0 ? `<p class="muted">Aucune compétence acquise.</p>` : `
        <table>
          <tr><th>Compétence</th><th>Catégorie</th><th>Niveau</th><th>XP</th><th>Statut</th></tr>
          ${competences.map((c) => `
            <tr>
              <td>
                ${escapeHtml(c.competence_nom)}${c.choix_achat ? ` <span class="muted">(${escapeHtml(c.choix_achat)})</span>` : ""}
                ${c.competence_description ? `<br><span class="muted">${escapeHtml(c.competence_description)}</span>` : ""}
              </td>
              <td>${escapeHtml(c.categorie)}</td>
              <td>${c.niveau_acquis}</td>
              <td>${c.xp_depense === 0 ? "Gratuit" : c.xp_depense}</td>
              <td>${escapeHtml(c.statut_maitre !== "non_requis" ? STATUT_MAITRE_LABELS[c.statut_maitre] || c.statut_maitre : "—")}</td>
            </tr>
          `).join("")}
        </table>
        `}

        ${sorts.length > 0 ? `
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

        ${prieres.length > 0 ? `
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

        ${assemblages.length > 0 ? `
        <h2>Assemblages de runes</h2>
        ${assemblages.map((a) => `
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
        ${manipulations.filter((m) => (m.niveau ?? 0) <= niveauAlchimie).length > 0 ? `
          <h3>Manipulations alchimiques</h3>
          ${manipulations.filter((m) => (m.niveau ?? 0) <= niveauAlchimie).map((m) => `
            <div class="card">
              <div class="card-title">${escapeHtml(m.nom ?? "")}</div>
              ${m.manipulations ? `<div class="desc">${escapeHtml(m.manipulations)}</div>` : ""}
            </div>
          `).join("")}
        ` : ""}
        ` : ""}

        ${niveauForge >= 1 ? `
        <h2>Forge (Niv. ${niveauForge})</h2>
        ${objetsForge.filter((o) => (o.difficulte ?? 0) <= niveauForge).length > 0 ? `
          <h3>Fabrication</h3>
          ${objetsForge.filter((o) => (o.difficulte ?? 0) <= niveauForge).map((o) => `
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
        ${reparationsForge.length > 0 ? `
          <h3>Réparation</h3>
          ${reparationsForge.map((rep) => `
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
        ${objetsJoaillerie.filter((o) => (o.difficulte ?? 0) <= niveauJoaillerie).length > 0 ? `
          <h3>Fabrication</h3>
          ${objetsJoaillerie.filter((o) => (o.difficulte ?? 0) <= niveauJoaillerie).map((o) => `
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

        ${historique || amePersonnage ? `
        <h2>Historique et âme</h2>
        ${historique ? `<h3>Historique</h3><p>${escapeHtml(historique).replace(/\n/g, "<br>")}</p>` : ""}
        ${amePersonnage ? `<h3>Âme</h3><p>${escapeHtml(amePersonnage).replace(/\n/g, "<br>")}</p>` : ""}
        ` : ""}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return <p className="text-muted-foreground text-center py-8">Chargement…</p>;
  }

  const xpDisponible = xpTotal - xpDepense;
  const niveauAlchimie = artisanatEtat?.niveau_alchimie ?? 0;
  const niveauForge = artisanatEtat?.niveau_forge ?? 0;
  const niveauJoaillerie = artisanatEtat?.niveau_joaillerie ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Étape 10 — Récapitulatif et finalisation
        </h2>
        <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
          <Printer className="h-4 w-4" />
          Exporter en PDF
        </Button>
      </div>

      <Tabs defaultValue="resume" className="w-full">
        <TabsList className="flex w-full overflow-x-auto gap-1 pb-1 h-auto">
          <TabsTrigger className="flex-shrink-0" value="resume">Résumé</TabsTrigger>
          <TabsTrigger className="flex-shrink-0" value="traits">Traits</TabsTrigger>
          <TabsTrigger className="flex-shrink-0" value="competences">Compétences</TabsTrigger>
          {sorts.length > 0 && <TabsTrigger className="flex-shrink-0" value="arcane">Magie Arcane</TabsTrigger>}
          {prieres.length > 0 && <TabsTrigger className="flex-shrink-0" value="prieres-div">Prières Divines</TabsTrigger>}
          {assemblages.length > 0 && <TabsTrigger className="flex-shrink-0" value="assemblages">Assemblages</TabsTrigger>}
          {niveauAlchimie >= 1 && <TabsTrigger className="flex-shrink-0" value="alchimie">Alchimie</TabsTrigger>}
          {niveauForge >= 1 && <TabsTrigger className="flex-shrink-0" value="forge">Artisanat (Forge)</TabsTrigger>}
          {niveauJoaillerie >= 1 && <TabsTrigger className="flex-shrink-0" value="joaillerie">Artisanat (Joaillerie)</TabsTrigger>}
        </TabsList>

        {/* Résumé général */}
        <TabsContent value="resume" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Nom du personnage</p>
                  <p className="font-medium text-foreground">{nomPersonnage}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Race</p>
                  <p className="font-medium text-foreground">
                    {raceNom}
                    {raceNomLatin && <span className="text-xs text-muted-foreground italic ml-1">({raceNomLatin})</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Classe</p>
                  <p className="font-medium text-foreground">{classeNom}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Niveau</p>
                  <p className="font-medium text-foreground">{niveau}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">XP Total</p>
                  <p className="font-medium text-foreground">{xpTotal}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">XP Dépensé</p>
                  <p className="font-medium text-foreground">{xpDepense}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">XP Disponible</p>
                  <p className="font-medium text-primary">{xpDisponible}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">PV Max</p>
                  <p className="font-medium text-foreground">{pvMax}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">PS Max</p>
                  <p className="font-medium text-foreground">{psMax}</p>
                </div>
                {religionNom && (
                  <div>
                    <p className="text-xs text-muted-foreground">Religion</p>
                    <p className="font-medium text-foreground">{religionNom}</p>
                  </div>
                )}
                {familleCriminelleNom && (
                  <div>
                    <p className="text-xs text-muted-foreground">Famille criminelle</p>
                    <p className="font-medium text-foreground">{familleCriminelleNom}</p>
                  </div>
                )}
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground mb-2">Expérience</p>
                <div className="space-y-1 text-sm">
                  <p>GN complétés : <strong>{gnCompletes}</strong></p>
                  <p>Mini-GN complétés : <strong>{miniGnCompletes}</strong></p>
                  <p>Ouvertures de terrain : <strong>{ouverturesTerrain}</strong></p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Traits raciaux */}
        <TabsContent value="traits" className="space-y-4 mt-6">
          {traitObligatoire && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trait obligatoire</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-medium text-foreground">{traitObligatoire.nom}</p>
                  <p className="text-sm text-muted-foreground">{traitObligatoire.description}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {traitsOptionnels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Traits optionnels</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {traitsOptionnels.map((trait) => (
                  <div key={trait.id} className="border-b border-border/50 pb-3 last:border-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{trait.nom}</p>
                        <p className="text-sm text-muted-foreground">{trait.description}</p>
                      </div>
                      <Badge variant="outline" className="text-xs ml-2">{trait.cout_xp} XP</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Compétences */}
        <TabsContent value="competences" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compétences acquises</CardTitle>
            </CardHeader>
            <CardContent>
              {competences.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune compétence acquise.</p>
              ) : (
                <div className="space-y-2">
                  {competences.map((comp) => (
                    <div key={comp.id} className="p-2 rounded border border-border/50 text-sm space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {comp.competence_nom}
                            {comp.choix_achat && <span className="text-muted-foreground ml-1">({comp.choix_achat})</span>}
                          </p>
                          {comp.competence_description && (
                            <p className="text-xs text-muted-foreground mt-1">{comp.competence_description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Magie Arcane */}
        {sorts.length > 0 && (
          <TabsContent value="arcane" className="space-y-4 mt-6">
            {Object.entries(
              sorts.reduce((acc, s) => {
                if (!acc[s.cercle]) acc[s.cercle] = [];
                acc[s.cercle].push(s);
                return acc;
              }, {} as Record<string, PersonnageSort[]>)
            ).map(([cercle, sortsDuCercle]) => (
              <Card key={cercle}>
                <CardHeader>
                  <CardTitle className="text-base">{cercle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sortsDuCercle.map((sort) => (
                    <div key={sort.id} className="p-3 rounded border border-border/50 text-sm space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{sort.nom_personnalise}</p>
                          {sort.sort_nom_base && sort.sort_nom_base !== sort.nom_personnalise && (
                            <p className="text-xs text-muted-foreground italic">Basé sur : {sort.sort_nom_base}</p>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs flex-shrink-0">{calculerCoutPS(sort.cout_xp_base)} PS</Badge>
                      </div>
                      {sort.formule_magique && (
                        <p className="text-xs text-amber-300 font-mono">Formule : {sort.formule_magique}</p>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {sort.zone_choisie && <span>Zone : {sort.zone_choisie}</span>}
                        {sort.portee_choisie && <span>Portée : {sort.portee_choisie}</span>}
                        {sort.duree_choisie && <span>Durée : {sort.duree_choisie}</span>}
                      </div>
                      {sort.sort_description && (
                        <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">{sort.sort_description}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        )}

        {/* Prières Divines */}
        {prieres.length > 0 && (
          <TabsContent value="prieres-div" className="space-y-4 mt-6">
            {Object.entries(
              prieres.reduce((acc, p) => {
                if (!acc[p.domaine]) acc[p.domaine] = [];
                acc[p.domaine].push(p);
                return acc;
              }, {} as Record<string, PersonnagePriere[]>)
            ).map(([domaine, prieresDuDomaine]) => (
              <Card key={domaine}>
                <CardHeader>
                  <CardTitle className="text-base">{domaine}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {prieresDuDomaine.map((priere) => (
                    <div key={priere.id} className="p-3 rounded border border-border/50 text-sm space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-foreground">{priere.nom_personnalise}</p>
                        {priere.cout_xp_base != null && (
                          <Badge variant="secondary" className="text-xs flex-shrink-0">{calculerCoutPS(priere.cout_xp_base)} PS</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {priere.duree_incantation && <span>Incantation : {priere.duree_incantation}</span>}
                        {priere.zone_choisie && <span>Zone : {priere.zone_choisie}</span>}
                        {priere.portee_choisie && <span>Portée : {priere.portee_choisie}</span>}
                        {priere.duree_choisie && <span>Durée : {priere.duree_choisie}</span>}
                      </div>
                      {priere.priere_description && (
                        <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">{priere.priere_description}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        )}

        {/* Assemblages */}
        {assemblages.length > 0 && (
          <TabsContent value="assemblages" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assemblages de runes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assemblages.map((asm) => (
                  <div key={asm.id} className="p-3 rounded border border-border/50 text-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground">{asm.nom}</p>
                      {asm.cout_ps != null && (
                        <Badge variant="secondary" className="text-xs flex-shrink-0">{asm.cout_ps} PS</Badge>
                      )}
                    </div>
                    {asm.cible && <p className="text-xs text-muted-foreground">Cible : {asm.cible}</p>}
                    {asm.runes_requises && asm.runes_requises.length > 0 && (
                      <p className="text-xs text-muted-foreground">Runes : {asm.runes_requises.join(", ")}</p>
                    )}
                    {asm.description && (
                      <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">{asm.description}</p>
                    )}
                    {asm.effet && (
                      <p className="text-xs text-foreground/80 font-medium">Effet : {asm.effet}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}
        {/* Alchimie */}
        {niveauAlchimie >= 1 && (
          <TabsContent value="alchimie" className="space-y-4 mt-6">
            {[
              { label: "Recettes mineures", niveau: 1 },
              { label: "Recettes intermédiaires", niveau: 2 },
              { label: "Recettes majeures", niveau: 3 },
            ]
              .map(({ label, niveau }) => ({
                label,
                items: recettes.filter((r) => r.niveau_requis === niveau),
              }))
              .filter(({ items }) => items.length > 0)
              .map(({ label, items }) => (
                <Card key={label}>
                  <CardHeader>
                    <CardTitle className="text-base">{label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {items.map((r) => (
                      <div key={r.id} className="p-2 rounded border border-border/50 text-sm space-y-1">
                        <p className="font-medium text-foreground">{r.nom}</p>
                        {r.effet && <p className="text-xs text-foreground/80">Effet : {r.effet}</p>}
                        {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            {manipulations.filter((m) => (m.niveau ?? 0) <= niveauAlchimie).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Manipulations alchimiques accessibles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {manipulations
                    .filter((m) => (m.niveau ?? 0) <= niveauAlchimie)
                    .map((m) => (
                      <div key={m.id} className="p-2 rounded border border-border/50 text-sm space-y-1">
                        <p className="font-medium text-foreground">{m.nom}</p>
                        {m.manipulations && <p className="text-xs text-muted-foreground">{m.manipulations}</p>}
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Artisanat (Forge) */}
        {niveauForge >= 1 && (
          <TabsContent value="forge" className="space-y-4 mt-6">
            <p className="text-sm text-muted-foreground">
              Niveau de Forge : <strong className="text-primary">{niveauForge}</strong>
            </p>
            {objetsForge
              .filter((o) => (o.difficulte ?? 0) <= niveauForge)
              .length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Fabrication</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {objetsForge
                    .filter((o) => (o.difficulte ?? 0) <= niveauForge)
                    .map((obj) => (
                      <div key={obj.id} className="p-2 rounded border border-border/50 text-sm space-y-1">
                        <p className="font-medium text-foreground">{obj.nom}</p>
                        {obj.description && <p className="text-xs text-muted-foreground">{obj.description}</p>}
                        {obj.type && <p className="text-xs text-muted-foreground">Type : {obj.type}</p>}
                        {obj.materiaux_communs && (
                          <p className="text-xs text-gray-300">
                            <span className="text-amber-400">Matériaux communs : </span>{obj.materiaux_communs}
                          </p>
                        )}
                        {niveauForge >= 2 && obj.materiaux_rares && (
                          <p className="text-xs text-gray-300">
                            <span className="text-purple-400">Matériaux rares : </span>{obj.materiaux_rares}
                          </p>
                        )}
                        {niveauForge >= 3 && (
                          <p className="text-xs text-amber-300 italic">Accès aux matériaux légendaires disponible.</p>
                        )}
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}
            {reparationsForge.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Réparation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {reparationsForge.map((rep) => (
                    <div key={rep.id} className="p-2 rounded border border-border/50 text-sm space-y-1">
                      <p className="font-medium text-foreground">{rep.nom_affichage}</p>
                      <p className="text-xs text-muted-foreground">Catégorie : {rep.categorie}</p>
                      <p className="text-xs text-gray-300">
                        <span className="text-amber-400">Matériaux communs : </span>{rep.materiaux}
                      </p>
                      {niveauForge >= 2 && (
                        <p className="text-xs text-gray-300">
                          <span className="text-purple-400">Matériaux rares : </span>{rep.materiaux_rares}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Artisanat (Joaillerie) */}
        {niveauJoaillerie >= 1 && (
          <TabsContent value="joaillerie" className="space-y-4 mt-6">
            <p className="text-sm text-muted-foreground">
              Niveau de Joaillerie : <strong className="text-primary">{niveauJoaillerie}</strong>
            </p>
            {objetsJoaillerie
              .filter((o) => (o.difficulte ?? 0) <= niveauJoaillerie)
              .length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Fabrication</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {objetsJoaillerie
                    .filter((o) => (o.difficulte ?? 0) <= niveauJoaillerie)
                    .map((obj) => (
                      <div key={obj.id} className="p-2 rounded border border-border/50 text-sm space-y-1">
                        <p className="font-medium text-foreground">{obj.nom}</p>
                        {obj.description && <p className="text-xs text-muted-foreground">{obj.description}</p>}
                        {obj.effet && <p className="text-xs text-foreground/80">Effet : {obj.effet}</p>}
                        {obj.materiaux_communs && (
                          <p className="text-xs text-gray-300">
                            <span className="text-amber-400">Matériaux communs : </span>{obj.materiaux_communs}
                          </p>
                        )}
                        {niveauJoaillerie >= 2 && obj.materiaux_rares && (
                          <p className="text-xs text-gray-300">
                            <span className="text-purple-400">Matériaux rares : </span>{obj.materiaux_rares}
                          </p>
                        )}
                        {niveauJoaillerie >= 3 && (
                          <p className="text-xs text-amber-300 italic">Accès aux matériaux légendaires disponible.</p>
                        )}
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Historique et âme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique et âme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {historique && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Historique</p>
              <p className="text-sm text-foreground whitespace-pre-line">{historique}</p>
            </div>
          )}
          {amePersonnage && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Âme</p>
              <p className="text-sm text-foreground whitespace-pre-line">{amePersonnage}</p>
            </div>
          )}
          {!historique && !amePersonnage && (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun historique ou âme renseigné.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Step10Recapitulatif;

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
}

interface PersonnageSort {
  id: string;
  nom_personnalise: string;
  niveau_sort: number;
  zone_choisie: string | null;
  portee_choisie: string | null;
  duree_choisie: string | null;
  cercle: string;
  cout_xp_base: number;
}

interface PersonnagePriere {
  id: string;
  nom_personnalise: string;
  niveau_priere: number;
  zone_choisie: string | null;
  portee_choisie: string | null;
  duree_choisie: string | null;
  domaine: string;
}

interface PersonnageAssemblage {
  id: string;
  nom: string;
  cible: string | null;
  cout_ps: number | null;
  xp_depense: number;
}

interface PersonnageRecette {
  id: string;
  nom: string;
  type: string;
  niveau_requis: number;
  xp_depense: number;
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Récupérer les compétences
        const { data: compData, error: compError } = await supabase
          .from("personnage_competences")
          .select(
            `
            id, niveau_acquis, appris_via_maitre, nom_maitre, statut_maitre, xp_depense, choix_achat,
            competences!inner(nom, categorie)
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
          }))
        );

        // Récupérer les sorts
        const { data: sortData, error: sortError } = await supabase
          .from("personnage_sorts")
          .select(
            `
            id, nom_personnalise, niveau_sort, zone_choisie, portee_choisie, duree_choisie,
            sorts!inner(cercle, cout_xp_base)
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
          }))
        );

        // Récupérer les prières
        const { data: prieData, error: prieError } = await supabase
          .from("personnage_prieres")
          .select(
            `
            id, nom_personnalise, niveau_priere, zone_choisie, portee_choisie, duree_choisie,
            prieres!inner(domaine)
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
          }))
        );

        // Récupérer les assemblages
        const { data: assemData, error: assemError } = await supabase
          .from("personnage_assemblages")
          .select(
            `
            id, xp_depense,
            assemblages_runes!inner(nom, cible, cout_ps)
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
          }))
        );

        // Récupérer les recettes
        const { data: recetData, error: recetError } = await supabase
          .from("personnage_recettes")
          .select(
            `
            id, xp_depense,
            recettes_alchimie!inner(nom, type, niveau_requis)
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
          }))
        );

        setLoading(false);
      } catch (err: any) {
        console.error(err);
        toast.error("Erreur lors du chargement du récapitulatif.");
        setLoading(false);
      }
    };

    fetchData();
  }, [personnageId, toast]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fiche de ${nomPersonnage}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { font-size: 24px; margin-bottom: 10px; }
          h2 { font-size: 18px; margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid #333; }
          .section { margin-bottom: 20px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .item { margin-bottom: 8px; }
          .label { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; }
        </style>
      </head>
      <body>
        <h1>Fiche de ${nomPersonnage}</h1>
        
        <h2>Informations générales</h2>
        <div class="grid">
          <div class="item"><span class="label">Race :</span> ${raceNom}${raceNomLatin ? ` (${raceNomLatin})` : ""}</div>
          <div class="item"><span class="label">Classe :</span> ${classeNom}</div>
          <div class="item"><span class="label">Niveau :</span> ${niveau}</div>
          <div class="item"><span class="label">XP Total :</span> ${xpTotal}</div>
          <div class="item"><span class="label">PV Max :</span> ${pvMax}</div>
          <div class="item"><span class="label">PS Max :</span> ${psMax}</div>
          ${religionNom ? `<div class="item"><span class="label">Religion :</span> ${religionNom}</div>` : ""}
          ${familleCriminelleNom ? `<div class="item"><span class="label">Famille criminelle :</span> ${familleCriminelleNom}</div>` : ""}
        </div>

        <h2>Historique et âme</h2>
        <div class="section">
          <h3>Historique</h3>
          <p>${historique || "(Non renseigné)"}</p>
          <h3>Âme</h3>
          <p>${amePersonnage || "(Non renseigné)"}</p>
        </div>

        <h2>Compétences</h2>
        <table>
          <tr><th>Compétence</th><th>Niveau</th><th>XP</th><th>Statut</th></tr>
          ${competences.map((c) => `
            <tr>
              <td>${c.competence_nom}</td>
              <td>${c.niveau_acquis}</td>
              <td>${c.xp_depense === 0 ? "Gratuit" : c.xp_depense}</td>
              <td>${c.statut_maitre !== "non_requis" ? STATUT_MAITRE_LABELS[c.statut_maitre] || c.statut_maitre : "—"}</td>
            </tr>
          `).join("")}
        </table>
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

      <Tabs defaultValue="infos" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="infos">Infos</TabsTrigger>
          <TabsTrigger value="traits">Traits</TabsTrigger>
          <TabsTrigger value="competences">Compétences</TabsTrigger>
          <TabsTrigger value="magie">Magie & Prières</TabsTrigger>
        </TabsList>

        {/* Infos générales */}
        <TabsContent value="infos" className="space-y-4 mt-6">
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
                    <div key={comp.id} className="flex items-center justify-between p-2 rounded border border-border/50 text-sm">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {comp.competence_nom}
                          {comp.choix_achat && <span className="text-muted-foreground ml-1">({comp.choix_achat})</span>}
                        </p>
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
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Magie & Prières */}
        <TabsContent value="magie" className="space-y-4 mt-6">
          {sorts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sorts arcaniques</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sorts.map((sort) => (
                    <div key={sort.id} className="p-2 rounded border border-border/50 text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{sort.nom_personnalise}</p>
                          <p className="text-xs text-muted-foreground">{sort.cercle} — Niveau {sort.niveau_sort}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">{calculerCoutPS(sort.cout_xp_base)} PS</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {prieres.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prières</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {prieres.map((priere) => (
                    <div key={priere.id} className="p-2 rounded border border-border/50 text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{priere.nom_personnalise}</p>
                          <p className="text-xs text-muted-foreground">{priere.domaine} — Niveau {priere.niveau_priere}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {assemblages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assemblages de runes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {assemblages.map((asm) => (
                    <div key={asm.id} className="p-2 rounded border border-border/50 text-sm">
                      <p className="font-medium text-foreground">{asm.nom}</p>
                      {asm.cout_ps && <p className="text-xs text-muted-foreground">Coût PS : {asm.cout_ps}</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {recettes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recettes alchimiques</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recettes.map((recette) => (
                    <div key={recette.id} className="p-2 rounded border border-border/50 text-sm">
                      <p className="font-medium text-foreground">{recette.nom}</p>
                      <p className="text-xs text-muted-foreground">{recette.type}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
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

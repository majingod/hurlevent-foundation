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
  niveau_sort: number;
  cercle: string;
  cout_xp_base: number;
}

interface Priere {
  id: string;
  nom_personnalise: string;
  niveau_priere: number;
  domaine: string;
}

interface Assemblage {
  id: string;
  nom: string;
  cible: string | null;
  cout_ps: number | null;
}

interface Recette {
  id: string;
  nom: string;
  type: string;
  niveau_requis: number;
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
          id, nom_personnalise, niveau_sort,
          sorts!inner(cercle, cout_xp_base)
        `
        )
        .eq("personnage_id", personnage!.id)
        .order("sorts.cercle")
        .order("nom_personnalise");
      return (data ?? []).map((s: any) => ({
        id: s.id,
        nom_personnalise: s.nom_personnalise,
        niveau_sort: s.niveau_sort,
        cercle: s.sorts.cercle,
        cout_xp_base: s.sorts.cout_xp_base,
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
          id, nom_personnalise, niveau_priere,
          prieres!inner(domaine)
        `
        )
        .eq("personnage_id", personnage!.id)
        .order("prieres.domaine")
        .order("nom_personnalise");
      return (data ?? []).map((p: any) => ({
        id: p.id,
        nom_personnalise: p.nom_personnalise,
        niveau_priere: p.niveau_priere,
        domaine: p.prieres.domaine,
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
          assemblages_runes!inner(nom, cible, cout_ps)
        `
        )
        .eq("personnage_id", personnage!.id)
        .order("assemblages_runes.nom");
      return (data ?? []).map((a: any) => ({
        id: a.id,
        nom: a.assemblages_runes.nom,
        cible: a.assemblages_runes.cible,
        cout_ps: a.assemblages_runes.cout_ps,
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
          recettes_alchimie!inner(nom, type, niveau_requis)
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
      })) as Recette[];
    },
    enabled: !!personnage?.id,
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

  const handlePrint = () => {
    window.print();
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

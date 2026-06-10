import { useAuth } from "@/contexts/AuthContext";
import { useProfil } from "@/contexts/ProfilContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Printer, X, Check, Hammer, Gem, FlaskConical, Bomb, Wand2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
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
import { BanqueXpCard } from "./sections/BanqueXpCard";
import { RaceClasseCard } from "./sections/RaceClasseCard";
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
import { ManuelGlobalSwitch, useManuelDisclosure } from "@/components/shared/ToggleManuel";
import { FicheImprimable } from "./FicheImprimable";
import BoutonRemodeler from "@/components/personnage/BoutonRemodeler";
import ReligionDetails from "@/components/shared/ReligionDetails";

type LangueRow = Database["public"]["Tables"]["langues"]["Row"];
type ReligionRow = Database["public"]["Tables"]["religions"]["Row"];

type FichePersonnageViewMode = 'route' | 'wizard-preview';

interface FichePersonnageViewProps {
  personnageId: string;
  mode: FichePersonnageViewMode;
}

const FichePersonnageView = ({ personnageId, mode }: FichePersonnageViewProps) => {
  const { user, role } = useAuth();
  const { joueurId } = useProfil();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingHistorique, setEditingHistorique] = useState(false);
  const [historiqueTmp, setHistoriqueTmp] = useState("");
  const [ameTmp, setAmeTmp] = useState("");
  const [saving, setSaving] = useState(false);
  const { isManuelOpen, toggleManuel, isAllOpen, toggleAll } = useManuelDisclosure();

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
        .select("id, nom, description, type, cout_xp, temps_fabrication_minutes, materiaux_communs, materiaux_rares")
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
        .select("id, nom, description, effet, cout_xp, temps_fabrication_minutes, temps_rare_minutes, materiaux_communs, materiaux_rares")
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
        .select(
          "id, nom, dirigeant, fondateur, symbole_sacre, pouvoir_symbole, domaines_principaux, domaines_proscrits, lore_fiche, rituels_fiche, lore_manuel, rituels_manuel"
        );
      if (error) throw error;
      return (data ?? []) as ReligionRow[];
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

  // ISOWNER-COMPTE-VS-PROFIL : on compare le PROFIL actif (joueurId), pas le compte (user.id).
  const isOwner = joueurId === fiche?.joueur_id;
  const isAdmin = role === "admin";
  // ÉDITION-ADMIN-WIZARD : l'édition in-place (historique/âme) reste réservée au
  // propriétaire ; l'admin passe par l'éditeur complet (wizard ?admin=1).
  const peutEditer = isOwner;
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

  // Ids de tous les items porteurs de verbatim (pour le switch global « Tous les onglets »).
  // race/classe = ids synthétiques (0 NULL en prod : toujours présents).
  const allManuelIds = useMemo(
    () => [
      ...(sorts ?? []).filter((s) => s.sort_description).map((s) => s.id),
      ...(prieres ?? []).filter((p) => p.priere_description).map((p) => p.id),
      ...(assemblages ?? []).filter((a) => a.texte_manuel).map((a) => a.id),
      ...competencesGroupees
        .filter((c) => c.rows.some((r) => r.description_niveau_acquis))
        .map((c) => c.competence_id),
      "race",
      "classe",
    ],
    [sorts, prieres, assemblages, competencesGroupees],
  );

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

  // PDF-PATTERN-4 PR-2 — déclenchement impression (vue FicheImprimable + window.print).
  const [printMode, setPrintMode] = useState<'fiche' | 'manuel'>('fiche');
  const [printNonce, setPrintNonce] = useState(0);
  const triggerPrint = (m: 'fiche' | 'manuel') => {
    setPrintMode(m);
    setPrintNonce((n) => n + 1);
  };
  useEffect(() => {
    if (printNonce > 0) window.print();
  }, [printNonce]);

  if (ficheLoading) {
    return <p className="text-center py-12 text-muted-foreground">Chargement…</p>;
  }

  if (!fiche) {
    return <p className="text-center py-12 text-muted-foreground">Personnage non trouvé.</p>;
  }

  return (
    <div className={mode === 'route' ? 'container max-w-6xl py-8 space-y-6' : 'space-y-6'}>
      {mode === 'route' && isAdmin && !isOwner && (
        <div className="rounded-xl border border-gold/20 bg-card p-4 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Wand2 className="h-5 w-5 shrink-0 mt-0.5 text-gold" />
            <div className="min-w-0">
              <p className="font-heading font-bold text-gold">Mode admin</p>
              <p className="text-sm mt-1 text-muted-foreground">
                Plein pouvoir sur <b>{fiche.nom}</b> (compétences, sorts, prières, XP)
                via l'éditeur complet, sans changer l'état du personnage. Chaque action
                est journalisée.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate(`/personnage/nouveau?id=${fiche.id}&admin=1`)}
            className="shrink-0 gap-2 w-full sm:w-auto"
          >
            <Wand2 className="h-4 w-4" /> Ouvrir l'éditeur complet
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-4xl font-bold text-primary break-words">{fiche.nom}</h1>
          <p className="text-muted-foreground mt-1">
            {fiche.race_nom} {fiche.race_nom_latin && <span className="italic">({fiche.race_nom_latin})</span>} • {fiche.classe_nom} • Niveau {fiche.niveau}
          </p>
        </div>
        {mode === 'route' && (
          <div className="flex gap-2 flex-wrap sm:justify-end">
            <Button onClick={() => triggerPrint('fiche')} variant="outline" size="sm" className="gap-2">
              <Printer className="h-4 w-4" />
              Fiche Version Courte
            </Button>
            <Button onClick={() => triggerPrint('manuel')} variant="outline" size="sm" className="gap-2">
              <Printer className="h-4 w-4" />
              Fiche Version Détaillée
            </Button>
          </div>
        )}
      </div>

      {mode === 'route' && isOwner && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="max-w-sm">
            <BoutonRemodeler personnageId={personnageId} />
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/personnage/nouveau?id=${fiche.id}&admin=1`)}
              title="Édite via l'éditeur complet, sans changer l'état du personnage"
              className="gap-2 border-dashed border-gold/30 text-gold hover:bg-gold/10 hover:text-gold"
            >
              <Wand2 className="h-4 w-4" /> Éditer en admin
            </Button>
          )}
        </div>
      )}

      <ManuelGlobalSwitch
        allOpen={isAllOpen(allManuelIds)}
        onToggle={() => toggleAll(allManuelIds)}
        title="Tous les onglets"
        subtitle="Affiche le verbatim du manuel sur tous les onglets"
      />

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
          <RaceClasseCard
            fiche={fiche}
            isManuelOpen={isManuelOpen}
            toggleManuel={toggleManuel}
            isAllOpen={isAllOpen}
            toggleAll={toggleAll}
          />
          <InfosCard fiche={fiche} xpDisponible={xpDisponible} />
          <BanqueXpCard
            joueurId={fiche.joueur_id}
            personnageId={fiche.id}
            personnageNom={fiche.nom}
            isOwner={peutEditer}
          />
          {(() => {
            const maReligion = fiche.religion_id
              ? religions?.find((r) => r.id === fiche.religion_id)
              : null;
            if (!maReligion) return null;
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Religion — {maReligion.nom}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ReligionDetails
                    religion={maReligion}
                    isManuelOpen={isManuelOpen(maReligion.id)}
                    onToggleManuel={() => toggleManuel(maReligion.id)}
                  />
                </CardContent>
              </Card>
            );
          })()}
          {editingHistorique && peutEditer && mode === 'route' ? (
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
              canEdit={peutEditer && mode === 'route'}
              isOwner={peutEditer}
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
            isManuelOpen={isManuelOpen}
            toggleManuel={toggleManuel}
            isAllOpen={isAllOpen}
            toggleAll={toggleAll}
          />
        </TabsContent>

        {/* Sorts */}
        <TabsContent value="sorts" className="space-y-4 mt-6">
          <SortsSection
            sorts={sorts ?? []}
            isManuelOpen={isManuelOpen}
            toggleManuel={toggleManuel}
            isAllOpen={isAllOpen}
            toggleAll={toggleAll}
          />
        </TabsContent>

        {/* Prières */}
        <TabsContent value="prieres" className="space-y-4 mt-6">
          <PrieresSection
            prieres={prieres ?? []}
            isManuelOpen={isManuelOpen}
            toggleManuel={toggleManuel}
            isAllOpen={isAllOpen}
            toggleAll={toggleAll}
          />
        </TabsContent>

        {/* Assemblages de runes */}
        <TabsContent value="assemblages" className="space-y-4 mt-6">
          <AssemblagesSection
            assemblages={assemblages}
            isManuelOpen={isManuelOpen}
            toggleManuel={toggleManuel}
            isAllOpen={isAllOpen}
            toggleAll={toggleAll}
          />
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
                <Button onClick={() => triggerPrint('fiche')} className="w-full gap-2">
                  <Printer className="h-4 w-4" />
                  Imprimer (Fiche Version Courte)
                </Button>
                <Button onClick={() => triggerPrint('manuel')} variant="outline" className="w-full gap-2">
                  <Printer className="h-4 w-4" />
                  Imprimer (Fiche Version Détaillée)
                </Button>
                <p className="text-xs text-muted-foreground">
                  <strong>Fiche Version Courte</strong> : descriptions courtes (résumé de jeu, version compacte).{" "}
                  <strong>Fiche Version Détaillée</strong> : texte verbatim complet du manuel (sorts, prières, race, classe, assemblages).
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {mode === 'route' && (
        <FicheImprimable
          printMode={printMode}
          fiche={fiche}
          xpDisponible={xpDisponible}
          traits={traits}
          competencesGroupees={competencesGroupees}
          sorts={sorts ?? []}
          prieres={prieres ?? []}
          assemblages={assemblages ?? []}
          recettes={recettes ?? []}
          manipulations={manipulations ?? []}
          objetsForge={objetsForge ?? []}
          reparationsForge={reparationsForge ?? []}
          objetsJoaillerie={objetsJoaillerie ?? []}
          artisanatEtat={artisanatEtat ?? null}
          piegesCatalogue={piegesCatalogue ?? []}
          personnagePieges={personnagePieges ?? []}
          langues={langues}
          religions={religions}
        />
      )}
    </div>
  );
};

export default FichePersonnageView;

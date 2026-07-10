import { useAuth } from "@/contexts/AuthContext";
import { useProfil } from "@/contexts/ProfilContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clientActif, estModeVisiteur } from "@/creation/clientActif";
import { URL_SITE } from "@/lib/liens";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Printer, X, Check, Hammer, Gem, FlaskConical, Bomb, Wand2, Snowflake, Skull } from "lucide-react";
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
import { useModeAffichage } from "@/contexts/ModeAffichageContext";
import BasculeAbregeIntegral from "@/components/shared/BasculeAbregeIntegral";
import RappelFouille from "./RappelFouille";
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
  // Patron canon abrégé ⇄ intégral (s299) — remplace l'ancien patron additif
  // « Texte(s) du manuel » sur toute la fiche.
  const { mode: modeAffichage, toggleMode } = useModeAffichage();
  // Religion : hors matrice canon s299 — son verbatim garde un dépliage local.
  const [religionManuelOuvert, setReligionManuelOuvert] = useState(false);

  // DATA-FIRST : vue_fiche_personnage joint personnages + races + classes + religions
  // Remplace 3 requêtes en cascade (personnage → race → classe → religion)
  const { data: fiche, isLoading: ficheLoading } = useQuery({
    queryKey: ["fiche-personnage", personnageId],
    queryFn: async () => {
      const { data } = await clientActif.lireFichePersonnage(personnageId!);
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
      const { data } = await clientActif.lireFicheCompetences(personnageId!);
      return (data ?? []) as Competence[];
    },
    enabled: !!personnageId,
  });

  // DATA-FIRST : vue_sorts_personnage — plus de jointure ni de .map() frontend
  const { data: sorts } = useQuery({
    queryKey: ["sorts-personnage", personnageId],
    queryFn: async () => {
      const { data } = await clientActif.lireFicheSorts(personnageId!);
      return (data ?? []) as Sort[];
    },
    enabled: !!personnageId,
  });

  // DATA-FIRST : vue_prieres_personnage — plus de jointure ni de .map() frontend
  const { data: prieres } = useQuery({
    queryKey: ["prieres-personnage", personnageId],
    queryFn: async () => {
      const { data } = await clientActif.lireFichePrieres(personnageId!);
      return (data ?? []) as Priere[];
    },
    enabled: !!personnageId,
  });

  // DATA-FIRST : vue_assemblages_personnage — plus de jointure ni de .map() frontend
  const { data: assemblages } = useQuery({
    queryKey: ["assemblages-personnage", personnageId],
    queryFn: async () => {
      const { data } = await clientActif.lireFicheAssemblages(personnageId!);
      return (data ?? []) as Assemblage[];
    },
    enabled: !!personnageId,
  });

  // s299 : vue_recettes_personnage n'expose ni recette_id ni resume_condense →
  // lecture directe personnage_recettes + jointure recettes_alchimie (même RLS
  // que les autres tables personnage_*), tri client équivalent aux .order() de la vue.
  const { data: recettes } = useQuery({
    queryKey: ["recettes-personnage", personnageId],
    queryFn: async () => {
      const { data } = await clientActif.lireFicheRecettes(personnageId!);
      const rows = (data ?? []).map((r) => ({
        id: r.id,
        personnage_id: r.personnage_id,
        xp_depense: r.xp_depense,
        ...r.recettes_alchimie,
      })) as Recette[];
      return rows.sort(
        (a, b) =>
          (a.type ?? "").localeCompare(b.type ?? "", "fr") ||
          (a.niveau_requis ?? 0) - (b.niveau_requis ?? 0) ||
          (a.nom ?? "").localeCompare(b.nom ?? "", "fr"),
      );
    },
    enabled: !!personnageId,
  });

  const { data: artisanatEtat } = useQuery({
    queryKey: ["artisanat-etat", personnageId],
    queryFn: async () => {
      const { data } = await clientActif.lireFicheArtisanatEtat(personnageId!);
      return (data as ArtisanatEtat) ?? null;
    },
    enabled: !!personnageId,
  });

  const { data: manipulations } = useQuery({
    queryKey: ["manipulations-alchimiques", artisanatEtat?.niveau_alchimie],
    queryFn: async () => {
      const { data } = await clientActif.lireFicheManipulations(artisanatEtat?.niveau_alchimie ?? 0);
      return (data ?? []) as ManipulationAlchimique[];
    },
    enabled: !!(artisanatEtat?.niveau_alchimie && artisanatEtat.niveau_alchimie >= 1),
  });

  // s299 v2 — fusion fabrication & réparation : jointure imbriquée vers
  // reparations_forge (remplace l'ancienne requête séparée sur cette table).
  // Clé de cache distincte de l'étape 9 du wizard (["objets-forge"], select *).
  const { data: objetsForge } = useQuery({
    queryKey: ["objets-forge-fiche"],
    queryFn: async () => {
      const { data } = await clientActif.lireFicheObjetsForge();
      return (data ?? []) as ObjetForge[];
    },
    enabled: !!(artisanatEtat?.niveau_forge && artisanatEtat.niveau_forge >= 1),
  });

  const { data: objetsJoaillerie } = useQuery({
    queryKey: ["objets-joaillerie"],
    queryFn: async () => {
      const { data } = await clientActif.lireFicheObjetsJoaillerie();
      return (data ?? []) as ObjetJoaillerie[];
    },
    enabled: !!(artisanatEtat?.niveau_joaillerie && artisanatEtat.niveau_joaillerie >= 1),
  });

  // PR-4 — Pièges : catalogue + possession (lecture seule, mirror étape 9)
  const { data: piegesCatalogue } = useQuery({
    queryKey: ["pieges-catalogue-fiche", artisanatEtat?.niveau_pieges],
    queryFn: async () => {
      const { data } = await clientActif.lireFichePiegesCatalogue(artisanatEtat?.niveau_pieges ?? 0);
      return (data ?? []) as PiegeRow[];
    },
    enabled: !!(artisanatEtat?.niveau_pieges && artisanatEtat.niveau_pieges >= 1),
  });

  const { data: personnagePieges } = useQuery({
    queryKey: ["personnage-pieges-fiche", personnageId],
    queryFn: async () => {
      const { data } = await clientActif.lireFichePieges(personnageId!);
      return (data ?? []) as PersonnagePiegeRow[];
    },
    enabled: !!personnageId && !!(artisanatEtat?.niveau_pieges && artisanatEtat.niveau_pieges >= 1),
  });

  const { data: langues } = useQuery({
    queryKey: ["langues-fiche"],
    queryFn: async () => {
      const { data, error } = await clientActif.lireFicheLangues();
      if (error) throw error;
      return (data ?? []) as Pick<LangueRow, "id" | "nom">[];
    },
  });

  const { data: religions } = useQuery({
    queryKey: ["religions-fiche"],
    queryFn: async () => {
      const { data, error } = await clientActif.lireFicheReligions();
      if (error) throw error;
      return (data ?? []) as ReligionRow[];
    },
  });

  // M3a PR-C1 : état d'édition (cache partagé avec BoutonRemodeler via ["etat-edition"]).
  // Sert aux bandeaux lecture seule gelé / mort sur la fiche route.
  const { data: etatEdition } = useQuery<{
    etat: string;
    raison: string;
    evenement_bloquant_id: string | null;
    demande_mort_epitaphe: string | null;
  } | null>({
    queryKey: ["etat-edition", personnageId],
    enabled: mode === "route" && !!personnageId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("etat_edition_personnage", {
        p_personnage_id: personnageId,
      });
      if (error) throw error;
      return (data ?? null) as {
        etat: string;
        raison: string;
        evenement_bloquant_id: string | null;
        demande_mort_epitaphe: string | null;
      } | null;
    },
  });

  // Événement bloquant (seulement si gelé) — RLS lecture joueurs sur est_publie.
  const evenementBloquantId = etatEdition?.evenement_bloquant_id ?? null;
  const { data: evenementBloquant } = useQuery({
    queryKey: ["evenement-bloquant", evenementBloquantId],
    enabled: !!evenementBloquantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evenements")
        .select("titre, date_evenement")
        .eq("id", evenementBloquantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // CIMETIÈRE — l'état « demande en attente » provient de etat_edition (etat='mort_en_attente').
  // La stèle vit dans `cimetiere` (statut en_attente), cachée du public.

  // A vécu au moins un événement (statut 'present') ? Condition d'admissibilité.
  const { data: aVecuEvenement } = useQuery({
    queryKey: ["a-vecu-evenement", personnageId],
    enabled: mode === "route" && !!personnageId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("inscriptions_evenements")
        .select("id", { count: "exact", head: true })
        .eq("personnage_id", personnageId!)
        .eq("statut", "present");
      if (error) throw error;
      return (count ?? 0) > 0;
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
          competence_resume_condense: c.competence_resume_condense,
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

  // CIMETIÈRE PR2 — état local du formulaire « Demander la mort ».
  const [epitapheMort, setEpitapheMort] = useState("");
  const [mortConfirmee, setMortConfirmee] = useState(false);
  const [envoiMort, setEnvoiMort] = useState(false);
  const handleDemanderMort = async () => {
    if (!fiche || !mortConfirmee) return;
    setEnvoiMort(true);
    try {
      const { data, error } = await supabase.rpc("creer_demande_mort", {
        p_personnage_id: fiche.id,
        p_epitaphe: epitapheMort.trim(),
      });
      if (error) throw error;
      const res = data as { succes: boolean; erreur?: string; message?: string };
      if (!res?.succes) {
        toast.error(res?.erreur ?? "Impossible d'envoyer la demande.");
        return;
      }
      toast.success(res.message ?? "Demande envoyée. Le staff va l'examiner.");
      setEpitapheMort("");
      setMortConfirmee(false);
      await queryClient.invalidateQueries({ queryKey: ["etat-edition", personnageId] });
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'envoi de la demande.");
    } finally {
      setEnvoiMort(false);
    }
  };

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
      {mode === "route" && etatEdition?.etat === "gele" && (
        <div className="flex items-start gap-3 rounded-lg border border-sky-700/50 bg-sky-900/20 px-4 py-3">
          <Snowflake className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
          <div className="min-w-0">
            <p className="font-heading text-sm font-bold text-sky-300">Fiche gelée</p>
            <p className="mt-0.5 text-sm text-foreground/85">
              {evenementBloquant?.titre ? (
                <>Inscrit à <b>{evenementBloquant.titre}</b>
                {evenementBloquant.date_evenement
                  ? ` (${new Date(evenementBloquant.date_evenement).toLocaleDateString("fr-CA")})`
                  : ""}. </>
              ) : null}
              La fiche sera de nouveau modifiable après la clôture de l'événement.
            </p>
          </div>
        </div>
      )}
      {mode === "route" && etatEdition?.etat === "mort" && (
        <div className="flex items-start gap-3 rounded-lg border border-red-800/50 bg-red-950/25 px-4 py-3">
          <Skull className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <p className="font-heading text-sm font-bold text-red-300">Personnage mort</p>
            <p className="mt-0.5 text-sm text-foreground/85">
              Cette fiche est conservée en mémoire, en lecture seule.
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-4xl font-bold text-primary break-words">{fiche.nom}</h1>
          <p className="text-muted-foreground mt-1">
            {fiche.race_nom} {fiche.race_nom_latin && <span className="italic">({fiche.race_nom_latin})</span>} • {fiche.classe_nom} • Niveau {fiche.niveau}
          </p>
        </div>
        {/* Impression réservée aux comptes connectés (fiche route ET récap du
            wizard connecté /createur). En MODE VISITEUR (URL /visiteur ou build
            hors-ligne), décision s320 : pas de bouton Imprimer — on pousse vers
            la création de compte sur le site (sauvegarde en ligne). Inverse
            partiellement [P4] s314. L'onglet Export reste gardé mode==='route'. */}
        {!estModeVisiteur() ? (
          <div className="flex gap-2 flex-wrap sm:justify-end">
            <Button onClick={() => triggerPrint('fiche')} variant="outline" size="sm" className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimer (Abrégé)
            </Button>
            <Button onClick={() => triggerPrint('manuel')} variant="outline" size="sm" className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimer (Intégral)
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground sm:max-w-xs sm:text-right">
            Pour sauvegarder ou imprimer votre personnage, créez un compte sur{" "}
            <a
              href={URL_SITE}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              le site officiel
            </a>
            .
          </p>
        )}
      </div>

      {/* s299 — rappel fouille tout en haut, puis bascule canon, visibles dans
          TOUS les modes (route ET embarqué wizard/admin). */}
      <RappelFouille />
      <BasculeAbregeIntegral mode={modeAffichage} onToggle={toggleMode} />

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
          <RaceClasseCard fiche={fiche} />
          <InfosCard fiche={fiche} xpDisponible={xpDisponible} />
          {!estModeVisiteur() && (
            <BanqueXpCard
              joueurId={fiche.joueur_id}
              personnageId={fiche.id}
              personnageNom={fiche.nom}
              isOwner={peutEditer}
            />
          )}
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
                    isManuelOpen={religionManuelOuvert}
                    onToggleManuel={() => setReligionManuelOuvert((o) => !o)}
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
                  Imprimer (Abrégé)
                </Button>
                <Button onClick={() => triggerPrint('manuel')} variant="outline" className="w-full gap-2">
                  <Printer className="h-4 w-4" />
                  Imprimer (Intégral)
                </Button>
                <p className="text-xs text-muted-foreground">
                  <strong>Abrégé</strong> : résumés de jeu, feuille compacte pour le terrain.{" "}
                  <strong>Intégral</strong> : texte verbatim complet du manuel.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {mode === "route" && isOwner && etatEdition?.etat !== "mort" && (
        <>
          {etatEdition?.etat === "mort_en_attente" ? (
            <div className="rounded-xl border border-gold/35 bg-card p-4 flex gap-3 items-start">
              <span className="text-xl mt-0.5">⏳</span>
              <div className="min-w-0">
                <p className="font-heading font-bold text-gold">Demande de mort en attente</p>
                <p className="mt-1.5 text-sm text-foreground/90">
                  Un animateur examinera bientôt ta demande pour <b>{fiche.nom}</b>. Tu seras notifié de la décision.
                </p>
                {etatEdition?.demande_mort_epitaphe && (
                  <p className="mt-2.5 border-l-2 border-gold pl-3 text-sm italic text-muted-foreground">
                    « {etatEdition.demande_mort_epitaphe} »
                  </p>
                )}
              </div>
            </div>
          ) : !aVecuEvenement ? (
            <div className="rounded-xl border border-border bg-card p-4 flex gap-3 items-start opacity-90">
              <Skull className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
              <div className="min-w-0">
                <p className="font-heading font-bold text-muted-foreground">Faire mourir ce personnage</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Tu pourras demander la mort de ce personnage <b>après avoir vécu au moins un événement</b> (GN).
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-red-800/50 bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-3 flex items-center gap-2">
                <Skull className="h-5 w-5 shrink-0 text-red-400" />
                <h3 className="font-heading font-bold text-red-300">Faire mourir ce personnage</h3>
              </div>
              <div className="px-4 py-4 space-y-4">
                <p className="text-sm text-foreground/90 leading-relaxed">
                  Demander que <b>{fiche.nom}</b> rejoigne le <b>Cimetière des Héros</b>. Un animateur examinera ta
                  demande ; une fois approuvée, la fiche devient <b>définitivement en lecture seule</b> et une stèle
                  commémorative est créée.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Épitaphe (facultatif) — quelques mots gravés sur la stèle
                  </label>
                  <Textarea
                    value={epitapheMort}
                    onChange={(e) => setEpitapheMort(e.target.value.slice(0, 280))}
                    placeholder="« Tombé en défendant le pont de Glaceval… »"
                    rows={3}
                  />
                  <p className="text-[11px] text-muted-foreground text-right">{epitapheMort.length}/280</p>
                </div>
                <div className="flex gap-2.5 items-start rounded-lg border border-red-800/50 bg-red-950/25 px-3 py-2.5">
                  <span className="text-red-300 mt-0.5">⚠️</span>
                  <p className="text-xs text-foreground/90 leading-snug">
                    Action <b>définitive</b>. Le personnage ne pourra plus gagner d'XP, ni être modifié, ni revenir en jeu.
                  </p>
                </div>
                <label className="flex gap-2.5 items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mortConfirmee}
                    onChange={(e) => setMortConfirmee(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-red-700"
                  />
                  <span className="text-sm text-foreground/90">
                    Je comprends que cette demande est <b>définitive</b>.
                  </span>
                </label>
                <Button
                  variant="destructive"
                  disabled={!mortConfirmee || envoiMort}
                  onClick={handleDemanderMort}
                  className="gap-2"
                >
                  <Skull className="h-4 w-4" />
                  {envoiMort ? "Envoi…" : "Demander la mort"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Monté dans les 2 modes (route + wizard-preview visiteur). `.fp-root` est
          display:none hors impression → ne pollue pas le récap à l'écran. */}
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
        objetsJoaillerie={objetsJoaillerie ?? []}
        artisanatEtat={artisanatEtat ?? null}
        piegesCatalogue={piegesCatalogue ?? []}
        personnagePieges={personnagePieges ?? []}
        langues={langues}
        religions={religions}
      />
    </div>
  );
};

export default FichePersonnageView;

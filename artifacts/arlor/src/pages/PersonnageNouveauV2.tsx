import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, User, Fingerprint, Sparkles, Swords, Star, Wand2, Sun, Shapes,
  Hammer, ClipboardCheck, AlertTriangle, Coins, TrendingUp,
} from "lucide-react";

import { supabase, setCanalAdmin } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfil } from "@/contexts/ProfilContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import StepperEtapes, { type EtapeDef } from "@/components/createur/StepperEtapes";
import DrawerAjusterXp from "@/components/createur/DrawerAjusterXp";

import Etape1_V2 from "@/components/createur/etapes/Etape1_V2";
import Etape2_V2 from "@/components/createur/etapes/Etape2_V2";
import Etape3_V2 from "@/components/createur/etapes/Etape3_V2";
import Etape4_V2 from "@/components/createur/etapes/Etape4_V2";
import Etape5_Competences_V2 from "@/components/createur/etapes/Etape5_Competences_V2";
import Etape6_Sorts_V2 from "@/components/createur/etapes/Etape6_Sorts_V2";
import Etape7_Prieres_V2 from "@/components/createur/etapes/Etape7_Prieres_V2";
import Etape8_Assemblages_V2 from "@/components/createur/etapes/Etape8_Assemblages_V2";
import Etape9_Artisanat_V2 from "@/components/createur/etapes/Etape9_Artisanat_V2";
import Etape10_Recapitulatif_V2 from "@/components/createur/etapes/Etape10_Recapitulatif_V2";

const TOTAL_STEPS = 10;

const ETAPES_DEF: EtapeDef[] = [
  { n: 1, t: "Identité", Icon: User },
  { n: 2, t: "Race", Icon: Fingerprint },
  { n: 3, t: "Traits", Icon: Sparkles },
  { n: 4, t: "Classe", Icon: Swords },
  { n: 5, t: "Compétences", Icon: Star },
  { n: 6, t: "Sorts", Icon: Wand2 },
  { n: 7, t: "Prières", Icon: Sun },
  { n: 8, t: "Assemblages", Icon: Shapes },
  { n: 9, t: "Artisanat", Icon: Hammer },
  { n: 10, t: "Récap", Icon: ClipboardCheck },
];

interface PersonnageRow {
  id: string;
  nom: string | null;
  etape_creation: number;
  xp_total: number | null;
  xp_depense: number | null;
}

export interface EtapeProps {
  personnageId: string;
  onSuccess: () => void;
  onPrevious?: () => void;
  onXpDeltaChange?: (delta: number) => void;
  onXpGainChange?: (gain: number) => void;
}

const PersonnageNouveauV2 = () => {
  const { user, role, loading: authLoading } = useAuth();
  const { joueurId, rechargerProfils } = useProfil();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // ?id= : reprise / modification d'un personnage précis depuis le tableau
  // de bord. Si présent, on NE passe PAS par demarrer_creation_personnage.
  const personnageIdParUrl = searchParams.get("id");

  // ÉDITION-ADMIN-WIZARD : un admin peut ouvrir l'éditeur complet d'un perso
  // finalisé (?admin=1). Le gate backend est contourné côté serveur (s141).
  const modeAdmin = role === "admin" && searchParams.get("admin") === "1";

  const [personnageId, setPersonnageId] = useState<string | null>(null);
  const [etape, setEtape] = useState<number>(1);
  const [xpDeltaCourant, setXpDeltaCourant] = useState<number>(0);
  const [xpGainCourant, setXpGainCourant] = useState<number>(0);
  const [demarrage, setDemarrage] = useState(true);
  const [erreurDemarrage, setErreurDemarrage] = useState<string | null>(null);
  const [xpDrawerOpen, setXpDrawerOpen] = useState(false);
  // Étape initiale positionnée une seule fois (cas reprise via ?id=) :
  // ne jamais ré-écraser la navigation manuelle de l'utilisateur ensuite.
  const [etapeInitialisee, setEtapeInitialisee] = useState(false);

  // AUDIT-ADMIN-MODE-ROLE : en admin mode, marquer le canal pour que les
  // actions auditées soient taguées « admin » (visibles au feed staff),
  // même sur son propre perso. Retiré au démontage / sortie d'admin mode.
  useEffect(() => {
    setCanalAdmin(modeAdmin);
    return () => setCanalAdmin(false);
  }, [modeAdmin]);

  // 1) Démarrage : soit reprise d'un personnage précis (?id=),
  //    soit création / récupération du brouillon unique.
  useEffect(() => {
    if (authLoading || !user || !joueurId) return;
    if (personnageId) return; // garde anti double-démarrage
    let annule = false;

    // Cas A — reprise via ?id= (bouton « Continuer / Modifier » du tableau
    // de bord). On prend l'id tel quel ; l'ownership est garanti par la RLS
    // sur « personnages » (le SELECT de la query "v2-personnage" lèvera une
    // erreur si le personnage n'appartient pas au joueur).
    if (personnageIdParUrl) {
      setPersonnageId(personnageIdParUrl);
      setDemarrage(false);
      return;
    }

    // Cas B — création / reprise du brouillon unique.
    const demarrer = async () => {
      setDemarrage(true);
      setErreurDemarrage(null);

      const { data, error } = await supabase.rpc("demarrer_creation_personnage", { p_profil_id: joueurId });

      if (annule) return;

      if (error) {
        console.error("[V2] demarrer_creation_personnage error:", error);
        setErreurDemarrage(error.message);
        toast.error(`Impossible de démarrer la création : ${error.message}`);
        setDemarrage(false);
        return;
      }

      const payload = (data ?? {}) as Record<string, any>;
      const succes = payload.succes === true;
      const code = (payload.erreurs?.[0]?.code ?? payload.code) as string | undefined;
      const personnage_id = payload.donnees?.personnage_id as string | undefined;
      const etape_courante = (payload.donnees?.etape_creation as number | undefined) ?? 1;

      // On accepte uniquement : succès explicite OU brouillon existant.
      const succesExplicite = succes === true && !!personnage_id;
      const brouillonExistant =
        succes === false && code === "brouillon_existant" && !!personnage_id;

      if (succesExplicite || brouillonExistant) {
        setPersonnageId(personnage_id!);
        setEtape(Math.max(1, Math.min(etape_courante, TOTAL_STEPS)));
        setEtapeInitialisee(true);
        setDemarrage(false);
        return;
      }

      const msg =
        (payload.message as string | undefined) ??
        `Démarrage refusé${code ? ` (${code})` : ""}.`;
      setErreurDemarrage(msg);
      toast.error(msg);
      setDemarrage(false);
    };

    demarrer();
    return () => {
      annule = true;
    };
  }, [authLoading, user?.id, joueurId, personnageIdParUrl]);

  // 2) État du personnage (XP, étape) — rafraîchi après chaque mutation
  const { data: personnage, error: erreurPersonnage } =
    useQuery<PersonnageRow | null>({
      queryKey: ["v2-personnage", personnageId],
      enabled: !!personnageId,
      queryFn: async () => {
        const { data, error } = await supabase
          .from("personnages")
          .select("id, nom, etape_creation, xp_total, xp_depense")
          .eq("id", personnageId!)
          .single();
        if (error) throw error;
        return data as PersonnageRow;
      },
    });

  // État courant (gele / campagne / …) — toujours actif (cache partagé avec
  // BoutonRemodeler et FichePersonnageView via la queryKey ["etat-edition"]).
  // On garde la même forme d'objet que BoutonRemodeler pour ne pas corrompre le
  // cache partagé (le bouton « Faire évoluer » remplit ce cache juste avant la
  // navigation vers le wizard) ; on lit l'état via .etat.
  const { data: etatEditionData, isPending: etatPending } = useQuery<{
    etat: string | null;
  } | null>({
    queryKey: ["etat-edition", personnageId],
    enabled: !!personnageId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("etat_edition_personnage", {
        p_personnage_id: personnageId!,
      });
      if (error) throw error;
      return (data ?? null) as { etat: string | null } | null;
    },
  });
  const etatEdition = etatEditionData?.etat ?? null;

  // M3a PR-C1 : mode évolution de campagne — détecté par l'ÉTAT en base,
  // jamais par un paramètre d'URL (non truquable). Le mode admin prime.
  const modeCampagne = !modeAdmin && etatEdition === "campagne";

  // ÉDITION-ADMIN-WIZARD : sortie propre de l'éditeur admin (retour fiche).
  const terminerEditionAdmin = () => {
    if (personnageId) navigate(`/personnage/${personnageId}`);
  };

  // Redirect automatique : si le personnage est finalisé (etape_creation > TOTAL_STEPS),
  // on bascule vers la fiche read-only — SAUF en mode admin, où l'on reste dans
  // l'éditeur complet pour modifier le perso finalisé en place.
  useEffect(() => {
    if (modeAdmin) return;
    if (!personnage || personnage.etape_creation <= TOTAL_STEPS) return;
    // Perso finalisé : attendre de connaître l'état avant de décider (la query
    // état est async ; sans cette garde, un perso campagne serait éjecté vers
    // la fiche avant que modeCampagne soit connu).
    if (etatPending) return;
    if (etatEdition === "campagne") return; // mode évolution : on reste.
    toast.info(
      "Ce personnage est finalisé. Utilise « Remodeler » depuis sa fiche pour le modifier.",
    );
    navigate(`/personnage/${personnage.id}`, { replace: true });
  }, [personnage, navigate, modeAdmin, etatPending, etatEdition]);

  // 1b) Reprise via ?id= : positionner l'étape initiale, une seule fois
  //     (ne pas écraser la navigation manuelle ensuite).
  //     - Brouillon (etape_creation <= TOTAL_STEPS) : reprendre où le joueur
  //       en était (« Continuer la création »).
  //     - Perso finalisé (campagne / remodelage_libre, etape_creation >
  //       TOTAL_STEPS) : repartir de l'étape 1 (parcours de remodelage /
  //       évolution complet), pas du récapitulatif.
  useEffect(() => {
    if (etapeInitialisee) return;
    if (!personnageIdParUrl) return;
    if (!personnage) return;
    const finalise = (personnage.etape_creation ?? 1) > TOTAL_STEPS;
    const cible = finalise
      ? 1
      : Math.max(1, Math.min(personnage.etape_creation ?? 1, TOTAL_STEPS));
    setEtape(cible);
    setEtapeInitialisee(true);
  }, [etapeInitialisee, personnageIdParUrl, personnage]);

  useEffect(() => {
    setXpDeltaCourant(0);
    setXpGainCourant(0);
  }, [etape]);

  // SCROLL-TO-TOP : remonter en haut du wizard à chaque changement d'étape.
  // Les étapes sont du state (setEtape), pas une route → le ScrollToTop global
  // (basé sur pathname) ne se déclenche pas ici.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [etape]);

  const xpTotal = personnage?.xp_total ?? 0;
  const xpDepense = personnage?.xp_depense ?? 0;
  const xpTotalAffiche = xpTotal + xpGainCourant;
  const xpDisponible = xpTotalAffiche - xpDepense - xpDeltaCourant;

  const progression = useMemo(
    () => Math.round((etape / TOTAL_STEPS) * 100),
    [etape]
  );

  // M3a PR-C1 : en campagne, race (2), stats (3) et classe (4) sont figées.
  const ETAPES_VERROUILLEES_CAMPAGNE = [2, 3, 4];
  const etapeVerrouillee = (n: number) =>
    modeCampagne && ETAPES_VERROUILLEES_CAMPAGNE.includes(n);

  // Étape la plus avancée atteinte : étapes <= etapeMax cliquables dans le stepper.
  // En mode admin OU campagne (perso finalisé), toutes les étapes sont accessibles.
  const etapeMax = modeAdmin || modeCampagne
    ? TOTAL_STEPS
    : Math.max(etape, Math.min(personnage?.etape_creation ?? 1, TOTAL_STEPS));
  const sauterEtape = (n: number) => {
    if (etapeVerrouillee(n)) return;
    if (n >= 1 && n <= etapeMax) setEtape(n);
  };

  const handleEtapeSuccess = async () => {
    // Recharger l'état serveur et faire confiance à etape_creation
    const result = await queryClient.fetchQuery<PersonnageRow>({
      queryKey: ["v2-personnage", personnageId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("personnages")
          .select("id, nom, etape_creation, xp_total, xp_depense")
          .eq("id", personnageId!)
          .single();
        if (error) throw error;
        return data as PersonnageRow;
      },
    });

    // ÉDITION-ADMIN-WIZARD / campagne : un perso finalisé a etape_creation >
    // TOTAL_STEPS. On ne quitte pas l'éditeur : on avance via le stepper, en
    // sautant les étapes verrouillées (campagne) au passage.
    if (modeAdmin || modeCampagne) {
      setEtape((e) => {
        let n = Math.min(e + 1, TOTAL_STEPS);
        while (etapeVerrouillee(n) && n < TOTAL_STEPS) n += 1;
        return n;
      });
      return;
    }

    // Personnage finalisé (étape 10 → 11) : sortir du wizard.
    // Le toast de succès est déjà affiché par Etape10_Recapitulatif_V2.
    if ((result.etape_creation ?? 0) > TOTAL_STEPS) {
      // Nouveau perso finalisé : rafraîchir les compteurs de profils (écran « Qui joue ? »).
      void rechargerProfils();
      navigate("/tableau-de-bord");
      return;
    }

    const cible = Math.max(1, Math.min(result.etape_creation ?? etape + 1, TOTAL_STEPS));
    setEtape(cible);
  };

  // Précédent = simple navigation. Aucune sauvegarde ni remboursement :
  // le retrait d'achats passe uniquement par le désachat par item (cascade).
  const handlePrevious = () => {
    setEtape((e) => {
      let n = e - 1;
      while (n > 1 && etapeVerrouillee(n)) n -= 1;
      return Math.max(1, n);
    });
  };


  // -- Rendus de chargement / erreur ----------------------------------------
  // Cas reprise via ?id= : on attend que l'étape initiale soit positionnée
  // (ou qu'une erreur de chargement survienne) avant d'afficher le wizard.
  const enAttenteEtapeInitiale =
    !!personnageIdParUrl && !etapeInitialisee && !erreurPersonnage;

  if (authLoading || demarrage || enAttenteEtapeInitiale) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white/60">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Préparation du créateur de personnage…
      </div>
    );
  }

  const messageErreurFatale =
    erreurDemarrage ??
    (personnageIdParUrl && erreurPersonnage
      ? `Personnage introuvable ou inaccessible : ${erreurPersonnage.message}`
      : null);

  if (messageErreurFatale || !personnageId) {
    return (
      <div className="mx-auto mt-12 max-w-xl space-y-4 rounded-lg border border-red-700/50 bg-red-950/30 p-6 text-red-100">
        <h2 className="text-xl font-heading text-red-200">
          Création indisponible
        </h2>
        <p className="text-sm">
          {messageErreurFatale ?? "Brouillon introuvable."}
        </p>
        <Button variant="outline" onClick={() => navigate("/tableau-de-bord")}>
          Retour au tableau de bord
        </Button>
      </div>
    );
  }

  // -- Rendu principal -------------------------------------------------------
  return (
    <>
      {/* ÉDITION-ADMIN-WIZARD : bandeau sticky d'indication + actions admin */}
      {modeAdmin && (
        <div className="sticky top-0 z-20 border-b border-bordeaux bg-bordeaux px-4 py-3">
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-white" />
            <div className="min-w-0 flex-1">
              <p className="font-heading text-sm font-bold text-white">
                ÉDITION ADMIN — {personnage?.nom ?? "Personnage"}
              </p>
              <p className="text-xs text-white/85">
                Verrous d'état contournés · l'état reste{" "}
                <b>{etatEdition ?? "…"}</b> · chaque achat est journalisé.
              </p>
            </div>
            <div className="grid shrink-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={terminerEditionAdmin}
                className="gap-2 border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                ← Terminer
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setXpDrawerOpen(true)}
                className="gap-2 border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Coins className="h-4 w-4" /> Ajuster XP
              </Button>
            </div>
          </div>
        </div>
      )}

      {modeCampagne && (
        <div className="sticky top-0 z-20 border-b border-gold/40 bg-gold/10 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <TrendingUp className="h-5 w-5 shrink-0 text-gold-accent" />
            <div className="min-w-0 flex-1">
              <p className="font-heading text-sm font-bold text-gold-accent">
                ÉVOLUTION DE CAMPAGNE — {personnage?.nom ?? "Personnage"}
              </p>
              <p className="text-xs text-foreground/80">
                Ajouts et améliorations uniquement. Ce qui a été joué en
                événement reste acquis.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/personnage/${personnageId}`)}
              className="shrink-0 gap-2"
            >
              ← Terminer
            </Button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        {/* En-tête : progression + XP */}
        <header className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-heading text-3xl text-gold">
                {modeCampagne ? "Évolution du personnage" : "Création de personnage"}
              </h1>
              <p className="text-sm text-white/50">
                Étape {etape} / {TOTAL_STEPS}
                {personnage?.nom ? ` — ${personnage.nom}` : ""}
              </p>
            </div>

            <div className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-2 text-right">
              <div className="text-[10px] uppercase tracking-widest text-gold/60">
                XP disponible
              </div>
              <div className="font-heading text-2xl text-gold">
                {xpDisponible}
              </div>
              <div className="text-[11px] text-white/50">
                {xpDepense} dépensés / {xpTotalAffiche} totaux
              </div>
            </div>
          </div>

          <Progress value={progression} className="h-2" />

          <StepperEtapes
            etapes={ETAPES_DEF}
            courant={etape}
            max={etapeMax}
            onJump={sauterEtape}
            verrouillees={modeCampagne ? ETAPES_VERROUILLEES_CAMPAGNE : []}
          />
        </header>

        {/* Contenu de l'étape */}
        <main className="rounded-xl border border-white/10 bg-black/30 p-6 shadow-lg">
          {etape === 1 && (
            <Etape1_V2
              personnageId={personnageId}
              onSuccess={handleEtapeSuccess}
              onXpGainChange={setXpGainCourant}
              modeCampagne={modeCampagne}
            />
          )}
          {etape === 2 && (
            <Etape2_V2
              personnageId={personnageId}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
            />
          )}
          {etape === 3 && (
            <Etape3_V2
              personnageId={personnageId}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
              onXpDeltaChange={setXpDeltaCourant}
            />
          )}
          {etape === 4 && (
            <Etape4_V2
              personnageId={personnageId}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
            />
          )}
          {etape === 5 && (
            <Etape5_Competences_V2
              personnageId={personnageId}
              xpDisponible={xpDisponible}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
              onXpDeltaChange={setXpDeltaCourant}
              modeCampagne={modeCampagne}
            />
          )}
          {etape === 6 && (
            <Etape6_Sorts_V2
              personnageId={personnageId}
              etapeCreation={personnage?.etape_creation ?? 0}
              xpDisponible={xpDisponible}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
              modeCampagne={modeCampagne}
            />
          )}
          {etape === 7 && (
            <Etape7_Prieres_V2
              personnageId={personnageId}
              etapeCreation={personnage?.etape_creation ?? 0}
              xpDisponible={xpDisponible}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
              modeCampagne={modeCampagne}
            />
          )}
          {etape === 8 && (
            <Etape8_Assemblages_V2
              personnageId={personnageId}
              etapeCreation={personnage?.etape_creation ?? 0}
              xpDisponible={xpDisponible}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
              modeCampagne={modeCampagne}
            />
          )}
          {etape === 9 && (
            <Etape9_Artisanat_V2
              personnageId={personnageId}
              etapeCreation={personnage?.etape_creation ?? 0}
              xpDisponible={xpDisponible}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
              modeCampagne={modeCampagne}
            />
          )}
          {etape === 10 && (
            <Etape10_Recapitulatif_V2
              personnageId={personnageId}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
              modeAdmin={modeAdmin}
              onTerminerAdmin={terminerEditionAdmin}
              modeCampagne={modeCampagne}
              onTerminerCampagne={() => navigate(`/personnage/${personnageId}`)}
            />
          )}
        </main>
      </div>

      {modeAdmin && (
        <DrawerAjusterXp
          personnageId={personnageId}
          nom={personnage?.nom ?? null}
          xpTotal={xpTotal}
          xpDepense={xpDepense}
          open={xpDrawerOpen}
          onOpenChange={setXpDrawerOpen}
        />
      )}
    </>
  );
};

export default PersonnageNouveauV2;

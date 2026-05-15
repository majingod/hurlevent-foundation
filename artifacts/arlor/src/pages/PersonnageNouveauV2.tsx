import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

import Etape1_V2 from "@/components/createur/etapes/Etape1_V2";
import Etape2_V2 from "@/components/createur/etapes/Etape2_V2";
import Etape3_V2 from "@/components/createur/etapes/Etape3_V2";
import Etape4_V2 from "@/components/createur/etapes/Etape4_V2";
import Etape5_Competences_V2 from "@/components/createur/etapes/Etape5_Competences_V2";
import Etape6_Sorts_V2 from "@/components/createur/etapes/Etape6_Sorts_V2";
import Etape7_Prieres_V2 from "@/components/createur/etapes/Etape7_Prieres_V2";
import Etape8_Artisanat_V2 from "@/components/createur/etapes/Etape8_Artisanat_V2";
import Etape9_Assemblages_V2 from "@/components/createur/etapes/Etape9_Assemblages_V2";
import Etape10_Historique_V2 from "@/components/createur/etapes/Etape10_Historique_V2";
import Etape11_Recapitulatif_V2 from "@/components/createur/etapes/Etape11_Recapitulatif_V2";

const TOTAL_STEPS = 11;

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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // ?id= : reprise / modification d'un personnage précis depuis le tableau
  // de bord. Si présent, on NE passe PAS par demarrer_creation_personnage.
  const personnageIdParUrl = searchParams.get("id");

  const [personnageId, setPersonnageId] = useState<string | null>(null);
  const [etape, setEtape] = useState<number>(1);
  const [xpDeltaCourant, setXpDeltaCourant] = useState<number>(0);
  const [xpGainCourant, setXpGainCourant] = useState<number>(0);
  const [demarrage, setDemarrage] = useState(true);
  const [erreurDemarrage, setErreurDemarrage] = useState<string | null>(null);
  // Étape initiale positionnée une seule fois (cas reprise via ?id=) :
  // ne jamais ré-écraser la navigation manuelle de l'utilisateur ensuite.
  const [etapeInitialisee, setEtapeInitialisee] = useState(false);

  // 1) Démarrage : soit reprise d'un personnage précis (?id=),
  //    soit création / récupération du brouillon unique.
  useEffect(() => {
    if (authLoading || !user) return;
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

      const { data, error } = await supabase.rpc("demarrer_creation_personnage");

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
  }, [authLoading, user?.id, personnageIdParUrl]);

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

  // 1b) Reprise via ?id= : positionner l'étape initiale sur etape_creation
  //     lu en base, une seule fois (ne pas écraser la navigation manuelle).
  useEffect(() => {
    if (etapeInitialisee) return;
    if (!personnageIdParUrl) return;
    if (!personnage) return;
    const cible = Math.max(
      1,
      Math.min(personnage.etape_creation ?? 1, TOTAL_STEPS)
    );
    setEtape(cible);
    setEtapeInitialisee(true);
  }, [etapeInitialisee, personnageIdParUrl, personnage]);

  useEffect(() => {
    setXpDeltaCourant(0);
    setXpGainCourant(0);
  }, [etape]);

  const xpTotal = personnage?.xp_total ?? 0;
  const xpDepense = personnage?.xp_depense ?? 0;
  const xpTotalAffiche = xpTotal + xpGainCourant;
  const xpDisponible = xpTotalAffiche - xpDepense - xpDeltaCourant;

  const progression = useMemo(
    () => Math.round((etape / TOTAL_STEPS) * 100),
    [etape]
  );

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
    const cible = Math.max(1, Math.min(result.etape_creation ?? etape + 1, TOTAL_STEPS));
    setEtape(cible);
  };

  const handlePrevious = () => {
    setEtape((e) => Math.max(e - 1, 1));
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
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      {/* En-tête : progression + XP */}
      <header className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl text-gold">
              Création de personnage
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
      </header>

      {/* Contenu de l'étape */}
      <main className="rounded-xl border border-white/10 bg-black/30 p-6 shadow-lg">
        {etape === 1 && (
          <Etape1_V2
            personnageId={personnageId}
            onSuccess={handleEtapeSuccess}
            onXpGainChange={setXpGainCourant}
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
            onSuccess={handleEtapeSuccess}
            onPrevious={handlePrevious}
            onXpDeltaChange={setXpDeltaCourant}
          />
        )}
        {etape === 6 && (
          <Etape6_Sorts_V2
            personnageId={personnageId}
            etapeCreation={personnage?.etape_creation ?? 0}
            onSuccess={handleEtapeSuccess}
            onPrevious={handlePrevious}
          />
        )}
        {etape === 7 && (
          <Etape7_Prieres_V2
            personnageId={personnageId}
            etapeCreation={personnage?.etape_creation ?? 0}
            onSuccess={handleEtapeSuccess}
            onPrevious={handlePrevious}
          />
        )}
        {etape === 8 && (
          <Etape8_Artisanat_V2
            personnageId={personnageId}
            etapeCreation={personnage?.etape_creation ?? 0}
            onSuccess={handleEtapeSuccess}
            onPrevious={handlePrevious}
          />
        )}
        {etape === 9 && (
          <Etape9_Assemblages_V2
            personnageId={personnageId}
            etapeCreation={personnage?.etape_creation ?? 0}
            onSuccess={handleEtapeSuccess}
            onPrevious={handlePrevious}
          />
        )}
        {etape === 10 && (
          <Etape10_Historique_V2
            personnageId={personnageId}
            onSuccess={handleEtapeSuccess}
            onPrevious={handlePrevious}
          />
        )}
        {etape === 11 && (
          <Etape11_Recapitulatif_V2
            personnageId={personnageId}
            onSuccess={handleEtapeSuccess}
            onPrevious={handlePrevious}
          />
        )}
      </main>
    </div>
  );
};

export default PersonnageNouveauV2;

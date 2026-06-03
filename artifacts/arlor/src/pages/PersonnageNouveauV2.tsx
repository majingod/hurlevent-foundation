import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

interface PersonnageRow {
  id: string;
  nom: string | null;
  etape_creation: number;
  xp_total: number | null;
  xp_depense: number | null;
}

interface ItemDetailAnnulation {
  type: string;
  type_label: string;
  nom: string;
  quantite: number;
  xp_unitaire: number;
  xp_total: number;
}

interface DonneesAnnulationEtape {
  etape_annulee: number;
  etape_apres: number;
  xp_rembourse: number;
  count_competences: number;
  count_sorts: number;
  count_prieres: number;
  count_assemblages: number;
  count_recettes: number;
  count_objets_forge: number;
  count_objets_joaillerie: number;
  items_detail: ItemDetailAnnulation[];
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
  // Etape la plus haute jamais atteinte dans cette session. Ne diminue jamais.
  // Sert a desactiver l'auto-skip si l'utilisateur revient en arriere : on
  // ne veut pas qu'une etape sans prerequis (ex. etape 7 sans prêtre)
  // re-skipe automatiquement vers l'avant alors que le joueur essaie de
  // remonter le wizard.
  const [etapeMaxAtteinte, setEtapeMaxAtteinte] = useState<number>(1);
  const [xpDeltaCourant, setXpDeltaCourant] = useState<number>(0);
  const [xpGainCourant, setXpGainCourant] = useState<number>(0);
  const [demarrage, setDemarrage] = useState(true);
  const [erreurDemarrage, setErreurDemarrage] = useState<string | null>(null);
  // Étape initiale positionnée une seule fois (cas reprise via ?id=) :
  // ne jamais ré-écraser la navigation manuelle de l'utilisateur ensuite.
  const [etapeInitialisee, setEtapeInitialisee] = useState(false);

  // Cat 2 voie A — modale de confirmation pour annuler l'étape courante.
  // `donneesAnnulation` non-null = modale ouverte avec les counts du dry_run.
  const [donneesAnnulation, setDonneesAnnulation] =
    useState<DonneesAnnulationEtape | null>(null);
  const [annulationEnCours, setAnnulationEnCours] = useState(false);

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

  // Redirect automatique : si le personnage est finalisé (etape_creation > TOTAL_STEPS),
  // on bascule vers la fiche read-only. La modification post-finalisation (achats inter-événements)
  // sera implémentée dans le chantier section 8.
  useEffect(() => {
    if (personnage && personnage.etape_creation > TOTAL_STEPS) {
      toast.info(
        "Ce personnage est finalisé. La modification post-finalisation arrivera bientôt.",
      );
      navigate(`/personnage/${personnage.id}`, { replace: true });
    }
  }, [personnage, navigate]);

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

  // Maintient etapeMaxAtteinte = max(etapeMaxAtteinte, etape). Augmente
  // jamais autrement. Ne diminue jamais (pas de reset).
  useEffect(() => {
    setEtapeMaxAtteinte((m) => Math.max(m, etape));
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

  // Hybride 4 (s99) : l'auto-skip silencieux des étapes vides est désactivé.
  // Quand une étape (Sorts/Prières/Assemblages/Artisanat) n'a rien à proposer,
  // le wizard affiche désormais l'empty-state explicite avec son bouton
  // « Suivant » au lieu de sauter en silence (corrige le saut muet 5→10).
  const autoSkipActif = false;

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

    // Personnage finalisé (étape 10 → 11) : sortir du wizard.
    // Le toast de succès est déjà affiché par Etape10_Recapitulatif_V2.
    if ((result.etape_creation ?? 0) > TOTAL_STEPS) {
      navigate("/tableau-de-bord");
      return;
    }

    const cible = Math.max(1, Math.min(result.etape_creation ?? etape + 1, TOTAL_STEPS));
    setEtape(cible);
  };

  const handlePrevious = async () => {
    if (!personnageId || etape <= 1) return;
    const { data, error } = await supabase.rpc("annuler_etape", {
      p_personnage_id: personnageId,
      p_etape_courante: etape,
      p_dry_run: true,
    });
    if (error) {
      toast.error(`Impossible d'annuler : ${error.message}`);
      return;
    }
    const payload = (data ?? {}) as {
      succes?: boolean;
      donnees?: DonneesAnnulationEtape;
      erreurs?: Array<{ message?: string }>;
    };
    if (payload.succes !== true || !payload.donnees) {
      const msg =
        payload.erreurs?.[0]?.message ?? "Impossible d'annuler l'étape.";
      toast.error(msg);
      return;
    }
    setDonneesAnnulation(payload.donnees);
  };

  const handleConfirmAnnulation = async () => {
    if (!personnageId || !donneesAnnulation) return;
    setAnnulationEnCours(true);
    try {
      const { data, error } = await supabase.rpc("annuler_etape", {
        p_personnage_id: personnageId,
        p_etape_courante: donneesAnnulation.etape_annulee,
        p_dry_run: false,
      });
      if (error) {
        toast.error(`Erreur : ${error.message}`);
        return;
      }
      const payload = (data ?? {}) as {
        succes?: boolean;
        erreurs?: Array<{ message?: string }>;
      };
      if (payload.succes !== true) {
        const msg =
          payload.erreurs?.[0]?.message ?? "Erreur lors de l'annulation.";
        toast.error(msg);
        return;
      }
      await queryClient.refetchQueries({
        queryKey: ["v2-personnage", personnageId],
      });
      setEtape(donneesAnnulation.etape_apres);
      toast.success(
        `Étape ${donneesAnnulation.etape_annulee} annulée — retour à l'étape ${donneesAnnulation.etape_apres}.`,
      );
      setDonneesAnnulation(null);
    } finally {
      setAnnulationEnCours(false);
    }
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
            xpDisponible={xpDisponible}
            onSuccess={handleEtapeSuccess}
            onPrevious={handlePrevious}
            onXpDeltaChange={setXpDeltaCourant}
          />
        )}
        {etape === 6 && (
          <Etape6_Sorts_V2
            personnageId={personnageId}
            etapeCreation={personnage?.etape_creation ?? 0}
            autoSkipActif={autoSkipActif}
            xpDisponible={xpDisponible}
            onSuccess={handleEtapeSuccess}
            onPrevious={handlePrevious}
          />
        )}
        {etape === 7 && (
          <Etape7_Prieres_V2
            personnageId={personnageId}
            etapeCreation={personnage?.etape_creation ?? 0}
            autoSkipActif={autoSkipActif}
            xpDisponible={xpDisponible}
            onSuccess={handleEtapeSuccess}
            onPrevious={handlePrevious}
          />
        )}
        {etape === 8 && (
          <Etape8_Assemblages_V2
            personnageId={personnageId}
            etapeCreation={personnage?.etape_creation ?? 0}
            xpDisponible={xpDisponible}
            autoSkipActif={autoSkipActif}
            onSuccess={handleEtapeSuccess}
            onPrevious={handlePrevious}
          />
        )}
        {etape === 9 && (
          <Etape9_Artisanat_V2
            personnageId={personnageId}
            etapeCreation={personnage?.etape_creation ?? 0}
            xpDisponible={xpDisponible}
            autoSkipActif={autoSkipActif}
            onSuccess={handleEtapeSuccess}
            onPrevious={handlePrevious}
          />
        )}
        {etape === 10 && (
          <Etape10_Recapitulatif_V2
            personnageId={personnageId}
            onSuccess={handleEtapeSuccess}
            onPrevious={handlePrevious}
          />
        )}
      </main>

      <AlertDialog
        open={!!donneesAnnulation}
        onOpenChange={(open) => {
          if (!open && !annulationEnCours) setDonneesAnnulation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revenir à l'étape précédente ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>Cette action annulera :</p>
                {donneesAnnulation && donneesAnnulation.items_detail.length > 0 && (
                  <div className="space-y-3">
                    {Object.entries(
                      donneesAnnulation.items_detail.reduce(
                        (acc, item) => {
                          (acc[item.type_label] ??= []).push(item);
                          return acc;
                        },
                        {} as Record<string, ItemDetailAnnulation[]>,
                      ),
                    ).map(([typeLabel, items]) => (
                      <div key={typeLabel}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
                          {typeLabel} :
                        </p>
                        <ul className="ml-4 mt-1 list-disc space-y-0.5 text-xs text-muted-foreground">
                          {items.map((item, i) => (
                            <li key={`${typeLabel}-${i}`}>
                              {item.nom}
                              {item.quantite > 1 && ` (×${item.quantite})`}
                              {item.xp_unitaire > 0
                                ? item.quantite > 1
                                  ? ` — ${item.xp_unitaire} XP/u = ${item.xp_total} XP`
                                  : ` — ${item.xp_total} XP`
                                : " — Gratuit"}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
                <p className="font-semibold text-gold">
                  XP remboursés total : {donneesAnnulation?.xp_rembourse ?? 0}
                </p>
                <p className="text-amber-400">Cette action est irréversible.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={annulationEnCours}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAnnulation}
              disabled={annulationEnCours}
            >
              {annulationEnCours ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Annulation…
                </>
              ) : (
                "Confirmer et revenir en arrière"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PersonnageNouveauV2;

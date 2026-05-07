import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const TOTAL_STEPS = 10;

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
}

const PersonnageNouveauV2 = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [personnageId, setPersonnageId] = useState<string | null>(null);
  const [etape, setEtape] = useState<number>(1);
  const [demarrage, setDemarrage] = useState(true);
  const [erreurDemarrage, setErreurDemarrage] = useState<string | null>(null);

  // 1) Démarrage : créer ou récupérer le brouillon
  useEffect(() => {
    if (authLoading || !user) return;
    let annule = false;

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

      const payload = (data ?? {}) as Record<string, unknown>;
      const succes = payload.succes as boolean | undefined;
      const code = payload.code as string | undefined;
      const personnage_id = payload.personnage_id as string | undefined;
      const etape_courante = payload.etape_creation as number | undefined;

      // On accepte uniquement : succès explicite OU brouillon existant.
      const succesExplicite = succes === true && !!personnage_id;
      const brouillonExistant =
        succes === false && code === "brouillon_existant" && !!personnage_id;

      if (succesExplicite || brouillonExistant) {
        setPersonnageId(personnage_id!);
        setEtape(Math.max(1, Math.min(etape_courante ?? 1, TOTAL_STEPS)));
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
  }, [authLoading, user]);

  // 2) État du personnage (XP, étape) — rafraîchi après chaque mutation
  const { data: personnage } = useQuery<PersonnageRow | null>({
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

  const xpTotal = personnage?.xp_total ?? 0;
  const xpDepense = personnage?.xp_depense ?? 0;
  const xpDisponible = xpTotal - xpDepense;

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
  if (authLoading || demarrage) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white/60">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Préparation du créateur de personnage…
      </div>
    );
  }

  if (erreurDemarrage || !personnageId) {
    return (
      <div className="mx-auto mt-12 max-w-xl space-y-4 rounded-lg border border-red-700/50 bg-red-950/30 p-6 text-red-100">
        <h2 className="text-xl font-heading text-red-200">
          Création indisponible
        </h2>
        <p className="text-sm">{erreurDemarrage ?? "Brouillon introuvable."}</p>
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
              {xpDepense} dépensés / {xpTotal} totaux
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
          />
        )}
        {etape === 4 && (
          <Etape4_V2
            personnageId={personnageId}
            onSuccess={handleEtapeSuccess}
            onPrevious={handlePrevious}
          />
        )}

        {etape > 4 && (
          <div className="space-y-4 text-center">
            <h2 className="font-heading text-2xl text-gold">
              Étapes 5 à {TOTAL_STEPS} à venir
            </h2>
            <p className="text-white/60">
              Le créateur V2 s'arrête pour le moment à l'étape 4. Les étapes
              suivantes seront ajoutées prochainement.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handlePrevious}>
                Étape précédente
              </Button>
              <Button onClick={() => navigate("/tableau-de-bord")}>
                Retour au tableau de bord
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PersonnageNouveauV2;

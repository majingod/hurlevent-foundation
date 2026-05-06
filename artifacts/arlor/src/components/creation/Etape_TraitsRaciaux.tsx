import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TraitRacial {
  trait_id: string;
  trait_nom: string;
  trait_description: string;
  cout_xp: number;
}

interface TraitChoisi {
  trait_id: string;
  est_gratuit: boolean;
  xp_depense: number;
}

interface Step3TraitsRaciauxProps {
  personnageId: string | null;
  onPeutPasser: (peut: boolean) => void;
  onXpDepenseChange: (v: number) => void;
}

const COUT_TRAIT = 10;

const Step3TraitsRaciaux = ({ personnageId, onPeutPasser, onXpDepenseChange }: Step3TraitsRaciauxProps) => {
  const [traitsGratuits, setTraitsGratuits] = useState<string[]>([]);
  const [traitsAchetes, setTraitsAchetes] = useState<string[]>([]);
  const [xpTotal, setXpTotal] = useState<number>(0);
  const [xpDepense, setXpDepense] = useState<number>(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [traits, setTraits] = useState<TraitRacial[]>([]);
  const [quotaGratuit, setQuotaGratuit] = useState<number>(1);
  const [chargement, setChargement] = useState(true);
  const [raceIdLocal, setRaceIdLocal] = useState<string | null>(null);
  const [sousTypeLocal, setSousTypeLocal] = useState<string | null>(null);
  const [raceNomLocal, setRaceNomLocal] = useState<string | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);

  useEffect(() => {
    if (!personnageId) {
      console.warn("[Etape_TraitsRaciaux] personnageId manquant — chargement annulé");
      setChargement(false);
      return;
    }
    const fetchData = async () => {
      setChargement(true);
      setErreurChargement(null);
      try {
        const { data: perso, error } = await supabase
          .from("personnages")
          .select("xp_total, xp_depense, traits_raciaux_choisis, race_id, sous_type_chimeride")
          .eq("id", personnageId)
          .single();

        if (error) {
          console.error("[Etape_TraitsRaciaux] Erreur lecture personnages:", error);
          toast.error(`Personnage non chargé : ${error.message}`);
          setChargement(false);
          return;
        }
        if (!perso) {
          console.warn("[Etape_TraitsRaciaux] Personnage introuvable pour id:", personnageId);
          setChargement(false);
          return;
        }

        console.log("[Etape_TraitsRaciaux] perso chargé:", {
          id: personnageId,
          race_id: perso.race_id,
          sous_type_chimeride: perso.sous_type_chimeride,
          xp_total: perso.xp_total,
          xp_depense: perso.xp_depense,
        });

        setXpTotal(perso.xp_total ?? 0);
        const xpDep = perso.xp_depense ?? 0;
        setXpDepense(xpDep);
        onXpDepenseChange(xpDep);

        const choisisRaw = (perso.traits_raciaux_choisis as any[] | null) ?? [];
        
        // Support du format Legacy (id, gratuit) et Nouveau (trait_id, est_gratuit)
        const choisis: TraitChoisi[] = choisisRaw.map(t => ({
          trait_id: t.trait_id || t.id,
          est_gratuit: t.est_gratuit !== undefined ? t.est_gratuit : t.gratuit,
          xp_depense: t.xp_depense ?? 0
        }));

        const gratuits = choisis.filter((t) => t.est_gratuit).map((t) => t.trait_id);
        const achetes = choisis.filter((t) => !t.est_gratuit).map((t) => t.trait_id);
        setTraitsGratuits(gratuits);
        setTraitsAchetes(achetes);

        setRaceIdLocal(perso.race_id ?? null);
        setSousTypeLocal(perso.sous_type_chimeride ?? null);

        if (!perso.race_id) {
          console.warn("[Etape_TraitsRaciaux] race_id NULL en DB — l'étape 2 n'a pas (encore) sauvegardé");
          setChargement(false);
          return;
        }

        const sousType = perso.sous_type_chimeride ?? null;

        // DATA-FIRST : race + traits en parallèle (plus de cascade).
        // vue_traits_par_race joint race_traits + traits_raciaux et filtre
        // est_actif = true directement en SQL — plus de .filter() côté JS.
        let traitsQuery = supabase
          .from("vue_traits_par_race")
          .select("trait_id, sous_type, trait_nom, trait_description, cout_xp")
          .eq("race_id", perso.race_id);

        if (sousType) {
          traitsQuery = traitsQuery.or(`sous_type.eq.${sousType},sous_type.is.null`);
        } else {
          traitsQuery = traitsQuery.is("sous_type", null);
        }

        const [raceRes, traitsRes] = await Promise.all([
          supabase
            .from("races")
            .select("nb_traits_raciaux, nom")
            .eq("id", perso.race_id)
            .single(),
          traitsQuery,
        ]);

        if (raceRes.error) {
          console.error("[Etape_TraitsRaciaux] Erreur lecture races:", raceRes.error);
          setErreurChargement(`Impossible de charger la race : ${raceRes.error.message}`);
          return;
        }

        const quota = raceRes.data?.nb_traits_raciaux ?? 1;
        const raceNom = raceRes.data?.nom ?? null;
        console.log("[Etape_TraitsRaciaux] race:", raceNom, "→ quota gratuit:", quota);
        setQuotaGratuit(quota);
        setRaceNomLocal(raceNom);
        onPeutPasser(gratuits.length >= quota);

        if (traitsRes.error) {
          console.error("[Etape_TraitsRaciaux] Erreur chargement traits:", traitsRes.error);
          setErreurChargement(
            `Erreur lors de la lecture de vue_traits_par_race : ${traitsRes.error.message}`,
          );
          toast.error(`Traits non chargés : ${traitsRes.error.message}`);
          return;
        }

        const rows = (traitsRes.data as any[] | null) ?? [];
        const formattedTraits = rows.map((item) => ({
          trait_id: item.trait_id,
          trait_nom: item.trait_nom ?? "Sans nom",
          trait_description: item.trait_description ?? "",
          cout_xp: item.cout_xp ?? 10,
        }));
        console.log("[Etape_TraitsRaciaux] Traits chargés:", formattedTraits.length);
        setTraits(formattedTraits);

        // Erreur explicite : la race exige des traits mais la vue n'en renvoie aucun
        if (formattedTraits.length === 0 && quota > 0) {
          const sousTypeMsg = sousType ? ` (sous-type « ${sousType} »)` : "";
          setErreurChargement(
            `Aucun trait racial trouvé dans vue_traits_par_race pour la race « ${raceNom ?? perso.race_id} »${sousTypeMsg}, ` +
              `alors que cette race exige ${quota} trait${quota > 1 ? "s" : ""} gratuit${quota > 1 ? "s" : ""}. ` +
              `Vérifie que les traits sont bien associés via la table race_traits et que est_actif = true. ` +
              `Tu ne peux pas continuer la création tant que ce problème n'est pas corrigé.`,
          );
          onPeutPasser(false);
        }
      } catch (err) {
        console.error("[Etape_TraitsRaciaux] Exception inattendue:", err);
        toast.error("Erreur inattendue lors du chargement des traits.");
      } finally {
        setChargement(false);
      }
    };
    fetchData();
  }, [personnageId]);

  // Notifier le parent quand traitsGratuits change
  useEffect(() => {
    onPeutPasser(traitsGratuits.length >= quotaGratuit);
  }, [traitsGratuits, quotaGratuit]);

  const xpDisponible = xpTotal - xpDepense;

  const sauvegarderTraits = async (
    newTraitsGratuits: string[],
    newTraitsAchetes: string[],
    newXpDepense: number,
  ) => {
    if (!personnageId) return;
    const choisis: TraitChoisi[] = [
      ...newTraitsGratuits.map((id) => ({ trait_id: id, est_gratuit: true, xp_depense: 0 })),
      ...newTraitsAchetes.map((id) => ({ trait_id: id, est_gratuit: false, xp_depense: COUT_TRAIT })),
    ];
    const { error } = await supabase
      .from("personnages")
      .update({
        traits_raciaux_choisis: choisis as any,
        xp_depense: newXpDepense,
        updated_at: new Date().toISOString(),
      })
      .eq("id", personnageId);
    if (error) {
      console.error("[Etape_TraitsRaciaux] Erreur sauvegarde traits:", error);
      toast.error("Erreur lors de la sauvegarde des traits.");
    }
  };

  const handleGratuit = async (traitId: string) => {
    const estDeja = traitsGratuits.includes(traitId);
    if (estDeja) {
      const newGratuits = traitsGratuits.filter((id) => id !== traitId);
      setTraitsGratuits(newGratuits);
      await sauvegarderTraits(newGratuits, traitsAchetes, xpDepense);
    } else {
      if (traitsGratuits.length >= quotaGratuit) return;
      const newGratuits = [...traitsGratuits, traitId];
      setTraitsGratuits(newGratuits);
      await sauvegarderTraits(newGratuits, traitsAchetes, xpDepense);
    }
  };

  const handleAcheter = async (traitId: string) => {
    if (traitsAchetes.includes(traitId)) {
      const newAchetes = traitsAchetes.filter((id) => id !== traitId);
      const newXpDepense = xpDepense - COUT_TRAIT;
      setTraitsAchetes(newAchetes);
      setXpDepense(newXpDepense);
      onXpDepenseChange(newXpDepense);
      await sauvegarderTraits(traitsGratuits, newAchetes, newXpDepense);
    } else {
      if (xpDisponible < COUT_TRAIT) {
        toast.error("XP insuffisant pour acheter ce trait");
        return;
      }
      // Valider via la fonction PL/pgSQL
      const { data: validation, error: rpcError } = await supabase.rpc("peut_acheter_trait_racial" as any, {
        p_personnage_id: personnageId,
        p_trait_id: traitId,
        p_race_id: raceIdLocal,
        p_sous_type: sousTypeLocal,
      });
      if (rpcError) {
        console.error("[Etape_TraitsRaciaux] Erreur RPC peut_acheter_trait_racial:", rpcError);
        toast.error("Erreur de validation du trait.");
        return;
      }
      if (validation === false) {
        toast.error("Ce trait ne peut pas être acheté pour ce personnage.");
        return;
      }
      const newAchetes = [...traitsAchetes, traitId];
      const newXpDepense = xpDepense + COUT_TRAIT;
      setTraitsAchetes(newAchetes);
      setXpDepense(newXpDepense);
      onXpDepenseChange(newXpDepense);
      await sauvegarderTraits(traitsGratuits, newAchetes, newXpDepense);
    }
  };

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-20 text-white/40">
        Chargement des traits raciaux…
      </div>
    );
  }

  if (erreurChargement) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
        <h2 className="text-2xl font-heading text-gold">Choisis tes traits raciaux</h2>
        <div className="rounded-lg border border-red-700/60 bg-red-950/40 p-4 text-red-200">
          <p className="font-semibold mb-2">⚠️ Erreur de chargement des traits raciaux</p>
          <p className="text-sm whitespace-pre-line">{erreurChargement}</p>
        </div>
      </div>
    );
  }

  if (traits.length === 0) {
    // Aucun trait ET aucune erreur ET quota = 0 : race vraiment sans traits configurés
    if (!chargement) onPeutPasser(true);
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
        <h2 className="text-2xl font-heading text-gold">Choisis tes traits raciaux</h2>
        <p className="text-white/50 italic">
          Aucun trait racial à choisir pour la race « {raceNomLocal ?? "inconnue"} ».
          Tu peux passer à l'étape suivante.
        </p>
      </div>
    );
  }

  const quotaAtteint = traitsGratuits.length >= quotaGratuit;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-gold">Choisis tes traits raciaux</h2>
          <p className="mt-1 text-white/60">
            Tu dois choisir {quotaGratuit} trait{quotaGratuit > 1 ? "s" : ""} gratuit{quotaGratuit > 1 ? "s" : ""}.
            Des traits supplémentaires coûtent {COUT_TRAIT} XP chacun.
          </p>
          <p className={`mt-1 text-sm font-semibold ${quotaAtteint ? "text-green-400" : "text-amber-400"}`}>
            {traitsGratuits.length} / {quotaGratuit} trait{quotaGratuit > 1 ? "s" : ""} gratuit{quotaGratuit > 1 ? "s" : ""} choisi{quotaGratuit > 1 ? "s" : ""}
            {!quotaAtteint && " — obligatoire pour continuer"}
          </p>
        </div>
        <div className="shrink-0 rounded-lg border border-gold/30 bg-gold/10 px-4 py-2 text-right">
          <div className="text-xs uppercase tracking-widest text-gold/60">XP disponible</div>
          <div className="text-2xl font-heading font-bold text-gold">{xpDisponible}</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {traits.map((trait) => {
          const estGratuit = traitsGratuits.includes(trait.trait_id);
          const estAchete = traitsAchetes.includes(trait.trait_id);
          const isOpen = expandedId === trait.trait_id;
          const gratuitDisabled = estAchete || (!estGratuit && quotaAtteint);
          const achatDisabled = estGratuit || (xpDisponible < COUT_TRAIT && !estAchete);

          return (
            <Card
              key={trait.trait_id}
              className="group cursor-pointer border-primary/10 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_25px_rgba(184,146,70,0.1)]"
            >
              <CardHeader
                className="pb-2"
                onClick={() => setExpandedId(isOpen ? null : trait.trait_id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="font-heading text-lg">{trait.trait_nom}</CardTitle>
                  <ChevronDown
                    className={`mt-1 h-4 w-4 flex-shrink-0 text-primary/40 transition-transform duration-300 group-hover:text-primary ${isOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ maxHeight: isOpen ? "1500px" : "0", opacity: isOpen ? 1 : 0 }}
                >
                  <p className="mt-1 border-t border-primary/10 pt-3">{trait.trait_description}</p>
                </div>
                <div
                  className="flex justify-end pt-1"
                  onClick={() => setExpandedId(isOpen ? null : trait.trait_id)}
                >
                  <span className="text-xs text-primary">{isOpen ? "Voir moins" : "Voir plus"}</span>
                </div>
                <div
                  className="flex gap-2 pt-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Bouton Gratuit */}
                  <Button
                    variant={estGratuit ? "default" : "outline"}
                    size="sm"
                    disabled={gratuitDisabled}
                    onClick={() => handleGratuit(trait.trait_id)}
                    className={`flex-1 ${estGratuit ? "bg-gold text-black hover:bg-gold/90" : "border-white/20"}`}
                  >
                    {estGratuit ? "Gratuit ✓" : "Gratuit"}
                  </Button>
                  {/* Bouton Acheter */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={achatDisabled}
                    onClick={() => handleAcheter(trait.trait_id)}
                    className={`flex-1 ${
                      estAchete
                        ? "bg-green-900/50 text-green-300 border border-green-700 hover:bg-green-800/50"
                        : "border-white/20"
                    }`}
                  >
                    {estAchete ? "✅ Acquis 10 xp" : `Acheter (${COUT_TRAIT} xp)`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Step3TraitsRaciaux;

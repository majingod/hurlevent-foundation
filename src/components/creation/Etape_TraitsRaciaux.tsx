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

  useEffect(() => {
    if (!personnageId) {
      setChargement(false);
      return;
    }
    const fetchData = async () => {
      setChargement(true);
      try {
        const { data: perso, error } = await supabase
          .from("personnages")
          .select("xp_total, xp_depense, traits_raciaux_choisis, race_id, sous_type_chimeride")
          .eq("id", personnageId)
          .single();
        if (error || !perso) { setChargement(false); return; }

        setXpTotal(perso.xp_total ?? 0);
        const xpDep = perso.xp_depense ?? 0;
        setXpDepense(xpDep);
        onXpDepenseChange(xpDep);

        const choisis = (perso.traits_raciaux_choisis as TraitChoisi[] | null) ?? [];
        const gratuits = choisis.filter((t) => t.est_gratuit).map((t) => t.trait_id);
        const achetes = choisis.filter((t) => !t.est_gratuit).map((t) => t.trait_id);
        setTraitsGratuits(gratuits);
        setTraitsAchetes(achetes);

        setRaceIdLocal(perso.race_id ?? null);
        setSousTypeLocal(perso.sous_type_chimeride ?? null);

        // Charger nb_traits_raciaux depuis la race
        if (perso.race_id) {
          const { data: raceData } = await supabase
            .from("races")
            .select("nb_traits_raciaux")
            .eq("id", perso.race_id)
            .single();
          const quota = raceData?.nb_traits_raciaux ?? 1;
          setQuotaGratuit(quota);
          onPeutPasser(gratuits.length >= quota);

          // Charger les traits filtrés par race via vue_traits_par_race
          const sousType = perso.sous_type_chimeride ?? null;
          let query = supabase
            .from("vue_traits_par_race" as any)
            .select("trait_id, trait_nom, trait_description, cout_xp, est_actif, sous_type")
            .eq("race_id", perso.race_id)
            .eq("est_actif", true);
          if (sousType) {
            query = (query as any).or(`sous_type.eq.${sousType},sous_type.is.null`);
          }
          const { data: traitsData } = await query;
          if (traitsData) {
            setTraits(
              (traitsData as any[]).map((t) => ({
                trait_id: t.trait_id,
                trait_nom: t.trait_nom,
                trait_description: t.trait_description,
                cout_xp: t.cout_xp,
              }))
            );
          }
        }
      } catch {
        // intentionally ignored — fallback to empty state
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
    await supabase
      .from("personnages")
      .update({
        traits_raciaux_choisis: choisis as any,
        xp_depense: newXpDepense,
        updated_at: new Date().toISOString(),
      })
      .eq("id", personnageId);
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
      const { data: validation } = await supabase.rpc("peut_acheter_trait_racial" as any, {
        p_personnage_id: personnageId,
        p_trait_id: traitId,
        p_race_id: raceIdLocal,
        p_sous_type: sousTypeLocal,
      });
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

  if (traits.length === 0) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
        <h2 className="text-2xl font-heading text-gold">Choisis tes traits raciaux</h2>
        <p className="text-white/50 italic">Aucun trait racial disponible pour cette race.</p>
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

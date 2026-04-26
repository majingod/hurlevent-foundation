import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClasseCard } from "@/components/shared/CardTemplates";
import ReligionCard from "@/components/encyclopedie/ReligionCard";
import { Button } from "@/components/ui/button";

interface EtapeClasseProps {
  personnageId: string | null;
  classeId: string | null;
  onClasseSelect: (id: string | null) => void;
  estCroyant: boolean | null;
  religionId: string | null;
  onReligionChange: (id: string | null, croyant?: boolean) => void;
  onPeutPasser: (peut: boolean) => void;
}

const EtapeClasse = ({
  personnageId,
  classeId,
  onClasseSelect,
  estCroyant,
  religionId,
  onReligionChange,
  onPeutPasser,
}: EtapeClasseProps) => {
  const [choixDecryptage, setChoixDecryptage] = useState<string | null>(null);
  const [confirmationReligion, setConfirmationReligion] = useState<"oui" | "non" | null>(null);
  const [religionIdLocale, setReligionIdLocale] = useState<string | null>(religionId);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-creation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("est_actif", true)
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  const { data: competenceDecryptage = null } = useQuery({
    queryKey: ["competence-decryptage"],
    queryFn: async () => {
      const { data } = await supabase
        .from("competences")
        .select("*")
        .ilike("nom", "%décryptage%")
        .maybeSingle();
      return data ?? null;
    },
  });

  const { data: religions = [] } = useQuery({
    queryKey: ["religions-creation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("religions")
        .select("*")
        .eq("est_actif", true)
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  const classeSelectionnee = classes.find((c) => c.id === classeId);
  const nomClasse = classeSelectionnee?.nom?.toLowerCase() ?? "";
  const isMage = nomClasse.includes("mage");
  const isPretre = nomClasse.includes("prêtre") || nomClasse.includes("pretre");

  const choixDecryptageOptions: string[] = (() => {
    if (!competenceDecryptage?.niveaux) return [];
    const niveaux = competenceDecryptage.niveaux as any;
    if (Array.isArray(niveaux)) {
      const premier = niveaux[0];
      if (typeof premier === "string") return niveaux as string[];
      if (premier && typeof premier === "object") {
        const candidats = premier.choix ?? premier.options ?? premier.valeurs;
        if (Array.isArray(candidats)) return candidats.map(String);
      }
    }
    return [];
  })();

  useEffect(() => {
    if (!classeId) { onPeutPasser(false); return; }

    if (isMage && competenceDecryptage && choixDecryptageOptions.length > 0) {
      if (!choixDecryptage) { onPeutPasser(false); return; }
    }

    if (isPretre) {
      const aReligionCroyant = !!(estCroyant && religionId);
      if (aReligionCroyant) {
        if (confirmationReligion === "oui") { onPeutPasser(true); return; }
        if (confirmationReligion === "non" && religionIdLocale) { onPeutPasser(true); return; }
        onPeutPasser(false); return;
      } else {
        onPeutPasser(!!religionIdLocale); return;
      }
    }

    onPeutPasser(true);
  }, [
    classeId, isMage, isPretre, competenceDecryptage,
    choixDecryptage, choixDecryptageOptions.length,
    confirmationReligion, religionIdLocale, estCroyant, religionId,
    onPeutPasser,
  ]);

  const sauvegarderClasse = async (id: string) => {
    if (!personnageId) return;
    await supabase
      .from("personnages")
      .update({ classe_id: id, updated_at: new Date().toISOString() })
      .eq("id", personnageId);
  };

  const sauvegarderDecryptage = async (choix: string) => {
    if (!personnageId || !competenceDecryptage) return;
    await (supabase as any).from("personnage_competences").upsert(
      {
        personnage_id: personnageId,
        competence_id: competenceDecryptage.id,
        choix_achat: choix,
        xp_depense: 0,
        niveau_acquis: 1,
      },
      { onConflict: "personnage_id,competence_id" }
    );
  };

  const sauvegarderReligion = async (id: string | null, croyant = true) => {
    if (!personnageId) return;
    await (supabase as any)
      .from("personnages")
      .update({ religion_id: id, est_croyant: croyant, updated_at: new Date().toISOString() })
      .eq("id", personnageId);
  };

  const handleClasseClick = (id: string) => {
    if (classeId === id) return;
    onClasseSelect(id);
    sauvegarderClasse(id);
    setChoixDecryptage(null);
    setConfirmationReligion(null);
    setReligionIdLocale(religionId);
  };

  const handleChoixDecryptage = (choix: string) => {
    const nouveau = choixDecryptage === choix ? null : choix;
    setChoixDecryptage(nouveau);
    if (nouveau) sauvegarderDecryptage(nouveau);
  };

  const handleChoixReligionPretre = (id: string) => {
    const nouveau = religionIdLocale === id ? null : id;
    setReligionIdLocale(nouveau);
    onReligionChange(nouveau, true);
    sauvegarderReligion(nouveau, true);
  };

  const renderPanneauMage = () => {
    if (!isMage) return null;
    return (
      <div className="mt-8 pt-8 border-t border-white/10 space-y-4 animate-in fade-in slide-in-from-bottom-4">
        <p className="text-sm text-white/80">
          La classe Mage t'offre gratuitement la compétence{" "}
          <strong className="text-gold">Décryptage</strong>. Choisis le type de décryptage :
        </p>
        {choixDecryptageOptions.length === 0 ? (
          <p className="text-xs text-white/40 italic">Chargement des choix de décryptage…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {choixDecryptageOptions.map((choix) => (
              <button
                key={choix}
                type="button"
                onClick={() => handleChoixDecryptage(choix)}
                className={`rounded-lg border p-4 text-left text-sm font-medium transition-all ${
                  choixDecryptage === choix
                    ? "border-gold bg-gold/10 text-gold ring-2 ring-gold/40"
                    : "border-white/10 bg-white/5 text-white/80 hover:border-gold/50"
                }`}
              >
                {choixDecryptage === choix && <span className="mr-2">✓</span>}
                {choix}
              </button>
            ))}
          </div>
        )}
        {!choixDecryptage && choixDecryptageOptions.length > 0 && (
          <p className="text-xs text-amber-400/80">
            ⚠️ Tu dois choisir un type de décryptage pour continuer.
          </p>
        )}
      </div>
    );
  };

  const renderPanneauPretre = () => {
    if (!isPretre) return null;
    const aReligionCroyant = !!(estCroyant && religionId);
    const religionActuelle = religions.find((r) => r.id === religionId);

    return (
      <div className="mt-8 pt-8 border-t border-white/10 space-y-6 animate-in fade-in slide-in-from-bottom-4">
        {aReligionCroyant ? (
          <>
            <p className="text-sm text-white/80">
              Ton personnage est déjà croyant. Souhaites-tu garder cette religion pour ta classe Prêtre ?
            </p>
            {religionActuelle && (
              <div className="max-w-md">
                <ReligionCard religion={religionActuelle} isSelected={false} />
              </div>
            )}
            <div className="flex gap-4">
              <Button
                type="button"
                variant={confirmationReligion === "oui" ? "default" : "outline"}
                onClick={() => setConfirmationReligion("oui")}
                className={`flex-1 h-12 ${
                  confirmationReligion === "oui"
                    ? "bg-gold text-black hover:bg-gold/90"
                    : "border-white/10 text-white"
                }`}
              >
                Oui, garder cette religion
              </Button>
              <Button
                type="button"
                variant={confirmationReligion === "non" ? "default" : "outline"}
                onClick={() => setConfirmationReligion("non")}
                className={`flex-1 h-12 ${
                  confirmationReligion === "non"
                    ? "bg-gold text-black hover:bg-gold/90"
                    : "border-white/10 text-white"
                }`}
              >
                Non, en choisir une autre
              </Button>
            </div>
            {confirmationReligion === "non" && (
              <div className="space-y-3 animate-in fade-in">
                <p className="text-sm text-white/60">Choisis une nouvelle religion :</p>
                <div className="grid gap-4 md:grid-cols-2">
                  {religions.map((rel) => (
                    <ReligionCard
                      key={rel.id}
                      religion={rel}
                      isSelected={religionIdLocale === rel.id}
                      onClick={() => handleChoixReligionPretre(rel.id)}
                    />
                  ))}
                </div>
                {!religionIdLocale && (
                  <p className="text-xs text-amber-400/80">
                    ⚠️ Tu dois choisir une religion pour continuer.
                  </p>
                )}
              </div>
            )}
            {confirmationReligion === null && (
              <p className="text-xs text-amber-400/80">
                ⚠️ Tu dois confirmer ta religion pour continuer.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-white/80">
              La classe Prêtre nécessite une religion. Choisis la religion de ton personnage :
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {religions.map((rel) => (
                <ReligionCard
                  key={rel.id}
                  religion={rel}
                  isSelected={religionIdLocale === rel.id}
                  onClick={() => handleChoixReligionPretre(rel.id)}
                />
              ))}
            </div>
            {!religionIdLocale && (
              <p className="text-xs text-amber-400/80">
                ⚠️ Tu dois choisir une religion pour continuer.
              </p>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <h2 className="text-2xl font-heading text-gold">Choisis la classe de ton personnage</h2>

      <div className="grid gap-4 md:grid-cols-2">
        {classes.map((cls) => (
          <ClasseCard
            key={cls.id}
            data={cls}
            isSelected={classeId === cls.id}
            onSelect={() => handleClasseClick(cls.id)}
          />
        ))}
      </div>

      {renderPanneauMage()}
      {renderPanneauPretre()}
    </div>
  );
};

export default EtapeClasse;

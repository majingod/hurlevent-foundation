import { useState } from "react";
import { CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import EncyclopedieCard from "@/components/encyclopedie/EncyclopedieCard";

interface Creature {
  id: string;
  nom: string;
  categorie: string;
  pv_formule: string | null;
  description: string;
  immunites: string | null;
  capacites_speciales: string | null;
}

const labelCategorie: Record<string, string> = {
  mort_vivant: "Mort-Vivant",
  morts_vivants: "Morts-Vivants",
  bete: "Bête",
  betes: "Bêtes",
  humanoide: "Humanoïde",
  humanoides: "Humanoïdes",
  demon: "Démon",
  demons: "Démons",
  dragon: "Dragon",
  dragons: "Dragons",
  elementaire: "Élémentaire",
  elementaires: "Élémentaires",
  fee: "Fée",
  fees: "Fées",
  monstre: "Monstre",
  monstres: "Monstres",
};

const formatCategorie = (cat: string) =>
  labelCategorie[cat] ??
  cat
    .split(/[_\s]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

const BestiaireSection = ({
  creatures,
  searchQuery = "",
}: {
  creatures: Creature[];
  searchQuery?: string;
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? creatures.filter(
        (c) =>
          (c.nom ?? "").toLowerCase().includes(q) ||
          (c.description ?? "").toLowerCase().includes(q),
      )
    : creatures;
  const grouped = groupBy(filtered, (c) => c.categorie);
  const keys = Object.keys(grouped).sort();

  return (
    <div className="space-y-8">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">Bestiaire</h2>
      {keys.length === 0 && (
        <p className="text-muted-foreground text-center py-6">Aucun résultat pour cette recherche.</p>
      )}
      {keys.map((cat) => (
        <section key={cat}>
          <h3 className="font-heading text-lg font-semibold text-primary mb-3">{formatCategorie(cat)}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {grouped[cat].map((c) => (
              <EncyclopedieCard
                key={c.id}
                id={c.id}
                isOpen={expanded.has(c.id)}
                onToggle={() => toggleExpanded(c.id)}
                maxHeight={1000}
                header={
                  <>
                    <CardTitle className="font-heading text-xl">{c.nom}</CardTitle>
                    {c.pv_formule && <Badge variant="secondary" className="text-xs w-fit">PV : {c.pv_formule}</Badge>}
                  </>
                }
              >
                <div className="space-y-2 border-t border-primary/10 pt-3 mt-1">
                  {c.immunites && <p><span className="font-medium text-foreground">Immunités :</span> {c.immunites}</p>}
                  {c.capacites_speciales && <p><span className="font-medium text-foreground">Capacités spéciales :</span> {c.capacites_speciales}</p>}
                  <p>{c.description}</p>
                </div>
              </EncyclopedieCard>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default BestiaireSection;

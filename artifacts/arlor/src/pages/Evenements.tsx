import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CarteEvenementJoueur,
  type EvenementPublie,
} from "@/components/evenements/CarteEvenementJoueur";
import { ModalesInscription } from "@/components/evenements/ModalesInscription";
import { useInscriptionEvenements } from "@/hooks/useInscriptionEvenements";

/* ---------- component ---------- */
const Evenements = () => {
  const inscription = useInscriptionEvenements();

  // DATA-FIRST : vue_evenements_publies calcule nb_inscrits côté DB.
  // Cache partagé avec le dashboard via la queryKey ["evenements-publies"].
  const { data: evenements = [], isLoading } = useQuery({
    queryKey: ["evenements-publies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vue_evenements_publies")
        .select("*");
      if (error) throw error;
      return (data ?? []) as EvenementPublie[];
    },
  });

  return (
    <div className="container py-12">
      <h1 className="mb-8 font-heading text-3xl font-bold text-primary md:text-4xl">
        Événements
      </h1>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : evenements.length === 0 ? (
        <p className="text-muted-foreground">Aucun événement publié pour le moment.</p>
      ) : (
        <div className="space-y-6">
          {evenements.map((ev) => (
            <CarteEvenementJoueur
              key={ev.id}
              ev={ev}
              statut={inscription.statutPour(ev)}
              onInscrire={inscription.ouvrirInscription}
              onDesinscrire={(e) =>
                inscription.ouvrirDesinscription(e, inscription.enAttenteIdsPour(e))
              }
            />
          ))}
        </div>
      )}

      <ModalesInscription ctrl={inscription} />
    </div>
  );
};

export default Evenements;

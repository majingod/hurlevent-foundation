import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfil } from "@/contexts/ProfilContext";
import { toast } from "sonner";
import type {
  EvenementPublie,
  StatutInscription,
} from "@/components/evenements/CarteEvenementJoueur";

interface Personnage {
  id: string;
  nom: string | null;
}

interface Inscription {
  id: string;
  evenement_id: string | null;
  statut: string | null;
}

export interface InscriptionController {
  // pour les cartes
  statutPour: (ev: EvenementPublie) => StatutInscription;
  enAttenteIdsPour: (ev: EvenementPublie) => string[];
  ouvrirInscription: (ev: EvenementPublie) => void;
  ouvrirDesinscription: (ev: EvenementPublie, ids: string[]) => void;
  // pour <ModalesInscription>
  personnages: Personnage[];
  modalOpen: boolean;
  setModalOpen: (o: boolean) => void;
  selectedEvent: EvenementPublie | null;
  selectedPersonnage: string | null;
  setSelectedPersonnage: (id: string) => void;
  submitting: boolean;
  confirmerInscription: () => Promise<void>;
  desinscrireEvent: EvenementPublie | null;
  fermerDesinscription: () => void;
  desinscribing: boolean;
  confirmerDesinscription: () => Promise<void>;
}

/**
 * Flux d'inscription / désinscription aux événements — partagé entre la page
 * Événements et le tableau de bord (PR2 dashboard miroir, s193).
 * Présence ≠ inscription : l'admin valide la PRÉSENCE (present/absent) ;
 * l'inscription est enregistrée immédiatement (statut en_attente).
 *
 * NOTE (dette INVALIDATE-INSCRIPTIONS-KEY) : l'invalidation post-action utilise
 * ["mes-inscriptions", user.id] alors que la query est sur joueurId. Comportement
 * conservé À L'IDENTIQUE depuis Evenements.tsx (le realtime couvre déjà la bonne
 * clé). Correction hors scope de ce refactor.
 */
export const useInscriptionEvenements = (): InscriptionController => {
  const { user } = useAuth();
  const { joueurId } = useProfil();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EvenementPublie | null>(null);
  const [selectedPersonnage, setSelectedPersonnage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [desinscrireEvent, setDesinscrireEvent] = useState<EvenementPublie | null>(null);
  const [desinscrireIds, setDesinscrireIds] = useState<string[]>([]);
  const [desinscribing, setDesinscribing] = useState(false);

  const { data: inscriptions = [] } = useQuery({
    queryKey: ["mes-inscriptions", joueurId],
    queryFn: async () => {
      if (!joueurId) return [] as Inscription[];
      const { data } = await supabase
        .from("inscriptions_evenements")
        .select("id, evenement_id, statut")
        .eq("joueur_id", joueurId);
      return (data ?? []) as Inscription[];
    },
    enabled: !!joueurId,
  });

  const { data: personnages = [] } = useQuery({
    queryKey: ["mes-personnages-actifs", joueurId],
    queryFn: async () => {
      const { data } = await supabase
        .from("personnages")
        .select("id, nom")
        .eq("joueur_id", joueurId!)
        .eq("est_actif", true)
        .eq("est_mort", false);
      return (data ?? []) as Personnage[];
    },
    enabled: !!joueurId,
  });

  // Realtime : invalide le cache quand les inscriptions changent
  useEffect(() => {
    const channel = supabase
      .channel("inscriptions-evenements")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inscriptions_evenements" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["evenements-publies"] });
          if (joueurId) {
            queryClient.invalidateQueries({ queryKey: ["mes-inscriptions", joueurId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [joueurId, queryClient]);

  const statutPour = (ev: EvenementPublie): StatutInscription => {
    const mes = inscriptions.filter((i) => i.evenement_id === ev.id);
    if (mes.some((i) => i.statut === "present")) return "present";
    if (mes.some((i) => i.statut === "absent")) return "absent";
    if (mes.some((i) => i.statut === "en_attente")) return "inscrit";
    return "aucun";
  };

  const enAttenteIdsPour = (ev: EvenementPublie): string[] =>
    inscriptions
      .filter((i) => i.evenement_id === ev.id && i.statut === "en_attente")
      .map((i) => i.id);

  const ouvrirInscription = (ev: EvenementPublie) => {
    if (!user) {
      navigate("/connexion");
      return;
    }
    setSelectedEvent(ev);
    setSelectedPersonnage(personnages.length > 0 ? personnages[0].id : null);
    setModalOpen(true);
  };

  const confirmerInscription = async () => {
    if (!selectedEvent || !user) return;
    setSubmitting(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user || !joueurId) {
      toast.error("Session expirée, veuillez vous reconnecter.");
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from("inscriptions_evenements").upsert(
      {
        evenement_id: selectedEvent.id,
        personnage_id: selectedPersonnage,
        joueur_id: joueurId,
        statut: "en_attente",
      },
      {
        onConflict: "evenement_id,personnage_id",
        ignoreDuplicates: true,
      }
    );

    setSubmitting(false);
    if (error) {
      if (error.code === "23505") {
        queryClient.invalidateQueries({ queryKey: ["mes-inscriptions", user.id] });
        setModalOpen(false);
      } else {
        toast.error("Erreur lors de l'inscription.");
      }
    } else {
      toast.success("Inscription envoyée ! En attente de confirmation.");
      queryClient.invalidateQueries({ queryKey: ["mes-inscriptions", user.id] });
      queryClient.invalidateQueries({ queryKey: ["evenements-publies"] });
      setModalOpen(false);
    }
  };

  const ouvrirDesinscription = (ev: EvenementPublie, ids: string[]) => {
    setDesinscrireEvent(ev);
    setDesinscrireIds(ids);
  };

  const fermerDesinscription = () => {
    setDesinscrireEvent(null);
    setDesinscrireIds([]);
  };

  const confirmerDesinscription = async () => {
    if (!user || desinscrireIds.length === 0) return;
    setDesinscribing(true);
    const { error } = await supabase
      .from("inscriptions_evenements")
      .delete()
      .in("id", desinscrireIds);
    setDesinscribing(false);
    if (error) {
      toast.error("Erreur lors de la désinscription.");
    } else {
      toast.success("Désinscription effectuée.");
      queryClient.invalidateQueries({ queryKey: ["mes-inscriptions", user.id] });
      queryClient.invalidateQueries({ queryKey: ["evenements-publies"] });
    }
    setDesinscrireEvent(null);
    setDesinscrireIds([]);
  };

  return {
    statutPour,
    enAttenteIdsPour,
    ouvrirInscription,
    ouvrirDesinscription,
    personnages,
    modalOpen,
    setModalOpen,
    selectedEvent,
    selectedPersonnage,
    setSelectedPersonnage,
    submitting,
    confirmerInscription,
    desinscrireEvent,
    fermerDesinscription,
    desinscribing,
    confirmerDesinscription,
  };
};

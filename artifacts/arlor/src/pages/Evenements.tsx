import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfil } from "@/contexts/ProfilContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarteEvenementJoueur, type StatutInscription } from "@/components/evenements/CarteEvenementJoueur";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useState } from "react";

/* ---------- types ---------- */
interface Evenement {
  id: string;
  titre: string | null;
  date_evenement: string | null;
  date_fin: string | null;
  lieu: string | null;
  type_evenement: string | null;
  xp_recompense: number | null;
  niveaux_recompense: number | null;
  adresse_physique: string | null;
  max_participants: number | null;
  description: string | null;
  nb_inscrits: number;
}

interface Personnage {
  id: string;
  nom: string | null;
}

interface Inscription {
  id: string;
  evenement_id: string | null;
  statut: string | null;
}

/* ---------- component ---------- */
const Evenements = () => {
  const { user } = useAuth();
  const { joueurId } = useProfil();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Evenement | null>(null);
  const [selectedPersonnage, setSelectedPersonnage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Désinscription (1A : uniquement les inscriptions « en_attente »)
  const [desinscrireEvent, setDesinscrireEvent] = useState<Evenement | null>(null);
  const [desinscrireIds, setDesinscrireIds] = useState<string[]>([]);
  const [desinscribing, setDesinscribing] = useState(false);

  // DATA-FIRST : vue_evenements_publies calcule nb_inscrits côté DB
  // Remplace la boucle N+1 (1 requête events + N requêtes COUNT)
  const { data: evenements = [], isLoading } = useQuery({
    queryKey: ["evenements-publies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vue_evenements_publies")
        .select("*");
      if (error) throw error;
      return (data ?? []) as Evenement[];
    },
  });

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

    return () => { supabase.removeChannel(channel); };
  }, [joueurId, queryClient]);

  const openModal = (ev: Evenement) => {
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

    const { data: { session } } = await supabase.auth.getSession();
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

  const ouvrirDesinscription = (ev: Evenement, ids: string[]) => {
    setDesinscrireEvent(ev);
    setDesinscrireIds(ids);
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
          {evenements.map((ev) => {
            const mes = inscriptions.filter((i) => i.evenement_id === ev.id);
            const enAttenteIds = mes
              .filter((i) => i.statut === "en_attente")
              .map((i) => i.id);
            const statut: StatutInscription = mes.some(
              (i) => i.statut === "present",
            )
              ? "present"
              : mes.some((i) => i.statut === "absent")
                ? "absent"
                : enAttenteIds.length > 0
                  ? "inscrit"
                  : "aucun";

            return (
              <CarteEvenementJoueur
                key={ev.id}
                ev={ev}
                statut={statut}
                onInscrire={openModal}
                onDesinscrire={(e) => ouvrirDesinscription(e, enAttenteIds)}
              />
            );
          })}
        </div>
      )}

      {/* ── Modale d'inscription ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              S'inscrire à {selectedEvent?.titre}
            </DialogTitle>
            <DialogDescription>
              Choisissez le personnage avec lequel vous souhaitez participer.
            </DialogDescription>
          </DialogHeader>

          {personnages.length === 0 ? (
            <div className="space-y-4 py-4 text-center">
              <p className="text-muted-foreground">
                Vous n'avez pas encore de personnage. Créez-en un d'abord.
              </p>
              <Button asChild>
                <Link to="/personnage/nouveau">Créer un personnage</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2 py-4">
                {personnages.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPersonnage(p.id)}
                    className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                      selectedPersonnage === p.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {p.nom ?? "Personnage sans nom"}
                  </button>
                ))}
              </div>
              <DialogFooter>
                <Button disabled={submitting || !selectedPersonnage} onClick={confirmerInscription}>
                  {submitting ? "Envoi…" : "Confirmer l'inscription"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirmation de désinscription ── */}
      <AlertDialog
        open={!!desinscrireEvent}
        onOpenChange={(open) => {
          if (!open) {
            setDesinscrireEvent(null);
            setDesinscrireIds([]);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">
              Se désinscrire de {desinscrireEvent?.titre} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ton inscription en attente sera retirée et ta place libérée. Tu pourras te réinscrire tant qu'il reste des places.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desinscribing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={desinscribing}
              onClick={(e) => {
                e.preventDefault();
                confirmerDesinscription();
              }}
            >
              {desinscribing ? "Désinscription…" : "Se désinscrire"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Evenements;

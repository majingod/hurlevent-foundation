import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarDays, MapPin, Users, Sparkles } from "lucide-react";

/* ---------- types ---------- */
interface Evenement {
  id: string;
  titre: string | null;
  date_evenement: string | null;
  date_fin: string | null;
  lieu: string | null;
  type_evenement: string | null;
  xp_recompense: number | null;
  max_participants: number | null;
  description: string | null;
  nb_inscrits: number;
}

interface Personnage {
  id: string;
  nom: string | null;
}

/* ---------- helpers ---------- */
const formatDate = (d: string | null) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const typeBadge = (t: string | null) => {
  switch (t) {
    case "mini_gn":
      return <Badge className="bg-blue-700 text-foreground hover:bg-blue-700">Mini GN</Badge>;
    case "gn_regulier":
      return <Badge className="bg-green-700 text-foreground hover:bg-green-700">GN Régulier</Badge>;
    case "entretien_terrain":
      return <Badge className="bg-primary text-primary-foreground hover:bg-primary">Entretien du Terrain</Badge>;
    default:
      return null;
  }
};

const xpLabel = (ev: Evenement) => {
  const xp = ev.xp_recompense ?? 0;
  if (ev.type_evenement === "gn_regulier") return `${xp} XP + 1 niveau`;
  return `${xp} XP`;
};

/* ---------- component ---------- */
const Evenements = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [inscriptions, setInscriptions] = useState<Set<string>>(new Set());
  const [personnages, setPersonnages] = useState<Personnage[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Evenement | null>(null);
  const [selectedPersonnage, setSelectedPersonnage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      // Fetch events with inscription count
      const { data: evData } = await supabase
        .from("evenements")
        .select("*")
        .eq("est_publie", true)
        .order("date_evenement", { ascending: true });

      const events: Evenement[] = [];
      for (const ev of evData ?? []) {
        const { count } = await supabase
          .from("inscriptions_evenements")
          .select("*", { count: "exact", head: true })
          .eq("evenement_id", ev.id)
          .eq("statut", "present");
        events.push({ ...ev, nb_inscrits: count ?? 0 });
      }
      setEvenements(events);

      if (user) {
        const { data: inscData } = await supabase
          .from("inscriptions_evenements")
          .select("evenement_id")
          .eq("joueur_id", user.id);
        setInscriptions(new Set((inscData ?? []).map((i) => i.evenement_id!)));

        const { data: persoData } = await supabase
          .from("personnages")
          .select("id, nom")
          .eq("joueur_id", user.id)
          .eq("est_actif", true)
          .eq("est_mort", false);
        setPersonnages((persoData ?? []) as Personnage[]);
      }

      setLoading(false);
    };
    load();
  }, [user]);

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
    const joueurId = session?.user?.id;
    if (!joueurId) {
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
        setInscriptions((prev) => new Set(prev).add(selectedEvent.id));
        setModalOpen(false);
      } else {
        toast.error("Erreur lors de l'inscription.");
      }
    } else {
      toast.success("Inscription envoyée ! En attente de confirmation.");
      setInscriptions((prev) => new Set(prev).add(selectedEvent.id));
      setModalOpen(false);
    }
  };

  const isComplet = (ev: Evenement) =>
    ev.max_participants != null && ev.nb_inscrits >= ev.max_participants;

  return (
    <div className="container py-12">
      <h1 className="mb-8 font-heading text-3xl font-bold text-primary md:text-4xl">
        Événements
      </h1>

      {loading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : evenements.length === 0 ? (
        <p className="text-muted-foreground">Aucun événement publié pour le moment.</p>
      ) : (
        <div className="space-y-6">
          {evenements.map((ev) => {
            const complet = isComplet(ev);
            const dejaInscrit = inscriptions.has(ev.id);

            return (
              <Card key={ev.id} className="border-primary/10">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-3">
                    {typeBadge(ev.type_evenement)}
                    {complet && (
                      <Badge variant="destructive">Complet</Badge>
                    )}
                  </div>
                  <CardTitle className="font-heading text-xl">{ev.titre}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-primary/60" />
                      {formatDate(ev.date_evenement)}
                      {ev.date_fin && <> au {formatDate(ev.date_fin)}</>}
                    </span>
                    {ev.lieu && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-primary/60" /> {ev.lieu}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-primary/60" /> {xpLabel(ev)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-primary/60" />
                      {ev.nb_inscrits} / {ev.max_participants ?? "∞"} places
                    </span>
                  </div>

                  {dejaInscrit ? (
                    <Button disabled size="sm" variant="secondary">
                      Déjà inscrit
                    </Button>
                  ) : complet ? (
                    <Button disabled size="sm" variant="secondary">
                      Complet
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => openModal(ev)}>
                      S'inscrire
                    </Button>
                  )}
                </CardContent>
              </Card>
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
    </div>
  );
};

export default Evenements;


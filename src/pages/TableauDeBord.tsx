import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CalendarDays,
  MapPin,
  Users,
  Sparkles,
  Shield,
  Swords,
  Bell,
  Plus,
  Eye,
  Pencil,
} from "lucide-react";

/* ---------- types ---------- */
interface PersonnageComplet {
  id: string;
  nom: string | null;
  niveau: number | null;
  xp_total: number | null;
  xp_depense: number | null;
  pv_max: number;
  ps_max: number;
  race_nom: string | null;
  classe_nom: string | null;
}

interface ProchainEvenement {
  id: string | null;
  titre: string | null;
  date_evenement: string | null;
  date_fin: string | null;
  lieu: string | null;
  type_evenement: string | null;
  xp_recompense: number | null;
  nb_inscrits: number | null;
  places_restantes: number | null;
}

interface Inscription {
  titre: string | null;
  date_evenement: string | null;
  statut: string | null;
}

interface Notification {
  id: string;
  message: string | null;
  created_at: string | null;
}

interface PersonnageSimple {
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

const typeLabel = (t: string | null) => {
  switch (t) {
    case "mini_gn": return "Mini GN";
    case "gn_regulier": return "GN Régulier";
    case "entretien_terrain": return "Entretien du Terrain";
    default: return t ?? "";
  }
};

const statutBadge = (s: string | null) => {
  switch (s) {
    case "en_attente":
      return <Badge className="bg-yellow-600 hover:bg-yellow-600 text-foreground">En attente</Badge>;
    case "confirme":
      return <Badge className="bg-green-700 hover:bg-green-700 text-foreground">Confirmé</Badge>;
    case "present":
      return <Badge className="bg-blue-700 hover:bg-blue-700 text-foreground">Présent</Badge>;
    case "annule":
      return <Badge variant="destructive">Annulé</Badge>;
    case "absent":
      return <Badge variant="secondary">Absent</Badge>;
    default:
      return <Badge variant="outline">{s}</Badge>;
  }
};

/* ---------- component ---------- */
const TableauDeBord = () => {
  const { user } = useAuth();

  const [personnages, setPersonnages] = useState<PersonnageComplet[]>([]);
  const [evenement, setEvenement] = useState<ProchainEvenement | null>(null);
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [inscriptionIds, setInscriptionIds] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [personnagesSimples, setPersonnagesSimples] = useState<PersonnageSimple[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPersonnage, setSelectedPersonnage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [persoRes, evRes, inscRes, notifRes] = await Promise.all([
        supabase
          .from("vue_xp_personnage")
          .select("id, nom, niveau, xp_total, xp_depense, pv_max, ps_max, race_nom, classe_nom")
          .eq("joueur_id", user.id)
          .eq("est_actif", true)
          .eq("est_mort", false)
          .order("nom"),
        supabase.from("vue_prochain_evenement").select("*").maybeSingle(),
        supabase
          .from("vue_inscriptions_resumees")
          .select("evenement_titre, date_evenement, statut, evenement_id")
          .eq("joueur_id", user.id)
          .order("date_evenement", { ascending: false })
          .limit(5),
        supabase
          .from("notifications")
          .select("id, message, created_at")
          .eq("user_id", user.id)
          .eq("lu", false)
          .order("created_at", { ascending: false }),
      ]);

      setPersonnages((persoRes.data ?? []) as PersonnageComplet[]);
      setEvenement(evRes.data as ProchainEvenement | null);

      const inscData = (inscRes.data ?? []) as any[];
      setInscriptions(
        inscData.map((i) => ({
          titre: i.evenement_titre,
          date_evenement: i.date_evenement,
          statut: i.statut,
        }))
      );
      setInscriptionIds(new Set(inscData.map((i: any) => i.evenement_id).filter(Boolean)));

      setNotifications((notifRes.data ?? []) as Notification[]);

      // For inscription modal
      const { data: simpData } = await supabase
        .from("personnages")
        .select("id, nom")
        .eq("joueur_id", user.id)
        .eq("est_actif", true)
        .eq("est_mort", false);
      setPersonnagesSimples((simpData ?? []) as PersonnageSimple[]);

      setLoading(false);
    };
    load();
  }, [user]);

  const marquerLu = async (id: string) => {
    await supabase.from("notifications").update({ lu: true }).eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const openModal = () => {
    setSelectedPersonnage(personnagesSimples.length > 0 ? personnagesSimples[0].id : null);
    setModalOpen(true);
  };

  const confirmerInscription = async () => {
    if (!evenement?.id || !user) return;
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
        evenement_id: evenement.id,
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
        setInscriptionIds((prev) => new Set(prev).add(evenement.id!));
        setModalOpen(false);
      } else {
        toast.error("Erreur lors de l'inscription.");
      }
    } else {
      toast.success("Inscription envoyée ! En attente de confirmation.");
      setInscriptionIds((prev) => new Set(prev).add(evenement.id!));
      setModalOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-12">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  const dejaInscritEv = evenement?.id ? inscriptionIds.has(evenement.id) : false;
  const evComplet = evenement?.places_restantes != null && evenement.places_restantes <= 0;

  return (
    <div className="container space-y-12 py-12">
      <h1 className="font-heading text-3xl font-bold text-primary md:text-4xl">
        Tableau de bord
      </h1>

      {/* ── Section 1 : Mes personnages ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold text-primary">Mes personnages</h2>
          <Button asChild size="sm">
            <Link to="/personnage/nouveau">
              <Plus className="mr-1 h-4 w-4" /> Créer un nouveau personnage
            </Link>
          </Button>
        </div>

        {personnages.length === 0 ? (
          <Card className="border-primary/10">
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <p className="text-muted-foreground">Vous n'avez pas encore de personnage.</p>
              <Button asChild>
                <Link to="/personnage/nouveau">Créer mon personnage</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {personnages.map((p) => {
              const xpTotal = p.xp_total ?? 0;
              const xpDepense = p.xp_depense ?? 0;
              const xpDispo = xpTotal - xpDepense;
              const progressPct = xpTotal > 0 ? (xpDepense / xpTotal) * 100 : 0;

              return (
                <Card key={p.id} className="border-primary/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading text-lg">
                      {p.nom ?? "Sans nom"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {p.race_nom} · {p.classe_nom} · Niveau {p.niveau ?? 1}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>XP dépensé : {xpDepense} / {xpTotal}</span>
                        <span>XP disponible : {xpDispo}</span>
                      </div>
                      <Progress value={progressPct} className="h-2" />
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Shield className="h-3.5 w-3.5 text-primary/60" /> PV max : {p.pv_max}
                      </span>
                      <span className="flex items-center gap-1">
                        <Swords className="h-3.5 w-3.5 text-primary/60" /> PS max : {p.ps_max}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/personnage/${p.id}`}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> Voir ma fiche
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/personnage/${p.id}/edit`}>
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Modifier
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 2 : Prochain événement ── */}
      <section className="space-y-4">
        <h2 className="font-heading text-2xl font-bold text-primary">Prochain événement</h2>
        {evenement ? (
          <Card className="border-primary/10">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="bg-primary/20 text-primary hover:bg-primary/20">
                  {typeLabel(evenement.type_evenement)}
                </Badge>
                {evenement.xp_recompense != null && (
                  <span className="flex items-center gap-1 text-xs text-primary/70">
                    <Sparkles className="h-3.5 w-3.5" /> {evenement.xp_recompense} XP
                  </span>
                )}
              </div>
              <CardTitle className="font-heading text-xl">{evenement.titre}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-primary/60" />
                  {formatDate(evenement.date_evenement)}
                  {evenement.date_fin && <> au {formatDate(evenement.date_fin)}</>}
                </span>
                {evenement.lieu && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary/60" /> {evenement.lieu}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary/60" />
                  {evenement.nb_inscrits ?? 0} inscrit(s)
                  {evenement.places_restantes != null && (
                    <> · {evenement.places_restantes} place(s) restante(s)</>
                  )}
                </span>
              </div>

              {dejaInscritEv ? (
                <Button disabled size="sm" variant="secondary">Déjà inscrit</Button>
              ) : evComplet ? (
                <Button disabled size="sm" variant="secondary">Complet</Button>
              ) : (
                <Button size="sm" onClick={openModal}>S'inscrire</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <p className="text-muted-foreground">Aucun événement à venir pour le moment.</p>
        )}
      </section>

      {/* ── Section 3 : Mes inscriptions ── */}
      <section className="space-y-4">
        <h2 className="font-heading text-2xl font-bold text-primary">Mes inscriptions</h2>
        {inscriptions.length === 0 ? (
          <p className="text-muted-foreground">Aucune inscription pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {inscriptions.map((insc, i) => (
              <Card key={i} className="border-primary/10">
                <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-medium">{insc.titre}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(insc.date_evenement)}</p>
                  </div>
                  {statutBadge(insc.statut)}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 4 : Notifications ── */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 font-heading text-2xl font-bold text-primary">
          <Bell className="h-5 w-5" /> Notifications
        </h2>
        {notifications.length === 0 ? (
          <p className="text-muted-foreground">Aucune nouvelle notification.</p>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <Card key={n.id} className="border-primary/10">
                <CardContent className="flex items-center justify-between gap-4 py-3">
                  <p className="text-sm">{n.message}</p>
                  <Button size="sm" variant="ghost" onClick={() => marquerLu(n.id)}>
                    Marquer comme lu
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Modale d'inscription ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              S'inscrire à {evenement?.titre}
            </DialogTitle>
            <DialogDescription>
              Choisissez le personnage avec lequel vous souhaitez participer.
            </DialogDescription>
          </DialogHeader>

          {personnagesSimples.length === 0 ? (
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
                {personnagesSimples.map((p) => (
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

export default TableauDeBord;


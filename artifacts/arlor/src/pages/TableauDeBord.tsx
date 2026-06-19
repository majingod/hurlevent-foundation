import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  Loader2,
  Plus,
  Trash2,
  User,
  Edit2,
  MoreVertical,
  ArrowRightLeft,
  ScrollText,
  Wallet,
  Coins,
  TrendingUp,
  Ban,
  Lock,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfil } from "@/contexts/ProfilContext";
import BoutonRemodeler from "@/components/personnage/BoutonRemodeler";
import ModaleTransfertPersonnage from "@/components/personnage/ModaleTransfertPersonnage";
import { HistoriqueBanque } from "@/components/personnage/sections/HistoriqueBanque";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import {
  CarteEvenementJoueur,
  type EvenementPublie,
} from "@/components/evenements/CarteEvenementJoueur";
import { ModalesInscription } from "@/components/evenements/ModalesInscription";
import { useInscriptionEvenements } from "@/hooks/useInscriptionEvenements";
import CarteNotifications from "@/components/notifications/CarteNotifications";

interface PersonnageResume {
  id: string;
  joueur_id: string;
  nom: string | null;
  niveau: number;
  xp_total: number;
  xp_depense: number;
  etape_creation: number;
  created_at: string;
  race_nom: string;
  classe_nom: string;
  est_finalise: boolean;
  gn_completes: number;
  mini_gn_completes: number;
  ouvertures_terrain: number;
  etat: string | null;
  evenement_inscrit_titre: string | null;
  evenement_inscrit_date: string | null;
  dans_fenetre_gel: boolean | null;
}

// Libellé de progression d'un personnage (segments non nuls uniquement).
const progressionLabel = (p: PersonnageResume): string => {
  const segs: string[] = [];
  if (p.gn_completes) segs.push(`${p.gn_completes} GN régulier${p.gn_completes > 1 ? "s" : ""}`);
  if (p.mini_gn_completes) segs.push(`${p.mini_gn_completes} mini-GN`);
  if (p.ouvertures_terrain) segs.push(`${p.ouvertures_terrain} ouverture${p.ouvertures_terrain > 1 ? "s" : ""}`);
  return segs.length === 0 ? "N'a participé à aucun événement" : segs.join(" · ");
};

// ASSOUPLIR-GEL : compte à rebours avant le gel (24 h avant l'événement inscrit).
const CompteARebours = ({
  titre,
  dateEvenement,
  dansFenetre,
}: {
  titre: string;
  dateEvenement: string | null;
  dansFenetre: boolean | null;
}) => {
  const seuil = dateEvenement
    ? new Date(dateEvenement).getTime() - 24 * 3600 * 1000
    : null;
  const [restant, setRestant] = useState<number>(() =>
    seuil ? seuil - Date.now() : 0
  );
  useEffect(() => {
    if (!seuil || dansFenetre) return;
    const id = setInterval(() => setRestant(seuil - Date.now()), 30000);
    setRestant(seuil - Date.now());
    return () => clearInterval(id);
  }, [seuil, dansFenetre]);

  if (dansFenetre) {
    return (
      <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/[0.07] px-3 py-2">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-red-300">
          🔒 Personnage bloqué
        </p>
        <p className="mt-1 text-[11.5px] text-white/70">
          Modifications fermées jusqu'à la confirmation des présences —{" "}
          <span className="font-semibold text-gold">{titre}</span>
        </p>
      </div>
    );
  }

  const total = Math.max(0, restant);
  const j = Math.floor(total / 86400000);
  const h = Math.floor((total % 86400000) / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  return (
    <div className="mb-3 rounded-lg border border-amber-500/28 bg-amber-500/[0.07] px-3 py-2">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-300">
        ⏳ Blocage des modifications dans
      </p>
      <p className="mt-0.5 text-[18px] font-bold tabular-nums tracking-wide text-foreground">
        {j} j {h} h {m} min
      </p>
      <p className="mt-1 text-[11.5px] text-white/60">
        Puis verrouillé jusqu'à la confirmation des présences —{" "}
        <span className="font-semibold text-gold">{titre}</span>
      </p>
    </div>
  );
};

interface SoldeBanque {
  solde: number | null;
  total_gagne: number | null;
  total_transfere: number | null;
}

// Banque XP au niveau du joueur (réserve commune). Affichage seul :
// le versement vers un personnage se fait depuis sa fiche (BanqueXpCard).
const CarteBanqueJoueur = ({ joueurId }: { joueurId: string }) => {
  const { data: banque } = useQuery({
    queryKey: ["banque-joueur", joueurId],
    queryFn: async (): Promise<SoldeBanque> => {
      const { data, error } = await supabase
        .from("vue_banque_joueur")
        .select("solde, total_gagne, total_transfere")
        .eq("joueur_id", joueurId)
        .maybeSingle();
      if (error) throw error;
      return data ?? { solde: 0, total_gagne: 0, total_transfere: 0 };
    },
    enabled: !!joueurId,
  });

  const solde = banque?.solde ?? 0;
  const aGagne = (banque?.total_gagne ?? 0) > 0;

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-heading text-gold">
          <Wallet className="h-4 w-4" />
          Banque XP
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-4xl leading-none text-gold">{solde}</span>
          <span className="text-sm text-muted-foreground">XP à répartir</span>
        </div>

        {aGagne && (
          <div className="flex gap-5 text-sm text-muted-foreground">
            <span>
              Total gagné{" "}
              <span className="font-medium text-foreground">{banque?.total_gagne ?? 0}</span>
            </span>
            <span>
              Transféré{" "}
              <span className="font-medium text-foreground">{banque?.total_transfere ?? 0}</span>
            </span>
          </div>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Ta réserve d'XP commune. L'XP des <span className="text-white/80">mini-GN</span> et des{" "}
          <span className="text-white/80">ouvertures de terrain</span> arrive ici ; tu la répartis
          ensuite sur le personnage de ton choix depuis sa fiche. Les GN réguliers, eux, donnent l'XP
          directement au personnage présent.
        </p>

        {solde > 0 && (
          <p className="text-xs text-gold/80">
            Ouvre la fiche d'un personnage pour répartir ton XP.
          </p>
        )}

        <div className="border-t border-white/10 pt-3">
          <p className="text-xs font-medium text-muted-foreground">Mouvements récents</p>
          <HistoriqueBanque joueurId={joueurId} />
        </div>
      </CardContent>
    </Card>
  );
};

const SectionProchainEvenement = () => {
  const inscription = useInscriptionEvenements();

  // Cache partagé avec la page Événements via la queryKey ["evenements-publies"].
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

  // « Prochain » = le plus proche dont la date est à venir (calcul client-side
  // pour réutiliser le cache complet partagé avec la page Événements).
  const prochain = useMemo(() => {
    const now = Date.now();
    return (
      evenements
        .filter(
          (e) =>
            e.date_evenement &&
            new Date(e.date_evenement).getTime() >= now,
        )
        .sort(
          (a, b) =>
            new Date(a.date_evenement!).getTime() -
            new Date(b.date_evenement!).getTime(),
        )[0] ?? null
    );
  }, [evenements]);

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-xl text-gold">Prochain événement</h2>
      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : prochain ? (
        <CarteEvenementJoueur
          ev={prochain}
          statut={inscription.statutPour(prochain)}
          onInscrire={inscription.ouvrirInscription}
          onDesinscrire={(e) =>
            inscription.ouvrirDesinscription(e, inscription.enAttenteIdsPour(e))
          }
        />
      ) : (
        <Card className="border-white/10 bg-white/5 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <CalendarDays className="mb-3 h-10 w-10 text-white/20" />
            <p className="text-muted-foreground">Aucun événement à venir</p>
          </CardContent>
        </Card>
      )}
      <ModalesInscription ctrl={inscription} />
    </div>
  );
};

const TableauDeBord = () => {
  const { user } = useAuth();
  const { joueurId, rechargerProfils } = useProfil();
  const queryClient = useQueryClient();
  const [personnageASupprimer, setPersonnageASupprimer] = useState<PersonnageResume | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [personnageATransferer, setPersonnageATransferer] = useState<PersonnageResume | null>(null);
  const navigate = useNavigate();

  // DATA-FIRST : vue_personnages_joueur retourne directement race_nom / classe_nom
  // + les compteurs de progression (gn_completes / mini_gn_completes / ouvertures_terrain)
  const {
    data: personnages = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["mes-personnages", joueurId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vue_personnages_joueur")
        .select("*")
        .eq("joueur_id", joueurId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PersonnageResume[];
    },
    enabled: !!joueurId,
  });

  const supprimerPersonnage = async () => {
    if (!personnageASupprimer) return;

    try {
      setSuppressionEnCours(true);
      const { data: deleted, error: deleteError } = await supabase
        .from("personnages")
        .delete()
        .eq("id", personnageASupprimer.id)
        .select("id");

      // FK inscriptions_evenements (NO ACTION) : un perso inscrit a un evenement
      // ne peut pas etre supprime tant qu'il est inscrit.
      if (deleteError) {
        if (deleteError.code === "23503") {
          throw new Error(
            "Ce personnage est inscrit à un événement. Désinscris-toi d'abord, puis réessaie."
          );
        }
        throw deleteError;
      }

      // Garde-fou : si 0 ligne supprimee, ne jamais afficher un faux succes.
      if (!deleted || deleted.length === 0) {
        throw new Error(
          "La suppression n'a pas pu être effectuée. Réessaie, ou contacte un animateur si le problème persiste."
        );
      }

      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "mes-personnages",
      });
      void rechargerProfils();
      toast({
        title: "Personnage supprimé",
        description: `Le personnage «${personnageASupprimer.nom}» a été supprimé.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erreur lors de la suppression",
        description: err.message,
      });
    } finally {
      setSuppressionEnCours(false);
      setPersonnageASupprimer(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading text-gold">Tableau de bord</h1>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
        <Link to="/personnage/nouveau">
          <Button className="bg-gold hover:bg-gold/80 text-black font-bold">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau personnage
          </Button>
        </Link>
      </div>

      {joueurId && <CarteBanqueJoueur joueurId={joueurId} />}

      <SectionProchainEvenement />

      <CarteNotifications />

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-6">
            <p className="text-destructive">{(error as Error).message}</p>
          </CardContent>
        </Card>
      )}

      {personnages.length === 0 ? (
        <Card className="border-white/10 bg-white/5 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <User className="mb-4 h-12 w-12 text-white/20" />
            <h3 className="text-xl font-heading text-white/80">Aucun personnage actif</h3>
            <p className="mb-6 text-muted-foreground">
              Vous n'avez pas encore créé de personnage. Commencez votre aventure maintenant !
            </p>
            <Link to="/personnage/nouveau">
              <Button variant="outline">Créer mon premier personnage</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {personnages.map((p) => (
            <Card key={p.id} className={`group overflow-hidden border-white/10 bg-white/5 transition-all hover:border-gold/30 ${p.etat === "bloque" ? "opacity-70" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-heading text-gold">{p.nom}</CardTitle>
                    {p.etat === "bloque" ? (
                      <Badge variant="outline" className="gap-1 border-white/25 bg-white/10 text-white/60">
                        <Ban className="h-3 w-3" /> Bloqué · lecture seule
                      </Badge>
                    ) : p.est_finalise ? (
                      <Badge className="border border-green-600/30 bg-green-600/20 text-green-400">
                        Finalisé
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-600/40 bg-amber-600/10 text-amber-400">
                        Brouillon
                      </Badge>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-white/60 hover:bg-white/10 hover:text-white"
                        aria-label="Actions du personnage"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-white/10 bg-slate-900 text-white">
                      <DropdownMenuItem
                        onClick={() => navigate(`/personnage/${p.id}/journal`)}
                        className="cursor-pointer focus:bg-white/10"
                      >
                        <ScrollText className="mr-2 h-4 w-4" />
                        Journal
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/10" />
                      <DropdownMenuItem
                        onClick={() => setPersonnageATransferer(p)}
                        disabled={p.etat === "gele" || p.etat === "mort" || p.etat === "bloque"}
                        className="cursor-pointer focus:bg-white/10"
                      >
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        Transférer…
                      </DropdownMenuItem>
                      {(p.etat === "gele" || p.etat === "mort" || p.etat === "bloque") && (
                        <div className="px-2 pb-1.5 text-xs text-white/40">
                          {p.etat === "gele"
                            ? "inscrit à un GN"
                            : p.etat === "mort"
                              ? "personnage mort"
                              : "personnage bloqué"}
                        </div>
                      )}
                      <DropdownMenuSeparator className="bg-white/10" />
                      <DropdownMenuItem
                        onClick={() => setPersonnageASupprimer(p)}
                        disabled={p.etat === "bloque"}
                        className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-300"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </DropdownMenuItem>
                      {p.etat === "bloque" && (
                        <div className="px-2 pb-1.5 text-xs text-white/40">
                          bloqué — contactez un animateur
                        </div>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {p.evenement_inscrit_titre && (
                  <CompteARebours
                    titre={p.evenement_inscrit_titre}
                    dateEvenement={p.evenement_inscrit_date}
                    dansFenetre={p.dans_fenetre_gel}
                  />
                )}
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><span className="text-white/60">Race :</span> {p.race_nom}</p>
                  <p><span className="text-white/60">Classe :</span> {p.classe_nom}</p>
                  <p><span className="text-white/60">Niveau :</span> {p.niveau}</p>
                </div>

                {p.est_finalise ? (
                  <>
                    <div
                      className={`mt-3 flex items-center justify-between rounded-lg border px-3 py-2 ${
                        p.xp_total - p.xp_depense > 0
                          ? "border-gold/35 bg-gold/10"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Coins
                          className={`h-4 w-4 ${
                            p.xp_total - p.xp_depense > 0 ? "text-gold" : "text-muted-foreground"
                          }`}
                        />
                        XP disponible
                      </span>
                      <span
                        className={`font-heading text-lg ${
                          p.xp_total - p.xp_depense > 0 ? "text-gold" : "text-muted-foreground"
                        }`}
                      >
                        {p.xp_total - p.xp_depense}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {p.xp_depense} / {p.xp_total} XP dépensés
                    </p>
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5 shrink-0 text-gold" />
                      <span>{progressionLabel(p)}</span>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    <span className="text-white/60">XP de départ :</span> {p.xp_total}
                  </p>
                )}

                <div className="mt-6 flex flex-col gap-2">
                  {p.est_finalise && (
                    <Link to={`/personnage/${p.id}`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full border-white/20 hover:bg-white/5">
                        <User className="mr-2 h-4 w-4" />
                        Voir la fiche
                        {p.etat === "bloque" && <Lock className="ml-2 h-3.5 w-3.5 text-white/40" />}
                      </Button>
                    </Link>
                  )}

                  {p.est_finalise && p.etat !== "bloque" && (
                    <BoutonRemodeler personnageId={p.id} compact />
                  )}

                  {!p.est_finalise && p.etat !== "bloque" && (
                    <Link
                      to={`/personnage/nouveau?id=${p.id}&etape=${(p.etape_creation ?? 0) >= 11 ? 11 : Math.max(1, (p.etape_creation ?? 0) + 1)}`}
                      className="w-full"
                    >
                      <Button variant="secondary" size="sm" className="w-full bg-gold/10 text-gold hover:bg-gold/20 border-gold/20">
                        <Edit2 className="mr-2 h-4 w-4" />
                        Continuer la création
                      </Button>
                    </Link>
                  )}

                  {p.etat === "bloque" && (
                    <p className="flex items-center gap-1.5 text-xs text-white/40">
                      <Lock className="h-3 w-3" />
                      Personnage bloqué par le staff — consultable, non modifiable.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!personnageASupprimer} onOpenChange={(open) => { if (!open) setPersonnageASupprimer(null); }}>
        <DialogContent className="border-white/10 bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-gold font-heading">Supprimer le personnage</DialogTitle>
            <DialogDescription className="text-white/70">
              Êtes-vous sûr de vouloir supprimer le personnage «{personnageASupprimer?.nom}» ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPersonnageASupprimer(null)} disabled={suppressionEnCours}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={supprimerPersonnage} disabled={suppressionEnCours}>
              {suppressionEnCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModaleTransfertPersonnage
        personnage={personnageATransferer}
        open={!!personnageATransferer}
        onOpenChange={(o) => { if (!o) setPersonnageATransferer(null); }}
        onTransfered={() =>
          queryClient.invalidateQueries({
            predicate: (q) =>
              Array.isArray(q.queryKey) && q.queryKey[0] === "mes-personnages",
          })
        }
      />
    </div>
  );
};

export default TableauDeBord;

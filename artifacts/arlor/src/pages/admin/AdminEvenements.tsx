import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  ChevronsUpDown,
  Clock,
  Users,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// ============================================================================
// Types & helpers
// ============================================================================

type StatutInscription = "inscrit" | "present" | "absent" | "en_attente";

type TypeEvenement = "gn_regulier" | "mini_gn" | "ouverture_terrain";

interface Evenement {
  id: string;
  titre: string | null;
  description: string | null;
  date_evenement: string | null;
  date_fin: string | null;
  lieu: string | null;
  adresse_physique: string | null;
  max_participants: number | null;
  type_evenement: string | null;
  xp_recompense: number | null;
  niveaux_recompense: number | null;
  est_publie: boolean | null;
  est_termine: boolean | null;
  created_at: string | null;
}

interface Inscription {
  id: string;
  evenement_id: string;
  personnage_id: string | null;
  joueur_id: string | null;
  statut: string | null;
  personnage_nom: string | null;
  joueur_nom: string | null;
}

interface PersonnageOption {
  id: string;
  nom: string | null;
  joueur_nom: string | null;
}

const TYPE_LABELS: Record<TypeEvenement, string> = {
  gn_regulier: "GN régulier",
  mini_gn: "Mini-GN",
  ouverture_terrain: "Ouverture de terrain",
};

const TYPE_DEFAULTS: Record<TypeEvenement, { xp: number; niveaux: number }> = {
  gn_regulier: { xp: 15, niveaux: 1 },
  mini_gn: { xp: 15, niveaux: 0 },
  ouverture_terrain: { xp: 10, niveaux: 0 },
};

const STATUT_LABELS: Record<string, string> = {
  inscrit: "Inscrit",
  en_attente: "Inscrit",
  present: "Présent",
  absent: "Absent",
};

const STATUT_OPTIONS: { value: StatutInscription; label: string }[] = [
  { value: "inscrit", label: "Inscrit" },
  { value: "present", label: "Présent" },
  { value: "absent", label: "Absent" },
];

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "EEE d MMM yyyy 'à' HH:mm", { locale: fr });
  } catch {
    return iso;
  }
};

const toLocalInputValue = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInputValue = (value: string): string | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

interface RpcResult {
  succes?: boolean;
  message?: string;
}

// ============================================================================
// Page principale
// ============================================================================

const AdminEvenements = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"publies" | "brouillons" | "archives">("publies");
  const [editing, setEditing] = useState<Evenement | null>(null);
  const [creating, setCreating] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  // Cast `as any` requis tant que les nouvelles colonnes/RPC ne sont pas
  // remontées dans `types.ts` (la migration phase_2_evenements_admin.sql doit
  // être appliquée et les types Supabase régénérés).
  const fromEvts = () => (supabase.from as any)("evenements");
  const fromInscr = () => (supabase.from as any)("inscriptions_evenements");

  const { data: evenements, isLoading } = useQuery({
    queryKey: ["admin-evenements-full"],
    queryFn: async () => {
      const { data, error } = await fromEvts()
        .select("*")
        .order("date_evenement", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Evenement[];
    },
  });

  const filtered = useMemo(() => {
    if (!evenements) return { publies: [], brouillons: [], archives: [] };
    const q = searchTerm.trim().toLowerCase();
    const match = (e: Evenement) =>
      !q ||
      (e.titre ?? "").toLowerCase().includes(q) ||
      (e.description ?? "").toLowerCase().includes(q) ||
      (e.lieu ?? "").toLowerCase().includes(q);
    return {
      publies: evenements.filter((e) => e.est_publie && !e.est_termine && match(e)),
      brouillons: evenements.filter((e) => !e.est_publie && !e.est_termine && match(e)),
      archives: evenements.filter((e) => e.est_termine && match(e)),
    };
  }, [evenements, searchTerm]);

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, est_publie }: { id: string; est_publie: boolean }) => {
      const { error } = await fromEvts().update({ est_publie }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.est_publie ? "Événement publié" : "Événement repassé en brouillon");
      qc.invalidateQueries({ queryKey: ["admin-evenements-full"] });
    },
    onError: () => toast.error("Erreur lors de la mise à jour."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromEvts().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Événement supprimé");
      qc.invalidateQueries({ queryKey: ["admin-evenements-full"] });
    },
    onError: () => toast.error("Suppression impossible."),
  });

  const cloturerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase.rpc as any)("cloturer_evenement", {
        p_evenement_id: id,
      });
      if (error) throw error;
      return data as RpcResult;
    },
    onSuccess: (data) => {
      if (data?.succes === false) {
        toast.error(data?.message ?? "Clôture impossible.");
      } else {
        toast.success(data?.message ?? "Événement terminé.");
        qc.invalidateQueries({ queryKey: ["admin-evenements-full"] });
        qc.invalidateQueries({ queryKey: ["inscriptions"] });
      }
      setClosingId(null);
    },
    onError: () => {
      toast.error("Erreur lors de la clôture.");
      setClosingId(null);
    },
  });

  const eventToClose = useMemo(
    () => evenements?.find((e) => e.id === closingId) ?? null,
    [evenements, closingId],
  );

  return (
    <AdminLayout
      title="Gestion des événements"
      searchPlaceholder="Rechercher un événement…"
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
    >
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button
            onClick={() => setCreating(true)}
            className="gap-2"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            Nouvel événement
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="publies">
              Publiés
              {filtered.publies.length > 0 && (
                <span className="ml-2 rounded-full bg-primary/20 px-2 text-xs">
                  {filtered.publies.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="brouillons">
              Brouillons
              {filtered.brouillons.length > 0 && (
                <span className="ml-2 rounded-full bg-primary/20 px-2 text-xs">
                  {filtered.brouillons.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="archives">
              Archives
              {filtered.archives.length > 0 && (
                <span className="ml-2 rounded-full bg-primary/20 px-2 text-xs">
                  {filtered.archives.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="publies" className="mt-4">
            <EventList
              isLoading={isLoading}
              events={filtered.publies}
              emptyMessage="Aucun événement publié pour le moment."
              variant="published"
              onEdit={setEditing}
              onUnpublish={(id) =>
                togglePublishMutation.mutate({ id, est_publie: false })
              }
              onClose={(id) => setClosingId(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          </TabsContent>

          <TabsContent value="brouillons" className="mt-4">
            <EventList
              isLoading={isLoading}
              events={filtered.brouillons}
              emptyMessage="Aucun brouillon. Crée ton premier événement avec le bouton ci-dessus."
              variant="draft"
              onEdit={setEditing}
              onPublish={(id) =>
                togglePublishMutation.mutate({ id, est_publie: true })
              }
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          </TabsContent>

          <TabsContent value="archives" className="mt-4">
            <EventList
              isLoading={isLoading}
              events={filtered.archives}
              emptyMessage="Aucun événement archivé pour le moment."
              variant="archive"
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Formulaire création / édition */}
      <EventFormDialog
        open={creating || editing !== null}
        evenement={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-evenements-full"] });
        }}
      />

      {/* Confirmation de clôture */}
      <AlertDialog
        open={closingId !== null}
        onOpenChange={(o) => !o && setClosingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">
              Terminer l'événement ?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Vous êtes sur le point de clôturer{" "}
                <strong>{eventToClose?.titre ?? "cet événement"}</strong>.
              </span>
              <span className="block text-destructive">
                Cette action est <strong>irréversible</strong>.
              </span>
              <span className="block">
                L'XP ({eventToClose?.xp_recompense ?? 0}) et les niveaux (
                {eventToClose?.niveaux_recompense ?? 0}) seront distribués à
                tous les participants marqués <strong>présents</strong>.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => closingId && cloturerMutation.mutate(closingId)}
              disabled={cloturerMutation.isPending}
            >
              {cloturerMutation.isPending ? "Clôture…" : "Confirmer la clôture"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminEvenements;

// ============================================================================
// Liste d'événements
// ============================================================================

interface EventListProps {
  isLoading: boolean;
  events: Evenement[];
  emptyMessage: string;
  variant: "published" | "draft" | "archive";
  onEdit?: (e: Evenement) => void;
  onPublish?: (id: string) => void;
  onUnpublish?: (id: string) => void;
  onClose?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const EventList = ({
  isLoading,
  events,
  emptyMessage,
  variant,
  onEdit,
  onPublish,
  onUnpublish,
  onClose,
  onDelete,
}: EventListProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-9 w-full mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {events.map((evt) => (
        <EventCard
          key={evt.id}
          evt={evt}
          variant={variant}
          onEdit={onEdit}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
          onClose={onClose}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

// ============================================================================
// Carte d'événement
// ============================================================================

interface EventCardProps {
  evt: Evenement;
  variant: "published" | "draft" | "archive";
  onEdit?: (e: Evenement) => void;
  onPublish?: (id: string) => void;
  onUnpublish?: (id: string) => void;
  onClose?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const EventCard = ({
  evt,
  variant,
  onEdit,
  onPublish,
  onUnpublish,
  onClose,
  onDelete,
}: EventCardProps) => {
  const [showInscriptions, setShowInscriptions] = useState(false);
  const [showPresenceTardive, setShowPresenceTardive] = useState(false);

  const typeKey = (evt.type_evenement as TypeEvenement) ?? "gn_regulier";
  const typeLabel = TYPE_LABELS[typeKey] ?? evt.type_evenement ?? "—";

  const gpsHref = evt.adresse_physique
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.adresse_physique)}`
    : null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-heading truncate">
              {evt.titre ?? "Sans titre"}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-xs">
                {typeLabel}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {evt.xp_recompense ?? 0} XP
              </Badge>
              {(evt.niveaux_recompense ?? 0) > 0 && (
                <Badge variant="secondary" className="text-xs">
                  +{evt.niveaux_recompense} niveau
                  {(evt.niveaux_recompense ?? 0) > 1 ? "x" : ""}
                </Badge>
              )}
              {variant === "archive" && (
                <Badge className="text-xs bg-muted text-muted-foreground">
                  Archivé
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 text-sm">
        {evt.description && (
          <p className="text-muted-foreground line-clamp-2">{evt.description}</p>
        )}

        <div className="space-y-1.5 text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{formatDate(evt.date_evenement)}</span>
          </div>
          {evt.date_fin && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              <span className="truncate">Fin : {formatDate(evt.date_fin)}</span>
            </div>
          )}
          {evt.lieu && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{evt.lieu}</span>
            </div>
          )}
          {gpsHref && (
            <a
              href={gpsHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-primary hover:underline"
            >
              <Navigation className="h-4 w-4" />
              Ouvrir le GPS
            </a>
          )}
          {evt.max_participants !== null && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" />
              <span>Max {evt.max_participants} participants</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Actions selon variant */}
        <div className="flex flex-wrap gap-2">
          {variant === "draft" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onEdit?.(evt)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Modifier
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => onPublish?.(evt.id)}
              >
                Publier
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => onDelete?.(evt.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}

          {variant === "published" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setShowInscriptions((s) => !s)}
              >
                <Users className="h-3.5 w-3.5 mr-1.5" />
                {showInscriptions ? "Masquer inscrits" : "Voir inscrits"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit?.(evt)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUnpublish?.(evt.id)}
              >
                Dépublier
              </Button>
              <Button
                size="sm"
                className="w-full"
                onClick={() => onClose?.(evt.id)}
              >
                Terminer l'événement
              </Button>
            </>
          )}

          {variant === "archive" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setShowInscriptions((s) => !s)}
              >
                <Users className="h-3.5 w-3.5 mr-1.5" />
                {showInscriptions ? "Masquer inscrits" : "Voir inscrits"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setShowPresenceTardive(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Présence tardive
              </Button>
            </>
          )}
        </div>

        {showInscriptions && (
          <InscriptionsList eventId={evt.id} readOnly={variant === "archive"} />
        )}
      </CardContent>

      {/* Présence tardive (archives) */}
      {variant === "archive" && (
        <PresenceTardiveDialog
          open={showPresenceTardive}
          eventId={evt.id}
          onClose={() => setShowPresenceTardive(false)}
        />
      )}
    </Card>
  );
};

// ============================================================================
// Liste des inscriptions
// ============================================================================

const InscriptionsList = ({ eventId, readOnly }: { eventId: string; readOnly: boolean }) => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["inscriptions", eventId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("inscriptions_evenements")
        .select(
          `id, statut, evenement_id, personnage_id, joueur_id,
           personnages(nom),
           profiles(nom_affichage)`,
        )
        .eq("evenement_id", eventId);
      if (error) throw error;
      return ((data ?? []) as any[]).map((row) => ({
        id: row.id,
        evenement_id: row.evenement_id,
        personnage_id: row.personnage_id,
        joueur_id: row.joueur_id,
        statut: row.statut,
        personnage_nom: row.personnages?.nom ?? null,
        joueur_nom: row.profiles?.nom_affichage ?? null,
      })) as Inscription[];
    },
  });

  const statutMutation = useMutation({
    mutationFn: async ({
      inscriptionId,
      nouveau,
    }: {
      inscriptionId: string;
      nouveau: StatutInscription;
    }) => {
      const { data, error } = await (supabase.rpc as any)("changer_statut_inscription", {
        p_inscription_id: inscriptionId,
        p_nouveau_statut: nouveau,
      });
      if (error) throw error;
      return data as RpcResult;
    },
    onSuccess: (data) => {
      if (data?.succes === false) {
        toast.error(data?.message ?? "Statut non modifié.");
      } else {
        toast.success(data?.message ?? "Statut mis à jour.");
        qc.invalidateQueries({ queryKey: ["inscriptions", eventId] });
      }
    },
    onError: () => toast.error("Erreur lors de la mise à jour."),
  });

  if (isLoading) {
    return (
      <div className="space-y-2 mt-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic mt-2">
        Aucune inscription pour cet événement.
      </p>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      {data.map((insc) => {
        const statutValue =
          insc.statut === "en_attente" ? "inscrit" : (insc.statut ?? "inscrit");
        return (
          <div
            key={insc.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">{insc.personnage_nom ?? "Sans nom"}</p>
              {insc.joueur_nom && (
                <p className="text-xs text-muted-foreground truncate">
                  {insc.joueur_nom}
                </p>
              )}
            </div>
            {readOnly ? (
              <Badge variant="outline" className="text-xs shrink-0">
                {STATUT_LABELS[statutValue] ?? statutValue}
              </Badge>
            ) : (
              <Select
                value={statutValue}
                onValueChange={(v) =>
                  statutMutation.mutate({
                    inscriptionId: insc.id,
                    nouveau: v as StatutInscription,
                  })
                }
              >
                <SelectTrigger className="h-8 w-[120px] shrink-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// Présence tardive (archives)
// ============================================================================

interface PresenceTardiveDialogProps {
  open: boolean;
  eventId: string;
  onClose: () => void;
}

const PresenceTardiveDialog = ({ open, eventId, onClose }: PresenceTardiveDialogProps) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selected, setSelected] = useState<PersonnageOption | null>(null);

  const { data: personnages, isLoading } = useQuery({
    queryKey: ["personnages-actifs-pour-presence"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("personnages")
        .select("id, nom, profiles(nom_affichage)")
        .eq("est_actif", true)
        .order("nom");
      if (error) throw error;
      return ((data ?? []) as any[]).map((p) => ({
        id: p.id,
        nom: p.nom,
        joueur_nom: p.profiles?.nom_affichage ?? null,
      })) as PersonnageOption[];
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Aucun personnage sélectionné");
      const { data, error } = await (supabase.rpc as any)("ajouter_presence_tardive", {
        p_evenement_id: eventId,
        p_personnage_id: selected.id,
      });
      if (error) throw error;
      return data as RpcResult;
    },
    onSuccess: (data) => {
      if (data?.succes === false) {
        toast.error(data?.message ?? "Action impossible.");
      } else {
        toast.success(data?.message ?? "Présence tardive ajoutée.");
        qc.invalidateQueries({ queryKey: ["inscriptions", eventId] });
        setSelected(null);
        onClose();
      }
    },
    onError: () => toast.error("Erreur lors de l'ajout."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Ajouter une présence tardive</DialogTitle>
          <DialogDescription>
            Recherche un personnage et confirme. L'XP et les niveaux de l'événement
            lui seront automatiquement attribués.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Personnage</Label>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between"
              >
                <span className="truncate">
                  {selected
                    ? `${selected.nom ?? "Sans nom"}${
                        selected.joueur_nom ? ` — ${selected.joueur_nom}` : ""
                      }`
                    : "Sélectionner un personnage…"}
                </span>
                <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <CommandInput placeholder="Chercher un personnage…" />
                <CommandList>
                  {isLoading && (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  )}
                  <CommandEmpty>Aucun personnage trouvé.</CommandEmpty>
                  <CommandGroup>
                    {personnages?.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={`${p.nom ?? ""} ${p.joueur_nom ?? ""}`}
                        onSelect={() => {
                          setSelected(p);
                          setPopoverOpen(false);
                        }}
                      >
                        <div>
                          <p className="text-sm">{p.nom ?? "Sans nom"}</p>
                          {p.joueur_nom && (
                            <p className="text-xs text-muted-foreground">
                              {p.joueur_nom}
                            </p>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!selected || mutation.isPending}
          >
            {mutation.isPending ? "Ajout…" : "Ajouter la présence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Formulaire création / édition
// ============================================================================

interface EventFormDialogProps {
  open: boolean;
  evenement: Evenement | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  titre: string;
  description: string;
  type_evenement: TypeEvenement;
  date_evenement: string;
  date_fin: string;
  lieu: string;
  adresse_physique: string;
  max_participants: string;
  xp_recompense: string;
  niveaux_recompense: string;
}

const emptyForm: FormState = {
  titre: "",
  description: "",
  type_evenement: "gn_regulier",
  date_evenement: "",
  date_fin: "",
  lieu: "",
  adresse_physique: "",
  max_participants: "",
  xp_recompense: String(TYPE_DEFAULTS.gn_regulier.xp),
  niveaux_recompense: String(TYPE_DEFAULTS.gn_regulier.niveaux),
};

const EventFormDialog = ({ open, evenement, onClose, onSaved }: EventFormDialogProps) => {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const isEdit = !!evenement;

  useEffect(() => {
    if (!open) return;
    if (evenement) {
      const type = (evenement.type_evenement as TypeEvenement) ?? "gn_regulier";
      setForm({
        titre: evenement.titre ?? "",
        description: evenement.description ?? "",
        type_evenement: type,
        date_evenement: toLocalInputValue(evenement.date_evenement),
        date_fin: toLocalInputValue(evenement.date_fin),
        lieu: evenement.lieu ?? "",
        adresse_physique: evenement.adresse_physique ?? "",
        max_participants:
          evenement.max_participants !== null
            ? String(evenement.max_participants)
            : "",
        xp_recompense: String(
          evenement.xp_recompense ?? TYPE_DEFAULTS[type].xp,
        ),
        niveaux_recompense: String(
          evenement.niveaux_recompense ?? TYPE_DEFAULTS[type].niveaux,
        ),
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, evenement]);

  const handleTypeChange = (type: TypeEvenement) => {
    const defaults = TYPE_DEFAULTS[type];
    setForm((prev) => ({
      ...prev,
      type_evenement: type,
      xp_recompense: String(defaults.xp),
      niveaux_recompense: String(defaults.niveaux),
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.titre.trim()) throw new Error("Le titre est requis.");
      if (!form.date_evenement) throw new Error("La date de début est requise.");

      const payload = {
        titre: form.titre.trim(),
        description: form.description.trim() || null,
        type_evenement: form.type_evenement,
        date_evenement: fromLocalInputValue(form.date_evenement),
        date_fin: fromLocalInputValue(form.date_fin),
        lieu: form.lieu.trim() || null,
        adresse_physique: form.adresse_physique.trim() || null,
        max_participants: form.max_participants
          ? parseInt(form.max_participants, 10)
          : null,
        xp_recompense: parseInt(form.xp_recompense, 10) || 0,
        niveaux_recompense: parseInt(form.niveaux_recompense, 10) || 0,
      };

      if (isEdit && evenement) {
        const { error } = await (supabase.from as any)("evenements")
          .update(payload)
          .eq("id", evenement.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from as any)("evenements").insert({
          ...payload,
          est_publie: false,
          est_termine: false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Événement modifié" : "Brouillon créé");
      onSaved();
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Sauvegarde impossible.");
    },
  });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEdit ? "Modifier l'événement" : "Nouvel événement"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Mets à jour les informations de l'événement."
              : "Crée un brouillon. Tu pourras le publier ensuite."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titre">Titre *</Label>
            <Input
              id="titre"
              value={form.titre}
              onChange={(e) => update("titre", e.target.value)}
              placeholder="Ex : GN d'ouverture 2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type d'événement *</Label>
            <Select
              value={form.type_evenement}
              onValueChange={(v) => handleTypeChange(v as TypeEvenement)}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as TypeEvenement[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {TYPE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Valeurs par défaut : {TYPE_DEFAULTS[form.type_evenement].xp} XP,{" "}
              {TYPE_DEFAULTS[form.type_evenement].niveaux} niveau
              {TYPE_DEFAULTS[form.type_evenement].niveaux > 1 ? "x" : ""}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="xp">XP attribuée</Label>
              <Input
                id="xp"
                type="number"
                min={0}
                value={form.xp_recompense}
                onChange={(e) => update("xp_recompense", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="niveaux">Niveaux attribués</Label>
              <Input
                id="niveaux"
                type="number"
                min={0}
                value={form.niveaux_recompense}
                onChange={(e) => update("niveaux_recompense", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Synopsis, ambiance, points d'intrigue…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date_evenement">Date de début *</Label>
              <Input
                id="date_evenement"
                type="datetime-local"
                value={form.date_evenement}
                onChange={(e) => update("date_evenement", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_fin">Date de fin</Label>
              <Input
                id="date_fin"
                type="datetime-local"
                value={form.date_fin}
                onChange={(e) => update("date_fin", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lieu">Lieu</Label>
            <Input
              id="lieu"
              value={form.lieu}
              onChange={(e) => update("lieu", e.target.value)}
              placeholder="Ex : Camp des Loups"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adresse">Adresse physique</Label>
            <Input
              id="adresse"
              value={form.adresse_physique}
              onChange={(e) => update("adresse_physique", e.target.value)}
              placeholder="Ex : 123 Rue du Bois, Sherbrooke QC"
            />
            {form.adresse_physique && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.adresse_physique)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Navigation className="h-3 w-3" />
                Aperçu sur Google Maps
              </a>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_participants">Nombre max de participants</Label>
            <Input
              id="max_participants"
              type="number"
              min={0}
              value={form.max_participants}
              onChange={(e) => update("max_participants", e.target.value)}
              placeholder="Laisser vide si illimité"
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending
              ? "Enregistrement…"
              : isEdit
                ? "Enregistrer"
                : "Créer le brouillon"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

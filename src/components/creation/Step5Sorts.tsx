import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Sparkles, Trash2 } from "lucide-react";
import { ZONES_PAR_TYPE, COUT_ZONE, PORTEES, DUREES } from "@/constants/magie";
import {
  calculerCoutPS,
  calculerCoutXP,
  coutXpMaxAutorise,
  filterPorteesDisponibles,
  filterDureesDisponibles,
  getNoteZone,
  isZoneUnique,
} from "@/utils/calculsMagie";

interface Step5SortsProps {
  personnageId: string;
  niveauPersonnage: number;
  xpDisponible: number;
  onXpSpent: (amount: number) => void;
}

const Step5Sorts = ({ personnageId, niveauPersonnage, xpDisponible, onXpSpent }: Step5SortsProps) => {
  const queryClient = useQueryClient();

  const [cercleSelectionne, setCercleSelectionne] = useState<string | null>(null);
  const [sortId, setSortId] = useState<string | null>(null);
  const [zoneChoisie, setZoneChoisie] = useState<string>("");
  const [porteeChoisie, setPorteeChoisie] = useState<string>("");
  const [dureeChoisie, setDureeChoisie] = useState<string>("");
  const [niveau, setNiveau] = useState<number>(1);
  const [nomPersonnalise, setNomPersonnalise] = useState<string>("");

  // Cercles disponibles
  const { data: cerclesDisponibles } = useQuery({
    queryKey: ["cercles-disponibles", personnageId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_cercles_disponibles")
        .select("cercle, niveau_max_sorts")
        .eq("personnage_id", personnageId)
        .order("cercle");
      return data ?? [];
    },
  });

  const cercleObj = cerclesDisponibles?.find((c) => c.cercle === cercleSelectionne);
  const niveauMaxCercle = cercleObj?.niveau_max_sorts ?? 0;

  // Sorts du cercle
  const { data: sorts } = useQuery({
    queryKey: ["sorts-cercle", cercleSelectionne, niveauMaxCercle],
    queryFn: async () => {
      if (!cercleSelectionne) return [];
      const { data } = await supabase
        .from("sorts")
        .select("*")
        .eq("cercle", cercleSelectionne)
        .lte("niveau", niveauMaxCercle)
        .eq("est_actif", true)
        .order("nom");
      return data ?? [];
    },
    enabled: !!cercleSelectionne,
  });

  // Sorts créés
  const { data: sortsCrees, refetch: refetchSortsCrees } = useQuery({
    queryKey: ["sorts-crees", personnageId],
    queryFn: async () => {
      const { data } = await supabase
        .from("personnage_sorts")
        .select("*, sorts(nom, cercle)")
        .eq("personnage_id", personnageId)
        .order("date_acquisition");
      return data ?? [];
    },
  });

  const sortSelectionne = sorts?.find((s) => s.id === sortId);

  // Reset cascading
  useEffect(() => {
    setSortId(null);
  }, [cercleSelectionne]);

  useEffect(() => {
    if (!sortSelectionne) {
      setZoneChoisie("");
      setPorteeChoisie("");
      setDureeChoisie("");
      setNiveau(1);
      setNomPersonnalise("");
      return;
    }
    setNomPersonnalise(sortSelectionne.nom);
    setNiveau(sortSelectionne.niveau ?? 1);
    // Pré-sélection zone si unique
    if (sortSelectionne.zone_effet && isZoneUnique(sortSelectionne.zone_effet)) {
      const zones = ZONES_PAR_TYPE[sortSelectionne.zone_effet] ?? [];
      setZoneChoisie(zones[0] ?? "");
    } else {
      setZoneChoisie("");
    }
    setPorteeChoisie("");
    setDureeChoisie("");
  }, [sortId]);

  const zonesDisponibles = useMemo(() => {
    if (!sortSelectionne?.zone_effet) return [];
    return ZONES_PAR_TYPE[sortSelectionne.zone_effet] ?? [];
  }, [sortSelectionne]);

  const porteesDispo = useMemo(
    () => (sortSelectionne?.portee ? filterPorteesDisponibles(sortSelectionne.portee) : PORTEES),
    [sortSelectionne]
  );

  const dureesDispo = useMemo(
    () => (sortSelectionne?.duree ? filterDureesDisponibles(sortSelectionne.duree) : DUREES),
    [sortSelectionne]
  );

  const coutXpBase = Number(sortSelectionne?.cout_xp_base ?? 0);
  const coutXp =
    sortSelectionne && zoneChoisie && porteeChoisie && dureeChoisie
      ? calculerCoutXP(zoneChoisie, porteeChoisie, dureeChoisie, niveau, coutXpBase)
      : 0;
  const coutXpMax = coutXpMaxAutorise(niveauPersonnage);
  const coutPS = coutXp > 0 ? calculerCoutPS(coutXp) : 0;
  const depasseMax = coutXp > coutXpMax;
  const xpInsuffisant = coutXp > xpDisponible;

  const peutAjouter =
    !!sortSelectionne &&
    !!zoneChoisie &&
    !!porteeChoisie &&
    !!dureeChoisie &&
    !depasseMax &&
    !xpInsuffisant &&
    nomPersonnalise.trim().length > 0;

  const ajouterSort = async () => {
    if (!peutAjouter || !sortSelectionne) return;
    const { error } = await supabase.from("personnage_sorts").insert({
      personnage_id: personnageId,
      sort_id: sortSelectionne.id,
      niveau_sort: niveau,
      xp_depense: coutXp,
      nom_personnalise: nomPersonnalise.trim(),
      zone_choisie: zoneChoisie,
      portee_choisie: porteeChoisie,
      duree_choisie: dureeChoisie,
    });
    if (error) {
      toast.error("Erreur lors de l'ajout du sort.");
      return;
    }
    onXpSpent(coutXp);
    toast.success(`Sort "${nomPersonnalise}" ajouté.`);
    // Reset
    setSortId(null);
    setCercleSelectionne(null);
    refetchSortsCrees();
  };

  const retirerSort = async (id: string, xp: number, nom: string) => {
    const { error } = await supabase.from("personnage_sorts").delete().eq("id", id);
    if (error) {
      toast.error("Erreur lors du retrait.");
      return;
    }
    onXpSpent(-xp);
    toast.success(`Sort "${nom}" retiré.`);
    refetchSortsCrees();
  };

  const noteZone = sortSelectionne?.zone_effet ? getNoteZone(sortSelectionne.zone_effet) : null;
  const zoneEstUnique = sortSelectionne?.zone_effet ? isZoneUnique(sortSelectionne.zone_effet) : false;

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold text-foreground">
        Étape 5 — Création de sorts arcaniques
      </h2>
      <p className="text-sm text-muted-foreground">
        Créez vos sorts en personnalisant zone, portée, durée et niveau. Coût maximum autorisé :{" "}
        <strong className="text-primary">{coutXpMax} XP</strong>.
      </p>

      {/* Sélection cercle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">1. Choisir un cercle</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={cercleSelectionne ?? ""} onValueChange={setCercleSelectionne}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un cercle" />
            </SelectTrigger>
            <SelectContent>
              {cerclesDisponibles?.map((c) => (
                <SelectItem key={c.cercle!} value={c.cercle!}>
                  {c.cercle} — sorts jusqu'au niveau {c.niveau_max_sorts}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Sélection sort */}
      {cercleSelectionne && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">2. Choisir un sort</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sorts?.map((s) => (
              <Card
                key={s.id}
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  sortId === s.id ? "border-2 border-primary ring-2 ring-primary/20" : ""
                }`}
                onClick={() => setSortId(s.id)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <strong className="font-heading text-primary">{s.nom}</strong>
                    <div className="flex gap-2">
                      <Badge variant="outline">Niv. {s.niveau}</Badge>
                      {s.type_sort && <Badge variant="secondary">{s.type_sort}</Badge>}
                      <Badge>{s.cout_xp_base} XP base</Badge>
                    </div>
                  </div>
                  {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Variables */}
      {sortSelectionne && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">3. Personnaliser le sort</CardTitle>
            <CardDescription>Coût XP = (zone + portée + durée + niveau) × coefficient</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Zone */}
            <div className="space-y-2">
              <Label>Zone d'effet</Label>
              {zoneEstUnique ? (
                <Input value={zoneChoisie} readOnly className="opacity-60" />
              ) : (
                <Select value={zoneChoisie} onValueChange={setZoneChoisie}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zonesDisponibles.map((z) => (
                      <SelectItem key={z} value={z}>
                        {z} ({COUT_ZONE[z] ?? 0} pts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {noteZone && <p className="text-xs italic text-muted-foreground">{noteZone}</p>}
            </div>

            {/* Portée */}
            <div className="space-y-2">
              <Label>Portée</Label>
              <Select value={porteeChoisie} onValueChange={setPorteeChoisie}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une portée" />
                </SelectTrigger>
                <SelectContent>
                  {porteesDispo.map((p) => (
                    <SelectItem key={p.label} value={p.label}>
                      {p.label} ({p.cout} pts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Durée */}
            <div className="space-y-2">
              <Label>Durée</Label>
              <Select value={dureeChoisie} onValueChange={setDureeChoisie}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une durée" />
                </SelectTrigger>
                <SelectContent>
                  {dureesDispo.map((d) => (
                    <SelectItem key={d.label} value={d.label}>
                      {d.label} ({d.cout} pts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Niveau */}
            <div className="space-y-2">
              <Label>Niveau du sort : {niveau}</Label>
              <Slider
                value={[niveau]}
                onValueChange={(v) => setNiveau(v[0])}
                min={1}
                max={niveauMaxCercle}
                step={1}
              />
            </div>

            {/* Nom personnalisé */}
            <div className="space-y-2">
              <Label>Nom personnalisé</Label>
              <Input
                value={nomPersonnalise}
                onChange={(e) => setNomPersonnalise(e.target.value)}
                placeholder="Nom du sort"
              />
            </div>

            {/* Coûts */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Coût XP :</span>
                <strong className={depasseMax ? "text-destructive" : "text-primary"}>{coutXp} XP</strong>
              </div>
              <div className="flex justify-between">
                <span>Coût PS à l'incantation :</span>
                <strong>{coutPS} PS</strong>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Coût max autorisé :</span>
                <span>{coutXpMax} XP</span>
              </div>
              {depasseMax && (
                <p className="flex items-center gap-2 text-destructive text-xs">
                  <AlertTriangle className="h-4 w-4" />
                  Ce sort dépasse le coût maximum autorisé pour votre niveau.
                </p>
              )}
              {xpInsuffisant && !depasseMax && (
                <p className="flex items-center gap-2 text-destructive text-xs">
                  <AlertTriangle className="h-4 w-4" />
                  XP disponible insuffisant.
                </p>
              )}
            </div>

            <Button onClick={ajouterSort} disabled={!peutAjouter} className="w-full">
              <Sparkles className="mr-2 h-4 w-4" />
              Ajouter ce sort au personnage
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sorts créés */}
      {sortsCrees && sortsCrees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">Sorts créés ({sortsCrees.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortsCrees.map((ps: any) => (
              <div
                key={ps.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-primary font-heading">{ps.nom_personnalise}</strong>
                    <Badge variant="outline">{ps.sorts?.cercle}</Badge>
                    <Badge variant="secondary">Niv. {ps.niveau_sort}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ps.zone_choisie} • {ps.portee_choisie} • {ps.duree_choisie}
                  </p>
                  <p className="text-xs">
                    <strong>{ps.xp_depense} XP</strong> • {calculerCoutPS(ps.xp_depense)} PS
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => retirerSort(ps.id, ps.xp_depense, ps.nom_personnalise)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Step5Sorts;

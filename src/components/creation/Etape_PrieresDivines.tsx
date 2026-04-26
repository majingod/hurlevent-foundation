import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
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

interface Step6PrieresProps {
  personnageId: string;
  niveauPersonnage: number;
  xpDisponible: number;
  religionId: string | null;
  onXpSpent: (amount: number) => void;
}

const Step6Prieres = ({
  personnageId,
  niveauPersonnage,
  xpDisponible,
  religionId,
  onXpSpent,
}: Step6PrieresProps) => {
  const [domaineSelectionne, setDomaineSelectionne] = useState<string | null>(null);
  const [priereId, setPriereId] = useState<string | null>(null);
  const [zoneChoisie, setZoneChoisie] = useState<string>("");
  const [porteeChoisie, setPorteeChoisie] = useState<string>("");
  const [dureeChoisie, setDureeChoisie] = useState<string>("");
  const [niveau, setNiveau] = useState<number>(1);
  const [nomPersonnalise, setNomPersonnalise] = useState<string>("");

  // Domaines disponibles
  const { data: domainesDisponibles } = useQuery({
    queryKey: ["domaines-disponibles", personnageId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_domaines_disponibles")
        .select("domaine, niveau_max_prieres")
        .eq("personnage_id", personnageId)
        .order("domaine");
      return data ?? [];
    },
  });

  // Domaines proscrits
  const { data: domainesProscrits } = useQuery({
    queryKey: ["domaines-proscrits", religionId],
    queryFn: async () => {
      if (!religionId) return [];
      const { data } = await supabase
        .from("religions")
        .select("domaines_proscrits")
        .eq("id", religionId)
        .single();
      return data?.domaines_proscrits ?? [];
    },
    enabled: !!religionId,
  });

  const domainesAffiches = useMemo(() => {
    return (domainesDisponibles ?? []).filter(
      (d) => !domainesProscrits?.includes(d.domaine!)
    );
  }, [domainesDisponibles, domainesProscrits]);

  const domaineObj = domainesAffiches.find((d) => d.domaine === domaineSelectionne);
  const niveauMaxDomaine = domaineObj?.niveau_max_prieres ?? 0;

  // Prières du domaine
  const { data: prieres } = useQuery({
    queryKey: ["prieres-domaine", domaineSelectionne, niveauMaxDomaine],
    queryFn: async () => {
      if (!domaineSelectionne) return [];
      const { data } = await supabase
        .from("prieres")
        .select("*")
        .eq("domaine", domaineSelectionne)
        .lte("niveau", niveauMaxDomaine)
        .eq("est_actif", true)
        .order("nom");
      return data ?? [];
    },
    enabled: !!domaineSelectionne,
  });

  // Prières créées
  const { data: prieresCrees, refetch: refetchPrieresCrees } = useQuery({
    queryKey: ["prieres-creees", personnageId],
    queryFn: async () => {
      const { data } = await supabase
        .from("personnage_prieres")
        .select("*, prieres(nom, domaine, duree_incantation)")
        .eq("personnage_id", personnageId)
        .order("date_acquisition");
      return data ?? [];
    },
  });

  const priereSelectionnee = prieres?.find((p) => p.id === priereId);

  useEffect(() => {
    setPriereId(null);
  }, [domaineSelectionne]);

  useEffect(() => {
    if (!priereSelectionnee) {
      setZoneChoisie("");
      setPorteeChoisie("");
      setDureeChoisie("");
      setNiveau(1);
      setNomPersonnalise("");
      return;
    }
    setNomPersonnalise(priereSelectionnee.nom);
    setNiveau(priereSelectionnee.niveau ?? 1);
    if (priereSelectionnee.zone_effet && isZoneUnique(priereSelectionnee.zone_effet)) {
      const zones = ZONES_PAR_TYPE[priereSelectionnee.zone_effet] ?? [];
      setZoneChoisie(zones[0] ?? "");
    } else {
      setZoneChoisie("");
    }
    setPorteeChoisie("");
    setDureeChoisie("");
  }, [priereId]);

  const zonesDisponibles = useMemo(() => {
    if (!priereSelectionnee?.zone_effet) return [];
    return ZONES_PAR_TYPE[priereSelectionnee.zone_effet] ?? [];
  }, [priereSelectionnee]);

  const porteesDispo = useMemo(
    () => (priereSelectionnee?.portee ? filterPorteesDisponibles(priereSelectionnee.portee) : PORTEES),
    [priereSelectionnee]
  );
  const dureesDispo = useMemo(
    () => (priereSelectionnee?.duree ? filterDureesDisponibles(priereSelectionnee.duree) : DUREES),
    [priereSelectionnee]
  );

  const coutXpBase = Number(priereSelectionnee?.cout_xp_base ?? 0);
  const coutXp =
    priereSelectionnee && zoneChoisie && porteeChoisie && dureeChoisie
      ? calculerCoutXP(zoneChoisie, porteeChoisie, dureeChoisie, niveau, coutXpBase)
      : 0;
  const coutXpMax = coutXpMaxAutorise(niveauPersonnage);
  const coutPS = coutXp > 0 ? calculerCoutPS(coutXp) : 0;
  const depasseMax = coutXp > coutXpMax;
  const xpInsuffisant = coutXp > xpDisponible;

  const peutAjouter =
    !!priereSelectionnee &&
    !!zoneChoisie &&
    !!porteeChoisie &&
    !!dureeChoisie &&
    !depasseMax &&
    !xpInsuffisant &&
    nomPersonnalise.trim().length > 0;

  const ajouterPriere = async () => {
    if (!peutAjouter || !priereSelectionnee) return;
    const { error } = await supabase.from("personnage_prieres").insert({
      personnage_id: personnageId,
      priere_id: priereSelectionnee.id,
      niveau_priere: niveau,
      xp_depense: coutXp,
      nom_personnalise: nomPersonnalise.trim(),
      zone_choisie: zoneChoisie,
      portee_choisie: porteeChoisie,
      duree_choisie: dureeChoisie,
    });
    if (error) {
      toast.error("Erreur lors de l'ajout de la prière.");
      return;
    }
    onXpSpent(coutXp);
    toast.success(`Prière "${nomPersonnalise}" ajoutée.`);
    setPriereId(null);
    setDomaineSelectionne(null);
    refetchPrieresCrees();
  };

  const retirerPriere = async (id: string, xp: number, nom: string) => {
    const { error } = await supabase.from("personnage_prieres").delete().eq("id", id);
    if (error) {
      toast.error("Erreur lors du retrait.");
      return;
    }
    onXpSpent(-xp);
    toast.success(`Prière "${nom}" retirée.`);
    refetchPrieresCrees();
  };

  const noteZone = priereSelectionnee?.zone_effet ? getNoteZone(priereSelectionnee.zone_effet) : null;
  const zoneEstUnique = priereSelectionnee?.zone_effet ? isZoneUnique(priereSelectionnee.zone_effet) : false;

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold text-foreground">
        Étape 6 — Création de prières divines
      </h2>
      <p className="text-sm text-muted-foreground">
        Créez vos prières divines. Coût maximum autorisé :{" "}
        <strong className="text-primary">{coutXpMax} XP</strong>.
      </p>

      {/* Sélection domaine */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">1. Choisir un domaine</CardTitle>
        </CardHeader>
        <CardContent>
          {domainesAffiches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun domaine disponible (tous proscrits par votre religion ou aucun acquis).
            </p>
          ) : (
            <Select value={domaineSelectionne ?? ""} onValueChange={setDomaineSelectionne}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un domaine" />
              </SelectTrigger>
              <SelectContent>
                {domainesAffiches.map((d) => (
                  <SelectItem key={d.domaine!} value={d.domaine!}>
                    {d.domaine} — prières jusqu'au niveau {d.niveau_max_prieres}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Sélection prière */}
      {domaineSelectionne && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">2. Choisir une prière</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {prieres?.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  priereId === p.id ? "border-2 border-primary ring-2 ring-primary/20" : ""
                }`}
                onClick={() => setPriereId(p.id)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <strong className="font-heading text-primary">{p.nom}</strong>
                    <div className="flex gap-2">
                      <Badge variant="outline">Niv. {p.niveau}</Badge>
                      {p.type_priere && <Badge variant="secondary">{p.type_priere}</Badge>}
                      <Badge>{p.cout_xp_base} XP base</Badge>
                    </div>
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                  {p.duree_incantation && (
                    <p className="text-xs italic text-muted-foreground">
                      Durée d'incantation : {p.duree_incantation}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Variables */}
      {priereSelectionnee && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">3. Personnaliser la prière</CardTitle>
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
              <Label>Niveau de la prière : {niveau}</Label>
              <Slider
                value={[niveau]}
                onValueChange={(v) => setNiveau(v[0])}
                min={1}
                max={niveauMaxDomaine}
                step={1}
              />
            </div>

            {/* Nom personnalisé */}
            <div className="space-y-2">
              <Label>Nom personnalisé</Label>
              <Input
                value={nomPersonnalise}
                onChange={(e) => setNomPersonnalise(e.target.value)}
                placeholder="Nom de la prière"
              />
            </div>

            {/* Coûts */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Coût XP :</span>
                <strong className={depasseMax ? "text-destructive" : "text-primary"}>{coutXp} XP</strong>
              </div>
              <div className="flex justify-between">
                <span>Coût PS à l'invocation :</span>
                <strong>{coutPS} PS</strong>
              </div>
              {priereSelectionnee.duree_incantation && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Durée d'incantation :</span>
                  <span>{priereSelectionnee.duree_incantation}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Coût max autorisé :</span>
                <span>{coutXpMax} XP</span>
              </div>
              {depasseMax && (
                <p className="flex items-center gap-2 text-destructive text-xs">
                  <AlertTriangle className="h-4 w-4" />
                  Cette prière dépasse le coût maximum autorisé pour votre niveau.
                </p>
              )}
              {xpInsuffisant && !depasseMax && (
                <p className="flex items-center gap-2 text-destructive text-xs">
                  <AlertTriangle className="h-4 w-4" />
                  XP disponible insuffisant.
                </p>
              )}
            </div>

            <Button onClick={ajouterPriere} disabled={!peutAjouter} className="w-full">
              <Sparkles className="mr-2 h-4 w-4" />
              Ajouter cette prière au personnage
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Prières créées */}
      {prieresCrees && prieresCrees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">Prières créées ({prieresCrees.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {prieresCrees.map((pp: any) => (
              <div
                key={pp.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-primary font-heading">{pp.nom_personnalise}</strong>
                    <Badge variant="outline">{pp.prieres?.domaine}</Badge>
                    <Badge variant="secondary">Niv. {pp.niveau_priere}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pp.zone_choisie} • {pp.portee_choisie} • {pp.duree_choisie}
                  </p>
                  <p className="text-xs">
                    <strong>{pp.xp_depense} XP</strong> • {calculerCoutPS(pp.xp_depense)} PS
                    {pp.prieres?.duree_incantation && ` • Incantation : ${pp.prieres.duree_incantation}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => retirerPriere(pp.id, pp.xp_depense, pp.nom_personnalise)}
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

export default Step6Prieres;

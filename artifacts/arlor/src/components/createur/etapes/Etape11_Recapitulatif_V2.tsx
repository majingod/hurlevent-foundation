import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FlaskConical,
  Gem,
  Hammer,
  Loader2,
  ScrollText,
  Sparkles,
  Sword,
  User,
  Wand2,
} from "lucide-react";

type VueRecap =
  Database["public"]["Views"]["vue_personnage_creation_complet"]["Row"];

interface Etape11Props {
  personnageId: string;
  onSuccess?: () => void;
  onPrevious?: () => void;
}

interface TraitRacial {
  trait_id?: string | null;
  trait_nom?: string | null;
  trait_description?: string | null;
  /** Coût intrinsèque du trait dans la table `traits_raciaux` (référentiel). */
  cout_xp?: number | null;
  /** XP réellement dépensé par le personnage (0 si pris gratuitement). */
  xp_depense?: number | null;
  /** True si le trait a été pris sur le quota gratuit de la race. */
  est_gratuit?: boolean | null;
}

interface CompetenceItem {
  nom?: string | null;
  categorie?: string | null;
  niveau_acquis?: number | null;
  xp_depense?: number | null;
  choix_achat?: string | null;
}

interface SortItem {
  nom_personnalise?: string | null;
  cercle?: string | null;
  formule_magique?: string | null;
  zone_choisie?: string | null;
  portee_choisie?: string | null;
  duree_choisie?: string | null;
}

interface PriereItem {
  nom_personnalise?: string | null;
  domaine?: string | null;
  zone_choisie?: string | null;
  portee_choisie?: string | null;
  duree_choisie?: string | null;
}

interface AssemblageItem {
  nom?: string | null;
  cible?: string | null;
  cout_ps?: number | null;
  runes_requises?: string[] | null;
  effet?: string | null;
}

interface RecetteItem {
  nom?: string | null;
  type?: string | null;
  niveau_requis?: number | null;
  effet?: string | null;
}

interface ObjetArtisanatItem {
  nom?: string | null;
  type?: string | null;
  difficulte?: number | null;
  description?: string | null;
  effet?: string | null;
}

interface ValidationError {
  code?: string;
  message?: string;
  champ?: string;
}

interface ValidationWarning {
  code?: string;
  message?: string;
}

interface ValidationResult {
  valide?: boolean;
  erreurs?: ValidationError[];
  avertissements?: ValidationWarning[];
  est_verrouille?: boolean;
  non_autorise?: boolean;
  message?: string;
  [k: string]: unknown;
}

const asArray = <T,>(value: Json | null | undefined): T[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  return [];
};

const Etape11_Recapitulatif_V2 = ({
  personnageId,
  onSuccess,
  onPrevious,
}: Etape11Props) => {
  const {
    data: recap,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["vue_personnage_creation_complet", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vue_personnage_creation_complet")
        .select("*")
        .eq("id", personnageId)
        .maybeSingle();
      if (error) throw error;
      return data as VueRecap | null;
    },
    enabled: !!personnageId,
  });

  const finaliserMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("valider_personnage_final", {
        p_personnage_id: personnageId,
      });
      if (error) throw error;
      return data as ValidationResult | null;
    },
    onSuccess: (data) => {
      const result = (data ?? {}) as ValidationResult;

      if (result.non_autorise === true) {
        toast.error("Accès refusé", {
          description:
            "Vous n'êtes pas autorisé à finaliser ce personnage.",
        });
        return;
      }

      const avertissements = result.avertissements ?? [];
      const avertDesc = avertissements
        .map((a) => a.message ?? a.code)
        .filter(Boolean)
        .join("\n");

      if (result.valide === true) {
        toast.success(
          result.message ?? "Personnage finalisé et verrouillé !",
          avertDesc ? { description: avertDesc } : undefined,
        );
        onSuccess?.();
        return;
      }

      const errs = result.erreurs ?? [];
      const errDesc = errs
        .map((e) => e.message ?? e.code)
        .filter(Boolean)
        .join("\n");

      toast.error("Validation impossible", {
        description: errDesc || result.message || "Erreur inconnue.",
      });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Chargement du récapitulatif…
      </div>
    );
  }

  if (error || !recap) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        <AlertTriangle className="mr-2 h-4 w-4" />
        Impossible de charger le personnage.
      </div>
    );
  }

  const traits = asArray<TraitRacial>(recap.traits_raciaux);
  const competences = asArray<CompetenceItem>(recap.competences);
  const sorts = asArray<SortItem>(recap.sorts);
  const prieres = asArray<PriereItem>(recap.prieres);
  const assemblages = asArray<AssemblageItem>(recap.assemblages);
  const recettes = asArray<RecetteItem>(recap.recettes);
  const objetsForge = asArray<ObjetArtisanatItem>(recap.objets_forge);
  const objetsJoaillerie = asArray<ObjetArtisanatItem>(recap.objets_joaillerie);

  const competencesParCategorie = competences.reduce<
    Record<string, CompetenceItem[]>
  >((acc, c) => {
    const cat = c.categorie ?? "Autre";
    (acc[cat] ??= []).push(c);
    return acc;
  }, {});

  const sortsParCercle = sorts.reduce<Record<string, SortItem[]>>((acc, s) => {
    const cle = s.cercle ?? "Autre";
    (acc[cle] ??= []).push(s);
    return acc;
  }, {});

  const prieresParDomaine = prieres.reduce<Record<string, PriereItem[]>>(
    (acc, p) => {
      const cle = p.domaine ?? "Autre";
      (acc[cle] ??= []).push(p);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold text-foreground flex items-center gap-2">
          <ScrollText className="h-5 w-5" />
          Étape 11 — Récapitulatif et finalisation
        </h2>
        <p className="text-sm text-muted-foreground">
          Vérifiez l'ensemble des informations de votre personnage avant de le
          finaliser. Une fois finalisé, le personnage sera verrouillé.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <User className="h-4 w-4" />
            Informations générales
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <Info label="Nom" value={recap.nom} />
          <Info
            label="Race"
            value={
              recap.race_nom
                ? `${recap.race_nom}${
                    recap.race_nom_latin ? ` (${recap.race_nom_latin})` : ""
                  }`
                : null
            }
          />
          <Info label="Classe" value={recap.classe_nom} />
          {recap.classe_secondaire_nom && (
            <Info
              label="Classe secondaire"
              value={recap.classe_secondaire_nom}
            />
          )}
          <Info label="Niveau" value={recap.niveau} />
          <Info label="PV max" value={recap.pv_max} />
          <Info label="PS max" value={recap.ps_max} />
          <Info label="XP total" value={recap.xp_total} />
          <Info label="XP dépensé" value={recap.xp_depense} />
          <Info label="XP disponible" value={recap.xp_disponible} />
          {recap.religion_nom && (
            <Info label="Religion" value={recap.religion_nom} />
          )}
          <Info label="GN complétés" value={recap.gn_completes ?? 0} />
          <Info label="Mini-GN" value={recap.mini_gn_completes ?? 0} />
          <Info
            label="Ouvertures terrain"
            value={recap.ouvertures_terrain ?? 0}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Traits raciaux
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {traits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun trait racial.</p>
          ) : (
            traits.map((t, i) => (
              <TraitRow key={t.trait_id ?? i} trait={t} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Sword className="h-4 w-4" />
            Compétences ({competences.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {competences.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune compétence acquise.
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(competencesParCategorie).map(([cat, items]) => (
                <div key={cat}>
                  <h4 className="text-sm font-semibold mb-2">{cat}</h4>
                  <ul className="space-y-1 text-sm">
                    {items.map((c, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2"
                      >
                        <span>
                          {c.nom}
                          {c.choix_achat && (
                            <span className="text-muted-foreground">
                              {" "}
                              ({c.choix_achat})
                            </span>
                          )}
                          {c.niveau_acquis && c.niveau_acquis > 1 && (
                            <span className="text-muted-foreground">
                              {" "}
                              — niv. {c.niveau_acquis}
                            </span>
                          )}
                        </span>
                        <Badge variant="outline">
                          {c.xp_depense === 0
                            ? "Gratuit"
                            : `${c.xp_depense ?? 0} XP`}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Sorts arcaniques ({sorts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sorts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun sort.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(sortsParCercle).map(([cercle, items]) => (
                <div key={cercle}>
                  <h4 className="text-sm font-semibold mb-2">{cercle}</h4>
                  <ul className="space-y-2 text-sm">
                    {items.map((s, i) => (
                      <li key={i} className="border rounded-md p-2">
                        <div className="font-medium">{s.nom_personnalise}</div>
                        {s.formule_magique && (
                          <div className="text-xs font-mono text-muted-foreground">
                            {s.formule_magique}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {[s.zone_choisie, s.portee_choisie, s.duree_choisie]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Prières divines ({prieres.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {prieres.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune prière.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(prieresParDomaine).map(([domaine, items]) => (
                <div key={domaine}>
                  <h4 className="text-sm font-semibold mb-2">{domaine}</h4>
                  <ul className="space-y-2 text-sm">
                    {items.map((p, i) => (
                      <li key={i} className="border rounded-md p-2">
                        <div className="font-medium">{p.nom_personnalise}</div>
                        <div className="text-xs text-muted-foreground">
                          {[p.zone_choisie, p.portee_choisie, p.duree_choisie]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Alchimie ({recettes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recettes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune recette alchimique.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recettes.map((r, i) => (
                <li key={i} className="border rounded-md p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.nom}</span>
                    {r.niveau_requis != null && (
                      <Badge variant="outline">Niv. {r.niveau_requis}</Badge>
                    )}
                  </div>
                  {r.effet && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.effet}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Assemblages de runes ({assemblages.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assemblages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun assemblage.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {assemblages.map((a, i) => (
                <li key={i} className="border rounded-md p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{a.nom}</span>
                    {a.cout_ps != null && (
                      <Badge variant="outline">{a.cout_ps} PS</Badge>
                    )}
                  </div>
                  {a.cible && (
                    <div className="text-xs text-muted-foreground">
                      Cible : {a.cible}
                    </div>
                  )}
                  {a.runes_requises && a.runes_requises.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Runes : {a.runes_requises.join(", ")}
                    </div>
                  )}
                  {a.effet && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {a.effet}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Hammer className="h-4 w-4" />
            Forge ({objetsForge.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {objetsForge.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun objet de forge.
            </p>
          ) : (
            <ArtisanatList items={objetsForge} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Gem className="h-4 w-4" />
            Joaillerie ({objetsJoaillerie.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {objetsJoaillerie.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun objet de joaillerie.
            </p>
          ) : (
            <ArtisanatList items={objetsJoaillerie} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Historique et âme
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-1">Historique</h4>
            {recap.historique ? (
              <p className="whitespace-pre-wrap text-muted-foreground">
                {recap.historique}
              </p>
            ) : (
              <p className="text-muted-foreground italic">Non renseigné.</p>
            )}
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-1">Âme</h4>
            {recap.ame_personnage ? (
              <p className="whitespace-pre-wrap text-muted-foreground">
                {recap.ame_personnage}
              </p>
            ) : (
              <p className="text-muted-foreground italic">Non renseigné.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        {onPrevious && (
          <Button variant="outline" onClick={onPrevious}>
            ← Précédent
          </Button>
        )}
        <Button
          size="lg"
          className="ml-auto"
          onClick={() => finaliserMutation.mutate()}
          disabled={finaliserMutation.isPending}
        >
          {finaliserMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Finalisation…
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Finaliser le personnage
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

const Info = ({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) => (
  <div>
    <div className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <div className="font-medium">
      {value === null || value === undefined || value === "" ? "—" : value}
    </div>
  </div>
);

const TraitRow = ({ trait }: { trait: TraitRacial }) => (
  <div className="border rounded-md p-3">
    <div className="flex items-center justify-between gap-2">
      <span className="font-medium">
        {trait.trait_nom ?? "(trait inconnu)"}
      </span>
      <Badge variant="outline">
        {trait.est_gratuit ? "Gratuit" : `${trait.xp_depense ?? 0} XP`}
      </Badge>
    </div>
    {trait.trait_description && (
      <p className="text-xs text-muted-foreground mt-1">
        {trait.trait_description}
      </p>
    )}
  </div>
);

const ArtisanatList = ({ items }: { items: ObjetArtisanatItem[] }) => (
  <ul className="space-y-2 text-sm">
    {items.map((o, i) => (
      <li key={i} className="border rounded-md p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{o.nom}</span>
          {o.difficulte != null && (
            <Badge variant="outline">Difficulté {o.difficulte}</Badge>
          )}
        </div>
        {o.type && (
          <div className="text-xs text-muted-foreground">{o.type}</div>
        )}
        {o.effet && (
          <p className="text-xs text-muted-foreground mt-1">
            <strong>Effet :</strong> {o.effet}
          </p>
        )}
        {o.description && (
          <p className="text-xs text-muted-foreground mt-1">{o.description}</p>
        )}
      </li>
    ))}
  </ul>
);

export default Etape11_Recapitulatif_V2;

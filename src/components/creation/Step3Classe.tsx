import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface Step3Props {
  classes: any[];
  classeId: string | null;
  setClasseId: (v: string) => void;
  religions: any[];
  religionId: string | null;
  setReligionId: (v: string | null) => void;
  estCroyant: boolean;
}

const Step3Classe = ({
  classes, classeId, setClasseId,
  religions, religionId, setReligionId, estCroyant,
}: Step3Props) => {
  const selectedClasse = classes.find((c) => c.id === classeId);
  const isPretre = selectedClasse?.nom === "Prêtre";
  const needsReligion = isPretre && !religionId;

  const formatGratuites = (gratuites: any): string[] => {
    if (!gratuites) return [];
    if (Array.isArray(gratuites)) return gratuites.map(String);
    return [];
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold text-foreground">
        Étape 3 — Choix de la classe
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        {classes.map((cls) => {
          const gratuites = formatGratuites(cls.competences_gratuites);
          const selected = classeId === cls.id;
          return (
            <Card
              key={cls.id}
              className={`cursor-pointer transition-all hover:border-primary/50 ${
                selected ? "border-2 border-primary ring-2 ring-primary/20" : ""
              }`}
              onClick={() => setClasseId(cls.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading">{cls.nom}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{cls.description}</p>
                <div className="flex gap-4">
                  <span>PV de départ : <strong className="text-primary">{cls.pv_depart}</strong></span>
                  <span>PS de départ : <strong className="text-primary">{cls.ps_depart}</strong></span>
                </div>
                {cls.role_combat && (
                  <p className="text-xs text-muted-foreground">Rôle : {cls.role_combat}</p>
                )}
                {gratuites.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Compétences gratuites :</p>
                    <div className="flex flex-wrap gap-1">
                      {gratuites.map((g, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{g}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Prêtre needs religion */}
      {isPretre && !estCroyant && !religionId && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>La classe Prêtre nécessite une religion. Veuillez choisir une religion ci-dessous.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {religions.map((rel) => (
              <Card
                key={rel.id}
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  religionId === rel.id ? "border-2 border-primary ring-2 ring-primary/20" : ""
                }`}
                onClick={() => setReligionId(rel.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-heading">{rel.nom}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {rel.domaines_principaux && (
                    <p>Domaines : {rel.domaines_principaux.join(", ")}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {selectedClasse && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-1">
          <p>Classe sélectionnée : <strong className="text-primary">{selectedClasse.nom}</strong></p>
          <p>PV max : <strong>{selectedClasse.pv_depart}</strong> — PS max : <strong>{selectedClasse.ps_depart}</strong></p>
        </div>
      )}
    </div>
  );
};

export default Step3Classe;

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BookOpen } from "lucide-react";

interface Step9Props {
  historique: string;
  setHistorique: (value: string) => void;
  amePersonnage: string;
  setAmePersonnage: (value: string) => void;
}

const Step9Historique = ({
  historique,
  setHistorique,
  amePersonnage,
  setAmePersonnage,
}: Step9Props) => {
  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold text-foreground flex items-center gap-2">
        <BookOpen className="h-5 w-5" />
        Étape 9 — Historique et âme
      </h2>

      <p className="text-sm text-muted-foreground">
        Décrivez l'histoire et la personnalité profonde de votre personnage. Ces champs seront toujours modifiables après la création.
      </p>

      {/* Historique du personnage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique du personnage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="historique">Racontez l'histoire de votre personnage</Label>
            <Textarea
              id="historique"
              placeholder="Racontez l'histoire de votre personnage, ses origines, ses motivations, les événements qui l'ont marqué..."
              value={historique}
              onChange={(e) => setHistorique(e.target.value)}
              className="min-h-[200px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Aucune limite de caractères. Soyez aussi détaillé que vous le souhaitez.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Âme du personnage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Âme du personnage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="ame">Décrivez la personnalité profonde</Label>
            <Textarea
              id="ame"
              placeholder="Décrivez la personnalité profonde, les valeurs, les traits de caractère, les motivations cachées de votre personnage..."
              value={amePersonnage}
              onChange={(e) => setAmePersonnage(e.target.value)}
              className="min-h-[200px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Aucune limite de caractères. Explorez la psychologie de votre personnage.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Step9Historique;

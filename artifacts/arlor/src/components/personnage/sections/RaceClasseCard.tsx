import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useModeAffichage } from "@/contexts/ModeAffichageContext";
import type { FichePersonnage } from "./types";

export const RaceClasseCard = ({ fiche }: { fiche: FichePersonnage }) => {
  // Patron canon abrégé ⇄ intégral (s299) : swap qui REMPLACE, jamais empilé.
  const { mode } = useModeAffichage();
  const texteRace = mode === "abrege" ? fiche.race_resume_condense : fiche.race_description;
  const texteClasse = mode === "abrege" ? fiche.classe_resume_condense : fiche.classe_description;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Identité</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Race */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {fiche.race_emoji && <span className="text-2xl leading-none">{fiche.race_emoji}</span>}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Race</p>
              <p className="font-medium text-foreground">
                {fiche.race_nom}
                {fiche.race_nom_latin && (
                  <span className="ml-1 italic text-muted-foreground">({fiche.race_nom_latin})</span>
                )}
              </p>
            </div>
          </div>

          {fiche.race_image_url && (
            <img
              src={fiche.race_image_url}
              alt={fiche.race_nom ?? "Race"}
              className="max-h-48 w-full rounded-md object-cover"
              loading="lazy"
            />
          )}

          {texteRace && (
            <p className="text-sm text-foreground/90 whitespace-pre-line">{texteRace}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {fiche.race_esperance_vie && (
              <Badge variant="outline" className="text-xs">Espérance de vie : {fiche.race_esperance_vie}</Badge>
            )}
          </div>

          {fiche.race_exigences_costume && (
            <p className="text-xs text-muted-foreground whitespace-pre-line">
              <span className="font-medium text-foreground">Exigences de costume : </span>
              {fiche.race_exigences_costume}
            </p>
          )}
        </div>

        <div className="border-t border-border/50" />

        {/* Classe */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {fiche.classe_emoji && <span className="text-2xl leading-none">{fiche.classe_emoji}</span>}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Classe</p>
              <p className="font-medium text-foreground">{fiche.classe_nom}</p>
            </div>
          </div>

          {fiche.classe_role_combat && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">Rôle : {fiche.classe_role_combat}</Badge>
            </div>
          )}

          {texteClasse && (
            <p className="text-sm text-foreground/90 whitespace-pre-line">{texteClasse}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RaceClasseCard;

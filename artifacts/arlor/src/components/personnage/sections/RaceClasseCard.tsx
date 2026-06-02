import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ManuelGlobalSwitch, ToggleManuel } from "@/components/shared/ToggleManuel";
import type { FichePersonnage } from "./types";

interface RaceClasseCardProps {
  fiche: FichePersonnage;
  isManuelOpen: (id: string) => boolean;
  toggleManuel: (id: string) => void;
  isAllOpen: (ids: string[]) => boolean;
  toggleAll: (ids: string[]) => void;
}

// Ids synthétiques stables (ne peuvent pas entrer en collision avec un UUID).
const RACE_ID = "race";
const CLASSE_ID = "classe";

export const RaceClasseCard = ({
  fiche,
  isManuelOpen,
  toggleManuel,
  isAllOpen,
  toggleAll,
}: RaceClasseCardProps) => {
  const raceCourte = fiche.race_description_courte ?? fiche.race_description;
  const classeCourte = fiche.classe_description_courte ?? fiche.classe_description;

  const idsVerbatim = [
    fiche.race_description ? RACE_ID : null,
    fiche.classe_description ? CLASSE_ID : null,
  ].filter((x): x is string => x !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Identité</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {idsVerbatim.length > 0 && (
          <ManuelGlobalSwitch
            allOpen={isAllOpen(idsVerbatim)}
            onToggle={() => toggleAll(idsVerbatim)}
            title="Cet onglet"
            subtitle="Verbatim du manuel pour la race et la classe"
          />
        )}

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

          {raceCourte && (
            <p className="text-sm text-foreground/90 whitespace-pre-line">{raceCourte}</p>
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

          <ToggleManuel
            texte={fiche.race_description}
            isOpen={isManuelOpen(RACE_ID)}
            onToggle={() => toggleManuel(RACE_ID)}
          />
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

          {classeCourte && (
            <p className="text-sm text-foreground/90 whitespace-pre-line">{classeCourte}</p>
          )}

          <ToggleManuel
            texte={fiche.classe_description}
            isOpen={isManuelOpen(CLASSE_ID)}
            onToggle={() => toggleManuel(CLASSE_ID)}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default RaceClasseCard;

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Loader2, Sparkles } from "lucide-react";

// ── Types locaux (forme du retour RPC journal_evolution_personnage) ──────────
type Ligne = {
  categorie:
    | "competences"
    | "pieges"
    | "sorts"
    | "prieres"
    | "recettes"
    | "assemblages"
    | "objets_forge"
    | "objets_joaillerie";
  type: "ajout" | "retrait" | "niveau" | "modification";
  id: string;
  nom: string;
  niveau_avant?: number;
  niveau_apres?: number;
  xp_delta: number;
  changements?: {
    champ: "niveau" | "zone" | "portee" | "duree";
    avant: unknown;
    apres: unknown;
  }[];
};

type EvenementEvolution = {
  evenement_id: string;
  titre: string;
  type_evenement: string | null;
  date_evenement: string | null;
  date_confirmation: string;
  acteur_nom: string | null;
  xp_recompense: number | null;
  niveau_up: boolean;
  premiere: boolean;
  lignes: Ligne[];
};

type JournalEvolutionRetour = {
  succes: boolean;
  erreurs: { code: string; message: string }[];
  avertissements: unknown[];
  donnees: {
    a_participe: boolean;
    fenetre_courante: {
      depuis_evenement_titre: string;
      depuis_date: string;
      lignes: Ligne[];
    } | null;
    evenements: EvenementEvolution[];
  };
};

const CAT_LABEL: Record<string, string> = {
  competences: "Compétence",
  pieges: "Piège",
  sorts: "Sort",
  prieres: "Prière",
  recettes: "Recette",
  assemblages: "Assemblage",
  objets_forge: "Objet de forge",
  objets_joaillerie: "Objet de joaillerie",
};

const CHAMP_LABEL: Record<string, string> = {
  niveau: "Niveau",
  zone: "Zone",
  portee: "Portée",
  duree: "Durée",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-CA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// ── Sous-composant : une ligne de diff ───────────────────────────────────────
function LigneEvolution({ ligne }: { ligne: Ligne }) {
  const borderClass =
    ligne.type === "retrait" ? "border-l-bordeaux" : "border-l-gold";

  return (
    <div className={`border-l-2 ${borderClass} pl-3 py-1`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm">
          <span className="text-xs text-muted-foreground">
            {CAT_LABEL[ligne.categorie] ?? ligne.categorie} ·{" "}
          </span>
          {ligne.type === "ajout" && (
            <span>
              <strong>{ligne.nom}</strong> acquis
              {ligne.niveau_apres != null ? ` · niv ${ligne.niveau_apres}` : ""}
            </span>
          )}
          {ligne.type === "retrait" && (
            <span>
              <strong>{ligne.nom}</strong> retiré
              {ligne.niveau_avant != null ? ` · niv ${ligne.niveau_avant}` : ""}
            </span>
          )}
          {ligne.type === "niveau" && (
            <span>
              <strong>{ligne.nom}</strong> · niv {ligne.niveau_avant} →{" "}
              {ligne.niveau_apres}
            </span>
          )}
          {ligne.type === "modification" && (
            <span>
              <strong>{ligne.nom}</strong> modifié
            </span>
          )}
        </div>
        {ligne.xp_delta !== 0 && (
          <span
            className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${
              ligne.xp_delta < 0
                ? "bg-bordeaux text-white"
                : "bg-gold text-black"
            }`}
          >
            {ligne.xp_delta < 0
              ? `−${Math.abs(ligne.xp_delta)} XP`
              : `+${ligne.xp_delta} XP`}
          </span>
        )}
      </div>
      {ligne.type === "modification" &&
        ligne.changements &&
        ligne.changements.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {ligne.changements.map((c, i) => (
              <li key={i}>
                {CHAMP_LABEL[c.champ] ?? c.champ} : {String(c.avant)} →{" "}
                {String(c.apres)}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────
export default function JournalEvolution({
  personnageId,
}: {
  personnageId: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["journal-evolution", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "journal_evolution_personnage",
        { p_personnage_id: personnageId },
      );
      if (error) throw error;
      return data as unknown as JournalEvolutionRetour;
    },
    enabled: !!personnageId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const donnees = data?.donnees;

  if (!donnees?.a_participe) {
    return (
      <div className="py-16 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-gold" />
        <p className="mt-3 font-heading text-lg text-gold">
          Ton journal t'attend
        </p>
        <p className="text-sm text-muted-foreground">
          Le journal démarre après ta première participation à un événement.
        </p>
      </div>
    );
  }

  const fenetre = donnees.fenetre_courante;

  return (
    <div className="space-y-6">
      {/* En cours d'évolution */}
      <Card className="border-2 border-dashed border-gold bg-transparent p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-lg text-foreground">
            En cours d'évolution
          </h2>
          <Badge variant="outline" className="border-gold text-gold">
            non scellé
          </Badge>
        </div>
        {fenetre && (
          <p className="text-xs text-muted-foreground">
            Depuis {fenetre.depuis_evenement_titre} ·{" "}
            {fmtDate(fenetre.depuis_date)}
          </p>
        )}
        {!fenetre || fenetre.lignes.length === 0 ? (
          <p className="mt-3 text-sm italic text-muted-foreground">
            Aucun changement depuis le dernier événement.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {fenetre.lignes.map((ligne) => (
              <LigneEvolution key={ligne.id} ligne={ligne} />
            ))}
          </div>
        )}
      </Card>

      {/* Accordéon des événements (ordre reçu : plus récent en haut) */}
      <Accordion type="multiple" className="space-y-2">
        {donnees.evenements.map((ev) => {
          const sousTitre = [ev.type_evenement, ev.date_evenement && fmtDate(ev.date_evenement)]
            .filter(Boolean)
            .join(" · ");
          return (
            <AccordionItem
              key={ev.evenement_id}
              value={ev.evenement_id}
              className="rounded-lg border px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-1 items-start justify-between gap-3 text-left">
                  <div>
                    <p className="font-heading text-base text-foreground">
                      {ev.titre}
                    </p>
                    {sousTitre && (
                      <p className="text-xs text-muted-foreground">
                        {sousTitre}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {ev.xp_recompense != null && (
                      <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-black">
                        +{ev.xp_recompense} XP
                      </span>
                    )}
                    {ev.niveau_up && (
                      <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-black">
                        +1 niveau
                      </span>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {ev.premiere ? (
                  <p className="text-sm text-muted-foreground">
                    Première participation — le suivi démarre ici.
                  </p>
                ) : ev.lignes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun changement de fiche pour cet événement.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ev.lignes.map((ligne) => (
                      <LigneEvolution key={ligne.id} ligne={ligne} />
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Scellé le {fmtDate(ev.date_confirmation)}
                  {ev.acteur_nom ? ` par ${ev.acteur_nom}` : ""}
                </p>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

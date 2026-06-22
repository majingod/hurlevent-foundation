import { QuickFacts } from "@/components/shared/QuickFacts";
import { SectionListe } from "@/components/shared/SectionListe";
import { EffetBox } from "@/components/shared/EffetBox";
import type { RecetteSectionsData } from "@/utils/alchimie";

// Brique de composition Lot B (PR2a) — rend une recette d'alchimie en langage
// Sections à partir du verbatim parsé (parseRecetteVerbatim). SOURCE UNIQUE de
// la composition (QuickFacts Formule/Durée → Ingrédients → Manipulations → labo
// → Effet → Note), réutilisée par les 3 surfaces alchimie (wizard É9,
// encyclopédie, fiche perso). Le fallback colonnes reste géré par chaque surface.

export const RecetteSections = ({ data }: { data: RecetteSectionsData }) => (
  <div className="space-y-2">
    <QuickFacts
      facts={[
        { label: "Formule", value: data.formule },
        { label: "Durée", value: data.duree },
      ]}
    />
    <SectionListe titre="Ingrédients" items={data.ingredients} />
    <SectionListe
      titre="Manipulations"
      items={data.manipulations}
      ordonnee
      note="À suivre à la lettre."
    />
    {data.labo && (
      <p className="border-l-2 border-border pl-2 text-[11px] italic text-muted-foreground">
        {data.labo}
      </p>
    )}
    <EffetBox>{data.effet}</EffetBox>
    {data.note && (
      <p className="text-[11px] italic text-muted-foreground">{data.note}</p>
    )}
  </div>
);

export default RecetteSections;

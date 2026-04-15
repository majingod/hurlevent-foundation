import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import type { Json } from "@/integrations/supabase/types";

interface ObjetForge {
  id: string;
  nom: string | null;
  description: string | null;
  type: string | null;
  stats: Json | null;
  difficulte: number | null;
}

interface ObjetJoaillerie {
  id: string;
  nom: string | null;
  description: string | null;
  effet: string | null;
  difficulte: number | null;
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

const ForgeJoaillerieSection = ({ forge, joaillerie }: { forge: ObjetForge[]; joaillerie: ObjetJoaillerie[] }) => {
  const forgeByDiff = groupBy(forge, (o) => String(o.difficulte ?? 0));
  const joailByDiff = groupBy(joaillerie, (o) => String(o.difficulte ?? 0));
  const forgeKeys = Object.keys(forgeByDiff).sort((a, b) => Number(a) - Number(b));
  const joailKeys = Object.keys(joailByDiff).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="space-y-8">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">Forge et Joaillerie</h2>

      {/* Forge */}
      <section>
        <h3 className="font-heading text-lg font-semibold text-primary mb-3">Forge</h3>
        {forgeKeys.map((diff) => (
          <div key={diff} className="mb-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Difficulté {diff}</h4>
            <Accordion type="multiple" className="w-full">
              {forgeByDiff[diff].map((o) => {
                const stats = o.stats && typeof o.stats === "object" && !Array.isArray(o.stats) ? o.stats as Record<string, any> : null;
                return (
                  <AccordionItem key={o.id} value={o.id}>
                    <AccordionTrigger className="font-heading text-base hover:no-underline">
                      <span className="flex items-center gap-2">
                        {o.nom}
                        {o.type && <span className="text-xs text-muted-foreground">({o.type})</span>}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground space-y-2">
                      {o.description && <p>{o.description}</p>}
                      {stats && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {Object.entries(stats).map(([k, v]) => (
                            <span key={k}><span className="font-medium text-foreground">{k} :</span> {String(v)}</span>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        ))}
      </section>

      {/* Joaillerie */}
      <section>
        <h3 className="font-heading text-lg font-semibold text-primary mb-3">Joaillerie</h3>
        {joailKeys.map((diff) => (
          <div key={diff} className="mb-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Difficulté {diff}</h4>
            <Accordion type="multiple" className="w-full">
              {joailByDiff[diff].map((o) => (
                <AccordionItem key={o.id} value={o.id}>
                  <AccordionTrigger className="font-heading text-base hover:no-underline">
                    {o.nom}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    {o.description && <p>{o.description}</p>}
                    {o.effet && <p><span className="font-medium text-foreground">Effet :</span> {o.effet}</p>}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}
      </section>
    </div>
  );
};

export default ForgeJoaillerieSection;

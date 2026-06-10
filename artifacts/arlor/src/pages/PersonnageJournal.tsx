import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { ArrowLeft, ScrollText } from "lucide-react";
import JournalEvolution from "@/components/personnage/journal/JournalEvolution";
import JournalActivite from "@/components/personnage/journal/JournalActivite";

export default function PersonnageJournal() {
  const { id } = useParams<{ id: string }>();

  const { data: fiche } = useQuery({
    queryKey: ["journal-nom", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_fiche_personnage")
        .select("nom")
        .eq("id", id!)
        .single();
      return data as { nom: string } | null;
    },
    enabled: !!id,
  });

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      {/* En-tête */}
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 gap-2">
          <Link to="/tableau-de-bord">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        </Button>
        <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold">
          <ScrollText className="h-4 w-4" />
          Journal
        </p>
        <h1 className="font-heading text-2xl text-primary">
          {fiche?.nom ?? "Personnage"}
        </h1>
        <p className="text-sm text-muted-foreground">
          L'évolution de ton personnage, événement par événement.
        </p>
      </div>

      <Tabs defaultValue="evolution">
        <TabsList>
          <TabsTrigger value="evolution">Évolution</TabsTrigger>
          <TabsTrigger value="activite">Activité détaillée</TabsTrigger>
        </TabsList>
        <TabsContent value="evolution" className="mt-6">
          <JournalEvolution personnageId={id!} />
        </TabsContent>
        <TabsContent value="activite" className="mt-6">
          <JournalActivite personnageId={id!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

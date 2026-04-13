import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Clock, AlertTriangle } from "lucide-react";

/* ── static data ── */

const reglesGenerales = [
  {
    titre: "Drogue",
    texte:
      "La drogue est interdite en tout temps sur le terrain. Quiconque contrevient à cette règle sera puni d'une expulsion immédiate, incluant le non-remboursement du tarif de jeu. Toutes drogues légales doivent être consommées sur le bord de la route, hors du terrain de jeu.",
  },
  {
    titre: "Cigarette",
    texte:
      "La consommation de tabac est permise dans les pipes. Les cigarettes et les cigares sont considérés comme des éléments hors-jeu. Ils sont interdits dans les tentes ainsi que sur toute la zone de jeu. Ils ne sont permis que sur le bord de la route, hors du terrain.",
  },
  {
    titre: "Alcool",
    texte:
      "Il est permis aux joueurs d'apporter leurs consommations alcoolisées. Chaque joueur est responsable de sa consommation et de ramasser ses contenants vides. Il est interdit de consommer de l'alcool dans les véhicules et de vendre de l'alcool sur place. L'organisation se donne le droit d'exclure un joueur en état d'ébriété.",
  },
  {
    titre: "Armes et équipements",
    texte:
      "Les armes doivent être suffisamment rembourrées. Les boucliers doivent être entourés d'une couche de mousse. Les armures ne doivent pas avoir d'extrémités perforantes ou tranchantes. Toutes armes, boucliers et pièces d'armures doivent être approuvés par un membre de l'organisation avant utilisation.",
  },
  {
    titre: "Harcèlement et consentement",
    texte:
      "Toute forme de harcèlement est interdite. Toutes plaintes pour des rapprochements non consentis ou manifestations abusives seront prises au sérieux. En cas de plainte, l'équipe d'organisation agit en conséquence.",
  },
  {
    titre: "Comportement",
    texte:
      "En tout temps, les participants doivent avoir un comportement hors-jeu respectueux d'autrui. Tous comportements déplacés se verront sanctionnés.",
  },
  {
    titre: "Hydratation et nourriture",
    texte:
      "Le joueur doit avoir en sa possession la nourriture suffisante pour sa consommation durant l'événement. De l'eau potable est fournie en jeu.",
  },
  {
    titre: "Carte d'assurance maladie",
    texte:
      "En cas de déplacement forcé pour des soins, il est préférable d'avoir sa carte d'assurance maladie à disposition dans les véhicules ou dans votre tente.",
  },
];

const reglesCombatTexte = [
  "Les armes doivent passer à l'inspection par un animateur à chaque événement.",
  "Tout coup porté à la tête, au visage ou aux parties génitales ne produit pas de dégât.",
  "L'usage des poings ou de contacts physiques rapprochés (prises de lutte, soumission) est interdit.",
  "Un personnage réduit à 1 point de vie est soumis à l'acte héroïque : toute attaque, compétence ou sort utilisé lui fait perdre son dernier PV et le rend comateux.",
  "Les attaques doivent avoir un élan complet. Les coups « mitraillettes » et les rebonds ne comptent pas.",
  "Il existe deux zones de dégât : le torse et les membres. Le défenseur attribue lui-même ses dégâts.",
  "Seuls un effet magique ET un effet de compétence peuvent être combinés. Jamais deux effets de même source.",
  "« Time Stop » = arrêt immédiat de toute activité. Mesure de sécurité à ne pas prendre à la légère.",
];

const tableauArmes = [
  { type: "Dague", taille: "45 cm ou moins", membres: "1", torse: "3" },
  { type: "Arme moyenne", taille: "45 à 80 cm", membres: "1", torse: "3" },
  { type: "Arme longue / bâtarde", taille: "80 à 110 cm", membres: "1", torse: "3" },
  { type: "Arme à deux mains (Guerrier)", taille: "110 à 160 cm", membres: "2", torse: "3" },
  { type: "Arme d'hast / bâton", taille: "200 cm ou moins", membres: "1", torse: "3" },
  { type: "Arc / Arbalète", taille: "Max 20 lb", membres: "2", torse: "2" },
  { type: "Arme de jet", taille: "30 cm ou moins", membres: "1", torse: "1" },
];

const tableauArmures = [
  { type: "Cuir (torse)", points: "1", duree: "2 combats" },
  { type: "Maille (torse)", points: "2", duree: "3 combats" },
  { type: "Plaques (torse)", points: "4", duree: "4 combats" },
  { type: "Casque", points: "+1", duree: "—" },
  { type: "Gorget", points: "+1", duree: "—" },
  { type: "Brassards", points: "+1", duree: "—" },
  { type: "Jambières", points: "+1", duree: "—" },
  { type: "Épaulettes", points: "+1", duree: "—" },
  { type: "Tassettes", points: "+1", duree: "—" },
];

/* ── types ── */

interface EffetCombat {
  id: string;
  nom: string | null;
  description: string | null;
  duree: string | null;
  conditions: string | null;
  type: string | null;
  source: string | null;
}

const typesEffet = ["debuff", "controle", "degats", "utilitaire", "mort"] as const;
const sourcesEffet = ["magie", "competence", "les_deux"] as const;

const labelType: Record<string, string> = {
  debuff: "Débuff",
  controle: "Contrôle",
  degats: "Dégâts",
  utilitaire: "Utilitaire",
  mort: "Mort",
};
const labelSource: Record<string, string> = {
  magie: "Magie",
  competence: "Compétence",
  les_deux: "Les deux",
};

/* ── component ── */

const Regles = () => {
  const [effets, setEffets] = useState<EffetCombat[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtreType, setFiltreType] = useState<string | null>(null);
  const [filtreSource, setFiltreSource] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("effets_combat")
        .select("*")
        .order("nom", { ascending: true });
      if (data) setEffets(data);
      setLoading(false);
    };
    fetch();
  }, []);

  const effetsFiltres = useMemo(() => {
    return effets.filter((e) => {
      const matchNom = !recherche || (e.nom ?? "").toLowerCase().includes(recherche.toLowerCase());
      const matchType = !filtreType || e.type === filtreType;
      const matchSource = !filtreSource || e.source === filtreSource;
      return matchNom && matchType && matchSource;
    });
  }, [effets, recherche, filtreType, filtreSource]);

  return (
    <div className="container py-12 max-w-5xl">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-8">
        Règles & Lexique
      </h1>

      <Tabs defaultValue="generales" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-card border border-border">
          <TabsTrigger value="generales" className="font-heading text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Règles générales
          </TabsTrigger>
          <TabsTrigger value="combat" className="font-heading text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Règles de combat
          </TabsTrigger>
          <TabsTrigger value="lexique" className="font-heading text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Lexique des effets
          </TabsTrigger>
        </TabsList>

        {/* ── Onglet 1 ── */}
        <TabsContent value="generales" className="mt-6 space-y-6">
          {reglesGenerales.map((r) => (
            <section key={r.titre}>
              <h2 className="font-heading text-xl font-semibold text-primary mb-2">{r.titre}</h2>
              <p className="text-muted-foreground leading-relaxed">{r.texte}</p>
            </section>
          ))}
        </TabsContent>

        {/* ── Onglet 2 ── */}
        <TabsContent value="combat" className="mt-6 space-y-8">
          <section>
            <h2 className="font-heading text-xl font-semibold text-primary mb-4">
              Règles générales de combat
            </h2>
            <ul className="space-y-3">
              {reglesCombatTexte.map((r, i) => (
                <li key={i} className="flex gap-3 text-muted-foreground leading-relaxed">
                  <span className="text-primary mt-1">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-primary mb-4">Tableau des armes</h2>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-card">
                    <TableHead className="text-primary font-heading">Type d'arme</TableHead>
                    <TableHead className="text-primary font-heading">Taille</TableHead>
                    <TableHead className="text-primary font-heading text-center">Dégât membres</TableHead>
                    <TableHead className="text-primary font-heading text-center">Dégât torse</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableauArmes.map((a) => (
                    <TableRow key={a.type}>
                      <TableCell className="font-medium">{a.type}</TableCell>
                      <TableCell className="text-muted-foreground">{a.taille}</TableCell>
                      <TableCell className="text-center">{a.membres}</TableCell>
                      <TableCell className="text-center">{a.torse}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-primary mb-4">Armures</h2>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-card">
                    <TableHead className="text-primary font-heading">Type</TableHead>
                    <TableHead className="text-primary font-heading text-center">Points d'armure</TableHead>
                    <TableHead className="text-primary font-heading text-center">Durée</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableauArmures.map((a) => (
                    <TableRow key={a.type}>
                      <TableCell className="font-medium">{a.type}</TableCell>
                      <TableCell className="text-center">{a.points}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{a.duree}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsContent>

        {/* ── Onglet 3 ── */}
        <TabsContent value="lexique" className="mt-6 space-y-6">
          {/* Recherche & filtres */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un effet…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-1 self-center">Type :</span>
              {typesEffet.map((t) => (
                <Badge
                  key={t}
                  variant={filtreType === t ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFiltreType(filtreType === t ? null : t)}
                >
                  {labelType[t]}
                </Badge>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-1 self-center">Source :</span>
              {sourcesEffet.map((s) => (
                <Badge
                  key={s}
                  variant={filtreSource === s ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFiltreSource(filtreSource === s ? null : s)}
                >
                  {labelSource[s]}
                </Badge>
              ))}
            </div>
          </div>

          {/* Résultats */}
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Chargement…</p>
          ) : effetsFiltres.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucun effet trouvé pour cette recherche.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {effetsFiltres.map((e) => (
                <Card key={e.id} className="border-border hover:border-primary/40 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="font-heading text-lg">{e.nom}</CardTitle>
                      <div className="flex gap-1 flex-shrink-0">
                        {e.type && (
                          <Badge variant="secondary" className="text-xs">
                            {labelType[e.type] ?? e.type}
                          </Badge>
                        )}
                        {e.source && (
                          <Badge variant="outline" className="text-xs">
                            {labelSource[e.source] ?? e.source}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-muted-foreground">{e.description}</p>
                    {e.duree && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Durée : {e.duree}</span>
                      </div>
                    )}
                    {e.conditions && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Conditions : {e.conditions}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Regles;

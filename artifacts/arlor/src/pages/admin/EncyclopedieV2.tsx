import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FicheMoteur2, type ChampSchema } from "@/components/shared/FicheMoteur2";
import { ListeMoteur, type ListeConfig } from "@/components/shared/ListeMoteur";
import { parseRecetteVerbatim } from "@/utils/alchimie";

/**
 * EncyclopedieV2 — page de VALIDATION admin du Moteur V2 (PR2a).
 *
 * Admin-gated (la route porte <ProtectedRoute requiredRole="animateur">). Prouve
 * sur 5 catégories-témoins que la même brique Liste (ListeMoteur) + la même brique
 * Fiche (FicheMoteur2) rendent tout l'éventail, seule la config (`fiches_listes` /
 * `fiches_schemas.champs_v2`) changeant. La page LIVE (Encyclopedie.tsx) n'est pas
 * touchée : ce moteur lit `champs_v2`, jamais `champs` (v1).
 */

// fiches_listes et fiches_schemas.champs_v2 ne sont pas (encore) dans les types
// générés : on lit ces colonnes additives via un client non typé.
const sb = supabase as any;

const CATS = [
  { cle: "race", label: "Races" },
  { cle: "trait_racial", label: "Traits raciaux" },
  { cle: "classe", label: "Classes" },
  { cle: "competences", label: "Compétences" },
  { cle: "assemblages", label: "Assemblages" },
  { cle: "alchimie", label: "Alchimie" },
  { cle: "sorts", label: "Sorts" },
  { cle: "prieres", label: "Prières" },
  { cle: "religions", label: "Religions" },
  { cle: "bestiaire", label: "Bestiaire" },
  { cle: "lore", label: "Régions / Lore" },
  { cle: "forge", label: "Forge" },
  { cle: "joaillerie", label: "Joaillerie" },
  { cle: "pieges", label: "Pièges" },
] as const;

type CatCle = (typeof CATS)[number]["cle"];

const TABLE_SOURCE: Record<CatCle, string> = {
  race: "races",
  trait_racial: "traits_raciaux",
  classe: "classes",
  competences: "competences",
  assemblages: "assemblages_runes",
  alchimie: "recettes_alchimie",
  sorts: "sorts",
  prieres: "prieres",
  religions: "religions",
  bestiaire: "bestiaire",
  lore: "lore",
  forge: "objets_forge",
  joaillerie: "objets_joaillerie",
  pieges: "pieges",
};

export default function EncyclopedieV2() {
  const [cat, setCat] = useState<CatCle>("sorts");
  const [mode, setMode] = useState<"abrege" | "integral">("integral");
  const [schema, setSchema] = useState<ChampSchema[]>([]);
  const [config, setConfig] = useState<ListeConfig | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [lookups, setLookups] = useState<Record<string, any[]>>({});
  const [competencesParId, setCompetencesParId] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<{ item: any } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let annule = false;
    setLoading(true);
    setSel(null);
    (async () => {
      const [schemaRes, listeRes] = await Promise.all([
        sb.from("fiches_schemas").select("champs_v2").eq("categorie", cat).maybeSingle(),
        sb.from("fiches_listes").select("*").eq("categorie", cat).maybeSingle(),
      ]);

      const dataRes = await sb.from(TABLE_SOURCE[cat]).select("*").eq("est_actif", true).order("nom");
      let donnees: any[] = dataRes.data ?? [];

      // Pièges : regroupe par nom -> 1 fiche porteuse de `.rows` (lignes triées par niveau).
      if (cat === "pieges") {
        const parNom: Record<string, any[]> = {};
        donnees.forEach((p) => {
          (parNom[p.nom] ||= []).push(p);
        });
        donnees = Object.entries(parNom).map(([nom, lignes]) => {
          const tri = [...lignes].sort((a, b) => (a.niveau ?? 0) - (b.niveau ?? 0));
          return { nom, resume_condense: tri[0]?.resume_condense ?? null, rows: tri };
        });
      }

      // Lookups FK (forge -> reparations) pour les render "relation" en FK.
      let lk: Record<string, any[]> = {};
      if (cat === "forge") {
        const repRes = await sb.from("reparations_forge").select("*").eq("est_actif", true);
        lk = { reparations: repRes.data ?? [] };
      }

      // Alchimie : pré-parse le verbatim en blocs (RecetteSections) injectés dans la fiche.
      if (cat === "alchimie") {
        donnees = donnees.map((r) => ({
          ...r,
          _sections: parseRecetteVerbatim(r.description_verbatim),
        }));
      }

      // Classes : résout competence_id -> nom (render liste_competences).
      let compMap: Record<string, string> = {};
      if (cat === "classe") {
        const compRes = await sb.from("competences").select("id, nom").eq("est_actif", true);
        compMap = Object.fromEntries(
          (compRes.data ?? []).map((c: any) => [c.id, c.nom ?? ""])
        );
      }

      // Races : injecte les noms de traits permis (relation race_traits) dans chaque entité.
      if (cat === "race") {
        const [rtRes, traitsRes] = await Promise.all([
          sb.from("race_traits").select("race_id, trait_id"),
          sb.from("traits_raciaux").select("id, nom").eq("est_actif", true),
        ]);
        const nomParTrait: Record<string, string> = Object.fromEntries(
          (traitsRes.data ?? []).map((t: any) => [t.id, t.nom ?? ""])
        );
        const traitsParRace: Record<string, string[]> = {};
        (rtRes.data ?? []).forEach((rt: any) => {
          const nom = nomParTrait[rt.trait_id];
          if (!nom) return;
          (traitsParRace[rt.race_id] ||= []);
          if (!traitsParRace[rt.race_id].includes(nom)) traitsParRace[rt.race_id].push(nom);
        });
        donnees = donnees.map((r) => ({ ...r, traits_permis: traitsParRace[r.id] ?? [] }));
      }

      if (annule) return;
      setSchema((schemaRes.data?.champs_v2 ?? []) as ChampSchema[]);
      setConfig((listeRes.data ?? null) as ListeConfig | null);
      setRows(donnees);
      setLookups(lk);
      setCompetencesParId(compMap);
      setLoading(false);
    })();
    return () => {
      annule = true;
    };
  }, [cat]);

  const modeMasque = config?.carte?.mode === "aucun";
  const modeEffectif: "abrege" | "integral" = modeMasque ? "integral" : mode;

  return (
    <div className="container py-8 max-w-5xl animate-in fade-in duration-500">
      {/* Header */}
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-2 tracking-tight">
        Encyclopédie — Moteur v2 (validation admin)
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Même brique Liste + même brique Fiche, seule la config change. 5 témoins :
        sorts · compétences · forge · pièges · bestiaire.
      </p>

      {/* Onglets de catégorie */}
      <div className="overflow-x-auto -mx-2 px-2 mb-6">
        <div className="inline-flex bg-card border border-border p-1 rounded-lg w-max">
          {CATS.map((c) => {
            const isActive = cat === c.cle;
            return (
              <button
                key={c.cle}
                onClick={() => setCat(c.cle)}
                className={`rounded-sm px-3 py-1.5 font-heading text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggle Abrégé / Intégral (caché si la config n'a pas d'abrégé) */}
      {!modeMasque && (
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setMode((m) => (m === "integral" ? "abrege" : "integral"))}
            className="rounded-md border border-gold/40 px-3 py-1.5 text-sm font-medium text-gold hover:border-gold transition-all"
            style={{ background: "rgba(201,168,76,0.06)" }}
          >
            {mode === "integral" ? "Texte intégral ✓" : "Texte abrégé ✓"}
          </button>
          <span className="text-xs text-muted-foreground">
            Bascule la source des champs texte (n'affecte jamais les chiffres).
          </span>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Chargement…</p>
      ) : sel ? (
        <div>
          <button
            onClick={() => setSel(null)}
            className="inline-flex items-center gap-1.5 text-sm text-gold hover:underline mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la liste
          </button>
          <h2 className="font-heading text-2xl font-bold text-gold mb-4">
            {String(sel.item?.nom ?? "")}
          </h2>
          <FicheMoteur2
            schema={schema}
            entite={sel.item}
            densite="encyclo"
            mode={modeEffectif}
            lookups={lookups}
            competencesParId={competencesParId}
          />
        </div>
      ) : config ? (
        <ListeMoteur config={config} rows={rows} onOpen={setSel} />
      ) : (
        <p className="text-muted-foreground text-center py-12">
          Aucune configuration de liste pour « {cat} ».
        </p>
      )}
    </div>
  );
}

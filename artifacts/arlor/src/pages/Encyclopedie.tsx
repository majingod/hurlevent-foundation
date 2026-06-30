import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BasculeAbregeIntegral from "@/components/shared/BasculeAbregeIntegral";
import { FicheMoteur2, type ChampSchema } from "@/components/shared/FicheMoteur2";
import { EncyclopedieHub, EncyclopedieSwitcher } from "@/components/encyclopedie/EncyclopedieNav";
import { EncyclopedieRecherche } from "@/components/encyclopedie/EncyclopedieRecherche";
import { ListeMoteur, type ListeConfig } from "@/components/shared/ListeMoteur";
import { parseRecetteVerbatim } from "@/utils/alchimie";

/**
 * Encyclopédie — page PUBLIQUE du Moteur V2, montée sur la route `/encyclopedie`
 * (aucun ProtectedRoute : accessible à tous, comme /regles ou /evenements).
 *
 * Rend les 14 catégories avec une seule brique Liste (ListeMoteur) + une seule
 * brique Fiche (FicheMoteur2) ; seule la config (`fiches_listes` /
 * `fiches_schemas.champs_v2`) change d'une catégorie à l'autre. Lit `champs_v2`,
 * jamais `champs` (l'ancien Encyclopedie.tsx v1 a été supprimé).
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

export default function Encyclopedie() {
  const [searchParams, setSearchParams] = useSearchParams();
  const catParam = searchParams.get("cat");
  const cat = (CATS.find((c) => c.cle === catParam)?.cle ?? null) as CatCle | null;
  const ficheParam = searchParams.get("fiche");
  const updateParams = (
    mut: (p: URLSearchParams) => void,
    opts?: { replace?: boolean }
  ) => {
    const next = new URLSearchParams(searchParams);
    mut(next);
    setSearchParams(next, opts);
  };
  const cleFiche = (item: any) => (cat === "pieges" ? item?.nom : item?.id);
  const setCat = (c: CatCle | null) =>
    updateParams((p) => {
      if (c) p.set("cat", c);
      else p.delete("cat");
      p.delete("fiche");
    });
  const goToFiche = (cle: string, key: string) =>
    updateParams((p) => {
      p.set("cat", cle);
      p.set("fiche", key);
    });
  const openFiche = (item: any) =>
    updateParams((p) => {
      const k = cleFiche(item);
      if (k != null) p.set("fiche", String(k));
    });
  const closeFiche = () =>
    updateParams((p) => p.delete("fiche"), { replace: true });
  const [mode, setMode] = useState<"abrege" | "integral">("integral");
  const [schema, setSchema] = useState<ChampSchema[]>([]);
  const [config, setConfig] = useState<ListeConfig | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [lookups, setLookups] = useState<Record<string, any[]>>({});
  const [competencesParId, setCompetencesParId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let annule = false;
    if (!cat) {
      setLoading(false);
      setErreur(null);
      setSchema([]);
      setConfig(null);
      setRows([]);
      return;
    }
    setLoading(true);
    setErreur(null);
    (async () => {
      try {
      const [schemaRes, listeRes] = await Promise.all([
        sb.from("fiches_schemas").select("champs_v2").eq("categorie", cat).maybeSingle(),
        sb.from("fiches_listes").select("*").eq("categorie", cat).maybeSingle(),
      ]);

      const dataRes = await sb.from(TABLE_SOURCE[cat]).select("*").eq("est_actif", true).order("nom");
      if (schemaRes.error || listeRes.error || dataRes.error) {
        throw schemaRes.error ?? listeRes.error ?? dataRes.error;
      }
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
      } catch (e) {
        if (!annule) {
          console.error("[EncyclopedieV2] chargement catégorie échoué", e);
          setErreur("Impossible de charger cette catégorie. Vérifie ta connexion et réessaie.");
        }
      } finally {
        if (!annule) setLoading(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [cat, reloadKey]);

  // Remonter en haut à chaque changement de vue (ouverture/fermeture de fiche,
  // changement de catégorie). Sans ça, ouvrir une fiche depuis le bas d'une longue
  // liste l'affiche scroll resté en bas. La liste se démonte quand une fiche est
  // ouverte : il n'y a donc pas de position de liste à restaurer.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [cat, ficheParam]);

  // Fiche ouverte = dérivée de l'URL (?fiche=clé). Source unique de vérité :
  // back navigateur/Android ferme la fiche, et un lien ?cat&fiche est partageable.
  const selItem =
    ficheParam != null
      ? (rows.find((r) => String(cleFiche(r)) === ficheParam) ?? null)
      : null;

  const modeMasque = config?.carte?.mode === "aucun";
  const modeEffectif: "abrege" | "integral" = modeMasque ? "integral" : mode;

  return (
    <div className="container py-8 max-w-5xl animate-in fade-in duration-500">
      {/* Header */}
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-2 tracking-tight">
        Encyclopédie
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Choisis une catégorie pour explorer, ou utilise la recherche pour trouver directement.
      </p>

      {/* Navigation groupée : hub (accueil) ou switcher (dans une catégorie) */}
      {!cat ? (
        <EncyclopedieRecherche
          onPick={(cle, id) => goToFiche(cle, id)}
        >
          <EncyclopedieHub onPick={(c) => setCat(c as CatCle)} />
        </EncyclopedieRecherche>
      ) : (
        <>
        <button
          onClick={() => setCat(null)}
          className="inline-flex items-center gap-1.5 text-sm text-gold hover:underline mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Toutes les catégories
        </button>
        <EncyclopedieSwitcher
          active={cat}
          onPick={(c) => setCat(c as CatCle)}
        />

      {/* Interrupteur Abrégé ⇄ Intégral (caché si la config n'a pas d'abrégé) */}
      {!modeMasque && (
        <BasculeAbregeIntegral
          mode={mode}
          onToggle={() => setMode((m) => (m === "integral" ? "abrege" : "integral"))}
          className="mb-6"
        />
      )}

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Chargement…</p>
      ) : erreur ? (
        <div className="text-center py-12">
          <p className="text-sm mb-4" style={{ color: "#e6b3b3" }}>{erreur}</p>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 px-4 py-2 text-sm text-gold hover:border-gold transition-all"
            style={{ background: "rgba(201,168,76,0.06)" }}
          >
            Réessayer
          </button>
        </div>
      ) : selItem ? (
        <div>
          <button
            onClick={closeFiche}
            className="inline-flex items-center gap-1.5 text-sm text-gold hover:underline mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la liste
          </button>
          <h2 className="font-heading text-2xl font-bold text-gold mb-4">
            {String(selItem?.nom ?? "")}
          </h2>
          <FicheMoteur2
            schema={schema}
            entite={selItem}
            densite="encyclo"
            mode={modeEffectif}
            lookups={lookups}
            competencesParId={competencesParId}
          />
        </div>
      ) : config ? (
        <ListeMoteur config={config} rows={rows} onOpen={({ item }) => openFiche(item)} />
      ) : (
        <p className="text-muted-foreground text-center py-12">
          Aucune configuration de liste pour « {cat} ».
        </p>
      )}
        </>
      )}
    </div>
  );
}

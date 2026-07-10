/**
 * Port TS fidèle de public.rechercher_encyclopedie (verbatim prod s320) — toute
 * évolution de la RPC doit être répercutée ici (et vice-versa).
 *
 * Miroir de la fonction SQL `rechercher_encyclopedie(p_terme)` : recherche
 * plein-texte « contient » (ILIKE sous-chaîne) désaccentuée sur 15 branches, seuil
 * 3 caractères, `rang` 1.0/0.5 (terme dans le champ titre → 1.0), tri
 * `rang DESC` puis `titre` (localeCompare "fr"), `LIMIT 50`. Le `snippet` reproduit
 * `_snip_contient` (positions calculées sur le corpus DÉSACCENTUÉ, extraits pris
 * dans le corpus ORIGINAL — comportement SQL reproduit tel quel).
 *
 * Module PUR : aucun import react/supabase — testable en isolation, tables passées
 * directement (le client visiteur y branche `getSnapshot().tables`).
 */

export type ResultatRechercheEncyclopedie = {
  type: string;
  id: string;
  titre: string;
  sous_titre: string | null;
  categorie: string | null;
  snippet: string | null;
  rang: number;
};

/**
 * Miroir TS de `public.f_unaccent` (extension unaccent Postgres) : NFD + retrait
 * des diacritiques combinants (U+0300–U+036F) + mappings des ligatures que NFD
 * ne décompose pas (`œ→oe, Œ→OE, æ→ae, Æ→AE`).
 */
export function unaccentFr(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "AE");
}

/**
 * Port fidèle de `_snip_contient(corps, termeUA)` (SQL 1-indexé → TS 0-indexé).
 * `termeUA` est déjà désaccentué (mais pas forcément en minuscules) ; la position
 * est cherchée sur `lower(unaccent(corps))` mais les extraits sont pris dans
 * `corps` ORIGINAL — dérive possible si `œ` change la longueur, identique côté SQL.
 */
export function snipContient(corps: string, termeUA: string): string {
  if (corps == null || corps === "") return "";
  const pos1 = unaccentFr(corps).toLowerCase().indexOf(termeUA.toLowerCase()) + 1; // 1-based ; 0 si absent
  if (pos1 === 0) return corps.substring(0, 80);
  const tlen = termeUA.length;
  const start1 = Math.max(1, pos1 - 30);
  return (
    (start1 > 1 ? "…" : "") +
    corps.substring(start1 - 1, pos1 - 1) +
    "<mark>" +
    corps.substring(pos1 - 1, pos1 - 1 + tlen) +
    "</mark>" +
    corps.substring(pos1 - 1 + tlen, pos1 - 1 + tlen + 45) +
    (corps.length > pos1 - 1 + tlen + 45 ? "…" : "")
  );
}

// ── Helpers de projection (miroir des `coalesce`) ──

type Ligne = Record<string, unknown>;

/** `coalesce(champ, '')` : null/undefined → "". */
function s(v: unknown): string {
  return v == null ? "" : String(v);
}

/** `coalesce(array_to_string(x, ' '), '')` : ignore les éléments NULL. */
function joindreTableau(v: unknown): string {
  if (!Array.isArray(v)) return "";
  return v
    .filter((e) => e != null)
    .map((e) => String(e))
    .join(" ");
}

// ── Descripteurs des 15 branches (ordre & champs = verbatim SQL) ──

interface Branche {
  type: string;
  /** Clé de la table dans le snapshot. */
  table: string;
  /** Champ 🏷 servant au calcul du `rang` (et exposé comme `titre`). */
  titre: (r: Ligne) => string;
  sousTitre: (r: Ligne) => string | null;
  categorie: (r: Ligne) => string | null;
  /** Corpus ILIKE : concat des champs avec ' ' (chaque champ `?? ""`). */
  corpus: (r: Ligne) => string;
  /** `pieges` : DISTINCT ON (nom) — 1 résultat par `nom` (1re ligne du snapshot). */
  dedupParNom?: boolean;
}

const BRANCHES: Branche[] = [
  {
    type: "lore",
    table: "lore",
    titre: (r) => s(r.nom),
    sousTitre: (r) => (r.sous_titre as string | null) ?? null,
    categorie: (r) => (r.categorie as string | null) ?? null,
    corpus: (r) => [s(r.nom), s(r.sous_titre), s(r.description)].join(" "),
  },
  {
    type: "bestiaire",
    table: "bestiaire",
    titre: (r) => s(r.nom),
    sousTitre: () => null,
    categorie: (r) => (r.categorie as string | null) ?? null,
    corpus: (r) =>
      [s(r.nom), s(r.categorie), s(r.description), s(r.immunites), s(r.capacites_speciales)].join(" "),
  },
  {
    type: "religion",
    table: "religions",
    titre: (r) => s(r.nom),
    sousTitre: (r) => (r.dirigeant as string | null) ?? null,
    categorie: () => "religion",
    corpus: (r) =>
      [
        s(r.nom),
        s(r.dirigeant),
        s(r.fondateur),
        s(r.description),
        s(r.lore_fiche),
        s(r.description_longue),
        s(r.lore_manuel),
        joindreTableau(r.rituels_manuel),
        s(r.pouvoir_symbole),
      ].join(" "),
  },
  {
    type: "competence",
    table: "competences", // ⚠ la TABLE, pas la vue
    titre: (r) => s(r.nom),
    sousTitre: () => null,
    categorie: (r) => (r.categorie as string | null) ?? null,
    corpus: (r) => [s(r.nom), s(r.categorie), s(r.description)].join(" "),
  },
  {
    type: "sort",
    table: "sorts",
    titre: (r) => s(r.nom),
    sousTitre: (r) => (r.cercle as string | null) ?? null,
    categorie: (r) => (r.type_sort as string | null) ?? null,
    corpus: (r) => [s(r.nom), s(r.cercle), s(r.type_sort), s(r.description)].join(" "),
  },
  {
    type: "priere",
    table: "prieres",
    titre: (r) => s(r.nom),
    sousTitre: (r) => (r.domaine as string | null) ?? null,
    categorie: (r) => (r.type_priere as string | null) ?? null,
    corpus: (r) => [s(r.nom), s(r.domaine), s(r.type_priere), s(r.description)].join(" "),
  },
  {
    type: "regle",
    table: "sections_regles",
    titre: (r) => s(r.titre),
    sousTitre: (r) => (r.categorie as string | null) ?? null,
    categorie: () => "regle",
    corpus: (r) => [s(r.titre), s(r.categorie), s(r.contenu)].join(" "),
  },
  {
    type: "race",
    table: "races",
    titre: (r) => s(r.nom),
    sousTitre: () => null,
    categorie: () => "race",
    corpus: (r) => [s(r.nom), s(r.description), s(r.resume_condense)].join(" "),
  },
  {
    type: "trait_racial",
    table: "traits_raciaux",
    titre: (r) => s(r.nom),
    sousTitre: () => null,
    categorie: () => "trait_racial",
    corpus: (r) => [s(r.nom), s(r.description)].join(" "),
  },
  {
    type: "classe",
    table: "classes",
    titre: (r) => s(r.nom),
    sousTitre: (r) => (r.role_combat as string | null) ?? null,
    categorie: () => "classe",
    corpus: (r) => [s(r.nom), s(r.description), s(r.role_combat)].join(" "),
  },
  {
    type: "forge",
    table: "objets_forge",
    titre: (r) => s(r.nom),
    sousTitre: (r) => (r.type as string | null) ?? null,
    categorie: () => "forge",
    corpus: (r) => [s(r.nom), s(r.description), s(r.effet), s(r.type)].join(" "),
  },
  {
    type: "joaillerie",
    table: "objets_joaillerie",
    titre: (r) => s(r.nom),
    sousTitre: () => null,
    categorie: () => "joaillerie",
    corpus: (r) => [s(r.nom), s(r.description), s(r.effet)].join(" "),
  },
  {
    type: "alchimie",
    table: "recettes_alchimie",
    titre: (r) => s(r.nom),
    sousTitre: (r) => (r.type as string | null) ?? null,
    categorie: () => "alchimie",
    corpus: (r) => [s(r.nom), s(r.description), s(r.effet), s(r.formule)].join(" "),
  },
  {
    type: "assemblages",
    table: "assemblages_runes",
    titre: (r) => s(r.nom),
    sousTitre: (r) => (r.cible as string | null) ?? null,
    categorie: () => "assemblages",
    corpus: (r) => [s(r.nom), s(r.description), s(r.effet), s(r.cible)].join(" "),
  },
  {
    type: "pieges",
    table: "pieges",
    titre: (r) => s(r.nom),
    sousTitre: (r) => (r.type_piege as string | null) ?? null,
    categorie: () => "pieges",
    corpus: (r) =>
      [s(r.nom), s(r.effets), s(r.effet_generique), s(r.type_piege), s(r.cible)].join(" "),
    dedupParNom: true,
  },
];

/**
 * Recherche encyclopédie locale sur le snapshot (miroir de la RPC prod).
 * `tables` : dictionnaire `nomTable → lignes` (tables absentes → `[]`).
 */
export function rechercherEncyclopedieLocale(
  tables: Record<string, Array<Record<string, unknown>> | undefined>,
  terme: string | null | undefined,
): ResultatRechercheEncyclopedie[] {
  if (terme == null) return [];
  const t = terme.trim();
  if (t.length < 3) return [];

  const termeUA = unaccentFr(t);
  const termeUALower = termeUA.toLowerCase();
  const contient = (champ: string): boolean =>
    unaccentFr(champ).toLowerCase().includes(termeUALower);

  const resultats: ResultatRechercheEncyclopedie[] = [];
  for (const br of BRANCHES) {
    const rows = (tables[br.table] ?? []).filter((r) => r.est_actif === true);
    const vusNoms = new Set<string>();
    for (const r of rows) {
      const corps = br.corpus(r);
      if (!contient(corps)) continue; // ILIKE sur le corpus désaccentué
      if (br.dedupParNom) {
        const nom = s(r.nom);
        if (vusNoms.has(nom)) continue; // DISTINCT ON (nom) : 1re ligne rencontrée
        vusNoms.add(nom);
      }
      const titre = br.titre(r);
      resultats.push({
        type: br.type,
        id: s(r.id),
        titre,
        sous_titre: br.sousTitre(r),
        categorie: br.categorie(r),
        snippet: snipContient(corps, termeUA),
        rang: contient(titre) ? 1.0 : 0.5,
      });
    }
  }

  // ORDER BY rang DESC, titre (localeCompare "fr") ; LIMIT 50.
  resultats.sort((a, b) => {
    if (b.rang !== a.rang) return b.rang - a.rang;
    return a.titre.localeCompare(b.titre, "fr");
  });
  return resultats.slice(0, 50);
}

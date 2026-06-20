// Logique narrative de la stèle mémorial (Temps 1, déterministe, sans IA).
// Mapping nature + épithètes graduées + phrase template + regroupement.

export type Nature = "Combat" | "Magie" | "Foi" | "Artisanat" | "Savoirs";

export interface CompetenceDetail { nom: string; categorie: string; niveau: number }
export interface SortDetail { nom: string; cercle: string | null; niveau: number }
export interface PriereDetail { nom: string; domaine: string | null; niveau: number }
export interface AssemblageDetail { nom: string; effet?: string | null }
export interface RecetteDetail { nom: string; type?: string | null }
export interface SteleDetails {
  competences?: CompetenceDetail[];
  sorts?: SortDetail[];
  prieres?: PriereDetail[];
  assemblages?: AssemblageDetail[];
  recettes?: RecetteDetail[];
}

// ── Mapping nature par nom de compétence (validé s250) ──
const NATURE_PAR_NOM: Record<string, Nature> = {
  // Artisanat
  "Forge": "Artisanat", "Joaillerie": "Artisanat", "Alchimie": "Artisanat",
  "Assemblage de Runes": "Artisanat", "Mineur": "Artisanat", "Herbalisme": "Artisanat",
  "Dépeçage": "Artisanat", "Création et désarmement de piège": "Artisanat",
  "Piège sécurisé": "Artisanat", "Piège Magique": "Artisanat",
  // Magie
  "Canalisation": "Magie", "Bâton de Sorcier": "Magie", "Développement Spirituel": "Magie",
  "Développement Spirituel Supérieur": "Magie", "Frénésie magique": "Magie", "Méditation": "Magie",
  // Foi
  "Bénédiction": "Foi", "Consécration": "Foi", "Grande Messe": "Foi", "Imposition des Mains": "Foi",
  "Premiers Soins": "Foi", "Chirurgien": "Foi", "Diagnostic": "Foi", "Réveil Expéditif": "Foi",
  "Rêves": "Foi", "Formation Théologique": "Foi",
  // Savoirs
  "Décryptage": "Savoirs", "Identification d'objet": "Savoirs", "Identification des Potions": "Savoirs",
  "Estimation": "Savoirs", "Hypnose": "Savoirs", "Langue supplémentaire": "Savoirs",
  "Linguistique et Mathématique": "Savoirs", "Revenu": "Savoirs",
  "Cachette secrète": "Savoirs", "Crochetage de serrure": "Savoirs", "Empoisonnement de projectile": "Savoirs",
  "Expertise en toxicologie": "Savoirs", "Falsification": "Savoirs", "Fouille rapide": "Savoirs",
  "Pistage": "Savoirs", "Rumeur": "Savoirs", "Torture": "Savoirs",
  "Connaissances Criminelles": "Savoirs", "Connaissances des Créatures": "Savoirs",
  "Connaissances des Gemmes Communes": "Savoirs", "Connaissances des Gemmes Rares": "Savoirs",
  "Connaissances des Herbes Communes": "Savoirs", "Connaissances des Herbes Rares": "Savoirs",
  "Connaissances des Métaux Communs": "Savoirs", "Connaissances des Métaux Rares": "Savoirs",
  "Connaissances des Religions": "Savoirs", "Connaissances des Runes": "Savoirs",
  "Connaissances Héraldique": "Savoirs",
  // Combat (voleur offensif ; le guerrier passe par le fallback catégorie)
  "Assommer": "Combat", "Attaque sournoise": "Combat", "Compétence d'arme à distance": "Combat",
};

const NATURE_PAR_CATEGORIE: Record<string, Nature> = {
  guerrier: "Combat", mage: "Magie", pretre: "Foi", voleur: "Savoirs", generale: "Savoirs",
};

export function natureDe(nom: string, categorie: string): Nature {
  return NATURE_PAR_NOM[nom] ?? NATURE_PAR_CATEGORIE[categorie] ?? "Savoirs";
}

// ── Métiers d'artisanat → libellé d'épithète ──
const METIER_PAR_NOM: Record<string, string> = {
  "Forge": "forgeron", "Joaillerie": "joaillier", "Alchimie": "alchimiste",
  "Assemblage de Runes": "runiste", "Herbalisme": "herboriste", "Mineur": "mineur",
  "Création et désarmement de piège": "piégeur", "Piège sécurisé": "piégeur", "Piège Magique": "piégeur",
};

// ── Articles français pour cercles / domaines ──
const ARTICLE: Record<string, string> = {
  "Air": "de l'Air", "Eau": "de l'Eau", "Feu": "du Feu", "Terre": "de la Terre",
  "Charmes": "des Charmes", "Illusion": "de l'Illusion", "Magie Noire": "de la Magie Noire",
  "Magie Pure": "de la Magie Pure", "Nécromancie": "de la Nécromancie", "Protection": "de la Protection",
  "Altération": "de l'Altération", "Divination": "de la Divination", "Combat": "du Combat",
  "Bénédiction": "de la Bénédiction", "Chaos": "du Chaos", "Éléments": "des Éléments",
  "Guerre": "de la Guerre", "Nature": "de la Nature", "Ordre": "de l'Ordre",
};
function avec(label: string): string {
  if (ARTICLE[label]) return ARTICLE[label];
  return /^[aàâäeéèêëiïîoôöuùûüh]/i.test(label) ? `de l'${label}` : `de ${label}`;
}
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function decap(s: string): string { return s.charAt(0).toLowerCase() + s.slice(1); }
function joinFr(arr: string[]): string {
  if (arr.length <= 1) return arr[0] ?? "";
  return arr.slice(0, -1).join(", ") + " et " + arr[arr.length - 1];
}

export interface Epithete { label: string; palier: number; score: number; nature: Nature }

function epMetier(metier: string, niv: number): string {
  if (niv >= 3) return `Maître ${metier}`;
  if (niv === 2) return `${cap(metier)} expérimenté`;
  return `${cap(metier)} à ses heures`;
}

export function genererEpithetes(d: SteleDetails): Epithete[] {
  const out: Epithete[] = [];
  const comp = d.competences ?? [];
  const sorts = d.sorts ?? [];
  const prieres = d.prieres ?? [];

  // Artisanat — métiers (niveau max de la compétence métier)
  const metierNiv: Record<string, number> = {};
  for (const c of comp) {
    const m = METIER_PAR_NOM[c.nom];
    if (m) metierNiv[m] = Math.max(metierNiv[m] ?? 0, c.niveau);
  }
  for (const m of Object.keys(metierNiv)) {
    const niv = metierNiv[m];
    out.push({ label: epMetier(m, niv), palier: niv, score: niv, nature: "Artisanat" });
  }

  // Magie — cercle dominant
  const cercleNiv: Record<string, number> = {};
  for (const s of sorts) if (s.cercle) cercleNiv[s.cercle] = Math.max(cercleNiv[s.cercle] ?? 0, s.niveau);
  for (const cercle of Object.keys(cercleNiv)) {
    const niv = cercleNiv[cercle];
    const palier = niv >= 3 ? 3 : niv === 2 ? 2 : 1;
    const label = palier === 3 ? `Maître ${avec(cercle)}` : palier === 2 ? `Mage ${avec(cercle)}` : `Initié ${avec(cercle)}`;
    out.push({ label, palier, score: niv + 0.5, nature: "Magie" });
  }

  // Foi — domaine dominant
  const domNiv: Record<string, number> = {};
  for (const p of prieres) if (p.domaine) domNiv[p.domaine] = Math.max(domNiv[p.domaine] ?? 0, p.niveau);
  for (const dom of Object.keys(domNiv)) {
    const niv = domNiv[dom];
    const palier = niv >= 4 ? 3 : niv >= 2 ? 2 : 1;
    const label = palier === 3 ? `Grand prêtre ${avec(dom)}` : palier === 2 ? `Prêtre ${avec(dom)}` : `Dévot ${avec(dom)}`;
    out.push({ label, palier, score: niv + 0.5, nature: "Foi" });
  }

  // Combat — armes
  const armes = comp.filter((c) => c.nom.startsWith("Compétence d'arme"));
  if (armes.length >= 1) {
    const nivMax = Math.max(...armes.map((a) => a.niveau));
    const lame = armes.some((a) => /lame/i.test(a.nom) && a.niveau === nivMax);
    let label = nivMax >= 3 ? "Maître d'armes" : nivMax === 2 ? "Guerrier aguerri" : "Combattant";
    if (lame && nivMax >= 2) label = "Bretteur";
    out.push({ label, palier: nivMax, score: nivMax, nature: "Combat" });
  }

  // Savoirs — érudition
  const savoirs = comp.filter((c) => natureDe(c.nom, c.categorie) === "Savoirs");
  if (savoirs.length >= 2) {
    const nivMax = Math.max(...savoirs.map((s) => s.niveau));
    const label = savoirs.length >= 6 ? "Maître érudit" : savoirs.length >= 4 ? "Érudit" : "Lettré";
    const palier = savoirs.length >= 6 ? 3 : 2;
    out.push({ label, palier, score: nivMax, nature: "Savoirs" });
  }

  return out.sort((a, b) => b.score - a.score);
}

// Top N épithètes pour la ligne sous le nom
export function lignerEpithetes(d: SteleDetails, max = 4): string[] {
  return genererEpithetes(d).slice(0, max).map((e) => e.label);
}

// Phrase template (style nominal), métiers factorisés par palier
export function genererPhrase(d: SteleDetails, gnCompletes?: number | null): string {
  const eps = genererEpithetes(d);
  if (eps.length === 0) return "";

  // Sépare métiers (factorisables) des autres épithètes
  const metierNiv: Record<string, number> = {};
  for (const c of d.competences ?? []) {
    const m = METIER_PAR_NOM[c.nom];
    if (m) metierNiv[m] = Math.max(metierNiv[m] ?? 0, c.niveau);
  }
  const autres = eps.filter((e) => e.nature !== "Artisanat");

  const phrases: string[] = [];
  for (const palier of [3, 2, 1]) {
    const frags: string[] = [];
    // épithètes non-métier de ce palier (1re lettre abaissée, noms propres préservés)
    autres.filter((e) => e.palier === palier).forEach((e) => frags.push(decap(e.label)));
    // métiers de ce palier, factorisés
    const metiers = Object.keys(metierNiv).filter((m) => metierNiv[m] === palier);
    if (metiers.length) {
      const noms = joinFr(metiers);
      if (palier >= 3) frags.push(`maître ${noms}`);
      else if (palier === 2) frags.push(`${noms} expérimenté`);
      else frags.push(`${noms} à ses heures`);
    }
    if (frags.length) phrases.push(cap(frags.join(", ")) + ".");
  }
  if (gnCompletes && gnCompletes > 0) {
    phrases.push(`${gnCompletes} rassemblement${gnCompletes > 1 ? "s" : ""} traversé${gnCompletes > 1 ? "s" : ""}.`);
  }
  return phrases.join(" ");
}

// Regroupement des savoir-faire par nature, spécialité = niveau max de la nature
export interface ItemNature { nom: string; niveau?: number | null; spe?: boolean }
export interface SectionNature { nature: Nature; items: ItemNature[] }
const ORDRE_NATURE: Nature[] = ["Combat", "Magie", "Foi", "Artisanat", "Savoirs"];

export function grouperParNature(d: SteleDetails): SectionNature[] {
  const buckets: Record<Nature, ItemNature[]> = { Combat: [], Magie: [], Foi: [], Artisanat: [], Savoirs: [] };
  for (const c of d.competences ?? []) buckets[natureDe(c.nom, c.categorie)].push({ nom: c.nom, niveau: c.niveau });
  for (const s of d.sorts ?? []) buckets.Magie.push({ nom: s.nom, niveau: s.niveau });
  for (const p of d.prieres ?? []) buckets.Foi.push({ nom: p.nom, niveau: p.niveau });
  for (const a of d.assemblages ?? []) buckets.Artisanat.push({ nom: a.nom });
  for (const r of d.recettes ?? []) buckets.Artisanat.push({ nom: r.nom });

  const out: SectionNature[] = [];
  for (const nature of ORDRE_NATURE) {
    const items = buckets[nature];
    if (!items.length) continue;
    const nivMax = Math.max(...items.map((i) => i.niveau ?? 0));
    if (nivMax > 0) items.forEach((i) => { if ((i.niveau ?? 0) === nivMax) i.spe = true; });
    items.sort((a, b) => (b.niveau ?? 0) - (a.niveau ?? 0));
    out.push({ nature, items });
  }
  return out;
}

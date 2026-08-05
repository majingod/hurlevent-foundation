/**
 * [VIS-8 C1, s375] ARTISANAT DU GÉNÉRATEUR — poids MESURÉS des tirages.
 *
 * RÈGLE (validée par Fred, s375) : quand une composition contient
 * `Alchimie`, `Assemblage de Runes` ou `Création et désarmement de piège`,
 * le personnage repart avec ses acquisitions gratuites dues (manuel :
 * Alchimie 1 → 5 recettes mineures · Alchimie 2 → +4 intermédiaires ·
 * Runes 1 → 2 assemblages au choix · Pièges 1 → 3 pièges de niveau 1),
 * tirées SANS REMISE dans le catalogue du palier, pondérées par ce que les
 * VRAIS joueurs ont pris.
 *
 * LE POOL N'EST PAS ICI : le pool = le snapshot (toutes les entrées actives
 * du palier — `recettes_alchimie` / `assemblages_runes` / `pieges`). Ce
 * fichier ne porte que les POIDS. Un item absent d'ici pèse `POIDS_DEFAUT`
 * (1) : tout le catalogue reste tirable, les goûts mesurés dominent, et une
 * recette ajoutée en base plus tard devient tirable à la régénération du
 * snapshot sans toucher ce fichier.
 *
 * SOURCE DES CHIFFRES (jamais retoucher à la main — re-mesurer) : prod
 * 2026-08-04 via MCP, `poids = nb de porteurs distincts + 1`.
 *   · recettes  : 13 personnages porteurs de recettes (152 lignes) ;
 *   · assemblages : 8 porteurs (36 lignes) ;
 *   · pièges niv 1 : 6 porteurs (22 lignes, améliorations niv 2 exclues).
 * Requête type : GROUP BY item, count(DISTINCT personnage_id).
 *
 * NOMS VERBATIM de la base (accents compris). Le test d'intégrité du lot
 * vérifie que CHAQUE clé ci-dessous existe au snapshot — une faute de
 * frappe = un poids orphelin silencieux, c'est le test qui l'attrape.
 */

export const POIDS_DEFAUT = 1;

/** Recettes d'alchimie (paliers 1 et 2 confondus — la clé est le nom). */
export const POIDS_RECETTES: Record<string, number> = {
  // — palier 1 (14 au catalogue, toutes prises par ≥ 3 des 13 alchimistes)
  "Potion de soins": 11,
  "Potion de regain spirituel": 11,
  "Poison de sommeil": 10,
  "Potion de protection magique": 10,
  "Encre d'Activation Runique": 8,
  "Poison d'anémie": 6,
  "Potion de peau d'écorce": 6,
  "Potion de stabilisation biochimique": 6,
  "Poison cataleptique": 5,
  "Poison de bras-mou": 5,
  "Potion d'endurance guerrière": 5,
  "Potion du cracheur de feu": 5,
  "Fortifiant anti-éléments": 4,
  "Poison de douleur": 4,
  // — palier 2 (16 au catalogue, 15 mesurées ; la 16ᵉ pèsera POIDS_DEFAUT)
  "Catalyseur à potion": 10,
  "Catalyseur à poison": 9,
  "Catalyseur magique": 9,
  "Antidote universel": 8,
  "Élixir de plénitude spirituelle": 6,
  "Remède curatif": 6,
  "Poison hallucinogène (intermédiaire)": 4,
  "Poison paralysant": 4,
  "Potion d'endurance guerrière accrue": 4,
  "Élixir d'héroïsme": 3,
  "Poison d'aveuglement": 3,
  "Poison de gangrène": 3,
  "Fortifiant d'endurance aux toxines": 2,
  "Potion de peau de pierre": 2,
  "Potion de résilience à la magie": 2,
};

/** Assemblages de runes (15/15 pris par au moins un runiste). */
export const POIDS_ASSEMBLAGES: Record<string, number> = {
  "Assemblage du passage": 8,
  "Assemblage de barrière magique": 6,
  "Assemblage de durabilité": 5,
  "Assemblage de résilience": 4,
  "Assemblage de liberté": 3,
  "Assemblage de préservation": 3,
  "Assemblage de productivité": 3,
  "Assemblage de rigidité": 3,
  "Assemblage de santé": 3,
  "Assemblage de vision pure": 3,
  "Assemblage de protection contre les éléments": 2,
  "Assemblage de protection du mal": 2,
  "Assemblage de régénération": 2,
  "Assemblage de repos en paix": 2,
  "Assemblage du bâtisseur": 2,
};

/** Pièges de niveau 1 (7 des 9 mesurés ; les 2 jamais pris pèsent 1). */
export const POIDS_PIEGES: Record<string, number> = {
  "Fléchette cachée": 5,
  "Fumée toxique": 5,
  "Piège immobilisant": 5,
  "Aiguille empoisonnée": 4,
  "Piège aveuglant": 2,
  "Piège d'hébêtement": 2,
  "Piège brise-doigts": 2,
};

/** Poids d'un item : mesuré s'il l'est, sinon POIDS_DEFAUT. */
export function poidsDe(nom: string, table: Record<string, number>): number {
  return table[nom] ?? POIDS_DEFAUT;
}

/**
 * Tirage pondéré SANS REMISE de `n` items (ou moins si le pool est plus
 * petit). Pur : `alea` injecté ∈ [0,1). Déterministe à aléa fixé — les tests
 * passent un générateur seedé.
 */
export function tirerSansRemisePondere<T>(
  pool: readonly T[],
  poids: (item: T) => number,
  n: number,
  alea: () => number,
): T[] {
  const restants = [...pool];
  const pris: T[] = [];
  while (pris.length < n && restants.length > 0) {
    const total = restants.reduce((s, it) => s + Math.max(0, poids(it)), 0);
    if (total <= 0) break;
    let curseur = alea() * total;
    let idx = restants.length - 1; // filet flottant : le dernier absorbe
    for (let i = 0; i < restants.length; i++) {
      curseur -= Math.max(0, poids(restants[i]));
      if (curseur < 0) {
        idx = i;
        break;
      }
    }
    pris.push(restants[idx]);
    restants.splice(idx, 1);
  }
  return pris;
}

/**
 * ⭐ [D52, s380] TRAITS RACIAUX DU GÉNÉRATEUR — poids MESURÉS des tirages.
 *
 * RÈGLE (arbitrage Fred, s380) : le 🎲 tire le trait racial GRATUIT du
 * personnage, exactement comme il tire déjà sa race, sa classe, ses sorts et
 * son artisanat (lettre de D42). Le dé décide d'un trait DÉFINITIF ; la fiche
 * du tirage l'ANNONCE avant que le joueur applique.
 *
 * LE POOL N'EST PAS ICI : le pool = `race_traits` du snapshot (la race, et le
 * SOUS-TYPE pour le Chiméride), moins « Inapte à la magie ». Ce fichier ne
 * porte que les POIDS. Un trait absent d'ici pèse `POIDS_DEFAUT` (1) : tout le
 * pool reste tirable, les goûts mesurés dominent, et un trait ajouté en base
 * plus tard devient tirable à la régénération du snapshot sans toucher ici.
 *
 * SOURCE DES CHIFFRES (jamais retoucher à la main — re-mesurer) : prod
 * `dezocltwpuhbvpxwcbdy`, 2026-08-06, `poids = nb de porteurs distincts du
 * trait en GRATUIT + 1`.
 *
 *   SELECT r.nom, t.nom, count(DISTINCT p.id) + 1 AS poids
 *   FROM personnages p
 *   JOIN races r ON r.id = p.race_id
 *   CROSS JOIN LATERAL jsonb_array_elements(
 *     COALESCE(p.traits_raciaux_choisis,'[]'::jsonb)) e
 *   JOIN traits_raciaux t ON t.id = (e->>'trait_id')::uuid
 *   WHERE (e->>'est_gratuit')::boolean = true AND p.est_finalise = true
 *   GROUP BY 1, 2;
 *
 * ⛔ DIVERGENCE DÉLIBÉRÉE AVEC D45, À NE PAS « CORRIGER ». Les poids sont
 * mesurés sur les personnages **FINALISÉS SEULEMENT** (`est_finalise = true`).
 * Les poids d'artisanat (D45, `contenu/artisanat.ts`) ne filtrent PAS la
 * finalisation ; la recommandation était d'aligner les deux sur « toutes les
 * fiches ». Fred a tranché FINALISÉES : le terrain, c'est ce qui arrive à la
 * table, pas ce qui traîne en brouillon. Ne pas ré-aligner sur D45.
 *
 * ⛔ « Inapte à la magie » (Demi-Orc) est EXCLU du tirage général — l'exclusion
 * vit dans le résolveur (`traitsTirables`, reconnaissance par le NOM
 * `TRAIT_INAPTE`, jamais par un id en dur). Motif : sorti pour un Demi-Orc
 * MAGE ou PRÊTRE, il détruirait une fiche magique et `valider_etape_3` la
 * refuserait (`trait_inapte_magie_incoherent`). D42 reste seule maîtresse de
 * ce trait : martial (guerrier/voleur) → posé d'office, gratuit, 0 XP.
 *
 * NOMS VERBATIM de la base (accents compris). Le test d'intégrité du lot
 * vérifie que CHAQUE clé ci-dessous existe au snapshot ET appartient au pool
 * de sa race — une faute de frappe = un poids orphelin silencieux, c'est le
 * test qui l'attrape.
 */

export { POIDS_DEFAUT, poidsDe, tirerSansRemisePondere } from "./artisanat";

/**
 * La CLÉ d'une table de poids : le nom de la race, suffixé du sous-type quand
 * la race en a un (le Chiméride, seul concerné — ses deux sous-types n'ont ni
 * le même pool ni les mêmes goûts).
 */
export function cleRaceTraits(raceNom: string, sousType?: string | null): string {
  return sousType ? `${raceNom} ${sousType}` : raceNom;
}

/**
 * Poids par race (clé = `cleRaceTraits`). Seuls les poids > 1 figurent ici :
 * tout le reste du pool pèse `POIDS_DEFAUT`. Les races absentes de cette table
 * (Fée, Haut-Elfe, Orc — non jouables) tirent donc uniformément.
 */
export const POIDS_TRAITS: Record<string, Record<string, number>> = {
  Humain: {
    Fortuné: 48,
    "Coup du destin": 9,
  },
  "Les Non-Races": {
    "Coup du destin": 2,
    Fortuné: 2,
  },
  "Demi-Elfe": {
    Fortuné: 4,
    "Résonance magique": 4,
    "Poigne ardente": 3,
    "Sang féerique": 3,
  },
  "Demi-Orc": {
    Charognard: 2,
    Mythomane: 2,
  },
  Drow: {
    "Créature des ténèbres": 2,
  },
  Gobelin: {
    Infusé: 4,
    Fortuné: 3,
    "Casse-pied": 2,
  },
  Myrvalk: {
    "Poussière des profondeurs": 2,
  },
  "Chiméride carnivore": {
    Charognard: 2,
    "Flair affûté": 2,
  },
  "Chiméride herbivore": {
    "Flair affûté": 2,
  },
};

/**
 * Poids du SOUS-TYPE Chiméride (mêmes source, date et règle que ci-dessus :
 * finalisés en prod, `porteurs + 1`). Le sous-type est tiré AVANT le trait,
 * parce que le pool de traits en dépend.
 *
 * Clé = la valeur littérale de `race_traits.sous_type` en base, celle-là même
 * que `valider_etape_2` attend en `p_sous_type_chimeride`.
 */
export const POIDS_SOUS_TYPE_CHIMERIDE: Record<string, number> = {
  carnivore: 3,
  herbivore: 2,
};

/**
 * Portage 1:1 de public.generer_formule_magique (SQL prod §3.5).
 *
 * Cinq dictionnaires COMPLETS (cercle, portée, zone, durée, niveau). Si UN mot
 * manque → retour `null` (miroir du `ELSE NULL` + court-circuit serveur). Sinon :
 *   cercle || ' ' || portee || ' ' || zone || ' ' || duree || ' ' || niveau
 *
 * Fonction PURE, zéro I/O, déterministe.
 */

const MOT_CERCLE: Record<string, string> = {
  "Air": "Xoth",
  "Altération": "Bedorm",
  "Charmes": "Veltel",
  "Combat": "Alagh",
  "Divination": "Shatur",
  "Eau": "Zaram",
  "Feu": "Zarr",
  "Illusion": "Guerben",
  "Magie Noire": "Notogh",
  "Magie Pure": "Lelphil",
  "Nécromancie": "Thork",
  "Protection": "Barak",
  "Terre": "Olor",
};

const MOT_PORTEE: Record<string, string> = {
  "Toucher": "Net",
  "5 Pieds": "Norak",
  "10 Pieds": "Naramir",
  "25 Pieds": "Namojakodi",
  "50 Pieds": "Nustamarnaroth",
  "À vue": "Nestramarnitakodal",
};

const MOT_ZONE: Record<string, string> = {
  "Personnelle": "Val",
  "1 Cible": "Temer",
  "2 Cibles": "Borak",
  "3 Cibles": "Biztalnen",
  "4 Cibles": "Bilnordanfat",
  "5 Cibles": "Burtalinokasen",
  "Rayon 3 pieds": "Tidartek",
  "Rayon 6 pieds": "Tazemked",
  "Rayon 10 pieds": "Tozarmanor",
  "Rayon 25 pieds": "Tulzakmineroth",
  "Rayon 50 pieds": "Tezelmaternothas",
};

const MOT_DUREE: Record<string, string> = {
  "Instantanée": "Mil",
  "1 Minute": "Meza",
  "5 Minutes": "Monorl",
  "10 Minutes": "Manorlas",
  "20 Minutes": "Mezoltir",
  "30 Minutes": "Motarnos",
  "40 Minutes": "Meriknaski",
  "50 Minutes": "Manorlzerik",
  "60 Minutes": "Meziltanitas",
};

const MOT_NIVEAU: Record<number, string> = {
  1: "Zet",
  2: "Zal",
  3: "Zul",
  4: "Zerat",
  5: "Zaroth",
  6: "Zomas",
  7: "Ziternak",
  8: "Zurminas",
  9: "Zotharnel",
  10: "Zapurnalen",
  11: "Zemaltoran",
  12: "Zokanastil",
  13: "Zaernamistren",
  14: "Zutramnektozat",
  15: "Zitalomatus",
  16: "Zomarnalutak",
  17: "Zuitikmaldorak",
  18: "Zuzmanaktalek",
  19: "Zutrantalakmunar",
  20: "Zomastirelnakosmal",
};

/**
 * @returns la formule magique complète, ou `null` si un composant est inconnu.
 */
export function genererFormuleMagique(
  cercle: string | null,
  zone: string,
  portee: string,
  duree: string,
  niveau: number
): string | null {
  const motCercle = cercle != null ? MOT_CERCLE[cercle] : undefined;
  const motPortee = MOT_PORTEE[portee];
  const motZone = MOT_ZONE[zone];
  const motDuree = MOT_DUREE[duree];
  const motNiveau = MOT_NIVEAU[niveau];

  if (
    motCercle == null ||
    motPortee == null ||
    motZone == null ||
    motDuree == null ||
    motNiveau == null
  ) {
    return null;
  }

  return `${motCercle} ${motPortee} ${motZone} ${motDuree} ${motNiveau}`;
}

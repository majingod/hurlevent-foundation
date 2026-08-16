/**
 * [s406] LA FORGE DES NOMS — LES DONNÉES ONT UNE SEULE MAISON, C'EST ICI.
 *
 * Source : maquette_s405_forge_noms.html (apport #30 de Fred, validé s405),
 * données extraites PAR SCRIPT, mot pour mot — seules les notes sont
 * décomposées en { titre, texte } (recomposition attestée à la génération).
 *
 * Répertoire ORIGINAL, style Royaumes oubliés mais ⛔ zéro nom tiré des
 * livres (PI Wizards). Sonorités ancrées au manuel de Destéa : Mérée,
 * Ombre-Terre, Rakhas, Peuple du Mythril, Animali-Fae, Magia-Bestia.
 *
 * Contrat de données (arbitrages Fred, s405) :
 * - Le groupe s'appelle « Sonorité du nom » : on décrit un NOM, pas une
 *   personne. Le 3ᵉ volet est « Autre » (⛔ jamais « Peu importe ») :
 *   aujourd'hui il tire dans les deux répertoires ; une clé "A" de vrai
 *   troisième registre reste possible dans PoolsParSonorite.
 * - Rien ne s'écrit en base : aucune colonne sexe/genre n'existe (mesuré
 *   s405), le choix vit dans l'écran au moment de forger.
 * - `label` est BYTE-EXACT avec `races.nom` des 8 races jouables — attesté
 *   contre la capture visiteur par forgeNoms.test.ts (bidirectionnel).
 */

export const ORDRE_RACES_FORGE = [
  "humain",
  "demiElfe",
  "drow",
  "gobelin",
  "demiOrc",
  "myrvalk",
  "chimeride",
  "nonRaces",
] as const;

export type RaceForgeId = (typeof ORDRE_RACES_FORGE)[number];

/** M/F = les deux répertoires ; "A" (« Autre ») = tirage dans les deux. */
export type SexeSonorite = "M" | "F" | "A";
export type SousTypeChimeride = "carnivore" | "herbivore";

export interface PoolPrenoms {
  /** Attaques (débuts de nom). */
  att: readonly string[];
  /** Syllabes médianes optionnelles (Drow, Chiméride) — allongent le nom. */
  mid?: readonly string[];
  /** Finales. */
  fin: readonly string[];
  /** Prénoms entiers, tirés tels quels (sans soudure). */
  entiers: readonly string[];
}

/** Une clé "A" (registre neutre dédié) pourra s'ajouter sans casser le type. */
export interface PoolsParSonorite {
  M: PoolPrenoms;
  F: PoolPrenoms;
}

export type FamillesRace =
  | { type: "compose"; a: readonly string[]; b: readonly string[] }
  | { type: "liste"; liste: readonly string[] }
  | {
      type: "sousType";
      carnivore: readonly string[];
      herbivore: readonly string[];
    };

export interface RaceNoms {
  /** BYTE-EXACT avec races.nom (base) — c'est la clé d'appariement. */
  label: string;
  /** Couleur de pastille et de plaque (maquette s405). */
  hue: string;
  note: { titre: string; texte: string };
  prenoms: PoolsParSonorite;
  familles: FamillesRace;
}

export const NOMS_PAR_RACE: Record<RaceForgeId, RaceNoms> = {
  "humain": {
    "label": "Humain",
    "hue": "#c9a15a",
    "note": {
      "titre": "Mérée l'ancienne",
      "texte": "latin d'église et vieux-françois. Les familles portent la terre : un mot de couleur ou de relief, un mot de pays."
    },
    "prenoms": {
      "M": {
        "att": [
          "Ald",
          "Aub",
          "Bast",
          "Bér",
          "Cass",
          "Corb",
          "Ferr",
          "Gaut",
          "Guil",
          "Land",
          "Mér",
          "Norb",
          "Orv",
          "Rém",
          "Thal",
          "Vald"
        ],
        "fin": [
          "ien",
          "éric",
          "imir",
          "ius",
          "elin",
          "emar",
          "oran",
          "ard",
          "éas",
          "in",
          "aume",
          "evin",
          "éon"
        ],
        "entiers": [
          "Anselme",
          "Barnabé",
          "Corentin",
          "Edmond",
          "Firmin",
          "Gaspard",
          "Honoré",
          "Onésime",
          "Tancrède",
          "Ambroise",
          "Léopold",
          "Urbain"
        ]
      },
      "F": {
        "att": [
          "Ad",
          "Am",
          "Bér",
          "Cél",
          "Clot",
          "Ed",
          "Élo",
          "Gis",
          "Isa",
          "Marg",
          "Or",
          "Ros",
          "Sér",
          "Viol",
          "Yol"
        ],
        "fin": [
          "eline",
          "iane",
          "ette",
          "onde",
          "ienne",
          "aude",
          "elle",
          "ine",
          "anne",
          "ilde",
          "ance",
          "oline"
        ],
        "entiers": [
          "Apolline",
          "Blandine",
          "Clémence",
          "Domitille",
          "Émérance",
          "Hermine",
          "Léocadie",
          "Pétronille",
          "Rosemonde",
          "Aldegonde",
          "Bathilde",
          "Colombe"
        ]
      }
    },
    "familles": {
      "type": "compose",
      "a": [
        "Beau",
        "Blanc",
        "Clair",
        "Fer",
        "Franc",
        "Grand",
        "Haut",
        "Mont",
        "Roc",
        "Val",
        "Vert",
        "Vieux",
        "Bas",
        "Fleur"
      ],
      "b": [
        "bois",
        "bourg",
        "champ",
        "court",
        "font",
        "fort",
        "lac",
        "mer",
        "mont",
        "pré",
        "rive",
        "chastel",
        "noue",
        "tertre"
      ]
    }
  },
  "demiElfe": {
    "label": "Demi-Elfe",
    "hue": "#8fb98a",
    "note": {
      "titre": "Filius-Fae, entre deux mondes",
      "texte": "la mélodie féérique posée sur des prénoms d'hommes. Les familles sont des images : la brume, la lune, une perle."
    },
    "prenoms": {
      "M": {
        "att": [
          "Aël",
          "Cor",
          "Ely",
          "Ess",
          "Fael",
          "Gal",
          "Ith",
          "Lior",
          "Mél",
          "Nor",
          "Syl",
          "Thar",
          "Var",
          "Ver"
        ],
        "fin": [
          "ian",
          "is",
          "ien",
          "andre",
          "iel",
          "os",
          "éo",
          "wyn",
          "arion",
          "evan",
          "ior",
          "aris"
        ],
        "entiers": [
          "Aubéron",
          "Célian",
          "Eryan",
          "Ilvain",
          "Naël",
          "Sylvio",
          "Théalis"
        ]
      },
      "F": {
        "att": [
          "Ael",
          "Ari",
          "Ili",
          "Lia",
          "Lys",
          "Mae",
          "Nae",
          "Noe",
          "Ondi",
          "Sae",
          "Syl",
          "Thal",
          "Vae",
          "Yse"
        ],
        "fin": [
          "anna",
          "ielle",
          "wenn",
          "ora",
          "ynn",
          "ia",
          "éa",
          "isse",
          "ariel",
          "ione"
        ],
        "entiers": [
          "Fianelle",
          "Lunaève",
          "Maëlys",
          "Nymphéa",
          "Solenn",
          "Ysoline"
        ]
      }
    },
    "familles": {
      "type": "liste",
      "liste": [
        "Brumefeuille",
        "Chantelune",
        "Claire-Aube",
        "Perle-du-Soir",
        "Ventargent",
        "Boisdoux",
        "Aubefroide",
        "Songefleur",
        "Luneclaire",
        "Miel-d'Orée",
        "Rossignolet",
        "Ombrelys",
        "Pluie-d'Étoiles",
        "Verte-Harpe"
      ]
    }
  },
  "drow": {
    "label": "Drow",
    "hue": "#9a7fd1",
    "note": {
      "titre": "L'Ombre-Terre",
      "texte": "de la soie et du venin : voyelles longues, doubles consonnes, une syllabe médiane qui s'étire, et des maisons qui claquent avec l'apostrophe."
    },
    "prenoms": {
      "M": {
        "att": [
          "Bhaer",
          "Drav",
          "Ghal",
          "Ilzr",
          "Krov",
          "Malz",
          "Rhyl",
          "Ssarn",
          "Tebr",
          "Vhel",
          "Vorn",
          "Xull",
          "Zek",
          "Quar"
        ],
        "mid": [
          "a",
          "in",
          "ol",
          "ur",
          "ez",
          "yr"
        ],
        "fin": [
          "ryn",
          "azz",
          "ar",
          "ikt",
          "ozz",
          "yrr",
          "endar",
          "ax",
          "eth",
          "il",
          "orn",
          "ust"
        ],
        "entiers": [
          "Zsavrak",
          "Dhulvrezz",
          "Kryzzalt"
        ]
      },
      "F": {
        "att": [
          "Bael",
          "Chal",
          "Drys",
          "Ilv",
          "Myr",
          "Ness",
          "Nhil",
          "Phae",
          "Ssyl",
          "Ulv",
          "Vess",
          "Xil",
          "Zar",
          "Qil"
        ],
        "mid": [
          "a",
          "ir",
          "es",
          "ya",
          "ol",
          "une"
        ],
        "fin": [
          "ynne",
          "iira",
          "ryl",
          "ith",
          "ara",
          "yss",
          "inril",
          "aeye",
          "ithra",
          "esse",
          "aya",
          "orne"
        ],
        "entiers": [
          "Vyxaless",
          "Zhorinne",
          "Maelthryss"
        ]
      }
    },
    "familles": {
      "type": "liste",
      "liste": [
        "Zzavryn",
        "Vel'Kryss",
        "Mal'Thara",
        "Noc'tyrr",
        "Dhraëzz",
        "Ilv'ryndé",
        "Ssol'venn",
        "Xar'quill",
        "Quav'ress",
        "Zhaun'dyl",
        "Ombre-Sœur",
        "Vhel'ashk"
      ]
    }
  },
  "gobelin": {
    "label": "Gobelin",
    "hue": "#7fb85f",
    "note": {
      "titre": "Rakhas la toxique",
      "texte": "ça claque et ça cliquette, et les clans se moquent du malheur. La table a déjà ses clans (Tamalou, Neige, Cailloux) : ceux-ci s'y ajoutent."
    },
    "prenoms": {
      "M": {
        "att": [
          "Kri",
          "Za",
          "Gno",
          "Pi",
          "Ska",
          "Bri",
          "Tar",
          "Flo",
          "Zi",
          "Mo",
          "Gre",
          "Bou"
        ],
        "fin": [
          "k",
          "bo",
          "cot",
          "ko",
          "clin",
          "quet",
          "rk",
          "zzo",
          "pin",
          "lon"
        ],
        "entiers": [
          "Krik",
          "Zibo",
          "Gnok",
          "Piko",
          "Skarl",
          "Bricou",
          "Tarpin",
          "Floc",
          "Mordicus",
          "Boulon",
          "Silex",
          "Grelot"
        ]
      },
      "F": {
        "att": [
          "Zi",
          "Pra",
          "Mi",
          "Fio",
          "Ca",
          "Gri",
          "Lou",
          "Pé",
          "Rou",
          "Ber"
        ],
        "fin": [
          "zelle",
          "line",
          "quette",
          "role",
          "chette",
          "goune",
          "lotte",
          "nette"
        ],
        "entiers": [
          "Griotte",
          "Pistache",
          "Mirabelle",
          "Zaza",
          "Luciole",
          "Fiole",
          "Braise",
          "Kumquat",
          "Papoue",
          "Vrille"
        ]
      }
    },
    "familles": {
      "type": "liste",
      "liste": [
        "Ferraille",
        "Soupape",
        "Crachefeu",
        "Troispattes",
        "Casserole",
        "Boitaclou",
        "Fondsdepoche",
        "Sifflet",
        "Gratteroche",
        "Mangecendre",
        "Vieuxclou",
        "Bouillabruit"
      ]
    }
  },
  "demiOrc": {
    "label": "Demi-Orc",
    "hue": "#c96a4e",
    "note": {
      "titre": "Deme-Droemon, deux sangs",
      "texte": "un tambour orc ou un prénom d'homme, au choix du tirage. L'épithète dit ce que le monde a retenu de toi."
    },
    "prenoms": {
      "M": {
        "att": [
          "Brog",
          "Ghaz",
          "Muld",
          "Thrag",
          "Vrok",
          "Ulg",
          "Skar",
          "Drogh",
          "Karg",
          "Zug",
          "Grosh",
          "Hurk"
        ],
        "fin": [
          "an",
          "ar",
          "im",
          "ok",
          "und",
          "ash",
          "or",
          "uk",
          "ag",
          "ur"
        ],
        "entiers": [
          "Aldric",
          "Bastian",
          "Roderic",
          "Simon"
        ]
      },
      "F": {
        "att": [
          "Brag",
          "Ghir",
          "Shar",
          "Velk",
          "Our",
          "Dren",
          "Kazh",
          "Morg",
          "Urz",
          "Vash"
        ],
        "fin": [
          "a",
          "una",
          "ika",
          "ora",
          "ess",
          "ild",
          "esha",
          "ola"
        ],
        "entiers": [
          "Marga",
          "Ursanne",
          "Rosalind"
        ]
      }
    },
    "familles": {
      "type": "liste",
      "liste": [
        "Poing-de-Fer",
        "Dent-Brisée",
        "Deux-Rivières",
        "Sang-Calme",
        "Roc-Debout",
        "Longue-Marche",
        "Cœur-de-Braise",
        "Marche-Devant",
        "Front-Haut",
        "Griffe-Tendre",
        "Œil-Franc",
        "Porte-Fardeau"
      ]
    }
  },
  "myrvalk": {
    "label": "Myrvalk",
    "hue": "#6fa8c9",
    "note": {
      "titre": "Le Peuple du Mythril",
      "texte": "nains et géants d'une même lignée. Des gemmes pour prénoms, et des familles qui sont des serments de forge."
    },
    "prenoms": {
      "M": {
        "att": [
          "Bal",
          "Dol",
          "Far",
          "Grum",
          "Bram",
          "Rund",
          "Vost",
          "Olg",
          "Sig",
          "Kel",
          "Ost",
          "Thrum"
        ],
        "fin": [
          "drim",
          "gar",
          "nik",
          "bol",
          "mir",
          "dak",
          "urn",
          "rik",
          "vald",
          "grin"
        ],
        "entiers": [
          "Torvald",
          "Kelbrand",
          "Ostrim"
        ]
      },
      "F": {
        "att": [
          "Ambr",
          "Sard",
          "Perl",
          "Émer",
          "Béryl",
          "Corn",
          "Jasp",
          "Gren",
          "Agath",
          "Dolom",
          "Mic"
        ],
        "fin": [
          "ine",
          "elle",
          "ade",
          "ise",
          "onde",
          "a",
          "ette",
          "ia"
        ],
        "entiers": [
          "Agathe",
          "Ambre",
          "Sardoine",
          "Perline",
          "Émerine",
          "Cornaline"
        ]
      }
    },
    "familles": {
      "type": "compose",
      "a": [
        "Veine",
        "Marteau",
        "Barbe",
        "Cœur",
        "Poing",
        "Bouclier",
        "Enclume",
        "Chant",
        "Souffle",
        "Serment"
      ],
      "b": [
        "-d'Argent",
        "-de-Fer",
        "-de-Granit",
        "-d'Or",
        "-de-Mythril",
        "-de-Braise",
        "-de-Sel",
        "-Profond",
        "-d'Étain",
        "-de-Houille"
      ]
    }
  },
  "chimeride": {
    "label": "Chiméride",
    "hue": "#d18fb0",
    "note": {
      "titre": "Animali-Fae",
      "texte": "un prénom qui chante, une syllabe médiane qui l'allonge, un totem qui griffe ou qui broute. Le totem suit le sous-type."
    },
    "prenoms": {
      "M": {
        "att": [
          "Fen",
          "Kaz",
          "Rho",
          "Sarr",
          "Taz",
          "Vay",
          "Zeph",
          "Ish",
          "Koa",
          "Nym",
          "Oke",
          "Rai",
          "Sun",
          "Yor"
        ],
        "mid": [
          "ka",
          "li",
          "ma",
          "ra",
          "sa",
          "za"
        ],
        "fin": [
          "ek",
          "ir",
          "an",
          "os",
          "aël",
          "um",
          "éo",
          "ash",
          "ao",
          "ei"
        ],
        "entiers": [
          "Fenek",
          "Kaziel",
          "Rhoan"
        ]
      },
      "F": {
        "att": [
          "Ama",
          "Caly",
          "Ishé",
          "Kia",
          "Lya",
          "Maë",
          "Naya",
          "Nei",
          "Ona",
          "Ory",
          "Séla",
          "Véa",
          "Zaï",
          "Thessa"
        ],
        "mid": [
          "na",
          "li",
          "ra",
          "sha",
          "va",
          "mi"
        ],
        "fin": [
          "ëlle",
          "ne",
          "ra",
          "ïs",
          "lia",
          "wa",
          "ya",
          "ssa",
          "mée",
          "oa"
        ],
        "entiers": [
          "Calyssia",
          "Nayara",
          "Sélwane"
        ]
      }
    },
    "familles": {
      "type": "sousType",
      "carnivore": [
        "Croc-Rouge",
        "Œil-de-Nuit",
        "Griffe-Sûre",
        "Course-Longue",
        "Souffle-de-Chasse",
        "Queue-Vive",
        "Dent-d'Hiver",
        "Pas-de-Velours"
      ],
      "herbivore": [
        "Ramure-Claire",
        "Pas-Tranquille",
        "Cœur-de-Prairie",
        "Corne-Patiente",
        "Plume-Grise",
        "Rosée-du-Matin",
        "Sabot-Léger",
        "Feuille-Mâchée"
      ]
    }
  },
  "nonRaces": {
    "label": "Les Non-Races",
    "hue": "#b0aec9",
    "note": {
      "titre": "Magia-Bestia",
      "texte": "les échappés du monde secret. Toutes les sonorités du dehors : le vieux parler des landes, et des noms qui sont des routes."
    },
    "prenoms": {
      "M": {
        "att": [
          "Bran",
          "Cael",
          "Sul",
          "Morc",
          "Talv",
          "Oss",
          "Ru",
          "Gwyl",
          "Aodh",
          "Ker"
        ],
        "fin": [
          "an",
          "arc",
          "ven",
          "ric",
          "ien",
          "ael",
          "or",
          "wyn"
        ],
        "entiers": [
          "Bran",
          "Cael",
          "Sulien",
          "Morcant",
          "Talvane",
          "Ossric",
          "Ruarc",
          "Gwylan"
        ]
      },
      "F": {
        "att": [
          "Sao",
          "Brig",
          "Ys",
          "Nov",
          "Eil",
          "Morw",
          "Aour",
          "Ken",
          "Gwen",
          "Der"
        ],
        "fin": [
          "line",
          "enn",
          "ara",
          "ith",
          "may",
          "ola",
          "aine",
          "eth"
        ],
        "entiers": [
          "Saoline",
          "Maëve",
          "Brighel",
          "Ysmay",
          "Novenn",
          "Ciara",
          "Eilith",
          "Morwenna"
        ]
      }
    },
    "familles": {
      "type": "liste",
      "liste": [
        "Vesperin",
        "Croisechemin",
        "Neuf-Lunes",
        "Sans-Rivage",
        "Loinvenu",
        "Brumenoire",
        "Fil-d'Astre",
        "Porte-Secret",
        "Marche-Brume",
        "Selle-Vide",
        "Dorloin",
        "Vieille-Route"
      ]
    }
  }
};

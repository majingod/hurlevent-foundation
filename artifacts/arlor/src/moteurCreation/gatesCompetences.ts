/**
 * Portage 1:1 de la fonction SQL public.peut_acheter_competence
 * Décide si un personnage peut acheter une compétence à un niveau donné
 *
 * Source de vérité : SQL en ANNEXE du document P1-a
 * Fonction PURE, zéro I/O, déterministe sur snapshot + contexte local
 */

import type {
  ContextePersonnage,
  DemandeAchatCompetence,
  VerdictAchat,
} from "./types";
import {
  getCompetence,
  getLangueNom,
  getReligionNom,
  getSnapshot,
} from "./snapshot";
import type {
  Competence,
} from "./snapshot";

export function peutAcheterCompetence(
  ctx: ContextePersonnage,
  demande: DemandeAchatCompetence
): VerdictAchat {
  // 2. gate_edition_personnage et « Personnage introuvable » — OMIS
  // Raison : pas de gel pour un perso local (créateur offline)
  // L'appelant valide l'existence du contexte avant appel.

  const competence = getCompetence(demande.competenceId);

  // 1. INAPTE À LA MAGIE × compétence à PS — miroir de l'ENVELOPPE serveur
  //    `peut_acheter_competence` (s369, Gotcha C80). Portage 1:1, y compris
  //    l'ORDRE : la règle passe AVANT le noyau, et le SELECT de l'enveloppe
  //    ne filtre PAS sur `est_actif` — une compétence à PS inactive est donc
  //    refusée avec CE motif, pas avec « Compétence inactive ».
  //    ⚠️ La liste des compétences à PS n'est PAS réécrite ici : elle vit dans
  //    `competences.exige_ps` (14 lignes / 10 noms), une seule maison pour le
  //    serveur et pour le miroir. Ne jamais la dériver de `categorie` :
  //    Alchimie, Décryptage, Premiers Soins et Réveil Expéditif sont
  //    mage/prêtre et sans PS.
  if (ctx.inapteMagie && competence?.exige_ps === true) {
    return {
      peutAcheter: false,
      raison:
        "Inapte à la magie : " +
        (competence.nom ?? "") +
        " repose sur les points de spiritualité, que ce personnage ne pourra jamais posséder.",
    };
  }

  // 3. Compétence introuvable/inactive (noyau)
  if (!competence) {
    return {
      peutAcheter: false,
      raison: "Compétence introuvable",
    };
  }
  if (!competence.est_actif) {
    return {
      peutAcheter: false,
      raison: "Compétence inactive",
    };
  }

  // 4. classes_requises
  if (
    competence.classes_requises &&
    competence.classes_requises.length > 0
  ) {
    const classeNormalisee = normaliserClasse(ctx.classeNom);
    if (
      !classeNormalisee ||
      !competence.classes_requises.includes(classeNormalisee)
    ) {
      const classes = competence.classes_requises.join(" ou ");
      return {
        peutAcheter: false,
        raison: `Classe requise : ${classes}`,
      };
    }
  }

  // 5. Niveau max autorisé
  const estPropreClasse = estPropreClasseCompetence(
    competence,
    ctx.classeNom
  );
  const niveauMaxAutorise =
    competence.est_general || estPropreClasse ? 3 : 2;

  if (demande.niveauDesire > niveauMaxAutorise) {
    return {
      peutAcheter: false,
      raison: `Niveau ${demande.niveauDesire} inaccessible hors de votre classe (maximum autorisé : ${niveauMaxAutorise})`,
    };
  }

  // 5b. Niveau invalide (check absolu)
  if (demande.niveauDesire < 1 || demande.niveauDesire > 3) {
    return {
      peutAcheter: false,
      raison: "Niveau invalide (1 à 3 attendu)",
    };
  }

  // 6. verrouillage_croise
  if (competence.verrouillage_croise) {
    // Vérifie si une compétence avec le MÊME nom mais AUTRE id est déjà acquise
    const snapshot = getSnapshot();
    const competencesAcquises = ctx.competencesAcquises;
    const autreConcurrence = competencesAcquises.some((ac) => {
      const competencesData = snapshot.tables.competences as Competence[];
      const autreComp = competencesData.find(
        (c) => c.id === ac.competenceId
      );
      return (
        autreComp &&
        autreComp.nom === competence.nom &&
        autreComp.id !== competence.id
      );
    });
    if (autreConcurrence) {
      return {
        peutAcheter: false,
        raison: `Vous avez déjà acquis "${competence.nom}" dans l'autre catégorie`,
      };
    }
  }

  // 7. Récupérer le niveau actuel pour cette compétence
  const niveauMaxActuel = Math.max(
    0,
    ...ctx.competencesAcquises
      .filter((ac) => ac.competenceId === demande.competenceId)
      .map((ac) => ac.niveauAcquis)
  );

  // 8. Vérifications type_achat
  switch (competence.type_achat) {
    case "simple": {
      if (demande.niveauDesire !== niveauMaxActuel + 1) {
        return {
          peutAcheter: false,
          raison: `Vous devez d'abord acquérir le niveau ${niveauMaxActuel + 1}`,
        };
      }
      break;
    }

    case "unique_avec_choix": {
      if (niveauMaxActuel >= 1) {
        // Déjà acquis niveau 1
        const acquisExistant = ctx.competencesAcquises.find(
          (ac) => ac.competenceId === demande.competenceId
        );
        let nomLisible: string | null = null;
        if (acquisExistant?.choixAchat) {
          if (competence.type_choix === "religion") {
            nomLisible =
              getReligionNom(acquisExistant.choixAchat) ||
              acquisExistant.choixAchat;
          } else if (
            competence.type_choix === "langue" ||
            competence.type_choix === "langue_ancienne"
          ) {
            nomLisible =
              getLangueNom(acquisExistant.choixAchat) ||
              acquisExistant.choixAchat;
          }
        }
        if (nomLisible) {
          return {
            peutAcheter: false,
            raison: `Déjà acquis : ${nomLisible}`,
          };
        } else {
          return {
            peutAcheter: false,
            raison: "Déjà acquis",
          };
        }
      }
      if (demande.niveauDesire !== 1) {
        return {
          peutAcheter: false,
          raison: "Seul le niveau 1 est achetable pour cette compétence",
        };
      }
      if (!demande.choixAchat || demande.choixAchat.trim() === "") {
        return {
          peutAcheter: false,
          raison: "Un choix est obligatoire",
        };
      }
      break;
    }

    case "multiple_avec_choix_par_niveau": {
      // Cas spécial : Connaissances Criminelles niv 1 sans choix
      if (competence.nom === "Connaissances Criminelles" && demande.niveauDesire === 1) {
        if (niveauMaxActuel >= 1) {
          return {
            peutAcheter: false,
            raison: "Déjà acquis au niveau 1",
          };
        }
      } else {
        // Choix obligatoire pour autres niveaux ou autres compétences
        if (!demande.choixAchat || demande.choixAchat.trim() === "") {
          return {
            peutAcheter: false,
            raison: "Un choix est obligatoire",
          };
        }
        // Vérifier l'unicité (niveau, choix)
        const deja_choisi = ctx.competencesAcquises.some(
          (ac) =>
            ac.competenceId === demande.competenceId &&
            ac.niveauAcquis === demande.niveauDesire &&
            ac.choixAchat === demande.choixAchat
        );
        if (deja_choisi) {
          return {
            peutAcheter: false,
            raison: `"${demande.choixAchat}" est déjà acquis au niveau ${demande.niveauDesire}`,
          };
        }

        // Cas spécial : Connaissances Criminelles niv 2
        if (
          competence.nom === "Connaissances Criminelles" &&
          demande.niveauDesire === 2
        ) {
          if (niveauMaxActuel < 1) {
            return {
              peutAcheter: false,
              raison:
                "Vous devez d'abord acquérir Connaissances Criminelles niveau 1",
            };
          }
        } else if (demande.niveauDesire >= 2) {
          // Pour autres compétences, niv n exige niv n-1 du MÊME choix
          const aLevelPrecedent = ctx.competencesAcquises.some(
            (ac) =>
              ac.competenceId === demande.competenceId &&
              ac.niveauAcquis === demande.niveauDesire - 1 &&
              ac.choixAchat === demande.choixAchat
          );
          if (!aLevelPrecedent) {
            return {
              peutAcheter: false,
              raison: `Vous devez d'abord acquérir "${competence.nom}" niveau ${demande.niveauDesire - 1} pour "${demande.choixAchat}"`,
            };
          }
        }
      }
      break;
    }

    case "multiple_choix_distinct": {
      if (demande.niveauDesire !== 1) {
        return {
          peutAcheter: false,
          raison: "Seul le niveau 1 est achetable pour cette compétence",
        };
      }
      if (!demande.choixAchat || demande.choixAchat.trim() === "") {
        return {
          peutAcheter: false,
          raison: "Un choix est obligatoire",
        };
      }
      const deja_choisi = ctx.competencesAcquises.some(
        (ac) =>
          ac.competenceId === demande.competenceId &&
          ac.choixAchat === demande.choixAchat
      );
      if (deja_choisi) {
        let nomLisible = demande.choixAchat;
        if (
          competence.type_choix === "langue" ||
          competence.type_choix === "langue_ancienne"
        ) {
          nomLisible =
            getLangueNom(demande.choixAchat) || demande.choixAchat;
        } else if (competence.type_choix === "religion") {
          nomLisible =
            getReligionNom(demande.choixAchat) || demande.choixAchat;
        }
        return {
          peutAcheter: false,
          raison: `Vous avez déjà acquis "${nomLisible}"`,
        };
      }
      break;
    }

    case "multiple_sans_choix": {
      if (demande.niveauDesire !== 1) {
        return {
          peutAcheter: false,
          raison: "Seul le niveau 1 est achetable pour cette compétence",
        };
      }

      // Cas spécial : Développement Spirituel
      if (competence.nom === "Développement Spirituel") {
        if (ctx.psMax >= 20) {
          return {
            peutAcheter: false,
            raison:
              "Maximum de 20 PS atteint — achetez Développement Spirituel Supérieur",
          };
        }
      }
      // Cas spécial : Développement Spirituel Supérieur
      else if (competence.nom === "Développement Spirituel Supérieur") {
        if (ctx.psMax < 20) {
          return {
            peutAcheter: false,
            raison:
              "Nécessite 20 PS (achetez d'abord Développement Spirituel)",
          };
        }
        if (ctx.psMax >= 30) {
          return {
            peutAcheter: false,
            raison: "Maximum absolu atteint (30 PS)",
          };
        }
      }
      break;
    }

    default: {
      return {
        peutAcheter: false,
        raison: `Type d'achat inconnu : ${competence.type_achat}`,
      };
    }
  }

  // 9. Dépeçage — prérequis spéciaux
  if (competence.nom === "Dépeçage" && demande.niveauDesire === 1) {
    // Prérequis : Connaissances des Créatures niv 1 ET Premiers Soins
    const hasConnaissancesCreatures1 = ctx.competencesAcquises.some(
      (ac) => ac.competenceNom === "Connaissances des Créatures" && ac.niveauAcquis >= 1
    );
    const hasPremiersSoins = ctx.competencesAcquises.some(
      (ac) => ac.competenceNom === "Premiers Soins"
    );
    if (!hasConnaissancesCreatures1 || !hasPremiersSoins) {
      return {
        peutAcheter: false,
        raison:
          "Prérequis : Connaissances des Créatures niveau 1 ET Premiers Soins",
      };
    }

    // Si choix fourni, vérifier CdC niv >= 1 avec le MÊME choix
    if (demande.choixAchat) {
      const hasConnaissancesCreaturesChoix = ctx.competencesAcquises.some(
        (ac) =>
          ac.competenceNom === "Connaissances des Créatures" &&
          ac.niveauAcquis >= 1 &&
          ac.choixAchat === demande.choixAchat
      );
      if (!hasConnaissancesCreaturesChoix) {
        return {
          peutAcheter: false,
          raison: `Vous devez d'abord avoir Connaissances des Créatures pour la catégorie "${demande.choixAchat}"`,
        };
      }
    }
  }

  if (competence.nom === "Dépeçage" && demande.niveauDesire === 2) {
    // Prérequis : Connaissances des Créatures niv 2
    const hasConnaissancesCreatures2 = ctx.competencesAcquises.some(
      (ac) => ac.competenceNom === "Connaissances des Créatures" && ac.niveauAcquis >= 2
    );
    if (!hasConnaissancesCreatures2) {
      return {
        peutAcheter: false,
        raison: "Prérequis : Connaissances des Créatures niveau 2",
      };
    }

    // Si choix fourni, vérifier CdC niv >= 2 avec le MÊME choix
    if (demande.choixAchat) {
      const hasConnaissancesCreaturesChoix = ctx.competencesAcquises.some(
        (ac) =>
          ac.competenceNom === "Connaissances des Créatures" &&
          ac.niveauAcquis >= 2 &&
          ac.choixAchat === demande.choixAchat
      );
      if (!hasConnaissancesCreaturesChoix) {
        return {
          peutAcheter: false,
          raison: `Vous devez d'abord avoir Connaissances des Créatures niveau 2 pour "${demande.choixAchat}"`,
        };
      }
    }
  }

  // 10. prerequis_competences (jsonb)
  // Forme réelle en prod : OBJET indexé par niveau acheté
  //   { "1": [ { competence_nom, niveau_min } ], "2": [ … ], … }
  // (miroir de `prerequis_competences -> p_niveau_desire::text` côté SQL).
  // On tolère aussi une forme plate (tableau) par prudence.
  if (competence.prerequis_competences) {
    type Prereq = { competence_nom: string; niveau_min: number };
    const raw = competence.prerequis_competences as unknown;
    let prereqForLevel: Prereq[] = [];
    const estPrereq = (p: unknown): p is Prereq =>
      p != null && typeof p === "object";

    if (Array.isArray(raw)) {
      prereqForLevel = raw.filter(estPrereq);
    } else if (raw && typeof raw === "object") {
      const forLevel = (raw as Record<string, unknown>)[
        String(demande.niveauDesire)
      ];
      if (Array.isArray(forLevel)) {
        prereqForLevel = forLevel.filter(estPrereq);
      }
    }

    if (prereqForLevel && prereqForLevel.length > 0) {
      const manquants: string[] = [];
      for (const prereq of prereqForLevel) {
        const niveauActuelPre = Math.max(
          0,
          ...ctx.competencesAcquises
            .filter((ac) => ac.competenceNom === prereq.competence_nom)
            .map((ac) => ac.niveauAcquis)
        );
        if (niveauActuelPre < prereq.niveau_min) {
          manquants.push(
            `${prereq.competence_nom} niveau ${prereq.niveau_min}`
          );
        }
      }
      if (manquants.length > 0) {
        return {
          peutAcheter: false,
          raison: `Prérequis manquant(s) : ${manquants.join(", ")}`,
        };
      }
    }
  }

  // 11. Coût XP
  const niveauxArray = competence.niveaux as Array<{
    niveau: number;
    cout_xp: number;
  }> | null;
  let coutXp = 0;
  if (niveauxArray) {
    const niveauDef = niveauxArray.find(
      (n) => n && n.niveau === demande.niveauDesire
    );
    if (niveauDef) {
      coutXp = niveauDef.cout_xp;
    } else {
      return {
        peutAcheter: false,
        raison: `Niveau ${demande.niveauDesire} non défini pour cette compétence`,
      };
    }
  } else {
    return {
      peutAcheter: false,
      raison: `Niveau ${demande.niveauDesire} non défini pour cette compétence`,
    };
  }

  if (ctx.xpDispo < coutXp) {
    return {
      peutAcheter: false,
      raison: `XP insuffisant. Requis : ${coutXp} | Disponible : ${ctx.xpDispo}`,
    };
  }

  // 12. necessiteMaitre
  const necessiteMaitre =
    (competence.est_general && demande.niveauDesire === 3) ||
    (estPropreClasse && demande.niveauDesire === 3) ||
    (!competence.est_general && !estPropreClasse && demande.niveauDesire === 2);

  // 13. Verdict OK — miroir exact du jsonb serveur
  return {
    peutAcheter: true,
    raison: "OK",
    coutXp,
    niveauActuel: niveauMaxActuel,
    niveauDesire: demande.niveauDesire,
    necessiteMaitre,
    typeAchat: competence.type_achat,
    typeChoix: competence.type_choix,
    verrouillageCroise: competence.verrouillage_croise,
  };
}

/**
 * Normaliser le nom de classe (Guerrier → guerrier, etc.)
 */
function normaliserClasse(
  classeNom: string | null
): string | null {
  if (!classeNom) return null;
  switch (classeNom) {
    case "Guerrier":
      return "guerrier";
    case "Voleur":
      return "voleur";
    case "Mage":
      return "mage";
    case "Prêtre":
      return "pretre";
    default:
      return null;
  }
}

/**
 * Détermine si une compétence est de la propre classe du personnage
 */
function estPropreClasseCompetence(
  competence: Competence,
  classeNom: string | null
): boolean {
  if (!classeNom) return false;
  return (
    (competence.categorie === "guerrier" && classeNom === "Guerrier") ||
    (competence.categorie === "voleur" && classeNom === "Voleur") ||
    (competence.categorie === "mage" && classeNom === "Mage") ||
    (competence.categorie === "pretre" && classeNom === "Prêtre")
  );
}

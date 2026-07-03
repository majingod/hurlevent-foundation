/**
 * Gratuités de classe — portage de l'annexe E
 * (public.attribuer_competences_gratuites_classe), version état-local offline.
 *
 * Source : `classes.competences_gratuites` jsonb `[{competence_id, niveau}]`
 * (du snapshot). Fonction PURE sur (snapshot, état, choix).
 */

import type { SnapshotVisiteur, Classe, Competence } from "./snapshot";
import type { EtatCreationVisiteur, CompetenceAcquiseLocale } from "./deriveurs";

export interface ErreurGratuite {
  code: "classe_manquante" | "competence_introuvable" | "choix_manquant";
  message: string;
}

export interface ResultatGratuites {
  etat: EtatCreationVisiteur;
  erreurs: ErreurGratuite[];
}

interface GratuiteDef {
  competence_id: string;
  niveau: number;
}

function getClasse(snapshot: SnapshotVisiteur, classeId: string | null): Classe | undefined {
  if (!classeId) return undefined;
  return snapshot.tables.classes.find((c) => c.id === classeId);
}

function getCompetenceById(
  snapshot: SnapshotVisiteur,
  id: string
): Competence | undefined {
  return snapshot.tables.competences.find((c) => c.id === id);
}

/**
 * Attribue les compétences gratuites de la classe à l'état local.
 *
 * @param choixParCompetence  map `competence_id → choix_achat` pour les
 *   gratuités à `type_choix` non-null (ex. religion, langue_ancienne).
 *
 * Sémantique portée de l'annexe E :
 *  1. Classe manquante → erreur `classe_manquante` « Le personnage n'a pas de classe. »
 *  2. Purge des gratuités obsolètes : IMPLICITE ici. On recompute « from
 *     scratch » en repartant des seuls achats PAYANTS (xp_depense > 0) ; toute
 *     gratuité précédente (xp_depense === 0) est donc écartée puis reconstruite
 *     pour la classe courante — un changement de classe local purge de fait les
 *     anciennes gratuités, comme le fait le DELETE serveur.
 *  3. Par gratuité :
 *     - compétence introuvable → erreur `competence_introuvable` (continue) ;
 *     - `type_choix` non-null sans choix → fallback religion = `etat.religionId`
 *       si présent, sinon erreur `choix_manquant`
 *       (`Un choix de type "%s" est obligatoire pour %s`, continue) ;
 *     - `type_choix === 'religion'` avec choix → l'état adopte la religion
 *       (`religionId`, `estCroyant = true`) ;
 *     - insertion idempotente `{ xp_depense: 0, appris_via_maitre: false,
 *       statut_maitre: 'non_requis', choix_achat }`.
 */
export function appliquerGratuites(
  snapshot: SnapshotVisiteur,
  etatInitial: EtatCreationVisiteur,
  choixParCompetence: Record<string, string> = {}
): ResultatGratuites {
  const erreurs: ErreurGratuite[] = [];

  const classe = getClasse(snapshot, etatInitial.classeId);
  if (!classe) {
    return {
      etat: etatInitial,
      erreurs: [
        { code: "classe_manquante", message: "Le personnage n'a pas de classe." },
      ],
    };
  }

  // Recompute « from scratch » : on ne garde que les achats payants, ce qui
  // purge implicitement les gratuités obsolètes (xp_depense === 0).
  let etat: EtatCreationVisiteur = {
    ...etatInitial,
    competencesAcquises: etatInitial.competencesAcquises.filter(
      (c) => c.xpDepense > 0
    ),
  };

  const gratuites = (classe.competences_gratuites as GratuiteDef[] | null) ?? [];

  for (const g of gratuites) {
    const comp = getCompetenceById(snapshot, g.competence_id);
    if (!comp) {
      erreurs.push({
        code: "competence_introuvable",
        message: `Compétence gratuite introuvable : ${g.competence_id}`,
      });
      continue;
    }

    let choix: string | null =
      choixParCompetence[g.competence_id] != null
        ? choixParCompetence[g.competence_id]
        : null;

    if (comp.type_choix != null && (choix == null || choix.trim() === "")) {
      // fallback religion (annexe E) : la religion de l'état sert de choix.
      if (etat.religionId) {
        choix = etat.religionId;
      } else {
        erreurs.push({
          code: "choix_manquant",
          message: `Un choix de type "${comp.type_choix}" est obligatoire pour ${comp.nom}`,
        });
        continue;
      }
    }

    // type_choix religion + choix → l'état adopte la religion.
    if (comp.type_choix === "religion" && choix) {
      etat = { ...etat, religionId: choix, estCroyant: true };
    }

    // Insertion idempotente : même (competenceId, niveau, choix) → pas de doublon.
    const item: CompetenceAcquiseLocale = {
      competenceId: g.competence_id,
      niveauAcquis: g.niveau,
      choixAchat: choix ?? null,
      xpDepense: 0,
      apprisViaMaitre: false,
      statutMaitre: "non_requis",
    };
    const dejaPresent = etat.competencesAcquises.some(
      (c) =>
        c.competenceId === item.competenceId &&
        c.niveauAcquis === item.niveauAcquis &&
        c.choixAchat === item.choixAchat
    );
    if (!dejaPresent) {
      etat = {
        ...etat,
        competencesAcquises: [...etat.competencesAcquises, item],
      };
    }
  }

  return { etat, erreurs };
}

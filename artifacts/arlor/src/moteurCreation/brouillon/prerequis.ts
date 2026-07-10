/**
 * Prérequis de compétences — SOURCE UNIQUE partagée (lots désachats + changement
 * de classe).
 *
 * `calculerPrerequis` porte fidèlement `verifier_prerequis_competences` (version
 * pastille-classe, migration 20260706195514) : pour chaque compétence du snapshot,
 * son `niveau_max_achetable` (premier niveau en échec − 1), ses pastilles et ses
 * raisons par niveau. La classe affiche une pastille (vert/rouge) SANS entrer dans
 * `v_manquants` ni réduire `niveau_max_achetable`.
 *
 * `cascadeParPrerequis` porte la BOUCLE serveur `WHILE changed` de la phase 1d de
 * `changer_classe_personnage` — également réutilisée par `desacheter_competence`
 * (A6) : tant qu'une compétence acquise dépasse son `niveau_max_achetable`
 * recalculé, on retire les niveaux excédentaires, jusqu'à stabilité. UNE seule
 * implémentation — le désachat ET le changement de classe la consomment.
 *
 * TS pur : aucun import React, aucun accès `localStorage`/`window`.
 */

import { getSnapshot } from "../snapshot";
import type { EtatDeriveVisiteur } from "./deriver";
import type { BrouillonVisiteur, BrouillonCompetence } from "./types";

type Deriver = (b: BrouillonVisiteur) => EtatDeriveVisiteur;

/**
 * `verifier_prerequis_competences` — version pastille-classe (migration
 * 20260706195514). La classe affiche une pastille (vert/rouge) SANS entrer dans
 * `v_manquants` ni réduire `niveau_max_achetable`.
 */
export function calculerPrerequis(
  b: BrouillonVisiteur,
  deriver: Deriver,
): Record<string, unknown> {
  const etat = deriver(b);
  const acquis = etat.contextePersonnage.competencesAcquises;
  const classeNom = etat.contextePersonnage.classeNom;
  const classeNorm =
    classeNom === "Guerrier" ? "guerrier"
    : classeNom === "Voleur" ? "voleur"
    : classeNom === "Mage" ? "mage"
    : classeNom === "Prêtre" ? "pretre"
    : null;
  const psMax = etat.contextePersonnage.psMax;
  const snapshot = getSnapshot();

  const niveauActuelParNom = (nom: string): number =>
    Math.max(0, ...acquis.filter((a) => a.competenceNom === nom).map((a) => a.niveauAcquis));

  // `formater_prereq_label` (migration 20260530203835) : "Niv N" sauf cible
  // mono-niveau (nom seul). Réservé aux 3 branches "special" ci-dessous —
  // le cas général garde son formateur existant (INCHANGÉ).
  const formaterPrereqLabelSpecial = (nom: string, niveauMin: number): string => {
    const cible = snapshot.tables.competences.find((c) => c.nom === nom);
    const niveaux = cible?.niveaux;
    const nbNiveaux = Array.isArray(niveaux) ? niveaux.length : 0;
    return nbNiveaux <= 1 ? nom : `${nom} Niv ${niveauMin}`;
  };

  const resultat: Record<string, unknown> = {};

  for (const comp of snapshot.tables.competences) {
    const prereqParNiveau: Record<string, Array<{ label: string; statut: string; competence_id: string | null }>> = {};
    const raisonsParNiveau: Record<string, string> = {};
    let niveauMaxAchetable = 3;

    for (let niveau = 1; niveau <= 3; niveau++) {
      const prereqNiv: Array<{ label: string; statut: string; competence_id: string | null }> = [];
      const manquants: string[] = [];

      // Prérequis de CLASSE : pastille sans impacter les manquants.
      const classesReq = comp.classes_requises;
      if (niveau === 1 && classesReq && classesReq.length > 0) {
        const acquisClasse = classeNorm != null && classesReq.includes(classeNorm);
        prereqNiv.push({
          label: classesReq.join(" ou "),
          statut: acquisClasse ? "acquis" : "manquant",
          competence_id: null,
        });
      }

      // Prérequis compétences — 3 branches EXCLUSIVES "special" (mêmes cas que
      // `assembler_prerequis_labels`, migration 20260706195514 : le cas général
      // structuré n'est PAS émis pour ces niveaux-là), sinon cas général
      // (objet indexé par niveau).
      if (comp.nom === "Dépeçage" && niveau === 1) {
        const items = [
          {
            label: `${formaterPrereqLabelSpecial("Connaissances des Créatures", 1)} (famille appropriée)`,
            acquis: niveauActuelParNom("Connaissances des Créatures") >= 1,
          },
          {
            label: formaterPrereqLabelSpecial("Premiers Soins", 1),
            acquis: niveauActuelParNom("Premiers Soins") >= 1,
          },
        ];
        for (const it of items) {
          prereqNiv.push({ label: it.label, statut: it.acquis ? "acquis" : "manquant", competence_id: null });
          if (!it.acquis) manquants.push(it.label);
        }
      } else if (comp.nom === "Dépeçage" && niveau === 2) {
        const label = `${formaterPrereqLabelSpecial("Connaissances des Créatures", 2)} (famille appropriée)`;
        const acquis = niveauActuelParNom("Connaissances des Créatures") >= 2;
        prereqNiv.push({ label, statut: acquis ? "acquis" : "manquant", competence_id: null });
        if (!acquis) manquants.push(label);
      } else if (comp.nom === "Développement Spirituel Supérieur" && niveau === 1) {
        const label = "20 PS via Développement Spirituel";
        const acquis = psMax >= 20;
        prereqNiv.push({ label, statut: acquis ? "acquis" : "manquant", competence_id: null });
        if (!acquis) manquants.push(label);
      } else {
        // Prérequis compétences (objet indexé par niveau).
        const raw = comp.prerequis_competences as unknown;
        let liste: Array<{ competence_nom: string; niveau_min: number }> = [];
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          const forLevel = (raw as Record<string, unknown>)[String(niveau)];
          if (Array.isArray(forLevel)) liste = forLevel as Array<{ competence_nom: string; niveau_min: number }>;
        }
        for (const pr of liste) {
          const actuel = niveauActuelParNom(pr.competence_nom);
          const okPre = actuel >= pr.niveau_min;
          const label = `${pr.competence_nom} niveau ${pr.niveau_min}`;
          prereqNiv.push({ label, statut: okPre ? "acquis" : "manquant", competence_id: null });
          if (!okPre) manquants.push(label);
        }
      }

      if (prereqNiv.length > 0) prereqParNiveau[String(niveau)] = prereqNiv;
      if (manquants.length > 0) {
        raisonsParNiveau[String(niveau)] = `Prérequis manquant(s) : ${manquants.join(", ")}`;
        if (niveau - 1 < niveauMaxAchetable) niveauMaxAchetable = niveau - 1;
      }
    }

    if (niveauMaxAchetable < 3 || Object.keys(prereqParNiveau).length > 0) {
      resultat[comp.id] = {
        niveau_max_achetable: niveauMaxAchetable,
        raisons_par_niveau: raisonsParNiveau,
        prereqs_par_niveau: prereqParNiveau,
      };
    }
  }

  return resultat;
}

/**
 * Boucle transitive de la phase 1d serveur (`changer_classe_personnage`) — aussi
 * la boucle prérequis du désachat (`desacheter_competence`) :
 *
 *   v_changed := true;
 *   WHILE v_changed LOOP
 *     v_changed := false;
 *     v_prereq := verifier_prerequis_competences(...);
 *     FOR chaque compétence acquise : niveau max > niveau_max_achetable
 *       → retirer les niveaux excédentaires ; v_changed := true;
 *   END LOOP;
 *
 * @param base           brouillon dont la CLASSE est celle utilisée pour dériver
 *                       les gratuités et donc les prérequis (classe cible pour un
 *                       changement de classe, classe courante pour un désachat).
 * @param competencesDeDepart set de compétences ACHETÉES survivantes (après les
 *                       retraits initiaux : class-locked / over-cap / cascade cible).
 * @returns le set stabilisé de compétences achetées qui SURVIVENT à la cascade.
 */
export function cascadeParPrerequis(
  base: BrouillonVisiteur,
  competencesDeDepart: BrouillonCompetence[],
  deriver: Deriver,
): BrouillonCompetence[] {
  let restantes = competencesDeDepart;
  let changed = true;
  while (changed) {
    changed = false;
    const bWork: BrouillonVisiteur = {
      ...base,
      acquisitions: { ...base.acquisitions, competences: restantes },
    };
    const prereq = calculerPrerequis(bWork, deriver) as Record<
      string,
      { niveau_max_achetable?: number }
    >;
    const maxParComp = new Map<string, number>();
    for (const c of restantes) {
      maxParComp.set(
        c.competenceId,
        Math.max(maxParComp.get(c.competenceId) ?? 0, c.niveauAcquis),
      );
    }
    for (const [cid, niv] of maxParComp) {
      const entree = prereq[cid];
      if (!entree) continue;
      const max = entree.niveau_max_achetable ?? 3;
      if (niv > max) {
        const avant = restantes.length;
        restantes = restantes.filter(
          (c) => !(c.competenceId === cid && c.niveauAcquis > max),
        );
        if (restantes.length !== avant) changed = true;
      }
    }
  }
  return restantes;
}

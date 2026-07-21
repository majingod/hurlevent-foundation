import { CatalogueCompetences } from "./catalogue";
import {
  CLASSE,
  FILET_MARTIAL,
  GRATUITES_GUERRIER,
  POND4_GUERRIER,
  POOL3_GUERRIER,
  ROLES_GUERRIER,
  type Etape4,
  type ItemPool,
} from "./contenu/guerrier";
import { cheminComplet, prixChemin, type EtatPossession } from "./couts";
import type {
  AchatPlanifie,
  Composition,
  ContexteComposition,
} from "./types";

/**
 * [VIS-8 lot 2a] Le composeur : déroule ① gratuités → ② noyau du rôle →
 * ③ essentiels retenus → ④ pondération du rôle + FILET → reliquat dit
 * (décision 15). PUR et déterministe (l'aléa de 🎲 est injecté).
 *
 * Pilote : classe Guerrier. Les autres classes suivent le même patron
 * (s349), seule la table de contenu change.
 */

const clef = (nom: string, niveau: number) => `${nom}@${niveau}`;

function planifier(
  catalogue: CatalogueCompetences,
  etat: EtatPossession,
  achats: AchatPlanifie[],
  dejaPlanifie: Set<string>,
  cible: { nom: string; niveauCible: number },
  couche: 2 | 3 | 4,
  motif: string,
  budgetRestant: number
): number | null {
  const copie: EtatPossession = { niveaux: new Map(etat.niveaux) };
  const chemin = cheminComplet(
    catalogue,
    CLASSE,
    copie,
    cible.nom,
    cible.niveauCible
  );
  if (chemin === null) return null; // hors plafond création (§2.5)
  if (chemin.total > budgetRestant) return null; // ne rentre pas
  for (const a of chemin.achats) {
    achats.push({ ...a, couche, motif });
    dejaPlanifie.add(clef(a.nom, a.niveau));
  }
  etat.niveaux = copie.niveaux;
  return chemin.total;
}

export function composerGuerrier(
  catalogue: CatalogueCompetences,
  ctx: ContexteComposition
): Composition {
  const role = ROLES_GUERRIER.find((r) => r.id === ctx.roleId);
  if (!role) return { ok: false, raison: `Rôle inconnu : ${ctx.roleId}` };

  const refus = role.requiert(ctx.inventaire);
  if (refus !== null) return { ok: false, raison: refus };

  // ① Gratuités de classe — possédées d'office, 0 XP.
  const etat: EtatPossession = { niveaux: new Map() };
  const gratuites = GRATUITES_GUERRIER.map((nom) => {
    const c = catalogue.exiger(nom);
    etat.niveaux.set(nom, 1);
    return { competenceId: c.id, nom: c.nom };
  });
  const alertes: string[] = [];
  if (
    !ctx.inventaire.has("lame_deux_mains") &&
    GRATUITES_GUERRIER.includes("Compétence d'arme à deux mains")
  ) {
    // §4.1 🔨 : offerte mais inutilisable les mains vides — le dire, pas la
    // présenter comme un acquis.
    alertes.push(
      "La Compétence d'arme à deux mains est offerte, mais sans arme à deux mains apportée elle reste inutilisable pour l'instant."
    );
  }

  const achats: AchatPlanifie[] = [];
  const dejaPlanifie = new Set<string>();
  let reste = ctx.budget;

  // ② Le noyau du rôle — s'il ne rentre pas dans le budget, c'est un bug de
  // contenu (les noyaux max mesurés tiennent tous sous 60) : on le dit.
  for (const cible of role.noyau(ctx.inventaire)) {
    const cout = planifier(
      catalogue,
      etat,
      achats,
      dejaPlanifie,
      cible,
      2,
      `${role.emoji} noyau — ${role.titre}`,
      reste
    );
    if (cout === null) {
      return {
        ok: false,
        raison: `Le noyau du rôle ne tient pas dans le budget (${cible.nom}).`,
      };
    }
    reste -= cout;
  }

  // ③ Les essentiels retenus (choisis en 🧭, tirés en 🎲). Un essentiel qui
  // ne rentre plus est simplement écarté avec une alerte — jamais bloquant.
  for (const cible of ctx.essentiels ?? []) {
    const cout = planifier(
      catalogue,
      etat,
      achats,
      dejaPlanifie,
      cible,
      3,
      "essentiel retenu",
      reste
    );
    if (cout === null) {
      alertes.push(
        `« ${cible.nom} » ne rentre plus dans le budget restant — écarté.`
      );
      continue;
    }
    reste -= cout;
  }

  // ④ La pondération du rôle, puis le FILET (règle s346).
  const derouler = (etapes: Etape4[]) => {
    for (const e of etapes) {
      if (e.type === "achat") {
        const dejaAuNiveau =
          (etat.niveaux.get(e.nom) ?? 0) >= e.niveauCible;
        if (dejaAuNiveau) continue;
        const cout = planifier(
          catalogue,
          etat,
          achats,
          dejaPlanifie,
          { nom: e.nom, niveauCible: e.niveauCible },
          4,
          `${role.emoji} dans l'esprit du rôle`,
          reste
        );
        if (cout !== null) reste -= cout;
      } else {
        // Jauge d'étendue : rachats à l'unité tant que budget et plafond.
        const c = catalogue.exiger(e.nom);
        const unit = catalogue.coutNiveau(e.nom, 1);
        const dejaRachetes = achats.filter((a) => a.nom === e.nom).length;
        let n = dejaRachetes;
        while (reste >= unit && n < e.plafondRachats) {
          achats.push({
            competenceId: c.id,
            nom: c.nom,
            niveau: 1,
            coutXp: unit,
            couche: 4,
            motif: "jauge d'étendue",
          });
          reste -= unit;
          n += 1;
        }
      }
    }
  };
  derouler(POND4_GUERRIER[role.id]);
  derouler(FILET_MARTIAL);

  // Décision 15 : s'il reste quelque chose, le dire.
  if (reste > 0) {
    alertes.push(
      `Il reste ${reste} XP — trop peu pour un achat entier ici : à dépenser dans le créateur, ou à garder pour l'événement.`
    );
  }

  const totalDepense = ctx.budget - reste;
  return {
    ok: true,
    gratuites,
    achats,
    budget: ctx.budget,
    totalDepense,
    reliquat: reste,
    alertes,
  };
}

/* ------------------------------------------------------------------ */
/** 🎲 — couche ③ tirée : 1-2 essentiels du pool de la classe, compatibles
 *  inventaire, hors possédé, qui rentrent dans le budget restant
 *  (comportement éprouvé de la maquette s346 ; `rng` injecté = testable). */
export function tirerEssentiels(
  catalogue: CatalogueCompetences,
  ctx: Omit<ContexteComposition, "essentiels">,
  budgetRestant: number,
  rng: () => number
): { nom: string; niveauCible: number }[] {
  const role = ROLES_GUERRIER.find((r) => r.id === ctx.roleId);
  if (!role) return [];
  const etat: EtatPossession = { niveaux: new Map() };
  for (const nom of GRATUITES_GUERRIER) etat.niveaux.set(nom, 1);
  for (const cible of role.noyau(ctx.inventaire)) {
    cheminComplet(catalogue, CLASSE, etat, cible.nom, cible.niveauCible);
  }
  const candidats = (
    Object.values(POOL3_GUERRIER).flat() as ItemPool[]
  ).filter(
    (i) =>
      (!i.condition || i.condition(ctx.inventaire)) &&
      (etat.niveaux.get(i.nom) ?? 0) < i.niveauCible
  );
  // Fisher-Yates avec l'aléa injecté.
  for (let k = candidats.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [candidats[k], candidats[j]] = [candidats[j], candidats[k]];
  }
  const pris: { nom: string; niveauCible: number }[] = [];
  let dispo = budgetRestant;
  for (const c of candidats) {
    if (pris.length >= 2) break;
    const prix = prixChemin(catalogue, CLASSE, etat, c.nom, c.niveauCible);
    if (prix === null || prix > dispo) continue;
    cheminComplet(catalogue, CLASSE, etat, c.nom, c.niveauCible);
    pris.push({ nom: c.nom, niveauCible: c.niveauCible });
    dispo -= prix;
  }
  return pris;
}

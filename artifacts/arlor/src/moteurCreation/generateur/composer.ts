import { CatalogueCompetences } from "./catalogue";
import { CatalogueMagie } from "./catalogueMagie";
import {
  archetypeDemandeDesPS,
  comp,
  entreeExigeDesPS,
  estCompetenceAPS,
  exigeDesPS,
  type Achat,
  type ContenuClasse,
  type EntreePool,
  type EtapePond,
  type OptionsRole,
} from "./contenu/commun";
import { CONTENU_GUERRIER } from "./contenu/guerrier";
import {
  NIVEAU_ACQUISITION,
  ordonnerPrieresRepresentatives,
  ordonnerSortsRepresentatifs,
  prixMagie,
  RAMPE,
} from "./coutsMagie";
import { cheminComplet, type EtatPossession } from "./couts";
import type {
  AchatMagiePlanifie,
  AchatPlanifie,
  Composition,
  ConfigMagie,
  ContexteComposition,
} from "./types";

/**
 * [VIS-8 lot 2b] Le composeur GÉNÉRIQUE : déroule ① gratuités → ② noyau du
 * rôle → ③ essentiels retenus → ④ pondération + FILET → reliquat dit
 * (décision 15). PUR et déterministe (l'aléa de 🎲 est injecté).
 *
 * Généralisé aux 4 classes (patron annoncé au lot 2a) : seul le CONTENU
 * change. Nouveau au 2b : les achats de MAGIE — un sort/prière configuré,
 * prix dérivé du miroir attesté (#710), RAMPE d'accès dérivée en chemin
 * complet (« rampe incluse », jamais un accès sec — décision 16).
 */

export interface Catalogues {
  competences: CatalogueCompetences;
  magie: CatalogueMagie;
}

const CATALOGUE_MAGIE_VIDE = new CatalogueMagie({ sorts: [], prieres: [] });

const clefComp = (nom: string, niveau: number) => `${nom}@${niveau}`;
const clefMagie = (t: string, nom: string, c: ConfigMagie) =>
  `${t}:${nom}@${c.niveau}|${c.zone}|${c.portee}|${c.duree}`;

const labelAchat = (a: Achat) =>
  a.t === "sortAuChoix"
    ? `sort ${a.rang} du cercle`
    : a.t === "priereAuChoix"
      ? `prière ${a.rang} du domaine`
      : a.nom;

/** L'état de travail d'une composition (cloné pour le tout-ou-rien). */
interface Chantier {
  etat: EtatPossession;
  achats: AchatPlanifie[];
  achatsMagie: AchatMagiePlanifie[];
  deja: Set<string>;
  /**
   * ⭐ [A2-Mage s358, élargi s360] LE CHOIX DE MAGIE — cercle du Mage ou
   * domaine du Prêtre. Résout les achats `sortAuChoix` / `priereAuChoix`.
   * Absent pour les classes sans magie.
   */
  choixMagie?: string;
  /** ⭐ [R1a s361] Le SECOND cercle/domaine — cible des achats `slot: 2`. */
  choixMagie2?: string;
}

const cloner = (ch: Chantier): Chantier => ({
  etat: { niveaux: new Map(ch.etat.niveaux) },
  achats: [...ch.achats],
  achatsMagie: [...ch.achatsMagie],
  deja: new Set(ch.deja),
  choixMagie: ch.choixMagie,
  // ⚠️ [R1a s361] Un cloneur écrit à la main est l'endroit où un champ neuf
  // meurt EN SILENCE : sans cette ligne, le second cercle disparaissait dès
  // qu'une entrée se planifiait sur une copie, et `sortAuChoix(1, 2)` ne
  // résolvait plus rien. Attrapé par la preuve par le contraire.
  choixMagie2: ch.choixMagie2,
});

const adopter = (ch: Chantier, src: Chantier) => {
  ch.etat = src.etat;
  ch.achats = src.achats;
  ch.achatsMagie = src.achatsMagie;
  ch.deja = src.deja;
};

function planifierComp(
  cats: Catalogues,
  classe: ContenuClasse["classe"],
  ch: Chantier,
  cible: { nom: string; niveauCible: number; choix?: string },
  couche: 2 | 3 | 4,
  motif: string,
  budgetRestant: number
): number | null {
  const copie: EtatPossession = { niveaux: new Map(ch.etat.niveaux) };
  const chemin = cheminComplet(
    cats.competences,
    classe,
    copie,
    cible.nom,
    cible.niveauCible
  );
  if (chemin === null) return null; // hors plafond création (§2.5)
  if (chemin.total > budgetRestant) return null; // ne rentre pas
  for (const a of chemin.achats) {
    // ⭐ [R1a s361] Le `choix_achat` ne vaut que pour la compétence CIBLE :
    // les prérequis traversés en chemin sont d'autres compétences.
    const choix = a.nom === cible.nom ? cible.choix : undefined;
    ch.achats.push({ ...a, couche, motif, ...(choix ? { choix } : {}) });
    ch.deja.add(clefComp(a.nom, a.niveau));
  }
  ch.etat.niveaux = copie.niveaux;
  return chemin.total;
}

function planifierRachat(
  cats: Catalogues,
  ch: Chantier,
  nom: string,
  couche: 2 | 3 | 4,
  motif: string,
  budgetRestant: number,
  choix?: string
): number | null {
  const c = cats.competences.exiger(nom);
  const unit = cats.competences.coutNiveau(nom, 1);
  if (unit > budgetRestant) return null;
  ch.achats.push({
    competenceId: c.id,
    nom: c.nom,
    niveau: 1,
    coutXp: unit,
    couche,
    motif,
    ...(choix ? { choix } : {}),
  });
  // Un rachat = un NOUVEAU choix : le niveau ne monte pas, mais la
  // compétence est désormais possédée (débloque ses dépendants).
  if (!ch.etat.niveaux.get(nom)) ch.etat.niveaux.set(nom, 1);
  return unit;
}

function planifierMagie(
  cats: Catalogues,
  classe: ContenuClasse["classe"],
  ch: Chantier,
  achat: Extract<Achat, { t: "sort" | "priere" }>,
  couche: 2 | 3 | 4,
  motif: string,
  budgetRestant: number
): number | null {
  if (ch.deja.has(clefMagie(achat.t, achat.nom, achat.config))) return 0;
  const modele =
    achat.t === "sort"
      ? cats.magie.exigerSort(achat.nom)
      : cats.magie.exigerPriere(achat.nom);
  const { coutXp, coutPS } = prixMagie(modele, achat.t, achat.config);

  // Surclassement (④ « monter la prière au niveau 3 ») : même modèle et
  // mêmes options à un niveau INFÉRIEUR déjà planifié → on le remplace,
  // jamais deux exemplaires. Le prix payé est le DELTA.
  const idx = ch.achatsMagie.findIndex(
    (m) =>
      m.type === achat.t &&
      m.nom === achat.nom &&
      m.config.zone === achat.config.zone &&
      m.config.portee === achat.config.portee &&
      m.config.duree === achat.config.duree &&
      m.config.niveau < achat.config.niveau
  );
  const rembourse = idx >= 0 ? ch.achatsMagie[idx].coutXp : 0;

  // La rampe dérivée : accès au niveau ceil(n/5) + la porte au niveau 1,
  // en chemin complet (prix contextuel — déjà payée = 0).
  const r = RAMPE[achat.t];
  const copie: EtatPossession = { niveaux: new Map(ch.etat.niveaux) };
  const acces = cheminComplet(
    cats.competences,
    classe,
    copie,
    r.acces,
    NIVEAU_ACQUISITION(achat.config.niveau)
  );
  if (acces === null) return null; // niveau 11+ : hors création
  const porte = cheminComplet(cats.competences, classe, copie, r.porte, 1);
  if (porte === null) return null;
  const totalRampe = acces.total + porte.total;
  if (totalRampe + coutXp - rembourse > budgetRestant) return null;

  for (const a of [...acces.achats, ...porte.achats]) {
    // ⭐ [R1a s361] L'ACCÈS nomme son cercle/domaine (`multiple_avec_choix_
    // par_niveau`, 178 lignes en prod dont zéro sans choix). La PORTE
    // (`Acquisition de Sort`/`de Prière`) est `simple` : 55 lignes en prod,
    // zéro AVEC choix. Ne pas lui en coller un.
    const choix = a.nom === r.acces ? ch.choixMagie : undefined;
    ch.achats.push({
      ...a,
      couche,
      motif: `accès — ${motif}`,
      ...(choix ? { choix } : {}),
    });
    ch.deja.add(clefComp(a.nom, a.niveau));
  }
  ch.etat.niveaux = copie.niveaux;
  if (idx >= 0) {
    // Surclassement EN PLACE : l'entrée reste dans SA couche (le noyau garde
    // sa prière), montée au nouveau niveau ; la trace dit qui l'a montée.
    const existant = ch.achatsMagie[idx];
    ch.achatsMagie[idx] = {
      ...existant,
      config: achat.config,
      coutXp,
      coutPS,
      surclasse: {
        deNiveau: existant.config.niveau,
        deCoutXp: existant.coutXp,
        parCouche: couche,
        motif,
      },
    };
  } else {
    ch.achatsMagie.push({
      type: achat.t,
      modeleId: modele.id,
      nom: modele.nom,
      config: achat.config,
      coutXp,
      coutPS,
      couche,
      motif,
    });
  }
  ch.deja.add(clefMagie(achat.t, achat.nom, achat.config));
  return totalRampe + coutXp - rembourse;
}

/**
 * ⭐ [A2-Mage s358] « le n-ième sort représentatif du cercle » → un achat de
 * sort concret. Rend `null` (et non une exception) quand le cercle n'est pas
 * choisi ou qu'il ne porte pas assez de sorts : une entrée non résolue est
 * SAUTÉE, jamais bloquante — même politique que les autres achats qui ne
 * rentrent pas dans le budget.
 */
function resoudreSortAuChoix(
  cats: Catalogues,
  cercle: string | undefined,
  rang: number
): Extract<Achat, { t: "sort" }> | null {
  if (!cercle) return null;
  const ordonnes = ordonnerSortsRepresentatifs(cats.magie.sortsDuCercle(cercle));
  const choisi = ordonnes[rang - 1];
  return choisi === undefined
    ? null
    : { t: "sort", nom: choisi.modele.nom, config: choisi.config };
}

/** ⭐ [A2-Prêtre s360] « la n-ième prière représentative du domaine » → un
 *  achat concret. Rend `null` (et non une exception) quand le domaine n'est
 *  pas connu ou que le rang dépasse le catalogue — jumeau de son homologue
 *  sort, à l'ORDRE près, qui est mesuré séparément (référence §5.2 ⑤). */
function resoudrePriereAuChoix(
  cats: Catalogues,
  domaine: string | undefined,
  rang: number
): Extract<Achat, { t: "priere" }> | null {
  if (!domaine) return null;
  const ordonnees = ordonnerPrieresRepresentatives(
    cats.magie.prieresDuDomaine(domaine)
  );
  const choisie = ordonnees[rang - 1];
  return choisie === undefined
    ? null
    : { t: "priere", nom: choisie.modele.nom, config: choisie.config };
}

function planifierAchat(
  cats: Catalogues,
  classe: ContenuClasse["classe"],
  ch: Chantier,
  a: Achat,
  couche: 2 | 3 | 4,
  motif: string,
  budgetRestant: number
): number | null {
  switch (a.t) {
    case "comp":
      return planifierComp(cats, classe, ch, a, couche, motif, budgetRestant);
    case "rachat":
      return planifierRachat(
        cats,
        ch,
        a.nom,
        couche,
        motif,
        budgetRestant,
        a.choix
      );
    case "sortAuChoix": {
      // Le contenu a demandé « le n-ième sort représentatif du cercle » :
      // le catalogue tranche, jamais le contenu (référence §5.1 ③).
      const cible = a.slot === 2 ? ch.choixMagie2 : ch.choixMagie;
      const resolu = resoudreSortAuChoix(cats, cible, a.rang);
      return resolu === null
        ? null
        : planifierMagie(cats, classe, ch, resolu, couche, motif, budgetRestant);
    }
    case "priereAuChoix": {
      // ⭐ [A2-Prêtre s360] « la n-ième prière représentative du domaine ».
      // Même patron que `sortAuChoix`, ordre PROPRE au prêtre (§5.2 ⑤).
      const cible = a.slot === 2 ? ch.choixMagie2 : ch.choixMagie;
      const resolu = resoudrePriereAuChoix(cats, cible, a.rang);
      return resolu === null
        ? null
        : planifierMagie(cats, classe, ch, resolu, couche, motif, budgetRestant);
    }
    default:
      return planifierMagie(cats, classe, ch, a, couche, motif, budgetRestant);
  }
}

/** Une ENTRÉE (1..n achats) est tout-ou-rien : simulée sur une copie, puis
 *  adoptée si tout passe (composite « cercle + un sort dedans »). */
function planifierEntree(
  cats: Catalogues,
  classe: ContenuClasse["classe"],
  ch: Chantier,
  achats: Achat[],
  couche: 2 | 3 | 4,
  motif: string,
  budgetRestant: number
): number | null {
  const essai = cloner(ch);
  let total = 0;
  for (const a of achats) {
    const cout = planifierAchat(
      cats,
      classe,
      essai,
      a,
      couche,
      motif,
      budgetRestant - total
    );
    if (cout === null) return null;
    total += cout;
  }
  adopter(ch, essai);
  return total;
}

const entreesDuPool = (contenu: ContenuClasse): EntreePool[] =>
  Object.values(contenu.pool3).flat();

function resoudreEssentiel(
  contenu: ContenuClasse,
  e: NonNullable<ContexteComposition["essentiels"]>[number],
  inv: ReadonlySet<string>,
  o: OptionsRole
): { label: string; achats: Achat[] | null } {
  if ("label" in e) {
    const entree = entreesDuPool(contenu).find((x) => x.label === e.label);
    if (!entree || (entree.condition && !entree.condition(inv, o))) {
      return { label: e.label, achats: null };
    }
    return { label: e.label, achats: entree.achats(inv, o) };
  }
  return { label: e.nom, achats: [comp(e.nom, e.niveauCible)] };
}

export function composerClasse(
  cats: Catalogues,
  contenu: ContenuClasse,
  ctx: ContexteComposition
): Composition {
  const role = contenu.roles.find((r) => r.id === ctx.roleId);
  if (!role) return { ok: false, raison: `Rôle inconnu : ${ctx.roleId}` };
  // ⭐ [A2-Prêtre s360] Le choix de magie : IMPOSÉ par l'archétype quand la
  // mesure en dégage un au noyau (🕊️ Guerre, 📿 Bénédiction), sinon celui du
  // joueur. Le composeur tranche UNE fois, tout le reste lit `o.element`.
  const choixMagie = role.magieImposee ?? ctx.element;
  const o: OptionsRole = { element: choixMagie, element2: ctx.element2 };

  const refus = role.requiert(ctx.inventaire, o);
  if (refus !== null) return { ok: false, raison: refus };

  // ⭐ [A2-socle] Garde « inapte à la magie » (référence v4 §2.2).
  // Le moteur ne devine RIEN : il lit le booléen que l'appelant a calculé.
  if (ctx.inapteMagie && archetypeDemandeDesPS(contenu, ctx.roleId, ctx.inventaire, o)) {
    return {
      ok: false,
      raison: `${role.emoji} ${role.titre} demande de la magie, et ton personnage y est inapte : choisis un autre rôle, ou une autre origine.`,
    };
  }

  // ① Gratuités de classe — possédées d'office, 0 XP.
  const ch: Chantier = {
    etat: { niveaux: new Map() },
    achats: [],
    achatsMagie: [],
    deja: new Set(),
    choixMagie,
    choixMagie2: ctx.element2,
  };
  const gratuites = contenu.gratuites.map((nom) => {
    const c = cats.competences.exiger(nom);
    ch.etat.niveaux.set(nom, 1);
    return { competenceId: c.id, nom: c.nom };
  });
  const alertes: string[] = [
    ...(contenu.alertesGratuites?.(ctx.inventaire) ?? []),
  ];
  let reste = ctx.budget;

  // ② Le noyau du rôle — s'il ne rentre pas dans le budget, c'est un bug de
  // contenu (les noyaux max mesurés tiennent tous sous 60) : on le dit.
  for (const a of role.noyau(ctx.inventaire, o)) {
    const cout = planifierAchat(
      cats,
      contenu.classe,
      ch,
      a,
      2,
      `${role.emoji} noyau — ${role.titre}`,
      reste
    );
    if (cout === null) {
      return {
        ok: false,
        raison: `Le noyau du rôle ne tient pas dans le budget (${labelAchat(a)}).`,
      };
    }
    reste -= cout;
  }

  // ③a ⭐ s352 — LA SIGNATURE DU RÔLE, en tête de ③, déterministe.
  // Sans elle, un 🎲 à 80 XP pouvait rendre l'archétype méconnaissable.
  // Gloutonne : une montée qui ne rentre pas est sautée, jamais bloquante.
  for (const entree of contenu.signature3?.[ctx.roleId] ?? []) {
    if (entree.condition && !entree.condition(ctx.inventaire, o)) continue;
    const cout = planifierEntree(
      cats,
      contenu.classe,
      ch,
      entree.achats(ctx.inventaire, o),
      3,
      `${role.emoji} signature — ${role.titre}`,
      reste
    );
    if (cout !== null) reste -= cout;
  }

  // ③b Les essentiels retenus (choisis en 🧭, tirés en 🎲). Un essentiel qui
  // ne rentre plus est simplement écarté avec une alerte — jamais bloquant.
  for (const e of ctx.essentiels ?? []) {
    const { label, achats } = resoudreEssentiel(contenu, e, ctx.inventaire, o);
    if (achats === null) {
      alertes.push(`« ${label} » n'est plus proposable — écarté.`);
      continue;
    }
    // ⭐ [A2-socle s355] Le pool ③b est partagé entre les rôles d'une classe :
    // une entrée à PS y est facultative, on l'écarte au lieu de refuser le
    // rôle entier. Ceinture ET bretelles avec le filtre de tirage : 🧭 laisse
    // le joueur CHOISIR ses essentiels, il ne passe pas par le tirage.
    if (ctx.inapteMagie && exigeDesPS(achats)) {
      alertes.push(
        `« ${label} » demande de la magie — écarté : ton personnage y est inapte.`
      );
      continue;
    }
    const cout = planifierEntree(
      cats,
      contenu.classe,
      ch,
      achats,
      3,
      "essentiel retenu",
      reste
    );
    if (cout === null) {
      alertes.push(
        `« ${label} » ne rentre plus dans le budget restant — écarté.`
      );
      continue;
    }
    reste -= cout;
  }

  // ④ La pondération du rôle, puis le FILET (règle s346).
  const derouler = (etapes: EtapePond[]) => {
    for (const e of etapes) {
      if (e.type === "achats") {
        const cout = planifierEntree(
          cats,
          contenu.classe,
          ch,
          e.achats(ctx.inventaire, o),
          4,
          `${role.emoji} dans l'esprit du rôle`,
          reste
        );
        if (cout !== null) reste -= cout;
      } else {
        // ⭐ [A2-socle] Un inapte ne reçoit AUCUNE jauge à PS — sans ça
        // `FILET_GUERRIER` / `FILET_VOLEUR` lui poseraient du
        // « Développement Spirituel ». L'XP glisse à l'étape suivante.
        if (ctx.inapteMagie && estCompetenceAPS(e.nom)) continue;
        // Jauge d'étendue : rachats à l'unité tant que budget et plafond.
        const c = cats.competences.exiger(e.nom);
        const unit = cats.competences.coutNiveau(e.nom, 1);
        let n = ch.achats.filter((a) => a.nom === e.nom).length;
        while (reste >= unit && n < e.plafondRachats) {
          ch.achats.push({
            competenceId: c.id,
            nom: c.nom,
            niveau: 1,
            coutXp: unit,
            couche: 4,
            motif: "jauge d'étendue",
          });
          // ⭐ s349 : le 1er rachat rend la compétence POSSÉDÉE (niveau 1) —
          // sinon un dépendant la repayerait (mesuré : Créatures → Dépeçage).
          if (!ch.etat.niveaux.get(e.nom)) ch.etat.niveaux.set(e.nom, 1);
          reste -= unit;
          n += 1;
        }
      }
    }
  };
  derouler(contenu.pond4[ctx.roleId] ?? []);
  derouler(contenu.filet);

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
    achats: ch.achats,
    achatsMagie: ch.achatsMagie,
    budget: ctx.budget,
    totalDepense,
    reliquat: reste,
    alertes,
  };
}

/* ------------------------------------------------------------------ */
/** 🎲 — couche ③ tirée : 1-2 entrées du pool de la classe, compatibles
 *  inventaire, utiles (pas déjà couvertes), qui rentrent dans le budget
 *  restant. `rng` injecté = testable. */
export function tirerEssentielsClasse(
  cats: Catalogues,
  contenu: ContenuClasse,
  ctx: Omit<ContexteComposition, "essentiels">,
  budgetRestant: number,
  rng: () => number
): { label: string }[] {
  const role = contenu.roles.find((r) => r.id === ctx.roleId);
  if (!role) return [];
  const choixMagie = role.magieImposee ?? ctx.element;
  const o: OptionsRole = { element: choixMagie, element2: ctx.element2 };

  // État de départ : gratuités + noyau (budget non contraint ici).
  const ch: Chantier = {
    etat: { niveaux: new Map() },
    achats: [],
    achatsMagie: [],
    deja: new Set(),
    choixMagie,
    choixMagie2: ctx.element2,
  };
  for (const nom of contenu.gratuites) ch.etat.niveaux.set(nom, 1);
  for (const a of role.noyau(ctx.inventaire, o)) {
    planifierAchat(
      cats,
      contenu.classe,
      ch,
      a,
      2,
      "noyau",
      Number.POSITIVE_INFINITY
    );
  }

  // ⭐ s352 — la signature est déjà prise en ③a par le composeur : on
  // l'applique à l'état de départ ET on en retire le prix du budget, sinon
  // le tirage la reproposerait et compterait deux fois le même XP.
  let budgetApresSignature = budgetRestant;
  for (const entree of contenu.signature3?.[ctx.roleId] ?? []) {
    if (entree.condition && !entree.condition(ctx.inventaire, o)) continue;
    const cout = planifierEntree(
      cats,
      contenu.classe,
      ch,
      entree.achats(ctx.inventaire, o),
      3,
      "signature",
      budgetApresSignature
    );
    if (cout !== null) budgetApresSignature -= cout;
  }

  // Candidats : condition ok ET utiles (prix > 0 sur l'état de départ).
  const candidats = entreesDuPool(contenu).filter((i) => {
    if (i.condition && !i.condition(ctx.inventaire, o)) return false;
    // ⭐ [A2-socle s355] Chez un inapte, une entrée à PS n'est pas écartée
    // APRÈS coup : elle n'entre jamais dans le tirage. Sinon 🎲 proposerait
    // « Canalisation » à quelqu'un qui ne peut pas la prendre.
    if (ctx.inapteMagie && entreeExigeDesPS(i, ctx.inventaire, o)) return false;
    const essai = cloner(ch);
    const prix = planifierEntree(
      cats,
      contenu.classe,
      essai,
      i.achats(ctx.inventaire, o),
      3,
      "essai",
      Number.POSITIVE_INFINITY
    );
    return prix !== null && prix > 0;
  });

  // Fisher-Yates avec l'aléa injecté.
  for (let k = candidats.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [candidats[k], candidats[j]] = [candidats[j], candidats[k]];
  }

  const pris: { label: string }[] = [];
  let dispo = budgetApresSignature;
  for (const c of candidats) {
    if (pris.length >= 2) break;
    const essai = cloner(ch);
    const prix = planifierEntree(
      cats,
      contenu.classe,
      essai,
      c.achats(ctx.inventaire, o),
      3,
      "essai",
      dispo
    );
    if (prix === null || prix === 0) continue;
    adopter(ch, essai);
    pris.push({ label: c.label });
    dispo -= prix;
  }
  return pris;
}

/* ------------------------------------------------------------------ */
/* Enveloppes de compatibilité — pilote Guerrier (API du lot 2a).      */

export function composerGuerrier(
  catalogue: CatalogueCompetences,
  ctx: ContexteComposition
): Composition {
  return composerClasse(
    { competences: catalogue, magie: CATALOGUE_MAGIE_VIDE },
    CONTENU_GUERRIER,
    ctx
  );
}

export function tirerEssentiels(
  catalogue: CatalogueCompetences,
  ctx: Omit<ContexteComposition, "essentiels">,
  budgetRestant: number,
  rng: () => number
): { nom: string; niveauCible: number }[] {
  const labels = tirerEssentielsClasse(
    { competences: catalogue, magie: CATALOGUE_MAGIE_VIDE },
    CONTENU_GUERRIER,
    ctx,
    budgetRestant,
    rng
  );
  return labels.map(({ label }) => {
    const entree = entreesDuPool(CONTENU_GUERRIER).find(
      (x) => x.label === label
    )!;
    const a = entree.achats(ctx.inventaire, {})[0];
    if (a.t === "sortAuChoix") {
      // Compat API Guerrier : le pool guerrier ne porte aucun `sortAuChoix`.
      return { nom: labelAchat(a), niveauCible: 1 };
    }
    return a.t === "comp"
      ? { nom: a.nom, niveauCible: a.niveauCible }
      : { nom: a.nom, niveauCible: 1 };
  });
}

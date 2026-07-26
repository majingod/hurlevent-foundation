/**
 * [VIS-8 lot 2b] Catalogue des MODÈLES de sorts/prières référencés par les
 * contenus casters. Injecté (fixture MCP dans les tests) — les modèles
 * portent des MAXIMA (Gotcha C55) : zone_effet / portee / duree plafonnent
 * les options choisies ; le prix vient de la formule, jamais du contenu.
 */

export interface SortModele {
  id: string;
  nom: string;
  cercle: string;
  niveau: number;
  type_sort: string;
  zone_effet: string;
  portee: string;
  duree: string;
  cout_xp_base: number;
}

export interface PriereModele {
  id: string;
  nom: string;
  domaine: string;
  niveau: number;
  type_priere: string;
  zone_effet: string;
  portee: string;
  duree: string;
  cout_xp_base: number;
}

export class CatalogueMagie {
  private sorts = new Map<string, SortModele>();
  private prieres = new Map<string, PriereModele>();

  constructor(d: {
    sorts: readonly SortModele[];
    prieres: readonly PriereModele[];
  }) {
    for (const s of d.sorts) {
      if (this.sorts.has(s.nom)) {
        throw new Error(`[generateur] Sort en double dans la fixture : « ${s.nom} ».`);
      }
      this.sorts.set(s.nom, s);
    }
    for (const p of d.prieres) {
      if (this.prieres.has(p.nom)) {
        throw new Error(`[generateur] Prière en double dans la fixture : « ${p.nom} ».`);
      }
      this.prieres.set(p.nom, p);
    }
  }

  exigerSort(nom: string): SortModele {
    const s = this.sorts.get(nom);
    if (!s) {
      throw new Error(
        `[generateur] Sort inconnu du catalogue magie : « ${nom} » — ` +
          `le contenu référence un modèle absent de la fixture.`
      );
    }
    return s;
  }

  exigerPriere(nom: string): PriereModele {
    const p = this.prieres.get(nom);
    if (!p) {
      throw new Error(
        `[generateur] Prière inconnue du catalogue magie : « ${nom} » — ` +
          `le contenu référence un modèle absent de la fixture.`
      );
    }
    return p;
  }

  /** La paire (dégâts + bouclier) d'un cercle — la question « ton élément ? ». */
  sortsDuCercle(cercle: string): SortModele[] {
    return [...this.sorts.values()].filter((s) => s.cercle === cercle);
  }

  /** ⭐ [A2-Prêtre s360] Les prières d'un domaine — jumeau de `sortsDuCercle`.
   *  ⚠️ Le domaine n'est PAS libre comme le cercle : la religion en proscrit
   *  2 sur 8 (référence §5.2 ①). Le filtrage par religion vit dans le
   *  résolveur, jamais ici — ce catalogue ne connaît que les modèles. */
  prieresDuDomaine(domaine: string): PriereModele[] {
    return [...this.prieres.values()].filter((p) => p.domaine === domaine);
  }
}

// =========================================================================
// acquisCampagne — helpers purs de détection des « acquis » en mode campagne.
//
// Reflète INV-3 backend (desacheter_*) — le serveur reste l'autorité.
// Chaque RPC desacheter_* compare l'item visé à la dernière photo de compo
// (derniere_photo_compo) et refuse le désachat des items déjà scellés
// (code `acquis_intouchable`). Ces helpers anticipent ce refus côté UI :
// ils déterminent si un item est « acquis » (donc non désachetable) afin de
// le verrouiller visuellement. Ils sont cosmétiques — jamais une autorisation.
//
// Fail-safe : en mode campagne, si la photo est null (aucune photo) ou
// undefined (chargement / requête échouée), TOUT est considéré comme scellé,
// car le backend refuse tout désachat tant que la photo est indisponible.
// Hors mode campagne (actif === false), aucun item n'est jamais scellé.
// =========================================================================

export interface PhotoCompo {
  competences?: { id: string; choix: string | null; niveau: number; niveaux?: number[] }[];
  /** instance_id présent dans les photos capturées depuis la migration 20260610204155. */
  sorts?: { id: string; instance_id?: string }[];
  prieres?: { id: string; instance_id?: string }[];
  recettes?: { id: string }[];
  assemblages?: { id: string }[];
  pieges?: { nom: string; niveau: number }[];
  [k: string]: unknown;
}

/** photo === undefined → en cours de chargement ; null → aucune photo. */
export type PhotoState = PhotoCompo | null | undefined;

/**
 * En mode campagne, la photo indisponible (null ou undefined) scelle tout :
 * le backend refuse tout désachat tant qu'il n'a pas de photo de référence.
 */
function photoIndisponible(photo: PhotoState): boolean {
  return photo === null || photo === undefined;
}

export function estNiveauCompetenceAcquis(
  actif: boolean,
  photo: PhotoState,
  competenceId: string,
  choixAchat: string | null,
  niveau: number,
): boolean {
  if (!actif) return false;
  if (photoIndisponible(photo)) return true;
  const cible = choixAchat ?? null;
  return (photo as PhotoCompo).competences?.some(
    (e) =>
      e.id === competenceId &&
      (e.choix ?? null) === cible &&
      e.niveau >= niveau,
  ) ?? false;
}

export function estSortAcquis(
  actif: boolean,
  photo: PhotoState,
  sortId: string,
  instanceId: string,
): boolean {
  if (!actif) return false;
  if (photoIndisponible(photo)) return true;
  // Miroir INV-3 backend : match par instance quand l'entrée photo porte un
  // instance_id ; repli conservateur par sort de base (photos antérieures).
  return (
    (photo as PhotoCompo).sorts?.some((e) =>
      e.instance_id !== undefined
        ? e.instance_id === instanceId
        : e.id === sortId,
    ) ?? false
  );
}

export function estPriereAcquise(
  actif: boolean,
  photo: PhotoState,
  priereId: string,
  instanceId: string,
): boolean {
  if (!actif) return false;
  if (photoIndisponible(photo)) return true;
  // Miroir INV-3 backend : match par instance quand l'entrée photo porte un
  // instance_id ; repli conservateur par prière de base (photos antérieures).
  return (
    (photo as PhotoCompo).prieres?.some((e) =>
      e.instance_id !== undefined
        ? e.instance_id === instanceId
        : e.id === priereId,
    ) ?? false
  );
}

export function estRecetteAcquise(
  actif: boolean,
  photo: PhotoState,
  recetteId: string,
): boolean {
  if (!actif) return false;
  if (photoIndisponible(photo)) return true;
  return (photo as PhotoCompo).recettes?.some((e) => e.id === recetteId) ?? false;
}

export function estAssemblageAcquis(
  actif: boolean,
  photo: PhotoState,
  assemblageId: string,
): boolean {
  if (!actif) return false;
  if (photoIndisponible(photo)) return true;
  return (
    (photo as PhotoCompo).assemblages?.some((e) => e.id === assemblageId) ?? false
  );
}

export function estPiegeAcquis(
  actif: boolean,
  photo: PhotoState,
  piegeNom: string,
  niveau: number,
): boolean {
  if (!actif) return false;
  if (photoIndisponible(photo)) return true;
  return (
    (photo as PhotoCompo).pieges?.some(
      (e) => e.nom === piegeNom && e.niveau >= niveau,
    ) ?? false
  );
}

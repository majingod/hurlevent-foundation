/**
 * s387 — D56 : le dépôt public ne nomme plus les joueurs (C107, vie privée).
 *
 * Ce fichier lit les sources de `contenu/` DEPUIS LE DISQUE (`readFileSync`),
 * il ne les importe pas : ce qu'on atteste, c'est le TEXTE COMMITTÉ, pas le
 * comportement du module. Zéro changement de comportement n'est attendu ici.
 *
 * ⚠️ Un lot de texte est vert par défaut : chaque assertion négative est
 * accompagnée de sa JUMELLE-TÉMOIN (le même regex, appliqué à une chaîne en
 * dur qui doit matcher) — sans elle, un regex devenu inopérant rendrait le
 * test vert à vide.
 *
 * D56-d : un effectif ne désigne pas parce qu'il est petit, mais parce qu'il
 * vaut 0 % ou 100 % — seuls ces extrêmes sont requalifiés (T1). Les rapports
 * intermédiaires restent du game-design légitime et sont vérifiés PRÉSENTS
 * (jumelle positive), pas absents.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CONTENU_DIR = path.resolve(import.meta.dirname, "contenu");

/** Les 6 fichiers de `contenu/` couverts par D56 (`traits.ts` est hors lot :
 *  aucun nom, aucun effectif extrême sur des personnes n'y a été mesuré). */
const FICHIERS_CONTENU = [
  "pretre.ts",
  "mage.ts",
  "guerrier.ts",
  "voleur.ts",
  "commun.ts",
  "artisanat.ts",
] as const;

const lireFichier = (nom: string): string =>
  readFileSync(path.join(CONTENU_DIR, nom), "utf8");

/** Capture un rapport « N/M » ou « N sur M » — avec ou sans mot entre les
 *  deux nombres (« 6 forgerons sur 6 »). Les bornes `;` et `.` empêchent de
 *  faire un faux rapport entre deux nombres de deux phrases voisines.
 *  ⚠️ Fabrique une INSTANCE FRAÎCHE à chaque appel : un `/g` partagé garde
 *  son `lastIndex` d'un `.test()` à l'autre et fausse le suivant. */
const ratioRegex = () => /(\d+)\s*(?:[^\d\n;.]{0,25}?\bsur\b\s*|\/\s*)(\d+)/g;

interface RatioOccurrence {
  fichier: string;
  ligne: number;
  texte: string;
  n: number;
  d: number;
}

function trouverRatios(fichier: string, contenu: string): RatioOccurrence[] {
  const occurrences: RatioOccurrence[] = [];
  contenu.split("\n").forEach((ligne, index) => {
    const re = ratioRegex();
    let m: RegExpExecArray | null;
    while ((m = re.exec(ligne))) {
      occurrences.push({
        fichier,
        ligne: index + 1,
        texte: m[0],
        n: Number(m[1]),
        d: Number(m[2]),
      });
    }
  });
  return occurrences;
}

/** Un rapport EXTRÊME (0 % ou 100 %) est celui qui désigne — D56-d. */
const estExtreme = (o: RatioOccurrence) => o.n === o.d || o.n === 0;

describe("s387 · D56 — le contenu ne nomme plus les joueurs (vie privée, C107)", () => {
  describe("T1 — plus aucun effectif extrême sur des personnes", () => {
    it("jumelle-témoin : le regex détecte les motifs qu'il doit détecter", () => {
      expect(ratioRegex().test("6 forgerons sur 6 l'ont")).toBe(true);
      expect(ratioRegex().test("Mesuré 2/2 chez")).toBe(true);
    });

    it("aucun rapport N/M ou N sur M avec N === M ou N === 0, hors exemptions non-personnes", () => {
      // `artisanat.ts` est exempté EN BLOC : ses ratios (ex. 15/15 assemblages
      // de runes) portent sur des OBJETS du snapshot, jamais sur des joueurs.
      const fichiersScannes = FICHIERS_CONTENU.filter((f) => f !== "artisanat.ts");
      const extremes = fichiersScannes
        .flatMap((f) => trouverRatios(f, lireFichier(f)))
        .filter(estExtreme)
        // `voleur.ts:30` — « 19/19 acquisitions de niveau 3 » porte sur des
        // ACQUISITIONS en jeu, pas sur des personnes (commenté sur place).
        .filter((o) => !(o.fichier === "voleur.ts" && o.ligne === 30));

      expect(extremes, JSON.stringify(extremes, null, 2)).toHaveLength(0);
    });

    it("jumelle positive : les rapports intermédiaires (game-design mesuré) subsistent", () => {
      const intermediaires = FICHIERS_CONTENU.flatMap((f) =>
        trouverRatios(f, lireFichier(f))
      ).filter((o) => !estExtreme(o));

      // Compte exact mesuré sur ce lot (s387) : 39 occurrences intermédiaires.
      expect(intermediaires.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe("T2 — plus aucune énumération nominative après « cohésion »", () => {
    const NOM_APRES_COHESION_RE = /cohésion[^\n]*·\s*[A-ZÀ-Ý]/;
    const GABARIT_MESURE_RE = /cohésion \d(\.\d+)? · \d+ .+ mesurés s\d+/;

    it("jumelle-témoin : le regex détecte une énumération de prénoms", () => {
      expect(
        NOM_APRES_COHESION_RE.test("n = 4, cohésion 0.72 · Dahlia, Simon De Foix")
      ).toBe(true);
    });

    it("aucune ligne « cohésion » ne porte un mot capitalisé après le ·", () => {
      const lignesFautives = FICHIERS_CONTENU.flatMap((f) => {
        const lignes = lireFichier(f).split("\n");
        return lignes
          .map((ligne, index) => ({ fichier: f, ligne: index + 1, texte: ligne }))
          .filter(({ texte }) => NOM_APRES_COHESION_RE.test(texte));
      });

      expect(lignesFautives, JSON.stringify(lignesFautives, null, 2)).toHaveLength(0);
    });

    it("jumelle positive : le gabarit « n prêtres/mages mesurés sN » subsiste (≥ 4 lignes)", () => {
      const lignesConformes = FICHIERS_CONTENU.flatMap((f) =>
        lireFichier(f)
          .split("\n")
          .filter((ligne) => GABARIT_MESURE_RE.test(ligne))
      );

      expect(lignesConformes.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("T3 — plus aucune XP nominative", () => {
    const XP_NIVEAU_RE = /\(\d+,\s*niv\s*\d+\)/;

    it("jumelle-témoin : le regex détecte un motif « (XP, niv N) »", () => {
      expect(XP_NIVEAU_RE.test("Éléonore (85, niv 6)")).toBe(true);
    });

    it("aucun motif « (XP, niv N) » dans contenu/", () => {
      const occurrences = FICHIERS_CONTENU.flatMap((f) => {
        const lignes = lireFichier(f).split("\n");
        return lignes
          .map((ligne, index) => ({ fichier: f, ligne: index + 1, texte: ligne }))
          .filter(({ texte }) => XP_NIVEAU_RE.test(texte));
      });

      expect(occurrences, JSON.stringify(occurrences, null, 2)).toHaveLength(0);
    });
  });
});

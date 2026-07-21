import { GROUPES_OBJETS, objetsGenerateur, type GroupeObjets } from "@/moteurCreation/exigences";

/**
 * [VIS-8 lot 1] Écran de constat « Qu'as-tu apporté ? » — les cases de
 * `objets_generateur` (31 en prod), groupées et triées par le lecteur.
 *
 * Décisions portées (VIS-8 §5) : on demande ce que le joueur POSSÈDE, jamais
 * ce qu'il a le droit d'en faire ; raccourci « Je n'ai rien apporté → » en
 * tête ; l'inventaire reste modifiable partout ensuite (🎒, rattrapage).
 *
 * Dégradation douce : sur un snapshot antérieur au lot 0 (19 clés, JSON
 * committé), `objetsGenerateur()` est vide → petit mot + « Continuer » actif,
 * rien ne bloque (même contrat que le lecteur : rien de grisé).
 */

export const TITRES_GROUPES: Record<GroupeObjets, string> = {
  armes: "⚔️ Armes",
  protections: "🛡️ Protections",
  accessoires: "🎒 Accessoires de métier",
  costume: "🎭 Costume",
};

export interface CaseInventaireProps {
  id: string;
  libelle: string;
  cochee: boolean;
  onBasculer: (id: string) => void;
  taille?: "normale" | "compacte";
}

/** Case à cocher « pilule » — partagée entre l'écran et le sac 🎒. */
export const CaseInventaire = ({
  id,
  libelle,
  cochee,
  onBasculer,
  taille = "normale",
}: CaseInventaireProps) => (
  <button
    type="button"
    aria-pressed={cochee}
    onClick={() => onBasculer(id)}
    className={`rounded-lg border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-accent ${
      taille === "compacte" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-[13px]"
    } ${
      cochee
        ? "border-gold-dark bg-gold text-black"
        : "border-white/10 bg-white/5 text-white/80 hover:border-gold/40"
    }`}
  >
    {cochee ? "✓ " : ""}
    {libelle}
  </button>
);

interface EcranInventaireProps {
  inventaire: ReadonlySet<string>;
  onBasculer: (id: string) => void;
  onContinuer: () => void;
  /** « Je n'ai rien apporté » : vide l'inventaire ET continue. */
  onRien: () => void;
}

const EcranInventaire = ({
  inventaire,
  onBasculer,
  onContinuer,
  onRien,
}: EcranInventaireProps) => {
  const cases = objetsGenerateur();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h2 className="font-heading text-2xl text-gold">Qu'as-tu apporté ?</h2>
      <p className="mt-1 text-[13px] text-white/50">
        Coche ce que tu as sur toi ou dans ton sac. On ne te demande pas ce que
        tu as le droit d'en faire — juste ce que tu possèdes. Tu pourras{" "}
        <b className="text-white/80">toujours</b> en ajouter plus tard, d'un
        tap, au moment où quelque chose te manquera.
      </p>
      <button
        type="button"
        onClick={onRien}
        className="mb-4 mt-3 rounded-lg border border-white/15 px-3.5 py-2 text-sm text-white/80 transition-colors hover:border-gold/40"
      >
        Je n'ai rien apporté →
      </button>

      {cases.length === 0 && (
        <p className="mb-4 rounded-lg border border-gold/25 bg-gold/5 p-3 text-xs text-white/60">
          La liste d'équipement n'est pas disponible dans cette version des
          données — continue, rien ne sera grisé.
        </p>
      )}

      {GROUPES_OBJETS.map((grp) => {
        const duGroupe = cases.filter((c) => c.groupe === grp);
        if (duGroupe.length === 0) return null;
        return (
          <div
            key={grp}
            className="mb-3 rounded-xl border border-white/10 bg-card p-3"
          >
            <div className="mb-2 text-[11px] uppercase tracking-widest text-white/40">
              {TITRES_GROUPES[grp]}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {duGroupe.map((c) => (
                <CaseInventaire
                  key={c.id}
                  id={c.id}
                  libelle={c.libelle}
                  cochee={inventaire.has(c.id)}
                  onBasculer={onBasculer}
                />
              ))}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={onContinuer}
        className="mt-2 w-full rounded-lg bg-gold px-5 py-3 text-[15px] font-semibold text-black transition-colors hover:bg-gold-accent"
      >
        Continuer →
      </button>
    </div>
  );
};

export default EcranInventaire;

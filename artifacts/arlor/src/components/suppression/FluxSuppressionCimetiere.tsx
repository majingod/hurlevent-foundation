import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Skull,
  Trash2,
  Lock,
  AlertTriangle,
  Feather,
  ShieldAlert,
  Loader2,
  Check as CheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

/**
 * Flux de suppression intégré au Cimetière des Héros (s256).
 *
 * Écran unique partagé par les 3 points d'entrée (personnage / profil / compte).
 * - Single source of truth : `apercu_suppression(p_cible, p_id_cible)` fournit la
 *   liste des personnages concernés ET leur admissibilité. AUCUN calcul d'admissibilité
 *   n'est refait côté React.
 * - Pour chaque perso admissible : case « Élever une stèle » + épitaphe inline.
 * - Déjà en attente : verrouillé (pas de doublon). Non-admissibles : notés, sans stèle.
 * - Confirmation par une seule case à cocher, puis appel de
 *   `creer_steles_et_supprimer(p_cible, p_id_cible, p_demandes)` (contrat standard).
 */

export type CibleSuppression = "personnage" | "profil" | "compte";

interface PersoApercu {
  personnage_id: string;
  nom: string;
  race: string | null;
  profil_nom: string | null;
  admissible: boolean;
  deja_en_attente: boolean;
  est_mort: boolean;
}

interface DonneesSuppression {
  nb_steles_creees: number;
  nb_steles_existantes: number;
  nb_persos_supprimes: number;
}

interface Props {
  cible: CibleSuppression;
  idCible: string;
  titre: string;
  /** Affichage en page pleine (`/compte`) vs dans une modale (perso / profil). */
  variante?: "modale" | "page";
  /** Nettoyage spécifique au point d'entrée (invalidation, déconnexion…). */
  onSuccess: (donnees: DonneesSuppression) => void | Promise<void>;
  /** Bouton « Annuler » (modale seulement). */
  onAnnuler?: () => void;
}

interface ChoixStele {
  coche: boolean;
  epitaphe: string;
}

export default function FluxSuppressionCimetiere({
  cible,
  idCible,
  titre,
  variante = "modale",
  onSuccess,
  onAnnuler,
}: Props) {
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [persos, setPersos] = useState<PersoApercu[]>([]);
  const [choix, setChoix] = useState<Record<string, ChoixStele>>({});
  const [confirme, setConfirme] = useState(false);
  const [enCours, setEnCours] = useState(false);

  // Aperçu (single source of truth) — toujours frais à l'ouverture.
  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreurChargement(null);
    (async () => {
      const { data, error } = await supabase.rpc("apercu_suppression", {
        p_cible: cible,
        p_id_cible: idCible,
      });
      if (!actif) return;
      const res = data as
        | { succes: boolean; donnees: PersoApercu[] | null; erreurs?: { message: string }[] }
        | null;
      if (error || !res?.succes) {
        setErreurChargement(
          error?.message ?? res?.erreurs?.[0]?.message ?? "Impossible de charger l'aperçu.",
        );
        setChargement(false);
        return;
      }
      setPersos(res.donnees ?? []);
      setChargement(false);
    })();
    return () => {
      actif = false;
    };
  }, [cible, idCible]);

  const admissibles = useMemo(
    () => persos.filter((p) => p.admissible && !p.est_mort),
    [persos],
  );
  const nonAdmissibles = useMemo(
    () => persos.filter((p) => !p.admissible && !p.est_mort),
    [persos],
  );

  const toggle = (p: PersoApercu) => {
    if (p.deja_en_attente) return;
    setChoix((c) => ({
      ...c,
      [p.personnage_id]: {
        coche: !c[p.personnage_id]?.coche,
        epitaphe: c[p.personnage_id]?.epitaphe ?? "",
      },
    }));
  };

  const setEpitaphe = (p: PersoApercu, v: string) =>
    setChoix((c) => ({
      ...c,
      [p.personnage_id]: { coche: c[p.personnage_id]?.coche ?? true, epitaphe: v },
    }));

  // Payload = uniquement les persos admissibles cochés (les « déjà » ne repassent pas).
  const demandes = useMemo(
    () =>
      admissibles
        .filter((p) => !p.deja_en_attente && choix[p.personnage_id]?.coche)
        .map((p) => ({
          personnage_id: p.personnage_id,
          epitaphe: choix[p.personnage_id]?.epitaphe?.trim() || null,
        })),
    [admissibles, choix],
  );

  const intro =
    cible === "personnage"
      ? "Avant de supprimer ce personnage, tu peux lui élever une stèle au Cimetière des Héros."
      : "Avant la suppression, tu peux honorer tes personnages admissibles au Cimetière des Héros.";

  const lancer = async () => {
    if (!confirme || enCours) return;
    setEnCours(true);
    try {
      const { data, error } = await supabase.rpc("creer_steles_et_supprimer", {
        p_cible: cible,
        p_id_cible: idCible,
        p_demandes: demandes,
      });
      if (error) throw new Error(error.message);

      const res = data as {
        succes: boolean;
        erreurs?: { message: string }[];
        avertissements?: { message: string }[];
        donnees?: DonneesSuppression;
      } | null;

      if (!res?.succes) {
        toast.error(res?.erreurs?.[0]?.message ?? "La suppression a échoué.");
        setEnCours(false);
        return;
      }

      // Avertissements non bloquants (non-admissibles supprimés sans stèle, etc.).
      (res.avertissements ?? []).forEach((a) => toast.warning(a.message));

      const d = res.donnees ?? {
        nb_steles_creees: 0,
        nb_steles_existantes: 0,
        nb_persos_supprimes: 0,
      };
      if (d.nb_steles_creees > 0) {
        toast.success(
          d.nb_steles_creees === 1
            ? "Une stèle a été envoyée au staff pour validation."
            : `${d.nb_steles_creees} stèles ont été envoyées au staff pour validation.`,
        );
      }

      await onSuccess(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
      setEnCours(false);
    }
  };

  const wrapper = variante === "page" ? "" : "px-1";

  if (chargement) {
    return (
      <div className={`flex items-center justify-center py-10 text-muted-foreground ${wrapper}`}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Chargement…
      </div>
    );
  }

  if (erreurChargement) {
    return (
      <div className={wrapper}>
        <div className="flex gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p>{erreurChargement}</p>
        </div>
        {onAnnuler && (
          <Button variant="outline" className="mt-4 w-full" onClick={onAnnuler}>
            Fermer
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={wrapper}>
      {/* En-tête */}
      <div className="mb-1.5 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-destructive/60 bg-destructive/10">
          <Trash2 className="h-[18px] w-[18px] text-destructive" />
        </div>
        <h2 className="m-0 font-heading text-xl font-bold text-foreground">{titre}</h2>
      </div>
      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{intro}</p>

      {/* Bloc Cimetière */}
      {admissibles.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-0.5 flex items-center gap-2">
            <Skull className="h-[15px] w-[15px] text-gold" />
            <h3 className="m-0 font-heading text-[15px] font-semibold tracking-wide text-gold">
              Cimetière des Héros
            </h3>
          </div>
          <p className="mb-3.5 text-xs leading-relaxed text-muted-foreground">
            Une stèle conserve la mémoire du personnage. Le staff la validera ensuite.
          </p>

          <div className="flex flex-col gap-2.5">
            {admissibles.map((p) => {
              const on = p.deja_en_attente || !!choix[p.personnage_id]?.coche;
              return (
                <div
                  key={p.personnage_id}
                  className={`overflow-hidden rounded-xl border transition-colors ${
                    on ? "border-gold bg-gold/10" : "border-border bg-background"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(p)}
                    disabled={p.deja_en_attente}
                    className={`flex w-full items-center gap-3 p-3 text-left ${
                      p.deja_en_attente ? "cursor-default" : "cursor-pointer"
                    }`}
                  >
                    <span
                      className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border-[1.5px] ${
                        on ? "border-gold bg-gold" : "border-border bg-transparent"
                      }`}
                    >
                      {on &&
                        (p.deja_en_attente ? (
                          <Lock className="h-3 w-3 text-background" />
                        ) : (
                          <CheckIcon className="h-3 w-3 text-background" strokeWidth={3.2} />
                        ))}
                    </span>
                    <span className="flex-1">
                      <span className="block text-[15px] font-semibold text-foreground">{p.nom}</span>
                      <span className="block text-xs text-muted-foreground">
                        {p.race ?? "—"}
                        {p.profil_nom ? ` · profil ${p.profil_nom}` : ""}
                      </span>
                    </span>
                    {p.deja_en_attente ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-[11.5px] text-gold">
                        <Lock className="h-3 w-3" /> Demande déjà envoyée
                      </span>
                    ) : (
                      <span className={`text-[11.5px] ${on ? "text-gold" : "text-muted-foreground"}`}>
                        {on ? "Stèle incluse" : "Élever une stèle"}
                      </span>
                    )}
                  </button>

                  {on && !p.deja_en_attente && (
                    <div className="px-3.5 pb-3.5 pl-[46px]">
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Feather className="h-3 w-3 text-gold" /> Épitaphe (optionnelle)
                      </div>
                      <Textarea
                        value={choix[p.personnage_id]?.epitaphe ?? ""}
                        onChange={(e) => setEpitaphe(p, e.target.value)}
                        placeholder="« Tombé au combat, fidèle jusqu'au bout… »"
                        rows={2}
                        className="resize-y text-sm"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Note non-admissibles */}
      {nonAdmissibles.length > 0 && (
        <div className="mt-3.5 flex gap-2.5 rounded-lg border border-border bg-muted p-3.5">
          <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="m-0 text-[12.5px] leading-relaxed text-muted-foreground">
            {nonAdmissibles.length === 1 ? (
              <>
                <strong className="text-foreground">{nonAdmissibles[0].nom}</strong> n'a participé à
                aucun événement : il sera supprimé sans stèle.
              </>
            ) : (
              <>
                <strong className="text-foreground">{nonAdmissibles.length} personnages</strong> n'ont
                participé à aucun événement ({nonAdmissibles.map((p) => p.nom).join(", ")}) : ils
                seront supprimés sans stèle.
              </>
            )}
          </p>
        </div>
      )}

      {/* Avertissement table rase (compte) */}
      {cible === "compte" && (
        <div className="mt-3.5 flex gap-2.5 rounded-lg border border-destructive/60 bg-destructive/10 p-3.5">
          <ShieldAlert className="mt-px h-[17px] w-[17px] shrink-0 text-destructive" />
          <p className="m-0 text-[12.5px] leading-relaxed text-foreground">
            <strong className="text-destructive">Effacement définitif.</strong> Ton compte, tes
            profils et tous tes personnages seront supprimés sans retour. Ton courriel sera libéré (tu
            pourras te réinscrire plus tard). Les stèles validées au Cimetière, elles, demeurent.{" "}
            <Link to="/confidentialite" className="text-gold underline underline-offset-2">
              Droit à l'effacement
            </Link>
            .
          </p>
        </div>
      )}

      {/* Confirmation */}
      <div className="mt-6 border-t border-border pt-4">
        <label className="mb-4 flex cursor-pointer items-start gap-2.5">
          <Checkbox
            checked={confirme}
            onCheckedChange={(v) => setConfirme(v === true)}
            className="mt-0.5"
          />
          <span className="text-sm leading-snug text-foreground">
            Je comprends que cette action est <strong>définitive</strong> et ne peut pas être annulée.
          </span>
        </label>

        <div className="flex flex-col gap-2">
          <Button
            variant="destructive"
            className="w-full font-heading tracking-wide"
            disabled={!confirme || enCours}
            onClick={lancer}
          >
            {enCours ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Supprimer définitivement
          </Button>
          {onAnnuler && (
            <Button variant="outline" className="w-full" disabled={enCours} onClick={onAnnuler}>
              Annuler
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

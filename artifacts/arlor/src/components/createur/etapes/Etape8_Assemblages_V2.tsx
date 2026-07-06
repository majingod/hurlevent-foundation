import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clientActif } from "@/creation/clientActif";
import type { Database } from "@/integrations/supabase/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ChevronRight } from "lucide-react";
import { COUT_ASSEMBLAGE_SUPPLEMENTAIRE } from "@/constants/artisanat";
import { BadgeAcquis } from "@/components/createur/BadgeAcquis";
import { LabelAjoutAnnulable } from "@/components/createur/LabelAjoutAnnulable";
import { useDernierePhotoCompo } from "@/hooks/useDernierePhotoCompo";
import { estAssemblageAcquis } from "@/lib/acquisCampagne";
import { QuickFacts } from "@/components/shared/QuickFacts";
import { EffetBox } from "@/components/shared/EffetBox";
import { BlocMaitrise } from "@/components/shared/BlocMaitrise";
import BasculeAbregeIntegral from "@/components/shared/BasculeAbregeIntegral";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { useModeAffichage } from "@/contexts/ModeAffichageContext";
import JaugeXP from "@/components/createur/aide/JaugeXP";
import IntroEtape, {
  IntroEtapeItem,
} from "@/components/createur/aide/IntroEtape";
import Astuce from "@/components/createur/aide/Astuce";
import { TapBulle, useTapBulle } from "@/components/createur/aide/TapBulle";
import { PastilleCout } from "@/components/createur/artisanat/PastilleCout";
import LegendeArtisanat, {
  type EntreeLegende,
} from "@/components/createur/artisanat/LegendeArtisanat";

/** assemblages_runes.duree (s177, D5) absent des types générés — augmentation
 * locale, même convention que effet_instance (cf. Etape6/7). Resync global =
 * dette RESYNC-TYPES-SUPABASE. */
type AssemblageRow = Database["public"]["Tables"]["assemblages_runes"]["Row"] & {
  duree: string | null;
};
type PersonnageAssemblageRow =
  Database["public"]["Tables"]["personnage_assemblages"]["Row"];
type QuotasRow = Database["public"]["Views"]["vue_artisanat_quotas"]["Row"];

/** Strip du préfixe « Assemblage de/du/… » (redondant dans l'étape « Assemblage
 * de Runes ») + capitalise l'initiale. La base garde le nom canonique du manuel
 * (RÉVISION-FIDÉLITÉ s188). */
const nomCourtAssemblage = (nom: string | null): string => {
  if (!nom) return "";
  const c = nom
    .replace(/^Assemblage\s+(?:de\s+la\s+|de\s+l['']|des\s+|du\s+|de\s+|d[''])/i, "")
    .trim();
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : nom;
};

interface Etape8Props {
  personnageId: string;
  /**
   * XP disponible du personnage (xp_total - xp_depense, ajuste du delta
   * courant). Calcule par PersonnageNouveauV2.tsx. Sert a griser le
   * bouton « Acheter » quand XP insuffisant. Fallback 0 = bloque par
   * defaut si la prop manque.
   */
  xpDisponible?: number;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onPrevious?: () => void;
  /**
   * Mode campagne (évolution) : verrouille visuellement le désachat des
   * assemblages acquis (PR-C2). Miroir d'INV-3 backend, qui reste l'autorité.
   */
  modeCampagne?: boolean;
}

const Etape8_Assemblages_V2 = ({
  personnageId,
  xpDisponible = 0,
  onSuccess,
  onError,
  onPrevious,
  modeCampagne = false,
}: Etape8Props) => {
  const queryClient = useQueryClient();
  const { mode, toggleMode } = useModeAffichage();

  // PR-C2 : photo de compo (frontière des acquis). Fetch seulement en campagne.
  const { data: photo } = useDernierePhotoCompo(personnageId, modeCampagne);

  // Quotas (vue_artisanat_quotas)
  const { data: quotas, isLoading: loadingQuotas } = useQuery({
    queryKey: ["artisanat-quotas", personnageId],
    queryFn: async () => {
      const { data, error } = await clientActif.lireArtisanatQuotas(
        personnageId,
      );
      if (error) throw error;
      return data as QuotasRow | null;
    },
    enabled: !!personnageId,
  });

  const niveauRunes = quotas?.niveau_runes ?? 0;
  const quotaAssemblagesTotal = quotas?.quota_assemblages_total ?? 0;
  const hasAssemblage = niveauRunes >= 1;

  // Liste des assemblages de runes
  const { data: assemblages, isLoading: loadingAssemblages, isError: assemblagesError, refetch: refetchAssemblages } = useQuery({
    queryKey: ["assemblages-runes"],
    queryFn: async () => {
      const { data, error } = await clientActif.lireAssemblagesRunes();
      if (error) throw error;
      return (data ?? []) as AssemblageRow[];
    },
    enabled: hasAssemblage,
  });

  // Assemblages déjà acquis par le personnage
  const { data: personnageAssemblages, isLoading: loadingPersoAssemblages } =
    useQuery({
      queryKey: ["personnage-assemblages", personnageId],
      queryFn: async () => {
        const { data, error } = await clientActif.lirePersonnageAssemblages(
          personnageId,
        );
        if (error) throw error;
        return (data ?? []) as PersonnageAssemblageRow[];
      },
      enabled: !!personnageId && hasAssemblage,
    });

  // Map assemblage_id → personnage_assemblage (pour pouvoir désacheter)
  const assemblagesAcquisParAssemblageId = useMemo(() => {
    const map = new Map<string, PersonnageAssemblageRow>();
    (personnageAssemblages ?? []).forEach((a) => {
      map.set(a.assemblage_id, a);
    });
    return map;
  }, [personnageAssemblages]);

  const nbGratuits = [...assemblagesAcquisParAssemblageId.values()].filter((a) => a.est_gratuit).length;
  const quotaRestant = Math.max(0, quotaAssemblagesTotal - nbGratuits);

  const acheterMutation = useMutation({
    mutationFn: async (params: {
      p_personnage_id: string;
      p_assemblage_id: string;
    }) => {
      const { data, error } = await clientActif.acheterAssemblage(params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalide toutes les queries qui contiennent personnageId dans leur
      // clef. Cela couvre ["personnage-assemblages", id], ["artisanat-quotas", id]
      // ET ["v2-personnage", id] du parent (header XP), sans avoir a lister
      // chaque queryKey explicitement.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Assemblage acquis !");
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const desacheterMutation = useMutation({
    mutationFn: async (params: {
      p_personnage_assemblage_id: string;
    }) => {
      const { data, error } = await clientActif.desacheterAssemblage(params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Assemblage retiré.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  // Avance etape_creation de 8 a 9 cote serveur. Les etapes 5-9 n'ont pas
  // de sauvegarder_etape_N : sans cet appel, le bouton « Suivant » ne ferait
  // que relire etape_creation et resterait bloque sur l'etape courante.
  const avancerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await clientActif.avancerEtape({
        p_personnage_id: personnageId,
        p_etape_courante: 8,
      });
      if (error) throw error;
      const payload = (data ?? {}) as Record<string, any>;
      if (payload.succes !== true) {
        const msg =
          (payload.erreurs?.[0]?.message as string | undefined) ??
          (payload.erreurs?.[0]?.code as string | undefined) ??
          "Impossible de passer a l'etape suivante.";
        throw new Error(msg);
      }
      return payload;
    },
    onSuccess: (payload) => {
      const avertissements =
        (payload?.avertissements as Array<{ message?: string }> | undefined) ??
        [];
      if (avertissements[0]?.message) toast.info(avertissements[0].message);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const handleToggle = (assemblage: AssemblageRow, acquis: PersonnageAssemblageRow | undefined) => {
    if (acquis) {
      // PR-C2 : garde défensive — un assemblage scellé par la photo ne peut
      // être retiré (le backend INV-3 refuserait de toute façon).
      if (estAssemblageAcquis(modeCampagne, photo, assemblage.id)) {
        toast.error(
          "Cet acquis a été joué en événement — il ne peut plus être retiré.",
        );
        return;
      }
      // Désacheter
      desacheterMutation.mutate({ p_personnage_assemblage_id: acquis.id });
    } else {
      // Acheter (le serveur décide gratuit vs payant selon quota)
      acheterMutation.mutate({
        p_personnage_id: personnageId,
        p_assemblage_id: assemblage.id,
      });
    }
  };

  // Couche aide (Lot B, s183) — état purement présentationnel, sans impact sur
  // la logique de données. Accordéon : pattern Set manuel + chevron (gotcha
  // s152, jamais de Radix Accordion avec enfants interactifs).
  const [catOuvert, setCatOuvert] = useState(true);
  const [rangsOuverts, setRangsOuverts] = useState<Set<string>>(new Set());
  const toggleRang = (id: string) =>
    setRangsOuverts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  // L2 — bulle d'aide au tap (un symbole tappable → explication sticky bottom).
  const { aide, montrer: montrerAide, fermer: fermerAide } = useTapBulle();

  if (loadingQuotas) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Chargement des quotas d'assemblages…
      </div>
    );
  }

  if (!hasAssemblage) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">
              Assemblages de runes
            </CardTitle>
            <CardDescription>
              Vous ne possédez pas la compétence « Assemblage de Runes ». Vous
              pouvez passer à l'étape suivante.
            </CardDescription>
          </CardHeader>
        </Card>
        <div className="flex justify-between pt-4">
          {onPrevious && (
            <Button variant="outline" onClick={onPrevious}>
              ← Précédent
            </Button>
          )}
          <Button
            className="ml-auto"
            onClick={() => avancerMutation.mutate()}
            disabled={avancerMutation.isPending}
          >
            {avancerMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Suivant →
          </Button>
        </div>
      </div>
    );
  }

  const mutationsPending = acheterMutation.isPending || desacheterMutation.isPending;

  // Couche aide (Lot B, s183) — dérivations purement présentationnelles.
  const maitriseDebloquee = niveauRunes >= 3;
  const acquisList = [...assemblagesAcquisParAssemblageId.values()];
  const nbScelles = modeCampagne
    ? acquisList.filter((a) =>
        estAssemblageAcquis(modeCampagne, photo, a.assemblage_id),
      ).length
    : 0;
  const nbAnnulables = modeCampagne
    ? acquisList.filter(
        (a) => !estAssemblageAcquis(modeCampagne, photo, a.assemblage_id),
      ).length
    : 0;

  // L1 — légende dirigée par les données : sections Coût / Vos assemblages
  // (campagne, si acquis) / Symboles. La ligne ⭐ varie selon le déblocage niv 3.
  const legende: EntreeLegende[] = [
    { section: "Coût" },
    {
      sym: <PastilleCout gratuit xp={COUT_ASSEMBLAGE_SUPPLEMENTAIRE} />,
      texte: `Compris dans votre quota gratuit (${quotaAssemblagesTotal} au niveau ${niveauRunes}).`,
    },
    {
      sym: <PastilleCout gratuit={false} xp={COUT_ASSEMBLAGE_SUPPLEMENTAIRE} />,
      texte: `Quota épuisé : ${COUT_ASSEMBLAGE_SUPPLEMENTAIRE} XP, remboursés si retiré.`,
    },
    ...(modeCampagne && (nbScelles > 0 || nbAnnulables > 0)
      ? ([
          { section: "Vos assemblages" },
          ...(nbScelles > 0
            ? [
                {
                  sym: "or",
                  texte: (
                    <span>
                      <strong className="text-gold">Fond doré 🔒</strong> —
                      scellé à un GN : ne peut plus être retiré.
                    </span>
                  ),
                },
              ]
            : []),
          ...(nbAnnulables > 0
            ? [
                {
                  sym: "vert",
                  texte: (
                    <span>
                      <strong className="text-emerald-400">Fond vert ＋</strong>{" "}
                      — ajout encore annulable (XP remboursés).
                    </span>
                  ),
                },
              ]
            : []),
        ] as EntreeLegende[])
      : []),
    { section: "Symboles" },
    {
      sym: <span className="text-[13px]">⭐</span>,
      texte: maitriseDebloquee
        ? "Maîtrise : effet renforcé débloqué par votre niveau 3 — coût en PS propre à chaque assemblage."
        : "Maîtrise : effet renforcé du niveau 3 — affiché grisé tant qu'il n'est pas débloqué.",
    },
    {
      sym: <span className="text-[11px] font-bold text-muted-foreground">PS</span>,
      texte: "Points de spiritualité : dépensés à chaque activation en jeu.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* I4 — Jauge XP sticky */}
      <JaugeXP xpDisponible={xpDisponible} />

      <BasculeAbregeIntegral mode={mode} onToggle={toggleMode} />

      {assemblagesError && <ErreurChargement onRetry={() => refetchAssemblages()} />}

      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Assemblages de runes
        </h2>
        <p className="text-sm text-muted-foreground">
          Sélectionnez vos assemblages gratuits et complétez avec des
          assemblages payants si vous le souhaitez.
        </p>
      </div>

      {/* W1 — Introduction d'étape */}
      <IntroEtape
        storageKey="hv-e8-intro-replie"
        titre="Comment fonctionne cette étape ?"
      >
        <IntroEtapeItem n={1}>
          Votre compétence{" "}
          <strong>Assemblage de Runes niveau {niveauRunes}</strong> vous donne{" "}
          <strong>{quotaAssemblagesTotal} assemblages gratuits</strong>.
        </IntroEtapeItem>
        <IntroEtapeItem n={2}>
          Touchez un assemblage pour déplier sa fiche complète : effet, cible,
          durée, coût en <strong>PS</strong> et runes.
        </IntroEtapeItem>
        <IntroEtapeItem n={3}>
          Cochez pour l'apprendre — gratuit tant qu'il reste du quota, sinon{" "}
          <strong>{COUT_ASSEMBLAGE_SUPPLEMENTAIRE} XP</strong> (remboursés si
          retiré).
        </IntroEtapeItem>
        <IntroEtapeItem n={4}>
          Chaque assemblage a un effet de <strong>Maîtrise ⭐</strong> renforcé,
          débloqué au <strong>niveau 3</strong> — affiché grisé avant.
        </IntroEtapeItem>
        {modeCampagne && (
          <IntroEtapeItem n={5}>
            Un assemblage <strong>joué en GN</strong> est scellé{" "}
            <strong className="text-gold">🔒</strong> ; un ajout récent{" "}
            <strong className="text-emerald-400">＋</strong> reste annulable.
          </IntroEtapeItem>
        )}
      </IntroEtape>

      {/* L1 — Légende des symboles */}
      <LegendeArtisanat storageKey="hv-e8-legende-replie" entrees={legende} />

      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={() => setCatOuvert((o) => !o)}
          className="flex w-full flex-wrap items-center gap-2 px-3.5 py-3 text-left"
        >
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${catOuvert ? "rotate-90" : ""}`}
          />
          <span className="flex-1 font-heading text-base font-semibold text-foreground">
            Assemblage de Runes
          </span>
          <span
            className={`whitespace-nowrap rounded-full border px-2 py-px text-[10.5px] font-bold ${
              quotaRestant > 0
                ? "border-primary/50 text-primary"
                : "border-amber-400/50 text-amber-400"
            }`}
          >
            {nbGratuits}/{quotaAssemblagesTotal} gratuits
          </span>
        </button>

        {catOuvert && (
          <div>
            {/* W3 — Astuce en tête de liste */}
            <Astuce
              storageKey="hv-e8-astuce-cat-vue"
              texte="Touchez un assemblage pour lire sa fiche. La pastille indique s'il est gratuit (quota) ou payant en XP."
            />

            <div className="pb-1">
              {loadingAssemblages || loadingPersoAssemblages ? (
                <div className="flex items-center px-3 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Chargement des assemblages…
                </div>
              ) : (assemblages ?? []).length === 0 ? (
                <p className="px-3 py-2.5 text-sm text-muted-foreground">
                  Aucun assemblage disponible.
                </p>
              ) : (
                (assemblages ?? []).map((assemblage) => {
                  const acquis = assemblagesAcquisParAssemblageId.get(
                    assemblage.id,
                  );
                  const estAcquis = !!acquis;
                  const estGratuit = acquis?.est_gratuit ?? false;
                  const seraGratuit = !estAcquis && quotaRestant > 0;
                  const xpInsuffisants =
                    !seraGratuit &&
                    !estAcquis &&
                    COUT_ASSEMBLAGE_SUPPLEMENTAIRE > xpDisponible;
                  // PR-C2 : assemblage scellé par la photo de compo.
                  const scelle = estAssemblageAcquis(
                    modeCampagne,
                    photo,
                    assemblage.id,
                  );
                  const pastilleGratuit = estAcquis ? estGratuit : seraGratuit;
                  const open = rangsOuverts.has(assemblage.id);

                  return (
                    <div
                      key={assemblage.id}
                      className={`border-t border-border transition-colors ${
                        scelle
                          ? "border-l-4 border-l-gold bg-gold/15"
                          : estAcquis
                            ? modeCampagne
                              ? "border-l-[3px] border-l-emerald-600/60 bg-emerald-600/10"
                              : "bg-primary/5"
                            : ""
                      }`}
                    >
                      {/* Ligne de repli (toujours visible) */}
                      <div
                        onClick={() => toggleRang(assemblage.id)}
                        className="flex cursor-pointer items-start gap-2 px-3 py-2.5"
                      >
                        <ChevronRight
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
                        />
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                          <strong className="font-heading text-sm text-primary">
                            {nomCourtAssemblage(assemblage.nom)}
                          </strong>
                          <PastilleCout
                            gratuit={pastilleGratuit}
                            xp={COUT_ASSEMBLAGE_SUPPLEMENTAIRE}
                            onAide={montrerAide}
                          />
                          {scelle && <BadgeAcquis />}
                          {!scelle && estAcquis && modeCampagne && (
                            <LabelAjoutAnnulable />
                          )}
                        </div>
                        <label
                          onClick={(e) => e.stopPropagation()}
                          className={`flex shrink-0 items-center ${xpInsuffisants ? "opacity-50" : ""}`}
                          title={
                            xpInsuffisants
                              ? `XP insuffisants (manque ${COUT_ASSEMBLAGE_SUPPLEMENTAIRE - xpDisponible} XP)`
                              : undefined
                          }
                        >
                          <Checkbox
                            checked={estAcquis}
                            disabled={
                              mutationsPending || xpInsuffisants || scelle
                            }
                            onCheckedChange={() =>
                              handleToggle(assemblage, acquis)
                            }
                            aria-label={`Sélectionner ${assemblage.nom ?? "l'assemblage"}`}
                          />
                        </label>
                      </div>

                      {/* Glance (replié) — clic ouvre aussi la rangée */}
                      {!open && assemblage.effet && (
                        <p
                          onClick={() => toggleRang(assemblage.id)}
                          className="cursor-pointer px-3 pb-2.5 pl-[34px] text-xs leading-snug text-muted-foreground"
                        >
                          {assemblage.effet}
                        </p>
                      )}

                      {/* Fiche complète (ouvert) */}
                      {open && (
                        <div className="ml-3 space-y-2 border-l-[3px] border-primary pb-3 pl-3 pr-3 pt-1">
                          <QuickFacts
                            facts={[
                              { label: "Cible", value: assemblage.cible },
                              { label: "Durée", value: assemblage.duree },
                              { label: "Coût PS", value: assemblage.cout_ps },
                              {
                                label: "Runes",
                                value:
                                  assemblage.runes_requises &&
                                  assemblage.runes_requises.length > 0
                                    ? assemblage.runes_requises.join(", ")
                                    : null,
                              },
                            ]}
                          />
                          {(assemblage.resume_condense || assemblage.texte_manuel) && (
                            <EffetBox>
                              {mode === "integral"
                                ? assemblage.texte_manuel ?? assemblage.resume_condense
                                : assemblage.resume_condense ?? assemblage.texte_manuel}
                            </EffetBox>
                          )}
                          <BlocMaitrise
                            effetMaitrise={assemblage.effet_maitrise}
                            coutPsMaitrise={assemblage.cout_ps_maitrise}
                            debloque={maitriseDebloquee}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </Card>

      {/* L2 — Bulle d'aide au tap (sticky bottom) */}
      <TapBulle aide={aide} onClose={fermerAide} />

      <div className="flex justify-between pt-4">
        {onPrevious && (
          <Button variant="outline" onClick={onPrevious}>
            ← Précédent
          </Button>
        )}
        <Button
          className="ml-auto"
          onClick={() => avancerMutation.mutate()}
          disabled={avancerMutation.isPending}
        >
          {avancerMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Suivant →
        </Button>
      </div>
    </div>
  );
};

export default Etape8_Assemblages_V2;

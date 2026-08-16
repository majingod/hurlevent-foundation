import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Info, AlertTriangle } from "lucide-react";
import ReligionDetails from "@/components/shared/ReligionDetails";

import { clientActif } from "@/creation/clientActif";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import IntroEtape, { IntroEtapeItem } from "@/components/createur/aide/IntroEtape";
import SectionCard from "@/components/createur/aide/SectionCard";
import { BadgeFige, BadgeModifiable } from "@/components/createur/aide/BadgesCampagne";
import type { EtapeProps } from "@/pages/PersonnageNouveauV2";
import ForgeNomsDialog from "@/components/createur/forgeNoms/ForgeNomsDialog";
import {
  TEXTES as TEXTES_FORGE,
  raceForgeDepuisNom,
} from "@/components/createur/forgeNoms/logique";
import type { SousTypeChimeride } from "@/components/createur/forgeNoms/noms";

// =========================================================================
// CONSTANTES DE CALCUL XP/NIVEAU — RATTRAPAGE (pré-plateforme)
// Valeurs fixes du manuel pour les présences faites AVANT que la plateforme
// ne suive les inscriptions/confirmations. Ce ne sont PAS des estimatifs et
// elles ne sont PAS attribuées par un animateur : elles fixent l'XP et le
// niveau de DÉPART du personnage. Section temporaire (cf. dette
// RETIRER-SECTION-RATTRAPAGE-XP) : à retirer / passer admin-only une fois que
// plus aucun joueur n'a de présences pré-plateforme.
// =========================================================================
const XP_GN_REGULIER = 15;
const XP_MINI_GN = 15;
const XP_OUVERTURE_TERRAIN = 10;
const NIVEAU_BASE = 1;

// --- Affordance du mode campagne, au niveau du champ (Lot A, s185) ---
// Figé = champ verrouillé (assombri + badge gris). Modifiable = champ encore
// éditable (pleine luminosité + badge). Pas d'or (= scellé) ni d'émeraude
// (= ajout annulable) ici, pour ne pas heurter le langage visuel campagne.
const champClass = (modeCampagne: boolean, editable: boolean) => {
  if (!modeCampagne) return "bg-white/5 border-white/10";
  return editable
    ? "bg-white/[0.06] border-white/20"
    : "bg-white/[0.02] border-white/[0.06] opacity-[0.45] pointer-events-none";
};

const FieldLabel = ({
  htmlFor,
  modeCampagne,
  editable,
  children,
}: {
  htmlFor?: string;
  modeCampagne: boolean;
  editable: boolean;
  children: ReactNode;
}) => (
  <div className="flex items-center justify-between gap-2">
    <Label htmlFor={htmlFor} className="text-base text-gold">
      {children}
    </Label>
    {modeCampagne && (editable ? <BadgeModifiable /> : <BadgeFige />)}
  </div>
);

interface Etape1Form {
  nom: string;
  gn_completes: number;
  mini_gn_completes: number;
  ouvertures_terrain: number;
  est_croyant: "oui" | "non" | "";
  religion_id: string;
  historique: string;
  ame_personnage: string;
}

const Etape1_V2 = ({
  personnageId,
  onSuccess,
  onXpGainChange,
  modeCampagne = false,
  rattrapageFige = false,
  onRaceForgee,
}: EtapeProps & {
  modeCampagne?: boolean;
  rattrapageFige?: boolean;
  /**
   * [s406] La Forge des noms a servi sur un personnage SANS race : remonte le
   * NOM de la race choisie (présélection d'écran pour l'étape 2, rien d'écrit).
   */
  onRaceForgee?: (raceNom: string) => void;
}) => {
  // Compteurs de rattrapage figés en campagne OU dès qu'inscrit à un événement.
  const compteursFiges = modeCampagne || rattrapageFige;
  const [submitting, setSubmitting] = useState(false);
  // M3a PR-C1 : valeurs d'identité figées en campagne (INV-4). On capture les
  // valeurs DB d'origine au chargement pour les renvoyer telles quelles au RPC,
  // quoi qu'il arrive côté formulaire (garantie anti-identite_figee_campagne).
  const valeursFigees = useRef<{
    nom: string;
    gn_completes: number;
    mini_gn_completes: number;
    ouvertures_terrain: number;
    est_croyant: boolean | null;
    religion_id: string | null;
  } | null>(null);
  // XP des GN/mini-GN/ouvertures DÉJÀ sauvegardé (donc déjà inclus dans xp_total serveur).
  // Sert à ne remonter au header que la portion NON sauvegardée (évite le double-compte).
  const [gainSauvegarde, setGainSauvegarde] = useState(0);
  const [religionManuelOpen, setReligionManuelOpen] = useState(false);
  // [s406] La Forge des noms — un SEUL point d'accès (décision Ⓐ s405), sous
  // le champ nom, visible ssi le nom est éditable (il se fige à la première
  // présence en jeu = mode campagne). Rien ne s'écrit depuis la Forge.
  const [forgeOuverte, setForgeOuverte] = useState(false);

  // Autosave brouillon (anti-perte sur reload / SW autoUpdate) : ne pas
  // déclencher avant le 1er chargement (reset), sinon on écraserait la DB
  // avec les defaults vides du formulaire.
  const pretAutosave = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<Etape1Form>({
    defaultValues: {
      nom: "",
      gn_completes: 0,
      mini_gn_completes: 0,
      ouvertures_terrain: 0,
      est_croyant: "",
      religion_id: "",
      historique: "",
      ame_personnage: "",
    },
  });

  const estCroyant = watch("est_croyant");

  // Watch temps réel des compteurs d'événements pour le bloc récapitulatif
  const gnCompletes = Number(watch("gn_completes")) || 0;
  const miniGnCompletes = Number(watch("mini_gn_completes")) || 0;
  const ouverturesTerrain = Number(watch("ouvertures_terrain")) || 0;

  const niveauActuel = NIVEAU_BASE + gnCompletes;
  const xpGn = gnCompletes * XP_GN_REGULIER;
  const xpMiniGn = miniGnCompletes * XP_MINI_GN;
  const xpOuvertures = ouverturesTerrain * XP_OUVERTURE_TERRAIN;

  // Remonte l'XP gagné estimé au header parent, en temps réel
  useEffect(() => {
    const gainEstime = xpGn + xpMiniGn + xpOuvertures;
    onXpGainChange?.(gainEstime - gainSauvegarde);
  }, [xpGn, xpMiniGn, xpOuvertures, gainSauvegarde, onXpGainChange]);

  // Charger les religions actives
  const { data: religions = [], isLoading: loadingReligions } = useQuery({
    queryKey: ["v2-religions"],
    queryFn: async () => {
      const { data, error } = await clientActif.lireReligionsCatalogue();
      if (error) throw error;
      return data ?? [];
    },
  });

  // [s406] Race du personnage : la Forge des noms la SUIT quand elle existe
  // (contrat Fred s405). Le catalogue (clé partagée avec l'étape 2) résout
  // race_id → nom. Inutile quand le nom est figé : pas de bouton.
  const { data: persoRace } = useQuery({
    queryKey: ["v2-forge-race", personnageId],
    enabled: !modeCampagne,
    queryFn: async () => {
      const { data, error } = await clientActif.lirePersonnageRace(personnageId);
      if (error) throw error;
      return data;
    },
  });
  const { data: racesCatalogue = [] } = useQuery({
    queryKey: ["v2-races"],
    enabled: !modeCampagne,
    queryFn: async () => {
      const { data, error } = await clientActif.lireRaces();
      if (error) throw error;
      return data ?? [];
    },
  });
  const raceNomPerso =
    (racesCatalogue as { id: string; nom: string }[]).find(
      (r) => r.id === ((persoRace?.race_id as string | null) ?? null),
    )?.nom ?? null;
  const raceFigeeForge = raceForgeDepuisNom(raceNomPerso);
  const sousTypeFigeForge =
    ((persoRace?.sous_type_chimeride ?? null) as SousTypeChimeride | null);

  // Pré-remplir avec les valeurs déjà sauvegardées sur le brouillon
  useEffect(() => {
    const charger = async () => {
      const { data } = await clientActif.lirePersonnageIdentite(personnageId);
      if (!data) return;
      // Garder les valeurs DB d'origine des 6 champs figés (INV-4) pour le submit campagne.
      valeursFigees.current = {
        nom: data.nom ?? "",
        gn_completes: data.gn_completes ?? 0,
        mini_gn_completes: data.mini_gn_completes ?? 0,
        ouvertures_terrain: data.ouvertures_terrain ?? 0,
        est_croyant: data.est_croyant ?? null,
        religion_id: data.religion_id ?? null,
      };
      reset({
        nom: data.nom ?? "",
        gn_completes: data.gn_completes ?? 0,
        mini_gn_completes: data.mini_gn_completes ?? 0,
        ouvertures_terrain: data.ouvertures_terrain ?? 0,
        est_croyant:
          data.est_croyant === true
            ? "oui"
            : data.est_croyant === false
            ? "non"
            : "",
        religion_id: data.religion_id ?? "",
        historique: data.historique ?? "",
        ame_personnage: data.ame_personnage ?? "",
      });
      setGainSauvegarde(
        (data.gn_completes ?? 0) * XP_GN_REGULIER +
          (data.mini_gn_completes ?? 0) * XP_MINI_GN +
          (data.ouvertures_terrain ?? 0) * XP_OUVERTURE_TERRAIN
      );
      pretAutosave.current = true;
    };
    charger();
  }, [personnageId, reset]);

  // Autosave brouillon : persiste les champs au fil de la saisie SANS valider
  // ni avancer (p_brouillon=true). Débouncé → au pire on perd la dernière
  // fraction de seconde de frappe. Erreurs de validation ignorées (silencieux).
  const sauvegarderBrouillon = useCallback(() => {
    if (!pretAutosave.current) return;
    const v = watch();
    const figees = modeCampagne ? valeursFigees.current : null;
    const cFiges = compteursFiges ? valeursFigees.current : null;
    const croyant = figees ? figees.est_croyant === true : v.est_croyant === "oui";
    clientActif
      .sauvegarderEtape1({
        p_personnage_id: personnageId,
        p_nom: figees ? figees.nom : (v.nom ?? "").trim(),
        p_gn_completes: cFiges ? cFiges.gn_completes : Number(v.gn_completes) || 0,
        p_mini_gn_completes: cFiges
          ? cFiges.mini_gn_completes
          : Number(v.mini_gn_completes) || 0,
        p_ouvertures_terrain: cFiges
          ? cFiges.ouvertures_terrain
          : Number(v.ouvertures_terrain) || 0,
        p_est_croyant: croyant,
        p_religion_id: (figees
          ? figees.religion_id
          : croyant
          ? v.religion_id
          : null) as unknown as string,
        p_historique: v.historique ?? "",
        p_ame_personnage: v.ame_personnage ?? "",
        p_brouillon: true,
      })
      .then(
        () => {},
        () => {},
      );
  }, [watch, modeCampagne, compteursFiges, personnageId]);

  // Déclenche un autosave débouncé à chaque changement de champ.
  useEffect(() => {
    const sub = watch(() => {
      if (!pretAutosave.current) return;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        sauvegarderBrouillon();
        autosaveTimer.current = null;
      }, 900);
    });
    return () => {
      sub.unsubscribe();
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [watch, sauvegarderBrouillon]);

  // Ref toujours à jour vers le dernier brouillon : la cleanup ci-dessous
  // dispatche ainsi les VALEURS FRAÎCHES (closure non périmée).
  const flushRef = useRef(sauvegarderBrouillon);
  useEffect(() => {
    flushRef.current = sauvegarderBrouillon;
  }, [sauvegarderBrouillon]);

  // Si un autosave est EN ATTENTE quand le joueur quitte l'étape (démontage SPA)
  // ou met l'onglet en arrière-plan / le ferme (mobile), on dispatche le save
  // tout de suite au lieu de l'annuler. Best-effort (fire-and-forget).
  useEffect(() => {
    const flushSiEnAttente = () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
        flushRef.current();
      }
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushSiEnAttente();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flushSiEnAttente);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flushSiEnAttente);
      flushSiEnAttente();
    };
  }, []);

  const onSubmit = async (values: Etape1Form) => {
    // M3a PR-C1 : en campagne, l'identité (6 champs INV-4) est figée et provient
    // STRICTEMENT de la DB. On ignore les valeurs du formulaire pour ces champs,
    // et on saute leurs validations (déjà valides à la finalisation).
    const figees = modeCampagne ? valeursFigees.current : null;

    if (!figees) {
      if (!values.nom.trim()) {
        toast.error("Le nom est obligatoire.");
        return;
      }
      if (values.est_croyant === "") {
        toast.error("Indique si ton personnage est croyant ou non.");
        return;
      }
      const croyant = values.est_croyant === "oui";
      if (croyant && !values.religion_id) {
        toast.error("Choisis une religion pour ton personnage croyant.");
        return;
      }
    }

    const nom = figees ? figees.nom : values.nom.trim();
    const cFiges = compteursFiges ? valeursFigees.current : null;
    const gnCompletes = cFiges ? cFiges.gn_completes : Number(values.gn_completes) || 0;
    const miniGnCompletesV = cFiges ? cFiges.mini_gn_completes : Number(values.mini_gn_completes) || 0;
    const ouverturesV = cFiges ? cFiges.ouvertures_terrain : Number(values.ouvertures_terrain) || 0;
    const croyant = figees ? figees.est_croyant === true : values.est_croyant === "oui";
    const religionId = figees
      ? figees.religion_id
      : croyant
      ? values.religion_id
      : null;

    // Le « Suivant » fait foi : annule tout autosave brouillon en attente
    // pour qu'il ne se dispatche pas par-dessus la vraie sauvegarde.
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    setSubmitting(true);
    const { data, error } = await clientActif.sauvegarderEtape1({
      p_personnage_id: personnageId,
      p_nom: nom,
      p_gn_completes: gnCompletes,
      p_mini_gn_completes: miniGnCompletesV,
      p_ouvertures_terrain: ouverturesV,
      p_est_croyant: croyant,
      p_religion_id: religionId as unknown as string,
      p_historique: values.historique,
      p_ame_personnage: values.ame_personnage,
    });
    setSubmitting(false);

    if (error) {
      console.error("[V2 Etape1] RPC error:", error);
      toast.error(`Erreur : ${error.message}`);
      return;
    }

    const payload = (data ?? {}) as Record<string, unknown>;
    const erreurs =
      (payload.erreurs as Array<{ code?: string; message?: string }>) ?? [];
    const avertissements =
      (payload.avertissements as Array<{ code?: string; message?: string }>) ?? [];

    if (payload.succes === false) {
      const premiereErreur = erreurs[0] ?? {};
      const code = premiereErreur.code ?? "erreur";
      const message = premiereErreur.message ?? "Sauvegarde refusée.";
      toast.error(`[${code}] ${message}`);
      return;
    }

    // Avertissements éventuels (cas succès — ex. validation propagée par valider_etape_1)
    avertissements.forEach((a) => {
      if (a.message) toast.info(a.message);
    });

    toast.success("Identité enregistrée.");
    onSuccess();
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* En-tête — pas de JaugeXP : l'étape 1 ne dépense aucun XP (le solde
          n'existe qu'après le choix de la race à l'étape 2). */}
      <div>
        <h2 className="font-heading text-xl font-semibold text-gold">
          Identité &amp; expérience
        </h2>
        <p className="mt-1 text-sm text-white/50">
          Présente ton personnage et déclare ton expérience de jeu.
        </p>
      </div>

      {modeCampagne && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          L'identité de ton personnage est figée. Son historique et son âme, eux,
          continuent de s'écrire.
        </p>
      )}

      {/* W1 — Introduction d'étape */}
      <IntroEtape
        storageKey="hv-e1-intro-replie"
        titre="Comment fonctionne cette étape ?"
      >
        <IntroEtapeItem n={1}>
          <strong>Présente ton personnage.</strong> Son nom, son histoire et son
          âme. Le <strong>nom se fixe dès ta première présence</strong> en jeu ;
          l'histoire et l'âme restent <strong>modifiables plus tard</strong>.
        </IntroEtapeItem>
        <IntroEtapeItem n={2}>
          <strong>Croyance.</strong> C'est avant tout du <strong>RP</strong>. La
          compétence <strong>Grande Messe</strong> ne donne ses bonus qu'aux
          fidèles du <strong>même dieu</strong>. Pour un <strong>prêtre</strong>,
          la religion fixe aussi ses <strong>domaines proscrits</strong>{" "}
          (interdits par son dieu).
        </IntroEtapeItem>
        <IntroEtapeItem n={3}>
          <strong>Rattrapage d'expérience.</strong> La plateforme suit désormais
          tes présences automatiquement. Déclare ici les GN, mini-GN et
          ouvertures faits <strong>avant la plateforme</strong> : ils fixent ton{" "}
          <strong>XP et ton niveau de départ</strong>.
        </IntroEtapeItem>
      </IntroEtape>

      {/* ===== SECTION A — Identité RP ===== */}
      <SectionCard titre="Identité RP" sousTitre="Qui est ton personnage">
        {/* Nom */}
        <div className="space-y-1.5">
          <FieldLabel htmlFor="nom" modeCampagne={modeCampagne} editable={false}>
            Nom du personnage
          </FieldLabel>
          <Input
            id="nom"
            {...register("nom", { required: !modeCampagne })}
            readOnly={modeCampagne}
            placeholder="Ex : Valerius l'Ancien"
            className={champClass(modeCampagne, false)}
          />
          {!modeCampagne && (
            <>
              <p className="flex items-center gap-1.5 text-[11.5px] text-[hsl(38_80%_60%)]">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Le nom se fixe à ta première présence en jeu.
              </p>
              {/* [s406] Un seul point d'accès à la Forge (décision Ⓐ s405). */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setForgeOuverte(true)}
                className="border-gold/60 bg-gold/10 text-gold hover:bg-gold/20 hover:text-gold"
              >
                {TEXTES_FORGE.bouton}
              </Button>
              <ForgeNomsDialog
                ouvert={forgeOuverte}
                onOuvertChange={setForgeOuverte}
                raceFigee={raceFigeeForge}
                sousTypeFige={sousTypeFigeForge}
                onChoisir={(nom, raceNom) => {
                  // Remplit le champ ; l'autosave brouillon (watch débouncé)
                  // part tout seul, comme pour une frappe au clavier.
                  setValue("nom", nom, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  // Personnage SANS race : la race de la Forge devient une
                  // présélection d'ÉCRAN pour l'étape 2 (rien d'écrit).
                  if (!raceNomPerso) onRaceForgee?.(raceNom);
                }}
              />
            </>
          )}
          {errors.nom && (
            <p className="text-xs text-red-400">Le nom est requis.</p>
          )}
        </div>

        {/* Historique */}
        <div className="mt-4 space-y-1.5">
          <FieldLabel htmlFor="historique" modeCampagne={modeCampagne} editable>
            Historique du personnage
          </FieldLabel>
          <Textarea
            id="historique"
            placeholder="Racontez l'histoire de votre personnage, ses origines, ses motivations, les événements qui l'ont marqué..."
            {...register("historique")}
            className={`min-h-[160px] resize-none ${champClass(modeCampagne, true)}`}
          />
          <p className="text-xs italic text-white/40">
            Aucune limite de caractères. Modifiable plus tard.
          </p>
        </div>

        {/* Âme */}
        <div className="mt-4 space-y-1.5">
          <FieldLabel htmlFor="ame_personnage" modeCampagne={modeCampagne} editable>
            Âme du personnage
          </FieldLabel>
          <Textarea
            id="ame_personnage"
            placeholder="Décrivez la personnalité profonde, les valeurs, les traits de caractère, les motivations cachées de votre personnage..."
            {...register("ame_personnage")}
            className={`min-h-[160px] resize-none ${champClass(modeCampagne, true)}`}
          />
          <p className="text-xs italic text-white/40">
            Aucune limite de caractères. Modifiable plus tard.
          </p>
        </div>
      </SectionCard>

      {/* ===== SECTION B — Croyance ===== */}
      <SectionCard
        titre="Croyance"
        sousTitre="La foi de ton personnage"
        badge={modeCampagne ? <BadgeFige /> : undefined}
      >
        <div className="space-y-3">
          <Label className="text-base text-gold">
            Ton personnage est-il croyant ?
          </Label>
          <Controller
            control={control}
            name="est_croyant"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                disabled={modeCampagne}
                className={`flex gap-6 ${modeCampagne ? "opacity-[0.45] pointer-events-none" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="croyant-oui" value="oui" />
                  <Label htmlFor="croyant-oui">Oui</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="croyant-non" value="non" />
                  <Label htmlFor="croyant-non">Non</Label>
                </div>
              </RadioGroup>
            )}
          />
        </div>

        {estCroyant === "oui" && (
          <div className="mt-4 space-y-2">
            <Label className="text-base text-gold">Religion</Label>
            <Controller
              control={control}
              name="religion_id"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={modeCampagne}
                >
                  <SelectTrigger className={champClass(modeCampagne, false)}>
                    <SelectValue
                      placeholder={
                        loadingReligions ? "Chargement…" : "Choisis une religion"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {religions.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {(() => {
              const relChoisie = religions.find(
                (r: any) => r.id === watch("religion_id")
              );
              if (!relChoisie) return null;
              return (
                <div className="rounded-lg border border-gold/20 bg-card p-4">
                  <ReligionDetails
                    religion={relChoisie}
                    isManuelOpen={religionManuelOpen}
                    onToggleManuel={() => setReligionManuelOpen((v) => !v)}
                  />
                </div>
              );
            })()}
          </div>
        )}
      </SectionCard>

      {/* ===== SECTION C — Rattrapage d'expérience ===== */}
      <SectionCard
        titre="Rattrapage d'expérience"
        sousTitre="Tes présences faites avant la plateforme"
        badge={compteursFiges ? <BadgeFige /> : undefined}
      >
        <p className="mb-3 text-[12.5px] leading-relaxed text-white/70">
          La plateforme suit désormais tes présences. Déclare ici les événements
          faits <strong className="text-foreground">avant</strong> : ils fixent
          ton XP et ton niveau de départ.
        </p>

        {rattrapageFige && !modeCampagne && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-[11.5px] text-amber-300">
            <span className="mt-px shrink-0">ⓘ</span>
            <span>
              Ces compteurs sont figés tant que tu es inscrit à un événement.
              Désinscris-toi pour les modifier de nouveau.
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="gn" className="text-[11.5px] text-white/70">
              GN réguliers{" "}
              <span className="text-white/40">(+15 XP, +1 niv.)</span>
            </Label>
            <Input
              id="gn"
              type="number"
              min={0}
              readOnly={compteursFiges}
              {...register("gn_completes", {
                valueAsNumber: true,
                min: 0,
                setValueAs: (v) => {
                  const n = Number(v);
                  if (Number.isNaN(n) || n < 0) return 0;
                  return Math.floor(n);
                },
              })}
              className={champClass(compteursFiges, false)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mini" className="text-[11.5px] text-white/70">
              Mini-GN <span className="text-white/40">(+15 XP)</span>
            </Label>
            <Input
              id="mini"
              type="number"
              min={0}
              readOnly={compteursFiges}
              {...register("mini_gn_completes", {
                valueAsNumber: true,
                min: 0,
                setValueAs: (v) => {
                  const n = Number(v);
                  if (Number.isNaN(n) || n < 0) return 0;
                  return Math.floor(n);
                },
              })}
              className={champClass(compteursFiges, false)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ouv" className="text-[11.5px] text-white/70">
              Ouvertures <span className="text-white/40">(+10 XP)</span>
            </Label>
            <Input
              id="ouv"
              type="number"
              min={0}
              readOnly={compteursFiges}
              {...register("ouvertures_terrain", {
                valueAsNumber: true,
                min: 0,
                setValueAs: (v) => {
                  const n = Number(v);
                  if (Number.isNaN(n) || n < 0) return 0;
                  return Math.floor(n);
                },
              })}
              className={champClass(compteursFiges, false)}
            />
          </div>
        </div>

        {/* Bloc récapitulatif niveau/XP de départ — temps réel */}
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-1.5 text-sm">
          <p className="text-white/70">
            Niveau de départ :{" "}
            <strong className="text-gold">{niveauActuel}</strong>{" "}
            <span className="text-white/40">
              ({NIVEAU_BASE} de base + {gnCompletes} GN
              {gnCompletes > 1 ? "s" : ""})
            </span>
          </p>
          <p className="text-white/70">
            XP de GN : <strong className="text-green-400">+{xpGn}</strong>
          </p>
          <p className="text-white/70">
            XP de mini-GN :{" "}
            <strong className="text-green-400">+{xpMiniGn}</strong>
          </p>
          <p className="text-white/70">
            XP d'ouvertures :{" "}
            <strong className="text-green-400">+{xpOuvertures}</strong>
          </p>
          <p className="text-xs italic text-white/40 pt-1">
            XP total : calculé à l'étape suivante, après le choix de la race.
          </p>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={submitting}
          className="bg-gold text-black hover:bg-gold/90"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Suivant
        </Button>
      </div>
    </form>
  );
};

export default Etape1_V2;

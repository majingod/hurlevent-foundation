import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, User, Fingerprint, Swords, Star, Wand2, Sun, Shapes,
  Hammer, ClipboardCheck, AlertTriangle, Coins, TrendingUp,
} from "lucide-react";

import { clientActif } from "@/creation/clientActif";
import { appliquerComposition } from "@/creation/generateur/appliquerComposition";
import { PROFIL_VISITEUR_LOCAL } from "@/creation/visiteur/clientVisiteur";
import { effacerBrouillon } from "@/creation/visiteur/stockageBrouillon";
import type { TiragePersonnage } from "@/moteurCreation/generateur/resoudre";
import type { CompositionOk } from "@/moteurCreation/generateur/types";
import { useAuth } from "@/contexts/AuthContext";
import { useProfil } from "@/contexts/ProfilContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import StepperEtapes, { type EtapeDef } from "@/components/createur/StepperEtapes";
import DrawerAjusterXp from "@/components/createur/DrawerAjusterXp";
import { useEtapesApplicables } from "@/components/createur/useEtapesApplicables";
import Generateur from "@/components/createur/generateur/Generateur";
import { GENERATEUR_ACTIF } from "@/components/createur/generateur/config";
import { doitMontrerAccueil } from "@/components/createur/generateur/decisionAccueil";

import Etape1_V2 from "@/components/createur/etapes/Etape1_V2";
import Etape2_V2 from "@/components/createur/etapes/Etape2_V2";
import Etape4_V2 from "@/components/createur/etapes/Etape4_V2";
import Etape5_Competences_V2 from "@/components/createur/etapes/Etape5_Competences_V2";
import Etape6_Sorts_V2 from "@/components/createur/etapes/Etape6_Sorts_V2";
import Etape7_Prieres_V2 from "@/components/createur/etapes/Etape7_Prieres_V2";
import Etape8_Assemblages_V2 from "@/components/createur/etapes/Etape8_Assemblages_V2";
import Etape9_Artisanat_V2 from "@/components/createur/etapes/Etape9_Artisanat_V2";
import Etape10_Recapitulatif_V2 from "@/components/createur/etapes/Etape10_Recapitulatif_V2";

const TOTAL_STEPS = 10; // étapes DB (inchangées) — finalisé = etape_creation > 10
const TOTAL_STEPS_UI = 9; // étapes affichées (fusion DB 2+3 → UI 2 « Race + Traits »)

// WIZARD-REFONTE-UX (PR2) — l'UI affiche 9 étapes ; la DB en garde 10.
// Mapping (Option « fusion 2+3 ») : UI 1 = DB 1 · UI 2 = DB 2 (+ DB 3 absorbée)
// · UI N>=3 = DB N+1. Seul l'affichage passe par ce mapping ; toute la
// navigation (applicabilité, rattrapage) continue de raisonner en numéros DB.
const ETAPES_UI: EtapeDef[] = [
  { n: 1, t: "Identité", Icon: User },
  { n: 2, t: "Race + Traits", Icon: Fingerprint },
  { n: 3, t: "Classe", Icon: Swords },
  { n: 4, t: "Compétences", Icon: Star },
  { n: 5, t: "Sorts", Icon: Wand2 },
  { n: 6, t: "Prières", Icon: Sun },
  { n: 7, t: "Assemblages", Icon: Shapes },
  { n: 8, t: "Artisanat", Icon: Hammer },
  { n: 9, t: "Récap", Icon: ClipboardCheck },
];

// DB 3 (Traits) est fusionnée dans l'écran UI 2 : jamais une cible de
// navigation autonome (ni affichée seule, ni rattrapée via avancer_etape —
// sauvegarder_etape_3 l'avance déjà au « Suivant » de l'écran fusionné).
const ETAPES_ABSORBEES = new Set<number>([3]);

const uiToDb = (ui: number): number => (ui <= 2 ? ui : ui + 1);
const dbToUi = (db: number): number =>
  db <= 2 ? db : db === 3 ? 2 : db - 1;

interface PersonnageRow {
  id: string;
  nom: string | null;
  niveau: number | null;
  etape_creation: number;
  xp_total: number | null;
  xp_depense: number | null;
}

export interface EtapeProps {
  personnageId: string;
  onSuccess: () => void;
  onPrevious?: () => void;
  onXpDeltaChange?: (delta: number) => void;
  onXpGainChange?: (gain: number) => void;
}

interface PersonnageNouveauV2Props {
  /**
   * Mode visiteur (P2-b) : wizard hors barrière auth, adossé au moteur local
   * (`clientActif` route vers `clientVisiteur` sur `/visiteur`). Aucune exigence
   * de compte/profil ; les liens de retour pointent vers l'accueil au lieu du
   * tableau de bord. Absent (défaut false) = chemin connecté INCHANGÉ.
   */
  modeVisiteur?: boolean;
}

const PersonnageNouveauV2 = ({ modeVisiteur = false }: PersonnageNouveauV2Props = {}) => {
  const { user, role, loading: authLoading } = useAuth();
  const { joueurId, rechargerProfils } = useProfil();
  const navigate = useNavigate();

  // Destination de tous les retours « sortie de wizard ». En visiteur (pas de
  // tableau de bord accessible sans compte), on renvoie vers l'accueil.
  const retourSortie = modeVisiteur ? "/" : "/tableau-de-bord";
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // ?id= : reprise / modification d'un personnage précis depuis le tableau
  // de bord. Si présent, on NE passe PAS par demarrer_creation_personnage.
  const personnageIdParUrl = searchParams.get("id");

  // ÉDITION-ADMIN-WIZARD : un admin peut ouvrir l'éditeur complet d'un perso
  // finalisé (?admin=1). Le gate backend est contourné côté serveur (s141).
  // BUG C (s311) : en visiteur, jamais de mode admin/campagne — ces modes
  // naviguent vers `/personnage/:id` (route protégée) et n'ont aucun sens hors
  // barrière auth. `modeCampagne` dérive déjà de l'état serveur (« brouillon »
  // en visiteur → false) ; on neutralise ici la seule autre porte, `modeAdmin`.
  const modeAdmin =
    !modeVisiteur && role === "admin" && searchParams.get("admin") === "1";

  const [personnageId, setPersonnageId] = useState<string | null>(null);
  const [etape, setEtape] = useState<number>(1);
  const [xpDeltaCourant, setXpDeltaCourant] = useState<number>(0);
  const [xpGainCourant, setXpGainCourant] = useState<number>(0);
  const [demarrage, setDemarrage] = useState(true);
  const [erreurDemarrage, setErreurDemarrage] = useState<string | null>(null);
  const [xpDrawerOpen, setXpDrawerOpen] = useState(false);
  // BUG C (s311) : en visiteur, la finalisation ne navigue nulle part (pas de
  // fiche visiteur, route protégée) — on affiche un panneau de succès en place.
  const [finalisationVisiteurReussie, setFinalisationVisiteurReussie] =
    useState(false);
  // [VIS-8 lot 1] Une porte de l'accueil a été franchie (🛠️) : « Précédent »
  // depuis l'étape 2 ne fait pas réapparaître le menu des portes.
  const [accueilFranchi, setAccueilFranchi] = useState(false);
  // [VIS-8 PR-B] 🎲 « Continuer dans le créateur » en cours d'application :
  // overlay bloquant (anti double-clic) le temps du rejeu des vraies RPC.
  const [applicationTirage, setApplicationTirage] = useState(false);
  // Étape initiale positionnée une seule fois (cas reprise via ?id=) :
  // ne jamais ré-écraser la navigation manuelle de l'utilisateur ensuite.
  const [etapeInitialisee, setEtapeInitialisee] = useState(false);
  // NAV-2 : étape serveur brute (1..TOTAL_STEPS) issue du démarrage / de la
  // reprise. Le positionnement réel (skip des étapes non applicables +
  // rattrapage avancer_etape) est différé jusqu'à `chargee` (cf. effet dédié).
  const [etapeCibleInitiale, setEtapeCibleInitiale] = useState<number | null>(null);
  // NAV-2 : garde anti double-déclenchement pendant l'enchaînement des
  // appels avancer_etape (rattrapage des étapes masquées).
  const [rattrapageEnCours, setRattrapageEnCours] = useState(false);

  // NAV-2 : applicabilité dynamique des étapes (É6 Sorts / É7 Prières /
  // É8 Assemblages). Cache partagé avec les étapes → apparition live après
  // achat de la compétence en É5.
  const { chargee, applicable } = useEtapesApplicables(personnageId);

  // AUDIT-ADMIN-MODE-ROLE : le canal admin (header x-hv-canal) est désormais
  // piloté globalement par le mode staff (ModeStaffContext) — plus de header
  // posé en doublon ici. `modeAdmin` reste utilisé pour la logique d'édition.

  // 1) Démarrage : soit reprise d'un personnage précis (?id=),
  //    soit création / récupération du brouillon unique.
  useEffect(() => {
    // Mode visiteur : aucune exigence user/joueurId (route publique, hors auth).
    if (!modeVisiteur && (authLoading || !user || !joueurId)) return;
    if (personnageId) return; // garde anti double-démarrage
    let annule = false;

    // Cas A — reprise via ?id= (bouton « Continuer / Modifier » du tableau
    // de bord). On prend l'id tel quel ; l'ownership est garanti par la RLS
    // sur « personnages » (le SELECT de la query "v2-personnage" lèvera une
    // erreur si le personnage n'appartient pas au joueur).
    if (personnageIdParUrl) {
      setPersonnageId(personnageIdParUrl);
      setDemarrage(false);
      return;
    }

    // Cas B — création / reprise du brouillon unique.
    const demarrer = async () => {
      setDemarrage(true);
      setErreurDemarrage(null);

      const { data, error } = await clientActif.demarrerCreationPersonnage({
        p_profil_id: modeVisiteur ? PROFIL_VISITEUR_LOCAL : joueurId!,
      });

      if (annule) return;

      if (error) {
        console.error("[V2] demarrer_creation_personnage error:", error);
        setErreurDemarrage(error.message);
        toast.error(`Impossible de démarrer la création : ${error.message}`);
        setDemarrage(false);
        return;
      }

      const payload = (data ?? {}) as Record<string, any>;
      const succes = payload.succes === true;
      const code = (payload.erreurs?.[0]?.code ?? payload.code) as string | undefined;
      const personnage_id = payload.donnees?.personnage_id as string | undefined;
      const etape_courante = (payload.donnees?.etape_creation as number | undefined) ?? 1;

      // On accepte uniquement : succès explicite OU brouillon existant.
      const succesExplicite = succes === true && !!personnage_id;
      const brouillonExistant =
        succes === false && code === "brouillon_existant" && !!personnage_id;

      if (succesExplicite || brouillonExistant) {
        setPersonnageId(personnage_id!);
        // NAV-2 : on ne positionne pas l'étape ici — on mémorise la cible
        // serveur et l'effet de positionnement l'appliquera une fois les
        // données d'applicabilité chargées (skip + rattrapage éventuel).
        setEtapeCibleInitiale(Math.max(1, Math.min(etape_courante, TOTAL_STEPS)));
        setDemarrage(false);
        return;
      }

      // TOP 5d — visiteur avec un brouillon FINALISÉ : `demarrer` refuse
      // (`FINALISE_EXISTANT`) plutôt que d'écraser le personnage prêt. Au simple
      // affichage du récap, on n'affiche donc PAS une erreur : on bascule sur le
      // panneau de fin de parcours (d'où l'utilisateur peut recommencer via une
      // suppression explicite).
      if (modeVisiteur && code === "FINALISE_EXISTANT") {
        setFinalisationVisiteurReussie(true);
        setDemarrage(false);
        return;
      }

      const msg =
        (payload.message as string | undefined) ??
        `Démarrage refusé${code ? ` (${code})` : ""}.`;
      setErreurDemarrage(msg);
      toast.error(msg);
      setDemarrage(false);
    };

    demarrer();
    return () => {
      annule = true;
    };
  }, [authLoading, user?.id, joueurId, personnageIdParUrl, modeVisiteur]);

  // 2) État du personnage (XP, étape) — rafraîchi après chaque mutation
  const { data: personnage, error: erreurPersonnage } =
    useQuery<PersonnageRow | null>({
      queryKey: ["v2-personnage", personnageId],
      enabled: !!personnageId,
      queryFn: async () => {
        const { data, error } = await clientActif.lirePersonnageProgression(
          personnageId!,
        );
        if (error) throw error;
        return data as PersonnageRow;
      },
    });

  // État courant (gele / campagne / …) — toujours actif (cache partagé avec
  // BoutonRemodeler et FichePersonnageView via la queryKey ["etat-edition"]).
  // On garde la même forme d'objet que BoutonRemodeler pour ne pas corrompre le
  // cache partagé (le bouton « Faire évoluer » remplit ce cache juste avant la
  // navigation vers le wizard) ; on lit l'état via .etat.
  const { data: etatEditionData, isPending: etatPending } = useQuery<{
    etat: string | null;
    rattrapage_editable: boolean | null;
  } | null>({
    queryKey: ["etat-edition", personnageId],
    enabled: !!personnageId,
    queryFn: async () => {
      const { data, error } = await clientActif.etatEditionPersonnage({
        p_personnage_id: personnageId!,
      });
      if (error) throw error;
      return (data ?? null) as {
        etat: string | null;
        rattrapage_editable: boolean | null;
      } | null;
    },
  });
  const etatEdition = etatEditionData?.etat ?? null;

  // M3a PR-C1 : mode évolution de campagne — détecté par l'ÉTAT en base,
  // jamais par un paramètre d'URL (non truquable). Le mode admin prime.
  const modeCampagne = !modeAdmin && etatEdition === "campagne";

  // ASSOUPLIR-GEL : compteurs de rattrapage figés dès qu'inscrit à un événement
  // à venir (rattrapage_editable=false), indépendamment du mode campagne.
  const rattrapageFige =
    !modeAdmin && etatEditionData?.rattrapage_editable === false;

  // ÉDITION-ADMIN-WIZARD : sortie propre de l'éditeur admin (retour fiche).
  const terminerEditionAdmin = () => {
    if (personnageId) navigate(`/personnage/${personnageId}`);
  };

  // TOP 5d — « Recommencer un nouveau personnage » (visiteur finalisé) :
  // suppression explicite du brouillon finalisé puis redémarrage de la création
  // à zéro. `demarrer` recrée alors un brouillon vide (plus de refus, le slot
  // est libre) et l'effet de positionnement affiche l'étape 1.
  const recommencerVisiteur = async () => {
    effacerBrouillon();
    const { data, error } = await clientActif.demarrerCreationPersonnage({
      p_profil_id: PROFIL_VISITEUR_LOCAL,
    });
    const payload = (data ?? {}) as Record<string, any>;
    const personnage_id = payload.donnees?.personnage_id as string | undefined;
    if (error || payload.succes !== true || !personnage_id) {
      toast.error(
        error?.message ??
          (payload.erreurs?.[0]?.message as string | undefined) ??
          "Impossible de redémarrer la création.",
      );
      return;
    }
    setFinalisationVisiteurReussie(false);
    setEtapeInitialisee(false);
    setEtape(1);
    setEtapeCibleInitiale(1);
    setPersonnageId(personnage_id);
  };

  // Redirect automatique : si le personnage est finalisé (etape_creation > TOTAL_STEPS),
  // on bascule vers la fiche read-only — SAUF en mode admin, où l'on reste dans
  // l'éditeur complet pour modifier le perso finalisé en place.
  useEffect(() => {
    if (modeAdmin) return;
    // Visiteur : pas de fiche read-only (route protégée). On reste dans le
    // wizard ; la sortie post-finalisation passe par handleEtapeSuccess.
    if (modeVisiteur) return;
    if (!personnage || personnage.etape_creation <= TOTAL_STEPS) return;
    // Perso finalisé : attendre de connaître l'état avant de décider (la query
    // état est async ; sans cette garde, un perso campagne serait éjecté vers
    // la fiche avant que modeCampagne soit connu).
    if (etatPending) return;
    if (etatEdition === "campagne") return; // mode évolution : on reste.
    toast.info(
      "Ce personnage est finalisé. Utilise « Remodeler » depuis sa fiche pour le modifier.",
    );
    navigate(`/personnage/${personnage.id}`, { replace: true });
  }, [personnage, navigate, modeAdmin, modeVisiteur, etatPending, etatEdition]);

  // 1b) Reprise via ?id= : positionner l'étape initiale, une seule fois
  //     (ne pas écraser la navigation manuelle ensuite).
  //     - Brouillon (etape_creation <= TOTAL_STEPS) : reprendre où le joueur
  //       en était (« Continuer la création »).
  //     - Perso finalisé (campagne / remodelage_libre, etape_creation >
  //       TOTAL_STEPS) : repartir de l'étape 1 (parcours de remodelage /
  //       évolution complet), pas du récapitulatif.
  useEffect(() => {
    if (etapeInitialisee) return;
    if (!personnageIdParUrl) return;
    if (!personnage) return;
    const finalise = (personnage.etape_creation ?? 1) > TOTAL_STEPS;
    // [s373 WIZARD-ETAPES-VERROUILLEES-APRES-GENERATEUR] Un personnage SANS
    // NOM (sortie du générateur : étapes 1-3 en brouillon, identité vierge)
    // rouvre sur « nomme ton perso », jamais sur le récapitulatif — le nom
    // est la clé du déverrouillage (cf. `etapeMax`).
    const sansNomInitial = !(personnage.nom ?? "").trim();
    const cible = finalise || sansNomInitial
      ? 1
      : Math.max(1, Math.min(personnage.etape_creation ?? 1, TOTAL_STEPS));
    // NAV-2 : positionnement réel différé à l'effet dédié (gate `chargee`).
    setEtapeCibleInitiale(cible);
  }, [etapeInitialisee, personnageIdParUrl, personnage]);

  // NAV-2 — helpers de navigation : prochaine / précédente étape applicable.
  const prochaineApplicable = (n: number) => {
    for (let m = n + 1; m <= TOTAL_STEPS; m += 1)
      if (applicable(m) && !ETAPES_ABSORBEES.has(m)) return m;
    return TOTAL_STEPS;
  };
  const precedenteApplicable = (n: number) => {
    for (let m = n - 1; m >= 1; m -= 1)
      if (applicable(m) && !ETAPES_ABSORBEES.has(m)) return m;
    return 1;
  };

  // NAV-2 — rattrapage serveur : avance etape_creation en enchaînant
  // avancer_etape(+1) sur chaque étape masquée `m` de `depuis` à `cible − 1`
  // (toutes ∈ 6..9 par construction). Réutilise le pattern de payload
  // {succes, erreurs} des étapes. Ne JAMAIS boucler : au premier échec
  // (succes !== true ou erreur réseau), on retourne l'étape bloquante.
  const rattraperEtapesMasquees = async (
    depuis: number,
    cible: number,
  ): Promise<{ ok: true } | { ok: false; bloque: number; message: string }> => {
    if (!personnageId) return { ok: false, bloque: depuis, message: "Personnage introuvable." };
    for (let m = depuis; m < cible; m += 1) {
      if (applicable(m)) continue; // sécurité : ne jamais sauter une étape applicable
      const { data, error } = await clientActif.avancerEtape({
        p_personnage_id: personnageId,
        p_etape_courante: m,
      });
      const payload = (data ?? {}) as Record<string, any>;
      if (error || payload.succes !== true) {
        const message =
          error?.message ??
          (payload.erreurs?.[0]?.message as string | undefined) ??
          (payload.erreurs?.[0]?.code as string | undefined) ??
          "Impossible de passer à l'étape suivante.";
        return { ok: false, bloque: m, message };
      }
    }
    return { ok: true };
  };

  // 1c) NAV-2 — positionnement initial unifié (démarrage ?id= ET brouillon).
  //     Ne s'exécute qu'une fois `chargee === true` pour ne jamais afficher
  //     une étape non applicable. Si la cible serveur pointe une étape masquée,
  //     on rattrape le serveur (avancer_etape séquentiel) avant d'afficher,
  //     exactement comme handleEtapeSuccess. En mode admin/campagne (perso
  //     finalisé), aucun avancer_etape : le serveur est déjà au-delà de la
  //     dernière étape, on se contente de viser la prochaine étape applicable.
  useEffect(() => {
    if (etapeInitialisee) return;
    if (etapeCibleInitiale == null) return;
    if (!chargee) return;
    let annule = false;

    const positionner = async () => {
      const depart = etapeCibleInitiale;
      const cible = applicable(depart)
        ? depart
        : prochaineApplicable(depart - 1);

      // Rattrapage serveur uniquement en création normale (brouillon) : un
      // perso finalisé (admin/campagne) a déjà etape_creation > TOTAL_STEPS.
      if (!modeAdmin && !modeCampagne && !applicable(depart) && cible > depart) {
        setRattrapageEnCours(true);
        const r = await rattraperEtapesMasquees(depart, cible);
        if (annule) return;
        setRattrapageEnCours(false);
        if (!r.ok) {
          toast.error(r.message);
          setEtape(r.bloque);
          setEtapeInitialisee(true);
          return;
        }
      }

      if (annule) return;
      setEtape(cible);
      setEtapeInitialisee(true);
    };

    void positionner();
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapeInitialisee, etapeCibleInitiale, chargee, modeAdmin, modeCampagne]);

  useEffect(() => {
    setXpDeltaCourant(0);
    setXpGainCourant(0);
  }, [etape]);

  // SCROLL-TO-TOP : remonter en haut du wizard à chaque changement d'étape.
  // Les étapes sont du state (setEtape), pas une route → le ScrollToTop global
  // (basé sur pathname) ne se déclenche pas ici.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [etape]);

  const xpTotal = personnage?.xp_total ?? 0;
  const xpDepense = personnage?.xp_depense ?? 0;
  const xpTotalAffiche = xpTotal + xpGainCourant;
  const xpDisponible = xpTotalAffiche - xpDepense - xpDeltaCourant;
  // [MAGIE-PLAFOND] Niveau du PERSONNAGE (pas du sort) : decide le plafond de prix.
  const niveauPersonnage = personnage?.niveau ?? 1;

  const progression = useMemo(
    () => Math.round((dbToUi(etape) / TOTAL_STEPS_UI) * 100),
    [etape]
  );

  // M3a PR-C1 : en campagne, race (2), stats (3) et classe (4) sont figées.
  const ETAPES_VERROUILLEES_CAMPAGNE = [2, 3, 4];
  const etapeVerrouillee = (n: number) =>
    modeCampagne && ETAPES_VERROUILLEES_CAMPAGNE.includes(n);

  // Étape la plus avancée atteinte : étapes <= etapeMax cliquables dans le stepper.
  // En mode admin OU campagne (perso finalisé), toutes les étapes sont accessibles.
  // [s373] LE NOM EST LA CLÉ DU DÉVERROUILLAGE (demande Fred) : un personnage
  // sans nom (sortie du générateur — un perso MANUEL ne peut pas dépasser
  // l'étape 1 sans nom, la règle est donc auto-ciblée) reste sur l'étape 1 ;
  // dès le nom donné, la navigation s'ouvre jusqu'à `etape_creation` (10
  // après la chaîne d'avancement d'`appliquerComposition`).
  const sansNom = !modeAdmin && !modeCampagne && !(personnage?.nom ?? "").trim();
  const etapeMax = modeAdmin || modeCampagne
    ? TOTAL_STEPS
    : sansNom
      ? 1
      : Math.max(etape, Math.min(personnage?.etape_creation ?? 1, TOTAL_STEPS));
  const sauterEtape = (n: number) => {
    if (etapeVerrouillee(n)) return;
    // NAV-2 : clamp de sécurité — une étape non applicable n'a pas d'icône
    // dans le stepper, ce saut ne devrait donc jamais survenir.
    if (!applicable(n)) return;
    if (n >= 1 && n <= etapeMax) setEtape(n);
  };

  const handleEtapeSuccess = async () => {
    // NAV-2 : garde anti double-déclenchement pendant un rattrapage en cours.
    if (rattrapageEnCours) return;

    // Recharger l'état serveur et faire confiance à etape_creation
    const result = await queryClient.fetchQuery<PersonnageRow>({
      queryKey: ["v2-personnage", personnageId],
      queryFn: async () => {
        const { data, error } = await clientActif.lirePersonnageProgression(
          personnageId!,
        );
        if (error) throw error;
        return data as PersonnageRow;
      },
    });

    // ÉDITION-ADMIN-WIZARD / campagne : un perso finalisé a etape_creation >
    // TOTAL_STEPS. On ne quitte pas l'éditeur : on avance via le stepper, en
    // sautant les étapes verrouillées (campagne) au passage.
    if (modeAdmin || modeCampagne) {
      // NAV-2 : perso finalisé — pas de rattrapage serveur (etape_creation est
      // déjà > TOTAL_STEPS). On saute les étapes figées (campagne) ET non
      // applicables (sans Acquisition de Sort/Prière, sans runes).
      setEtape((e) => {
        let n = Math.min(e + 1, TOTAL_STEPS);
        while (
          n < TOTAL_STEPS &&
          (etapeVerrouillee(n) || !applicable(n) || ETAPES_ABSORBEES.has(n))
        )
          n += 1;
        return n;
      });
      return;
    }

    // Personnage finalisé (étape 10 → 11) : sortir du wizard.
    // Le toast de succès est déjà affiché par Etape10_Recapitulatif_V2.
    if ((result.etape_creation ?? 0) > TOTAL_STEPS) {
      // BUG C (s311) : en visiteur, aucune fiche à ouvrir (route protégée) et
      // aucun profil à rafraîchir. On ne NAVIGUE PAS : le brouillon reste
      // sauvegardé et un panneau de succès s'affiche en place.
      if (modeVisiteur) {
        setFinalisationVisiteurReussie(true);
        return;
      }
      // Nouveau perso finalisé : rafraîchir les compteurs de profils (écran
      // « Qui joue ? »).
      void rechargerProfils();
      navigate(retourSortie);
      return;
    }

    // NAV-2 : l'étape courante a déjà fait passer etape_creation à `etape + 1`
    // côté serveur (avancer_etape appelé par l'étape). On vise la prochaine
    // étape applicable et on rattrape le serveur sur les étapes masquées
    // intermédiaires (toutes ∈ 6..9) via avancer_etape séquentiel.
    const cible = prochaineApplicable(etape);
    if (cible > etape + 1) {
      setRattrapageEnCours(true);
      const r = await rattraperEtapesMasquees(etape + 1, cible);
      setRattrapageEnCours(false);
      if (!r.ok) {
        // Fallback : afficher l'étape masquée bloquante (son écran
        // « indisponibles » + bouton manuel prend le relais). Ne jamais boucler.
        toast.error(r.message);
        setEtape(r.bloque);
        return;
      }
    }
    setEtape(cible);
  };

  // Précédent = simple navigation. Aucune sauvegarde ni remboursement :
  // le retrait d'achats passe uniquement par le désachat par item (cascade).
  const handlePrevious = () => {
    // NAV-2 : navigation pure (aucun appel serveur). On vise la précédente
    // étape applicable, en sautant aussi les étapes figées (campagne).
    let n = precedenteApplicable(etape);
    while (n > 1 && etapeVerrouillee(n)) n = precedenteApplicable(n);
    setEtape(n);
  };


  // -- Rendus de chargement / erreur ----------------------------------------
  // On attend que l'étape initiale soit positionnée (ou qu'une erreur de
  // chargement survienne) avant d'afficher le wizard. NAV-2 : ce positionnement
  // dépend désormais de `chargee` (applicabilité) — pour les DEUX chemins de
  // démarrage (brouillon et reprise ?id=) — afin de ne JAMAIS monter une étape
  // non applicable, même une fraction de seconde.
  const enAttenteEtapeInitiale =
    !!personnageId && !etapeInitialisee && !erreurPersonnage;

  if ((!modeVisiteur && authLoading) || demarrage || enAttenteEtapeInitiale) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white/60">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Préparation du créateur de personnage…
      </div>
    );
  }

  // BUG C (s311) : panneau de succès visiteur post-finalisation. Réutilise le
  // pattern visuel de l'en-tête de `CreationVisiteur` (font-heading text-primary
  // + carte bg-card/80 border-primary/20). Le brouillon N'EST PAS supprimé.
  // TOP 5d : ce panneau est aussi affiché au simple ré-affichage d'un brouillon
  // finalisé (`demarrer` refuse `FINALISE_EXISTANT`) → il précède le rendu
  // d'erreur fatale, car dans ce cas `personnageId` reste nul.
  if (modeVisiteur && finalisationVisiteurReussie) {
    return (
      <div className="mx-auto mt-12 max-w-xl px-4">
        <div className="space-y-5 rounded-lg border border-primary/20 bg-card/80 p-6">
          <h2 className="font-heading text-2xl text-primary">
            Ton personnage est prêt !
          </h2>
          <p className="text-sm text-muted-foreground">
            Ton brouillon est complet et validé par les règles du jeu. Il reste
            sauvegardé sur cet appareil : ta fiche, ton code de reprise et ton
            fichier restent consultables à tout moment. Pour le jouer en GN,
            crée un compte — Hurlevent te proposera de le transformer
            automatiquement en vrai personnage.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate("/visiteur/fiche")}>
              Voir ma fiche
            </Button>
            <Button variant="outline" onClick={() => navigate("/connexion")}>
              Créer un compte
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              Retour à l'accueil
            </Button>
          </div>
          {/* TOP 5d — 3e action discrète : suppression explicite du personnage
              finalisé + redémarrage à zéro (AlertDialog destructif maison). */}
          <div className="pt-1">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Recommencer un nouveau personnage
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Recommencer à zéro ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ton personnage finalisé sera définitivement supprimé de cet
                    appareil. Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      void recommencerVisiteur();
                    }}
                  >
                    Supprimer et recommencer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    );
  }

  const messageErreurFatale =
    erreurDemarrage ??
    (personnageIdParUrl && erreurPersonnage
      ? `Personnage introuvable ou inaccessible : ${erreurPersonnage.message}`
      : null);

  if (messageErreurFatale || !personnageId) {
    return (
      <div className="mx-auto mt-12 max-w-xl space-y-4 rounded-lg border border-red-700/50 bg-red-950/30 p-6 text-red-100">
        <h2 className="text-xl font-heading text-red-200">
          Création indisponible
        </h2>
        <p className="text-sm">
          {messageErreurFatale ?? "Brouillon introuvable."}
        </p>
        <Button variant="outline" onClick={() => navigate(retourSortie)}>
          {modeVisiteur ? "Retour à l'accueil" : "Retour au tableau de bord"}
        </Button>
      </div>
    );
  }

  // [VIS-8 lot 1] Accueil des portes — ÉTEINT (GENERATEUR_ACTIF=false)
  // jusqu'au lot résolveur. Placé APRÈS les early-returns : le démarrage est
  // terminé, l'étape est positionnée (NAV-2), les cas reprise / admin /
  // campagne / visiteur finalisé sont déjà passés. Ne concerne qu'un
  // démarrage à zéro (étape 1).
  if (
    doitMontrerAccueil({
      actif: GENERATEUR_ACTIF,
      accueilFranchi,
      modeAdmin,
      modeCampagne,
      reprise: !!personnageIdParUrl,
      etape,
    })
  ) {
    // [VIS-8 PR-B] 🎲 « Continuer dans le créateur » : applique la composition
    // au personnage DÉJÀ démarré par cette page (jamais de re-démarrage —
    // `brouillon_existant` sinon), via les vraies portes `ClientCreation`.
    // La PRÉSENCE de ce prop allume la porte 🎲 (décision 28/33) — le double
    // gate tient : sans `GENERATEUR_ACTIF`, ce bloc n'est jamais rendu.
    const appliquerTirage = async (resultat: {
      tirage: TiragePersonnage;
      composition: CompositionOk;
    }) => {
      if (applicationTirage) return;
      setApplicationTirage(true);
      try {
        const res = await appliquerComposition(clientActif, resultat, personnageId);
        if (!res.faits.some((f) => f.type === "etape4")) {
          // Échec AVANT l'étape 4 : les achats n'ont pas commencé (ordre du
          // plan), rien d'irréversible — on reste sur la fiche (retry sûr).
          toast.error(
            res.echecs[0]?.message ||
              "Le personnage n'a pas pu être préparé. Réessaie, ou passe par « Je bâtis moi-même ».",
          );
          return;
        }
        if (res.echecs.length > 0) {
          // Politique VIS-6 : achats refusés journalisés, on continue — le
          // créateur est l'endroit où compléter (pas de re-tentative ici,
          // les jauges répétées doubleraient).
          toast.warning(
            `${res.echecs.length} achat${res.echecs.length > 1 ? "s" : ""} n'a pas pu être appliqué — tu pourras compléter dans le créateur.`,
          );
        }
        // Le rejeu a écrit via RPC : purger tout le cache du personnage
        // (pattern maison : toute clé qui porte l'id).
        await queryClient.invalidateQueries({
          predicate: (q) => q.queryKey.includes(personnageId),
        });
        setAccueilFranchi(true); // → wizard, étape 1 : le joueur nomme son perso
      } catch (e) {
        // `ErreurConversionTirage` (snapshot inutilisable) ou panne réseau
        // inattendue : message en clair, on reste sur la fiche.
        toast.error(
          e instanceof Error
            ? e.message
            : "Le tirage n'a pas pu être appliqué. Réessaie.",
        );
      } finally {
        setApplicationTirage(false);
      }
    };

    return (
      <>
        <Generateur
          modeVisiteur={modeVisiteur}
          onBatirMoiMeme={() => setAccueilFranchi(true)}
          onAppliquerTirage={appliquerTirage}
        />
        {applicationTirage && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-gold" />
            <p className="text-sm text-white/80">Préparation du personnage…</p>
          </div>
        )}
      </>
    );
  }

  // [s368 #3] « Tu pourras revenir ici à tout moment » — la promesse de
  // l'accueil. Le retour est offert EXACTEMENT quand l'accueil se
  // ré-afficherait à un rechargement (même fonction, accueilFranchi remis à
  // faux) : jamais en admin/campagne/reprise, jamais passé l'étape 1 — donc
  // jamais sur un personnage avancé qu'un rejeu pourrait écraser.
  const peutRevenirAuxPortes =
    accueilFranchi &&
    doitMontrerAccueil({
      actif: GENERATEUR_ACTIF,
      accueilFranchi: false,
      modeAdmin,
      modeCampagne,
      reprise: !!personnageIdParUrl,
      etape,
    });

  // -- Rendu principal -------------------------------------------------------
  return (
    <>
      {/* ÉDITION-ADMIN-WIZARD : bandeau sticky d'indication + actions admin */}
      {modeAdmin && (
        <div className="sticky top-0 z-20 border-b border-bordeaux bg-bordeaux px-4 py-3">
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-white" />
            <div className="min-w-0 flex-1">
              <p className="font-heading text-sm font-bold text-white">
                ÉDITION ADMIN — {personnage?.nom ?? "Personnage"}
              </p>
              <p className="text-xs text-white/85">
                Verrous d'état contournés · l'état reste{" "}
                <b>{etatEdition ?? "…"}</b> · chaque achat est journalisé.
              </p>
            </div>
            <div className="grid shrink-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={terminerEditionAdmin}
                className="gap-2 border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                ← Terminer
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setXpDrawerOpen(true)}
                className="gap-2 border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Coins className="h-4 w-4" /> Ajuster XP
              </Button>
            </div>
          </div>
        </div>
      )}

      {modeCampagne && (
        <div className="sticky top-0 z-20 border-b border-gold/40 bg-gold/10 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <TrendingUp className="h-5 w-5 shrink-0 text-gold-accent" />
            <div className="min-w-0 flex-1">
              <p className="font-heading text-sm font-bold text-gold-accent">
                ÉVOLUTION DE CAMPAGNE — {personnage?.nom ?? "Personnage"}
              </p>
              <p className="text-xs text-foreground/80">
                Ajouts et améliorations uniquement. Ce qui a été joué en
                événement reste acquis.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/personnage/${personnageId}`)}
              className="shrink-0 gap-2"
            >
              ← Terminer
            </Button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        {/* En-tête : progression + XP */}
        <header className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-heading text-3xl text-gold">
                {modeCampagne ? "Évolution du personnage" : "Création de personnage"}
              </h1>
              <p className="text-sm text-white/50">
                Étape {dbToUi(etape)} / {TOTAL_STEPS_UI}
                {personnage?.nom ? ` — ${personnage.nom}` : ""}
              </p>
              {peutRevenirAuxPortes && (
                <button
                  type="button"
                  onClick={() => setAccueilFranchi(false)}
                  className="mt-1.5 rounded border border-white/15 px-2.5 py-1 text-xs text-white/70 transition-colors hover:border-gold/40 hover:text-white"
                >
                  🧭 Revenir aux trois chemins
                </button>
              )}
            </div>

            <div className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-2 text-right">
              <div className="text-[10px] uppercase tracking-widest text-gold/60">
                XP disponible
              </div>
              <div className="font-heading text-2xl text-gold">
                {xpDisponible}
              </div>
              <div className="text-[11px] text-white/50">
                {xpDepense} dépensés / {xpTotalAffiche} totaux
              </div>
            </div>
          </div>

          <Progress value={progression} className="h-2" />

          {/* NAV-2 : étapes non applicables absentes du stepper. Tant que
              l'applicabilité n'est pas résolue, on affiche un placeholder
              (rangée de pastilles squelettes, même hauteur) — jamais la liste
              complète puis retrait (pas de flash d'icônes qui disparaissent). */}
          {chargee ? (
            <StepperEtapes
              etapes={ETAPES_UI.filter((e) => applicable(uiToDb(e.n)))}
              courant={dbToUi(etape)}
              max={dbToUi(etapeMax)}
              onJump={(ui) => sauterEtape(uiToDb(ui))}
              verrouillees={
                modeCampagne
                  ? [...new Set(ETAPES_VERROUILLEES_CAMPAGNE.map(dbToUi))]
                  : []
              }
            />
          ) : (
            <div
              className="flex gap-2 overflow-x-auto px-1 pb-2"
              aria-hidden
            >
              {ETAPES_UI.map((e) => (
                <div
                  key={e.n}
                  className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                >
                  <span className="h-10 w-10 animate-pulse rounded-full border border-white/10 bg-white/5" />
                  <span className="h-2 w-10 animate-pulse rounded bg-white/5" />
                </div>
              ))}
            </div>
          )}

          {/* NAV-2 : loader discret pendant l'enchaînement des avancer_etape. */}
          {rattrapageEnCours && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Passage des étapes non applicables…
            </div>
          )}
        </header>

        {/* [s373] Sortie du générateur (🧭 comme 🎲) : le personnage est
            entièrement composé mais SANS NOM (etape_creation >= 5 + nom vide,
            combinaison impossible en création manuelle). Le bandeau nomme la
            cause ET la promesse : nommer déverrouille la promenade. */}
        {sansNom && (personnage?.etape_creation ?? 1) >= 5 && (
          <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
            ✨ Ton personnage est prêt — il ne lui manque qu'un nom.
            Donne-lui un nom ci-dessous : toutes les étapes se
            déverrouilleront et tu pourras te promener librement entre elles
            pour l'ajuster.
          </div>
        )}

        {/* Contenu de l'étape */}
        <main className="rounded-xl border border-white/10 bg-black/30 p-6 shadow-lg">
          {etape === 1 && (
            <Etape1_V2
              personnageId={personnageId}
              onSuccess={handleEtapeSuccess}
              onXpGainChange={setXpGainCourant}
              modeCampagne={modeCampagne}
              rattrapageFige={rattrapageFige}
            />
          )}
          {(etape === 2 || etape === 3) && (
            <Etape2_V2
              personnageId={personnageId}
              xpDisponible={xpDisponible}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
              onXpDeltaChange={setXpDeltaCourant}
              onXpGainChange={setXpGainCourant}
            />
          )}
          {etape === 4 && (
            <Etape4_V2
              personnageId={personnageId}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
            />
          )}
          {etape === 5 && (
            <Etape5_Competences_V2
              personnageId={personnageId}
              xpDisponible={xpDisponible}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
              onXpDeltaChange={setXpDeltaCourant}
              modeCampagne={modeCampagne}
            />
          )}
          {etape === 6 && (
            <Etape6_Sorts_V2
              personnageId={personnageId}
              xpDisponible={xpDisponible}
              niveauPersonnage={niveauPersonnage}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
              modeCampagne={modeCampagne}
            />
          )}
          {etape === 7 && (
            <Etape7_Prieres_V2
              personnageId={personnageId}
              xpDisponible={xpDisponible}
              niveauPersonnage={niveauPersonnage}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
              modeCampagne={modeCampagne}
            />
          )}
          {etape === 8 && (
            <Etape8_Assemblages_V2
              personnageId={personnageId}
              xpDisponible={xpDisponible}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
              modeCampagne={modeCampagne}
            />
          )}
          {etape === 9 && (
            <Etape9_Artisanat_V2
              personnageId={personnageId}
              xpDisponible={xpDisponible}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
              modeCampagne={modeCampagne}
            />
          )}
          {etape === 10 && (
            <Etape10_Recapitulatif_V2
              personnageId={personnageId}
              onSuccess={handleEtapeSuccess}
              onPrevious={handlePrevious}
              modeAdmin={modeAdmin}
              onTerminerAdmin={terminerEditionAdmin}
              modeCampagne={modeCampagne}
              onTerminerCampagne={() => navigate(`/personnage/${personnageId}`)}
            />
          )}
        </main>
      </div>

      {modeAdmin && (
        <DrawerAjusterXp
          personnageId={personnageId}
          nom={personnage?.nom ?? null}
          xpTotal={xpTotal}
          xpDepense={xpDepense}
          open={xpDrawerOpen}
          onOpenChange={setXpDrawerOpen}
        />
      )}
    </>
  );
};

export default PersonnageNouveauV2;

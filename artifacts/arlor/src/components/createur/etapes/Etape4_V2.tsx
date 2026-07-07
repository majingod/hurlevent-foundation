import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { clientActif } from "@/creation/clientActif";
import { chargerBrouillon } from "@/creation/visiteur/stockageBrouillon";
import { deriverEtat } from "@/moteurCreation/brouillon/deriver";
import { changerClasse } from "@/moteurCreation/brouillon/appliquer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ReligionDetails from "@/components/shared/ReligionDetails";
import ModaleChangementClasse, {
  type DChangementClasse,
} from "@/components/createur/ModaleChangementClasse";
import IntroEtape, { IntroEtapeItem } from "@/components/createur/aide/IntroEtape";
import BasculeAbregeIntegral from "@/components/shared/BasculeAbregeIntegral";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { useModeAffichage } from "@/contexts/ModeAffichageContext";
import type { EtapeProps } from "@/pages/PersonnageNouveauV2";

interface CompetenceGratuite {
  niveau: number;
  competence_id: string;
}

interface NiveauInfo {
  niveau: number;
  cout_xp: number;
  description?: string;
}

interface CompetenceInfo {
  id: string;
  nom: string;
  type_choix: string | null;
  type_achat: string | null;
  niveaux_parsed: NiveauInfo[];
}

// [VIS-1] Détection du mode visiteur par le pathname — MÊME source de vérité que
// le Proxy `clientActif` (qui route par URL). Choix du pathname plutôt qu'une
// prop descendue : ça garde le changement CHIRURGICAL (aucune modif de
// `EtapeProps`, partagée par les 9 écrans) et garantit ZÉRO diff en mode
// connecté (le prédicat est faux hors `/visiteur`).
const RE_VISITEUR = /^\/visiteur(\/|$)/;

// [VIS-1] Aperçu LOCAL d'un changement de classe (mode visiteur). Composé des
// helpers existants (`deriverEtat` + `changerClasse`) — aucune règle inventée :
// on compare les gratuités et l'XP AVANT/APRÈS le swap de classe.
interface ApercuVisiteurClasse {
  classeAvant: string;
  classeApres: string;
  retirees: string[];
  nouvelles: string[];
  xpRecupere: number;
}

// Forme du `donnees` renvoye par changer_classe_personnage en dry_run (apercu).
interface ApercuChangementClasse {
  classe_avant: string;
  classe_apres: string;
  perdues: {
    nom: string;
    raison: string;
    xp: number;
    niveaux: { niv: number; xp: number; gratuit: boolean }[];
  }[];
  dormants: { type: string; nom: string; niveau: number; xp: number }[];
  maitre_en_attente: { nom: string; niveau: number }[];
  offertes: { nom: string; type: string; xp: number }[];
  multi_choix: {
    competence_id: string;
    nom: string;
    defaut?: string | null;
    options: { choix_achat: string; label: string; xp: number }[];
  }[];
  xp_rembourse: number;
}

const Etape4_V2 = ({ personnageId, onSuccess, onPrevious }: EtapeProps) => {
  const [submitting, setSubmitting] = useState(false);
  const { mode, toggleMode } = useModeAffichage();
  const [classeIdSelectionnee, setClasseIdSelectionnee] = useState<string>("");
  const [classesOuvertes, setClassesOuvertes] = useState<Set<string>>(new Set());
  const [detailsComp, setDetailsComp] = useState<Set<string>>(new Set());
  const [fichesReligion, setFichesReligion] = useState<Set<string>>(new Set());
  const [legendeOuverte, setLegendeOuverte] = useState(false);
  const [choixParCompetence, setChoixParCompetence] = useState<
    Record<string, string>
  >({});
  const [devenirCroyant, setDevenirCroyant] = useState(true);

  // --- Changement de classe (perso ayant déjà une classe) ---
  const [modaleOpen, setModaleOpen] = useState(false);
  const [previewDonnees, setPreviewDonnees] = useState<ApercuChangementClasse | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [previewBusy, setPreviewBusy] = useState(false);
  const [pendingCtx, setPendingCtx] = useState<{
    classeId: string;
    choixFinaux: Record<string, string>;
    religionChoisie: string | null;
    religionInitiale: string | null;
  } | null>(null);

  // [VIS-1] AlertDialog d'aperçu du changement de classe en mode visiteur.
  const [apercuVisiteur, setApercuVisiteur] =
    useState<ApercuVisiteurClasse | null>(null);
  const [visiteurDialogOpen, setVisiteurDialogOpen] = useState(false);

  // Pattern Set manuel (gotcha s152 : Radix Accordion a enfants interactifs proscrit).
  const toggleSet = (
    setter: (updater: (prev: Set<string>) => Set<string>) => void,
    key: string
  ) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const { data: perso } = useQuery({
    queryKey: ["v2-perso-classe", personnageId],
    queryFn: async () => {
      const { data, error } = await clientActif.lirePersonnageClasse(
        personnageId,
      );
      if (error) throw error;
      return data;
    },
  });

  const { data: compNamesActuelles = [] } = useQuery({
    queryKey: ["v2-comp-names-actuelles", personnageId],
    enabled: !!perso?.classe_id,
    queryFn: async () => {
      const { data, error } = await clientActif.lirePersonnageCompetencesNoms(
        personnageId,
      );
      if (error) throw error;
      const noms = (data ?? [])
        .map((r: any) => r.competences?.nom)
        .filter(Boolean) as string[];
      return Array.from(new Set(noms));
    },
  });

  const { data: classes = [], isLoading, isError: classesError, refetch: refetchClasses } = useQuery({
    queryKey: ["v2-classes"],
    queryFn: async () => {
      const { data, error } = await clientActif.lireClasses();
      if (error) throw error;
      return data ?? [];
    },
  });

  const raceId = perso?.race_id ?? null;
  const { data: race } = useQuery({
    queryKey: ["v2-race-restrictions", raceId],
    enabled: !!raceId,
    queryFn: async () => {
      const { data, error } = await clientActif.lireRace(raceId!);
      if (error) throw error;
      return data;
    },
  });

  const restrictions = (race?.restrictions_classes ?? []) as string[];
  const classesAffichees = restrictions.length
    ? classes.filter(
        (c: any) =>
          !restrictions.includes(c.id) && !restrictions.includes(c.nom)
      )
    : classes;

  const classeSelectionnee = useMemo(
    () => classes.find((c: any) => c.id === classeIdSelectionnee) ?? null,
    [classes, classeIdSelectionnee]
  );

  const competencesGratuites: CompetenceGratuite[] = useMemo(() => {
    const raw = classeSelectionnee?.competences_gratuites;
    return Array.isArray(raw) ? (raw as unknown as CompetenceGratuite[]) : [];
  }, [classeSelectionnee]);

  const tousLesCompetenceIds = useMemo(() => {
    const ids = new Set<string>();
    classes.forEach((c: any) => {
      const raw = c.competences_gratuites;
      if (Array.isArray(raw)) {
        raw.forEach((g: any) => {
          if (g?.competence_id) ids.add(g.competence_id);
        });
      }
    });
    return Array.from(ids);
  }, [classes]);

  const { data: infosCompetences = [] } = useQuery({
    queryKey: [
      "v2-infos-comp-gratuites-all-classes",
      tousLesCompetenceIds.join(","),
    ],
    enabled: tousLesCompetenceIds.length > 0,
    queryFn: async () => {
      const { data, error } = await clientActif.lireCompetencesParIds(
        tousLesCompetenceIds,
      );
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        id: c.id as string,
        nom: c.nom as string,
        type_choix: (c.type_choix ?? null) as string | null,
        type_achat: (c.type_achat ?? null) as string | null,
        niveaux_parsed: parseNiveaux(c.niveaux),
      })) as CompetenceInfo[];
    },
  });

  const infosCompetencesMap = useMemo(() => {
    const map = new Map<string, CompetenceInfo>();
    infosCompetences.forEach((c) => map.set(c.id, c));
    return map;
  }, [infosCompetences]);

  const competencesParClasseId = useMemo(() => {
    const result: Record<string, CompetenceInfo[]> = {};
    classes.forEach((c: any) => {
      const raw = c.competences_gratuites;
      const liste: CompetenceInfo[] = [];
      if (Array.isArray(raw)) {
        raw.forEach((g: any) => {
          const info = infosCompetencesMap.get(g?.competence_id);
          if (info) liste.push(info);
        });
      }
      result[c.id] = liste;
    });
    return result;
  }, [classes, infosCompetencesMap]);

  const competencesAvecChoix = useMemo(
    () =>
      competencesGratuites
        .map((g) => infosCompetencesMap.get(g.competence_id))
        .filter(
          (c): c is CompetenceInfo => !!c && c.type_choix !== null
        ),
    [competencesGratuites, infosCompetencesMap]
  );

  const aBesoinChoixReligion = competencesAvecChoix.some(
    (c) => c.type_choix === "religion"
  );
  const aBesoinChoixLangueAncienne = competencesAvecChoix.some(
    (c) => c.type_choix === "langue_ancienne"
  );

  const { data: languesAnciennes = [] } = useQuery({
    queryKey: ["v2-langues-anciennes"],
    enabled: aBesoinChoixLangueAncienne,
    queryFn: async () => {
      const { data, error } = await clientActif.lireLanguesAnciennes();
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: religions = [] } = useQuery({
    queryKey: ["v2-religions-full"],
    enabled: aBesoinChoixReligion,
    queryFn: async () => {
      const { data, error } = await clientActif.lireReligions();
      if (error) throw error;
      return data ?? [];
    },
  });

  const dejaCroyant = !!perso?.est_croyant && !!perso?.religion_id;

  // Auto-remplir le choix religion si déjà croyant
  useEffect(() => {
    if (dejaCroyant && perso?.religion_id) {
      const compReligion = competencesAvecChoix.find(
        (c) => c.type_choix === "religion"
      );
      if (compReligion) {
        setChoixParCompetence((prev) => ({
          ...prev,
          [compReligion.id]: perso.religion_id!,
        }));
      }
    }
  }, [dejaCroyant, perso?.religion_id, competencesAvecChoix]);

  useEffect(() => {
    if (perso?.classe_id) {
      const cid = perso.classe_id;
      setClasseIdSelectionnee(cid);
      setClassesOuvertes((prev) => new Set(prev).add(cid));
    }
  }, [perso]);

  // Validité formulaire pour griser le bouton Suivant.
  // Reproduit la logique de onSubmit (les toast.error restent en backup
  // pour les race conditions et les RPC errors).
  const isValid = useMemo(() => {
    if (!classeIdSelectionnee) return false;
    // Chaque compétence avec choix doit avoir un choix renseigné, sauf
    // fallback automatique pour religion si le perso est déjà croyant.
    for (const c of competencesAvecChoix) {
      if (choixParCompetence[c.id]) continue;
      if (c.type_choix === "religion" && dejaCroyant && perso?.religion_id) continue;
      return false;
    }
    // Si une compétence religion est requise mais le perso n'est pas croyant,
    // exiger le consentement explicite (devenirCroyant).
    const compReligion = competencesAvecChoix.find((c) => c.type_choix === "religion");
    if (compReligion && !dejaCroyant && !devenirCroyant) return false;
    return true;
  }, [
    classeIdSelectionnee,
    competencesAvecChoix,
    choixParCompetence,
    dejaCroyant,
    perso?.religion_id,
    devenirCroyant,
  ]);

  // Appel dry_run -> donnees (ou null si erreur, toast affiché)
  const callDryRun = async (
    classeId: string,
    choix: Record<string, string>
  ): Promise<ApercuChangementClasse | null> => {
    const { data, error } = await clientActif.changerClassePersonnage({
      p_personnage_id: personnageId,
      p_classe_id: classeId,
      p_choix_par_competence: choix,
      p_dry_run: true,
    });
    if (error) {
      toast.error(`Erreur aperçu : ${error.message}`);
      return null;
    }
    const payload = (data ?? {}) as Record<string, unknown>;
    if (payload.succes === false) {
      const erreurs = (payload.erreurs as Array<any>) ?? [];
      toast.error(erreurs[0]?.message ?? "Aperçu refusé.");
      return null;
    }
    return (payload.donnees as ApercuChangementClasse) ?? null;
  };

  // Sauvegarde réelle (étape 4). Retourne true si succès.
  const executerSauvegarde = async (
    classeId: string,
    choixComplets: Record<string, string>,
    religionChoisie: string | null,
    religionInitiale: string | null
  ): Promise<boolean> => {
    const { data, error } = await clientActif.sauvegarderEtape4({
      p_personnage_id: personnageId,
      p_classe_id: classeId,
      p_choix_par_competence: choixComplets,
    });
    if (error) {
      console.error("[V2 Etape4] RPC error:", error);
      toast.error(`Erreur : ${error.message}`);
      return false;
    }
    const payload = (data ?? {}) as Record<string, unknown>;
    if (payload.succes === false) {
      const erreurs = (payload.erreurs as Array<any>) ?? [];
      const code = erreurs[0]?.code ?? "erreur";
      const message = erreurs[0]?.message ?? "Sauvegarde refusée.";
      toast.error(`[${code}] ${message}`);
      return false;
    }
    toast.success("Classe enregistrée.");
    if (dejaCroyant && religionChoisie && religionChoisie !== religionInitiale) {
      const nomReligion = (religions as Array<{ id: string; nom: string }>).find(
        (r) => r.id === religionChoisie
      )?.nom;
      if (nomReligion) {
        toast.info(
          `Religion mise à jour : tu es maintenant croyant de ${nomReligion}`
        );
      }
    }
    return true;
  };

  // Changement de sélection multi-choix -> re-appel dry_run (total XP live)
  const onSelectInstance = async (competenceId: string, choixAchat: string) => {
    const next = { ...selections, [competenceId]: choixAchat };
    setSelections(next);
    if (!pendingCtx) return;
    setPreviewBusy(true);
    const donnees = await callDryRun(pendingCtx.classeId, {
      ...pendingCtx.choixFinaux,
      ...next,
    });
    setPreviewBusy(false);
    if (donnees) setPreviewDonnees(donnees);
  };

  const onConfirmChangement = async () => {
    if (!pendingCtx) return;
    setPreviewBusy(true);
    const ok = await executerSauvegarde(
      pendingCtx.classeId,
      { ...pendingCtx.choixFinaux, ...selections },
      pendingCtx.religionChoisie,
      pendingCtx.religionInitiale
    );
    setPreviewBusy(false);
    if (ok) {
      setModaleOpen(false);
      onSuccess();
    }
  };

  // [VIS-1] Confirmation de l'AlertDialog visiteur → sauvegarde réelle. La
  // sauvegarde passe par `clientActif` (routé vers `clientVisiteur`) qui applique
  // le VRAI `changerClasse` + `sauvegarderEtape4` sur le brouillon local.
  const onConfirmVisiteur = async () => {
    if (!pendingCtx) return;
    setSubmitting(true);
    const ok = await executerSauvegarde(
      pendingCtx.classeId,
      pendingCtx.choixFinaux,
      pendingCtx.religionChoisie,
      pendingCtx.religionInitiale
    );
    setSubmitting(false);
    setVisiteurDialogOpen(false);
    if (ok) onSuccess();
  };

  // Mapping donnees (dry_run) -> forme `d` de la modale
  const previewD = useMemo<DChangementClasse | null>(() => {
    if (!previewDonnees) return null;
    const dn = previewDonnees;
    const toNom = dn.classe_apres as string;
    const fromNom = dn.classe_avant as string;
    const emoji = (nom: string) =>
      (classes.find((c: any) => c.nom === nom)?.emoji as string) ?? "•";
    const whyPerdue = (raison: string) =>
      raison === "class_locked"
        ? "Réservée à une autre classe — retrait entier"
        : raison === "gratuite_obsolete"
        ? `Gratuite de l'ancienne classe — non offerte par ${toNom}`
        : "Retirée en cascade (un prérequis a été perdu)";

    const perdues: DChangementClasse["perdues"] = [];
    const reduites: DChangementClasse["reduites"] = [];
    ((dn.perdues as Array<any>) ?? []).forEach((p) => {
      const niveaux = (p.niveaux as Array<any>) ?? [];
      if (p.raison === "over_cap") {
        const maxNiv = niveaux.reduce((m, l) => Math.max(m, l.niv), 0);
        reduites.push({
          nom: p.nom,
          from: maxNiv,
          to: 2,
          why: "Hors-classe : plafond niveau 2 — le(s) niveau(x) au-dessus sont retirés",
          xp: p.xp,
        });
      } else if (niveaux.length > 1) {
        perdues.push({
          nom: p.nom,
          cascade: true,
          why: whyPerdue(p.raison),
          levels: niveaux.map((l) => ({
            niv: l.niv,
            gratuit: !!l.gratuit,
            xp: l.xp,
          })),
        });
      } else {
        const l = niveaux[0] ?? { niv: 1, xp: p.xp, gratuit: p.xp === 0 };
        perdues.push({
          nom: p.nom,
          niv: l.niv,
          xp: p.xp,
          gratuit: !!l.gratuit,
          why: whyPerdue(p.raison),
        });
      }
    });

    const multiNames = new Set(
      ((dn.multi_choix as Array<any>) ?? []).map((m) => m.nom)
    );
    const offertes = (dn.offertes as Array<any>) ?? [];
    const offertesRefund = offertes
      .filter((o) => o.type === "d6_refund" && !multiNames.has(o.nom))
      .map((o) => ({
        nom: o.nom,
        niv: 1,
        why: `Déjà payée — offerte par ${toNom} → remboursée et rendue gratuite`,
        xp: o.xp,
      }));
    const nouvelles = offertes
      .filter((o) => o.type === "ajout")
      .map((o) => ({ nom: o.nom, niv: 1 }));
    const multiChoix = ((dn.multi_choix as Array<any>) ?? []).map((m) => ({
      competence_id: m.competence_id,
      nom: m.nom,
      why: `Offerte par ${toNom} (1 instance gratuite). Tu en as ${
        (m.options as Array<any>).length
      } payées — choisis laquelle devient gratuite ; les autres restent payées.`,
      options: ((m.options as Array<any>) ?? []).map((o) => ({
        id: o.choix_achat,
        label: o.label,
        xp: o.xp,
      })),
    }));

    const dormItems = ((dn.dormants as Array<any>) ?? []).map((sd) => ({
      nom: sd.nom,
      niv: sd.niveau ?? 0,
    }));
    const dormXp = ((dn.dormants as Array<any>) ?? []).reduce(
      (a, sd) => a + (sd.xp ?? 0),
      0
    );
    const maitre = ((dn.maitre_en_attente as Array<any>) ?? []).map((m) => ({
      nom: m.nom,
      niv: m.niveau,
      why: "Niveau hors-classe → l'approbation d'un maître devient requise",
    }));

    const touched = new Set<string>();
    ((dn.perdues as Array<any>) ?? []).forEach((p) => touched.add(p.nom));
    ((dn.maitre_en_attente as Array<any>) ?? []).forEach((m) =>
      touched.add(m.nom)
    );
    offertes.forEach((o) => touched.add(o.nom));
    ((dn.multi_choix as Array<any>) ?? []).forEach((m) => touched.add(m.nom));
    const inchangees = compNamesActuelles.filter((n) => !touched.has(n));

    return {
      from: { n: fromNom, e: emoji(fromNom) },
      to: { n: toNom, e: emoji(toNom) },
      perso: perso?.nom ?? "Personnage",
      perdues,
      reduites,
      offertesRefund,
      multiChoix,
      dormants: {
        items: dormItems,
        xp: dormXp,
        why: "Leur niveau dépasse l'accès restant.",
      },
      maitre,
      nouvelles,
      inchangees,
      xpRembourse: dn.xp_rembourse ?? 0,
    };
  }, [previewDonnees, classes, compNamesActuelles, perso]);

  const onSubmit = async () => {
    if (!classeIdSelectionnee) {
      toast.error("Choisis une classe.");
      return;
    }

    // Valider les choix obligatoires, avec fallback automatique pour religion
    // si le personnage est déjà croyant (sa religion étape 1 est utilisée).
    const choixEffectif: Record<string, string> = { ...choixParCompetence };
    for (const c of competencesAvecChoix) {
      if (!choixEffectif[c.id]) {
        if (c.type_choix === "religion" && dejaCroyant && perso?.religion_id) {
          choixEffectif[c.id] = perso.religion_id;
          continue;
        }
        const typeNom =
          c.type_choix === "religion" ? "religion" : "langue ancienne";
        toast.error(`Un choix de ${typeNom} est requis pour : ${c.nom}.`);
        return;
      }
    }

    const compReligion = competencesAvecChoix.find(
      (c) => c.type_choix === "religion"
    );

    // Pour un perso non-croyant, exiger le consentement explicite à devenir croyant.
    if (compReligion && !dejaCroyant && !devenirCroyant) {
      toast.error(
        "Tu dois accepter de devenir croyant pour valider le choix de religion."
      );
      return;
    }

    const choixFinaux: Record<string, string> = {};
    for (const c of competencesAvecChoix) {
      if (choixEffectif[c.id]) choixFinaux[c.id] = choixEffectif[c.id];
    }

    const religionChoisie = compReligion ? choixFinaux[compReligion.id] : null;
    const religionInitiale = perso?.religion_id ?? null;

    // Changement de classe (le perso a déjà une classe différente).
    const estChangementClasse =
      !!perso?.classe_id && classeIdSelectionnee !== perso.classe_id;

    if (estChangementClasse) {
      // [VIS-1] Mode visiteur : le serveur n'est pas juge (dry_run local hollow).
      // On calcule l'aperçu depuis le brouillon (deriverEtat avant/après swap) et
      // on demande confirmation via un AlertDialog. Mode connecté : INCHANGÉ.
      const estVisiteur = RE_VISITEUR.test(window.location.pathname);
      if (estVisiteur) {
        const b = chargerBrouillon();
        if (b) {
          const avant = deriverEtat(b);
          const apres = deriverEtat(changerClasse(b, classeIdSelectionnee));
          const cle = (g: { competenceId: string; niveauAcquis: number; choixAchat: string | null }) =>
            `${g.competenceId}|${g.niveauAcquis}|${g.choixAchat ?? ""}`;
          const avantSet = new Set(avant.gratuites.map(cle));
          const apresSet = new Set(apres.gratuites.map(cle));
          const uniq = (noms: string[]) => [...new Set(noms.filter(Boolean))];
          const nomClasse = (id: string) =>
            (classes.find((c: any) => c.id === id)?.nom as string) ?? "—";
          setPendingCtx({
            classeId: classeIdSelectionnee,
            choixFinaux,
            religionChoisie,
            religionInitiale,
          });
          setApercuVisiteur({
            classeAvant: nomClasse(perso?.classe_id ?? ""),
            classeApres: nomClasse(classeIdSelectionnee),
            retirees: uniq(
              avant.gratuites
                .filter((g) => !apresSet.has(cle(g)))
                .map((g) => g.competenceNom)
            ),
            nouvelles: uniq(
              apres.gratuites
                .filter((g) => !avantSet.has(cle(g)))
                .map((g) => g.competenceNom)
            ),
            xpRecupere: Math.max(0, apres.xpDispo - avant.xpDispo),
          });
          setVisiteurDialogOpen(true);
          return;
        }
        // Brouillon absent (cas dégénéré) → sauvegarde directe sans aperçu.
        setSubmitting(true);
        const okv = await executerSauvegarde(
          classeIdSelectionnee,
          choixFinaux,
          religionChoisie,
          religionInitiale
        );
        setSubmitting(false);
        if (okv) onSuccess();
        return;
      }

      setSubmitting(true);
      const donnees = await callDryRun(classeIdSelectionnee, choixFinaux);
      setSubmitting(false);
      if (!donnees) return;

      // Seuil figé (s213) — piloté par le RÉSULTAT du dry_run, pas par un
      // prédicat structurel : la modale ne s'ouvre QUE si le changement a une
      // conséquence réelle = XP remboursé, compétence ACHETÉE perdue, ou
      // sort/prière mis en dormance. Sinon → changement silencieux.
      const perteAchetee = (donnees.perdues ?? []).some((p) =>
        (p.niveaux ?? []).some((n) => n.gratuit === false)
      );
      const dormance = (donnees.dormants ?? []).length > 0;
      const declencheModale =
        (donnees.xp_rembourse ?? 0) > 0 || perteAchetee || dormance;

      if (declencheModale) {
        const sel: Record<string, string> = {};
        ((donnees.multi_choix as Array<any>) ?? []).forEach((m) => {
          if (m?.competence_id && m?.defaut) sel[m.competence_id] = m.defaut;
        });
        setSelections(sel);
        setPendingCtx({
          classeId: classeIdSelectionnee,
          choixFinaux,
          religionChoisie,
          religionInitiale,
        });
        setPreviewDonnees(donnees);
        setModaleOpen(true);
        return;
      }

      // Changement sans conséquence → sauvegarde silencieuse directe.
      setSubmitting(true);
      const okSilencieux = await executerSauvegarde(
        classeIdSelectionnee,
        choixFinaux,
        religionChoisie,
        religionInitiale
      );
      setSubmitting(false);
      if (okSilencieux) onSuccess();
      return;
    }

    // Première sélection (ou classe identique) → sauvegarde directe.
    setSubmitting(true);
    const ok = await executerSauvegarde(
      classeIdSelectionnee,
      choixFinaux,
      religionChoisie,
      religionInitiale
    );
    setSubmitting(false);
    if (ok) onSuccess();
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-6"
      >
        <IntroEtape
          storageKey="hv-e4-intro-replie"
          titre="Comment fonctionne le choix de classe ?"
        >
          <IntroEtapeItem n={1}>
            Coche ta classe principale. Elle fixe tes{" "}
            <span className="text-primary">PV et PS de départ</span> et t'offre
            des compétences gratuites (niveau 1).
          </IntroEtapeItem>
          <IntroEtapeItem n={2}>
            Certaines compétences offertes demandent un{" "}
            <span className="text-primary">choix</span> (une langue ancienne, une
            religion) : coche ton option.
          </IntroEtapeItem>
          <IntroEtapeItem n={3}>
            « Détails » montre ce que fait chaque compétence. Tu pourras en
            acheter d'autres à l'étape Compétences.
          </IntroEtapeItem>
        </IntroEtape>

        {/* Légende repliable — symboles adaptés au contexte classe */}
        <div className="rounded-xl border border-white/10 bg-black/25">
          <button
            type="button"
            onClick={() => setLegendeOuverte((o) => !o)}
            aria-expanded={legendeOuverte}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-white/70"
          >
            {legendeOuverte ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            ℹ Comprendre les symboles
          </button>
          {legendeOuverte && (
            <div className="space-y-2 px-3 pb-3 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 rounded border border-green-600/30 bg-green-600/20 px-2 py-0.5 text-[11px] font-medium text-green-400">
                  Acquis gratuitement
                </span>
                <span className="text-white/60">
                  Compétence offerte par ta classe — niveau 1 inclus, sans coût.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white/60">
                  Niveau 1
                </span>
                <span className="text-white/60">
                  Seul le niveau 1 est offert ; les niveaux supérieurs s'achètent
                  à l'étape Compétences.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 text-[11px] text-amber-400">
                  ● choix requis
                </span>
                <span className="text-white/60">
                  Cette compétence demande un choix (langue ancienne ou religion).
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 rounded-full border border-gold/60 bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold">
                  ✦ Ton choix
                </span>
                <span className="text-white/60">
                  Ton choix gratuit — en sélectionner un autre annule le précédent.
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="font-heading text-2xl text-gold">Choisis ta classe</h2>
          <p className="text-sm text-white/50">
            PV / PS de départ + compétences gratuites de la classe.
          </p>
        </div>

        <BasculeAbregeIntegral mode={mode} onToggle={toggleMode} />

        {classesError && <ErreurChargement onRetry={() => refetchClasses()} />}

        {isLoading && (
          <p className="text-white/50">Chargement des classes…</p>
        )}

        <div className="space-y-2.5">
          {classesAffichees.map((c: any) => {
            const selectionne = classeIdSelectionnee === c.id;
            const ouverte = classesOuvertes.has(c.id);
            const gratuites = competencesParClasseId[c.id] ?? [];
            const texteClasse =
              mode === "integral"
                ? c.description ?? c.resume_condense
                : c.resume_condense ?? c.description;
            return (
              <div
                key={c.id}
                className={`overflow-hidden rounded-xl border transition-colors ${
                  selectionne
                    ? "border-gold/50 bg-gold/[0.06]"
                    : "border-white/10 bg-black/25"
                }`}
              >
                {/* En-tête : case (sélectionne) + zone (ouvre/ferme) */}
                <div className="flex items-start gap-3 p-3">
                  <Checkbox
                    checked={selectionne}
                    onCheckedChange={() => {
                      if (selectionne) {
                        setClasseIdSelectionnee("");
                      } else {
                        setClasseIdSelectionnee(c.id);
                        setClassesOuvertes(new Set([c.id]));
                        // PR4 persist-au-choix : persiste classe_id en brouillon.
                        // Garde !perso?.classe_id => 1er choix en creation
                        // uniquement (evite la cascade changer_classe en
                        // edition, ou perso.classe_id cache desync l'apercu).
                        // Fire-and-forget : pas d'attente, pas d'avancement.
                        if (!perso?.classe_id) {
                          clientActif
                            .sauvegarderEtape4({
                              p_personnage_id: personnageId,
                              p_classe_id: c.id,
                              p_choix_par_competence: null,
                              p_brouillon: true,
                            })
                            .then(
                              () => {},
                              () => {},
                            );
                        }
                      }
                    }}
                    className="mt-0.5"
                    aria-label={`Choisir la classe ${c.nom}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setClassesOuvertes((prev) =>
                        prev.has(c.id) ? new Set() : new Set([c.id]),
                      )
                    }
                    aria-expanded={ouverte}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-semibold text-gold">
                        {c.emoji ? <span>{c.emoji}</span> : null}
                        {c.nom}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                          PV {c.pv_depart ?? "?"} · PS {c.ps_depart ?? "?"}
                        </span>
                        <ChevronRight
                          className={`h-4 w-4 flex-shrink-0 text-gold transition-transform ${
                            ouverte ? "rotate-90" : ""
                          }`}
                        />
                      </span>
                    </div>
                    {gratuites.length > 0 && (
                      <div className="mt-1.5 text-[11.5px] text-white/55">
                        <span className="font-semibold text-green-400">
                          Compétences gratuites :{" "}
                        </span>
                        {gratuites.map((g) => g.nom).join(" · ")}
                      </div>
                    )}
                  </button>
                </div>

                {ouverte && (
                  <div className="space-y-3 px-3 pb-3 pl-12">
                    {texteClasse && (
                      <p className="whitespace-pre-line text-sm leading-relaxed text-white/75">
                        {texteClasse}
                      </p>
                    )}

                    {gratuites.length > 0 && (
                      <div className="space-y-2">
                        <div className="font-heading text-sm text-gold">
                          Compétences gratuites
                        </div>
                        {gratuites.map((comp) => (
                          <CompetenceGratuiteEtape5
                            key={comp.id}
                            comp={comp}
                            estClasseSelectionnee={selectionne}
                            choisi={choixParCompetence[comp.id] ?? null}
                            detailsOuvert={detailsComp.has(`${c.id}:${comp.id}`)}
                            onToggleDetails={() =>
                              toggleSet(setDetailsComp, `${c.id}:${comp.id}`)
                            }
                            religions={religions as any[]}
                            languesAnciennes={languesAnciennes as any[]}
                            onChoisir={(valeur) =>
                              setChoixParCompetence((prev) => ({
                                ...prev,
                                [comp.id]: valeur,
                              }))
                            }
                            estFicheOuverte={(rid) =>
                              fichesReligion.has(`${comp.id}:${rid}`)
                            }
                            onToggleFiche={(rid) =>
                              toggleSet(setFichesReligion, `${comp.id}:${rid}`)
                            }
                            dejaCroyant={dejaCroyant}
                            devenirCroyant={devenirCroyant}
                            onDevenirCroyant={setDevenirCroyant}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Avertissement changement de classe (perso ayant déjà une classe) */}
        {!!perso?.classe_id &&
          classeIdSelectionnee &&
          classeIdSelectionnee !== perso.classe_id && (
            <div className="rounded-lg border border-bordeaux/60 bg-bordeaux/15 p-3 text-[12.5px] leading-relaxed text-white/80">
              ⚠️ <strong>Changement de classe.</strong> Au « Suivant », si ce
              changement retire des compétences achetées, rembourse des XP ou met
              des sorts/prières en sommeil, un aperçu s'affiche{" "}
              <strong>avant</strong> toute sauvegarde.
            </div>
          )}

        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" onClick={onPrevious}>
            Étape précédente
          </Button>
          <Button
            type="submit"
            disabled={submitting || !isValid}
            className="bg-gold text-black hover:bg-gold/90"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Suivant
          </Button>
        </div>
      </form>
      {modaleOpen && previewD && (
        <ModaleChangementClasse
          d={previewD}
          selections={selections}
          busy={previewBusy}
          onSelect={onSelectInstance}
          onConfirm={onConfirmChangement}
          onCancel={() => {
            if (!previewBusy) {
              setModaleOpen(false);
              setPreviewDonnees(null);
            }
          }}
        />
      )}

      {/* [VIS-1] Aperçu du changement de classe en mode visiteur (moteur local). */}
      <AlertDialog
        open={visiteurDialogOpen}
        onOpenChange={(o) => {
          if (!submitting) setVisiteurDialogOpen(o);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Changer de classe{apercuVisiteur ? ` : ${apercuVisiteur.classeAvant} → ${apercuVisiteur.classeApres}` : ""} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Voici ce que ce changement implique pour ton brouillon. Rien n'est
              enregistré tant que tu n'as pas confirmé.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {apercuVisiteur && (
            <div className="space-y-3 text-sm">
              {apercuVisiteur.retirees.length > 0 && (
                <div>
                  <p className="font-semibold text-foreground">
                    Compétences qui ne seront plus offertes gratuitement
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {apercuVisiteur.retirees.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
              {apercuVisiteur.nouvelles.length > 0 && (
                <div>
                  <p className="font-semibold text-foreground">
                    Nouvelles compétences gratuites
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {apercuVisiteur.nouvelles.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
              {apercuVisiteur.xpRecupere > 0 && (
                <p className="text-primary">
                  XP récupéré : {apercuVisiteur.xpRecupere}
                </p>
              )}
              {apercuVisiteur.retirees.length === 0 &&
                apercuVisiteur.nouvelles.length === 0 &&
                apercuVisiteur.xpRecupere === 0 && (
                  <p className="text-muted-foreground">
                    Aucune conséquence sur tes acquis.
                  </p>
                )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                void onConfirmVisiteur();
              }}
            >
              Changer de classe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// =========================================================================
// HELPERS / SOUS-COMPOSANTS
// =========================================================================

// Parse la colonne competences.niveaux (JSONB) — même forme qu'à l'étape 5.
function parseNiveaux(raw: unknown): NiveauInfo[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const obj = entry as Record<string, unknown>;
      return {
        niveau: typeof obj.niveau === "number" ? obj.niveau : Number(obj.niveau ?? 1),
        cout_xp: typeof obj.cout_xp === "number" ? obj.cout_xp : Number(obj.cout_xp ?? 0),
        description:
          typeof obj.description === "string" ? obj.description : undefined,
      } as NiveauInfo;
    })
    .filter((n): n is NiveauInfo => n !== null)
    .sort((a, b) => a.niveau - b.niveau);
}

interface CompGratuiteProps {
  comp: CompetenceInfo;
  estClasseSelectionnee: boolean;
  choisi: string | null;
  detailsOuvert: boolean;
  onToggleDetails: () => void;
  religions: any[];
  languesAnciennes: any[];
  onChoisir: (valeur: string) => void;
  estFicheOuverte: (religionId: string) => boolean;
  onToggleFiche: (religionId: string) => void;
  dejaCroyant: boolean;
  devenirCroyant: boolean;
  onDevenirCroyant: (v: boolean) => void;
}

// Compétence gratuite rendue « façon étape 5 » : pastille « Acquis gratuitement »
// + Niveau 1, Détails (niveau 1 offert + paliers 2-3 en LECTURE SEULE), et choix
// radio-like (langue / religion) réutilisant ReligionDetails.
function CompetenceGratuiteEtape5({
  comp,
  estClasseSelectionnee,
  choisi,
  detailsOuvert,
  onToggleDetails,
  religions,
  languesAnciennes,
  onChoisir,
  estFicheOuverte,
  onToggleFiche,
  dejaCroyant,
  devenirCroyant,
  onDevenirCroyant,
}: CompGratuiteProps) {
  const { mode } = useModeAffichage();
  const estReligion = comp.type_choix === "religion";
  const estLangue = comp.type_choix === "langue_ancienne";
  const aChoix = estReligion || estLangue;
  const niveaux = comp.niveaux_parsed ?? [];
  const niv1 = niveaux[0];
  const suivants = niveaux.slice(1);

  const options: { id: string; nom: string }[] = estReligion
    ? religions.map((r) => ({ id: r.id as string, nom: r.nom as string }))
    : estLangue
    ? languesAnciennes.map((l) => ({ id: l.id as string, nom: l.nom as string }))
    : [];

  return (
    <div className="overflow-hidden rounded-lg border border-gold/40">
      {/* En-tête façon étape 5 (pastille adaptée au contexte classe) */}
      <div className="flex flex-wrap items-center gap-2 border-l-4 border-gold bg-gold/[0.12] px-3 py-2">
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded bg-gold text-[12px] font-black text-black">
          ✓
        </span>
        <strong className="text-[13px] text-foreground">{comp.nom}</strong>
        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white/55">
          Niveau 1
        </span>
        <span className="rounded border border-green-600/30 bg-green-600/20 px-2 py-0.5 text-[11px] font-medium text-green-400">
          Acquis gratuitement
        </span>
        <button
          type="button"
          onClick={onToggleDetails}
          aria-expanded={detailsOuvert}
          className="ml-auto text-[11.5px] font-semibold text-gold"
        >
          {detailsOuvert ? "Masquer ▾" : "Détails ▸"}
        </button>
      </div>

      {detailsOuvert && niv1 && (
        <div className="space-y-2 border-t border-white/[0.07] px-3 py-2.5">
          {/* niveau 1 (offert) */}
          <p className="text-[12px] leading-relaxed text-white/75">
            {niv1.description}
          </p>
          {/* paliers suivants — LECTURE SEULE (achat à l'étape Compétences) */}
          {suivants.length > 0 && (
            <div className="rounded-lg border border-gold/20 bg-gold/5 p-3">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gold">
                Ce que donnent les niveaux suivants
              </div>
              <div className="space-y-1.5">
                {suivants.map((nv) => (
                  <div key={nv.niveau} className="flex gap-2">
                    <span className="h-fit flex-shrink-0 rounded border border-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white/50">
                      Niv. {nv.niveau} · {nv.cout_xp} XP
                    </span>
                    <span className="text-[11.5px] leading-snug text-white/65">
                      {nv.description}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[10.5px] italic text-white/45">
                Achetables plus tard à l'étape Compétences.
              </p>
            </div>
          )}
        </div>
      )}

      {aChoix && (
        <div className="border-t border-white/[0.08] px-3 py-2.5">
          {!estClasseSelectionnee ? (
            <p className="text-[11.5px] text-white/55">
              <span className="text-gold">✦</span> Choix de{" "}
              {estReligion ? "religion" : "langue ancienne"} à effectuer une fois
              cette classe sélectionnée.
            </p>
          ) : (
          <>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-gold">
              {estReligion
                ? "Choisis ta religion"
                : "Choisis ta langue ancienne"}
            </span>
            {!choisi && (
              <span className="text-[10.5px] text-amber-400">● choix requis</span>
            )}
          </div>
          <div className="space-y-1.5">
            {options.map((o) => {
              const on = choisi === o.id;
              const religionObj = estReligion
                ? religions.find((r) => r.id === o.id)
                : undefined;
              const ficheOuverte = estReligion && estFicheOuverte(o.id);
              return (
                <div
                  key={o.id}
                  className={`overflow-hidden rounded-lg border ${
                    on
                      ? "border-gold bg-gold/[0.08]"
                      : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="flex items-start gap-2.5 px-2.5 py-2">
                    <Checkbox
                      checked={on}
                      onCheckedChange={() => onChoisir(o.id)}
                      className="mt-0.5"
                      aria-label={`Choisir ${o.nom}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="cursor-pointer text-[13px] font-bold text-foreground"
                          onClick={() => onChoisir(o.id)}
                        >
                          {o.nom}
                        </span>
                        {on ? (
                          <span className="flex-shrink-0 rounded-full border border-gold/60 bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold">
                            ✦ Ta {estReligion ? "religion" : "langue"} (gratuit)
                          </span>
                        ) : estReligion ? (
                          <button
                            type="button"
                            onClick={() => onToggleFiche(o.id)}
                            className="flex-shrink-0 whitespace-nowrap text-[11.5px] font-semibold text-white/60"
                          >
                            {ficheOuverte ? "Masquer ▾" : "Détails ▸"}
                          </button>
                        ) : null}
                      </div>
                      {on && estReligion && (
                        <button
                          type="button"
                          onClick={() => onToggleFiche(o.id)}
                          className="mt-1 text-[11.5px] font-semibold text-gold"
                        >
                          {ficheOuverte ? "Masquer la fiche ▾" : "Voir la fiche ▸"}
                        </button>
                      )}
                    </div>
                  </div>
                  {estReligion && ficheOuverte && religionObj && (
                    <div className="border-t border-white/[0.08] px-3 py-2.5">
                      <ReligionDetails
                        religion={religionObj}
                        isManuelOpen={mode === "integral"}
                        onToggleManuel={() => {}}
                        hideManuelButton
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {choisi && (
            <p className="mt-2 text-[11px] text-green-400">
              ✓ Choix enregistré — en sélectionner un autre annule celui-ci.
            </p>
          )}
          {estReligion && !dejaCroyant && (
            <label className="mt-2 flex items-start gap-2 text-[11.5px] text-white/70">
              <Checkbox
                checked={devenirCroyant}
                onCheckedChange={(v) => onDevenirCroyant(v === true)}
                className="mt-0.5"
              />
              <span>
                Mon personnage devient croyant de cette religion (modifie aussi
                son statut de croyance).
              </span>
            </label>
          )}
          </>
          )}
        </div>
      )}
    </div>
  );
}

export default Etape4_V2;

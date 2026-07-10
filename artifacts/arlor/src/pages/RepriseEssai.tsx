/**
 * [VIS-6] Lot 2 — page de reprise du brouillon visiteur (route authentifiée
 * `/reprise-essai`). Transforme un personnage bâti en essai libre (brouillon
 * `localStorage`) en VRAI personnage, via les RPC serveur — après un pré-vol
 * annoncé et une confirmation explicite.
 *
 * Machine à 4 états :
 *  1. PRÉ-VOL   — rapport `preVolerBrouillon` (aucune écriture) : ce qui ne passe
 *     plus, et de combien le total XP réel divergera de l'aperçu hors-ligne ;
 *  2. REJEU     — `rejouerBrouillon(clientServeur, …)` : journal en direct ;
 *  3. RÉSULTAT  — complet (« recréé à l'identique ») ou partiel (« Presque ! ») ;
 *  4. BLOQUÉ    — démarrage refusé (personnage déjà en cours) : aucun rejeu.
 *
 * Après un rejeu réussi (complet OU partiel), on NE supprime PAS le brouillon
 * `localStorage` (il reste consultable en mode visiteur) ; on pose seulement le
 * drapeau `hv-reprise-ignoree` pour que la bannière ne revienne plus.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, Check, Sparkles } from "lucide-react";
import { useProfil } from "@/contexts/ProfilContext";
import { clientServeur } from "@/creation";
import { chargerBrouillon } from "@/creation/visiteur/stockageBrouillon";
import { preVolerBrouillon, type RapportPreVol } from "@/creation/reprise/preVolBrouillon";
import {
  rejouerBrouillon,
  catalogueDepuisSnapshot,
  type FaitRejeu,
  type EchecRejeu,
  type ResultatRejeu,
} from "@/creation/reprise/rejouerBrouillon";
import { ignorerRepriseDefinitivement } from "@/creation/reprise/repriseFlags";
import { getSnapshot } from "@/moteurCreation/snapshot";
import type { BrouillonVisiteur } from "@/moteurCreation/brouillon/types";

// ============================================================
// Libellés catalogue (wording des faits/échecs)
// ============================================================

function nomTable(table: string, id: string | undefined): string | undefined {
  if (!id) return undefined;
  const rows = getSnapshot().tables[table as keyof ReturnType<typeof getSnapshot>["tables"]] as
    | Array<{ id: string; nom?: string | null }>
    | undefined;
  return rows?.find((r) => r.id === id)?.nom ?? undefined;
}

/** Nom lisible d'un fait/échec de rejeu, résolu contre le brouillon + catalogue. */
function libelle(f: FaitRejeu, b: BrouillonVisiteur): string {
  switch (f.type) {
    case "demarrage":
      return "Démarrage de la création";
    case "etape1":
      return "Identité";
    case "etape2":
      return "Race";
    case "etape3":
      return "Traits raciaux";
    case "etape4":
      return "Classe";
    case "competence": {
      const c = b.acquisitions.competences.find((x) => x.instanceId === f.instanceId);
      return nomTable("competences", c?.competenceId) ?? "Compétence";
    }
    case "sort": {
      const s = b.acquisitions.sorts.find((x) => x.instanceId === f.instanceId);
      return s?.nomPersonnalise ?? nomTable("sorts", s?.sortId) ?? "Sort";
    }
    case "priere": {
      const p = b.acquisitions.prieres.find((x) => x.instanceId === f.instanceId);
      return p?.nomPersonnalise ?? nomTable("prieres", p?.priereId) ?? "Prière";
    }
    case "recette": {
      const r = b.acquisitions.recettes.find((x) => x.instanceId === f.instanceId);
      return nomTable("recettes_alchimie", r?.recetteId) ?? "Recette";
    }
    case "assemblage": {
      const a = b.acquisitions.assemblages.find((x) => x.instanceId === f.instanceId);
      return nomTable("assemblages_runes", a?.assemblageId) ?? "Assemblage";
    }
    case "piege": {
      const pg = b.acquisitions.pieges.find((x) => x.instanceId === f.instanceId);
      return nomTable("pieges", pg?.piegeId) ?? "Piège";
    }
  }
}

// Familles pour le résumé ✓/⚠ du pré-vol.
const FAMILLES: Array<{ label: string; types: FaitRejeu["type"][] }> = [
  { label: "Identité", types: ["etape1", "etape2", "etape3", "etape4"] },
  { label: "Compétences", types: ["competence"] },
  { label: "Sorts & prières", types: ["sort", "priere"] },
  { label: "Artisanat", types: ["recette", "assemblage", "piege"] },
];

function fmtXp(x: number): string {
  return String(Math.round(x * 100) / 100);
}

function descriptifPerso(b: BrouillonVisiteur): { nom: string; race: string; classe: string } {
  return {
    nom: b.etape1.nom?.trim() || "Personnage sans nom",
    race: nomTable("races", b.etape2.raceId) ?? "",
    classe: nomTable("classes", b.etape4.classeId) ?? "",
  };
}

// ============================================================
// Machine à états
// ============================================================

type Etat =
  | { phase: "chargement" }
  | { phase: "absent" }
  | { phase: "prevol"; rapport: RapportPreVol }
  | { phase: "rejeu" }
  | { phase: "complet"; res: ResultatRejeu }
  | { phase: "partiel"; res: ResultatRejeu }
  | { phase: "bloque"; res: ResultatRejeu };

export default function RepriseEssai() {
  const navigate = useNavigate();
  const { profilActif } = useProfil();
  const brouillon = useMemo(() => chargerBrouillon(), []);
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  const [rapport, setRapport] = useState<RapportPreVol | null>(null);
  const [journal, setJournal] = useState<FaitRejeu[]>([]);
  const rejeuLance = useRef(false);

  // Pré-vol au montage (aucune écriture serveur ni localStorage).
  useEffect(() => {
    let vivant = true;
    if (!brouillon) {
      setEtat({ phase: "absent" });
      return;
    }
    void preVolerBrouillon(brouillon).then((r) => {
      if (!vivant) return;
      setRapport(r);
      setEtat({ phase: "prevol", rapport: r });
    });
    return () => {
      vivant = false;
    };
  }, [brouillon]);

  async function lancerRejeu() {
    if (!brouillon || !profilActif || rejeuLance.current) return;
    rejeuLance.current = true;
    setJournal([]);
    setEtat({ phase: "rejeu" });
    const res = await rejouerBrouillon(
      clientServeur,
      catalogueDepuisSnapshot(),
      brouillon,
      profilActif.id,
      (fait) => setJournal((j) => [...j, fait]),
    );
    if (res.statut === "echec_demarrage") {
      setEtat({ phase: "bloque", res });
      return;
    }
    // Rejeu réussi (complet OU partiel) : le brouillon reste, la bannière part.
    ignorerRepriseDefinitivement();
    setEtat({ phase: res.statut === "complet" ? "complet" : "partiel", res });
  }

  const retourTableau = () => navigate("/tableau-de-bord");
  const versWizard = (personnageId: string | null) =>
    navigate(personnageId ? `/personnage/nouveau?id=${personnageId}` : "/personnage/nouveau");

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-4 px-4 py-6">
      {etat.phase === "chargement" && (
        <Card>
          <CardContent className="flex items-center gap-3 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
            <p className="text-sm text-muted-foreground">Vérification de votre brouillon…</p>
          </CardContent>
        </Card>
      )}

      {etat.phase === "absent" && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-gold">Aucun brouillon à reprendre</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Aucun personnage d'essai n'est enregistré sur cet appareil.
            </p>
            <Button className="w-full" onClick={retourTableau}>
              Retour au tableau de bord
            </Button>
          </CardContent>
        </Card>
      )}

      {etat.phase === "prevol" && brouillon && (
        <VuePreVol
          brouillon={brouillon}
          rapport={etat.rapport}
          peutCreer={!!profilActif}
          onCreer={lancerRejeu}
          onAnnuler={retourTableau}
        />
      )}

      {etat.phase === "rejeu" && brouillon && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-gold">
              <Loader2 className="h-5 w-5 animate-spin" />
              Création en cours…
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul className="flex flex-col gap-1.5">
              {journal.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{libelle(f, brouillon)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Chaque élément passe par les règles officielles — rien n'est écrit en douce.
            </p>
          </CardContent>
        </Card>
      )}

      {etat.phase === "complet" && brouillon && (
        <VueResultatComplet
          brouillon={brouillon}
          xp={rapport?.xpTotalAttendu}
          onContinuer={() => versWizard(etat.res.personnageId)}
        />
      )}

      {etat.phase === "partiel" && brouillon && (
        <VueResultatPartiel
          brouillon={brouillon}
          res={etat.res}
          onContinuer={() => versWizard(etat.res.personnageId)}
        />
      )}

      {etat.phase === "bloque" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Un personnage est déjà en cours
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Vous avez déjà un personnage en cours de création — terminez-le d'abord.
            </p>
            <Button className="w-full" onClick={() => versWizard(null)}>
              Aller au créateur
            </Button>
            <Button variant="ghost" className="w-full" onClick={retourTableau}>
              Retour au tableau de bord
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Vue PRÉ-VOL
// ============================================================

function VuePreVol({
  brouillon,
  rapport,
  peutCreer,
  onCreer,
  onAnnuler,
}: {
  brouillon: BrouillonVisiteur;
  rapport: RapportPreVol;
  peutCreer: boolean;
  onCreer: () => void;
  onAnnuler: () => void;
}) {
  const divergence = rapport.xpTotalAttendu !== rapport.xpTotalOffline;
  const typesEnEchec = new Set(rapport.echecs.map((e) => e.type));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-gold">Vérification de votre brouillon</CardTitle>
        <p className="text-sm text-muted-foreground">
          Avant de créer le personnage, on vérifie chaque choix contre les règles à jour.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Résumé par famille : ✓ ou ⚠ */}
        <ul className="flex flex-col gap-1.5">
          {FAMILLES.map((fam) => {
            const ok = !fam.types.some((t) => typesEnEchec.has(t));
            return (
              <li key={fam.label} className="flex items-center gap-2 text-sm">
                {ok ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                )}
                <span className={ok ? "" : "text-amber-300"}>{fam.label}</span>
              </li>
            );
          })}
        </ul>

        {/* Échecs item par item */}
        {rapport.echecs.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3">
            <ul className="flex flex-col gap-1.5">
              {rapport.echecs.map((e, i) => (
                <li key={i} className="text-sm text-amber-200">
                  «&nbsp;{libelle(e, brouillon)}&nbsp;» n'est plus offert — il sera laissé de côté.
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Total XP */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total XP dépensé</span>
            <span className="flex items-baseline gap-2">
              {divergence && (
                <span className="text-sm text-muted-foreground line-through">
                  {fmtXp(rapport.xpTotalOffline)}
                </span>
              )}
              <span className="text-xl font-bold text-gold">{fmtXp(rapport.xpTotalAttendu)} XP</span>
            </span>
          </div>
        </div>

        {divergence && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3 text-sm text-amber-200">
            Le rabais d'Acquisition est recalculé au moment réel de chaque achat : le total passe de{" "}
            {fmtXp(rapport.xpTotalOffline)} à {fmtXp(rapport.xpTotalAttendu)} XP. Rien n'est créé sans
            votre accord.
          </div>
        )}

        {rapport.peremption && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-muted-foreground">
            Ce brouillon date d'une version antérieure des règles — la vérification ci-dessus fait foi.
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            className="w-full bg-gold font-bold text-black hover:bg-gold/80"
            disabled={!peutCreer}
            onClick={onCreer}
          >
            {divergence
              ? `Créer quand même (${fmtXp(rapport.xpTotalAttendu)} XP)`
              : "Créer ce personnage"}
          </Button>
          {!peutCreer && (
            <p className="text-xs text-muted-foreground">
              Sélectionnez d'abord un profil pour créer le personnage.
            </p>
          )}
          <Button variant="ghost" className="w-full" onClick={onAnnuler}>
            Annuler — garder le brouillon tel quel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Vues RÉSULTAT
// ============================================================

function VueResultatComplet({
  brouillon,
  xp,
  onContinuer,
}: {
  brouillon: BrouillonVisiteur;
  xp: number | undefined;
  onContinuer: () => void;
}) {
  const { nom, race, classe } = descriptifPerso(brouillon);
  const descriptif = [race, classe].filter(Boolean).join(" ");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
          Votre personnage est prêt
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-white">{nom}</span>
          {descriptif ? ` — ${descriptif}` : ""} — a été recréé à l'identique
          {xp != null ? `, ${fmtXp(xp)} XP dépensés` : ""}.
        </p>
        <Button className="w-full bg-gold font-bold text-black hover:bg-gold/80" onClick={onContinuer}>
          Continuer dans le créateur (étape 5)
        </Button>
      </CardContent>
    </Card>
  );
}

function VueResultatPartiel({
  brouillon,
  res,
  onContinuer,
}: {
  brouillon: BrouillonVisiteur;
  res: ResultatRejeu;
  onContinuer: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-amber-400">
          <Sparkles className="h-5 w-5" />
          Presque !
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Votre personnage a été créé, mais certains éléments ont été laissés de côté :
        </p>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3">
          <ul className="flex flex-col gap-2">
            {res.echecs.map((e: EchecRejeu, i) => (
              <li key={i} className="text-sm text-amber-200">
                <span className="font-medium">{libelle(e, brouillon)}</span> — {e.message}
              </li>
            ))}
          </ul>
        </div>
        <Button className="w-full bg-gold font-bold text-black hover:bg-gold/80" onClick={onContinuer}>
          Continuer dans le créateur (étape 5)
        </Button>
      </CardContent>
    </Card>
  );
}

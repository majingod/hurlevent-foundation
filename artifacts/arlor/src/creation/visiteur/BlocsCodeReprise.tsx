/**
 * UI du code de reprise (lot HL-A3, s321) — emporter/reprendre le brouillon
 * visiteur. Deux blocs indépendants, montés là où le wizard visiteur en a
 * besoin (cf. FichePersonnageView, CreationVisiteur).
 */

import { useRef, useState } from "react";
import { ChevronDown, AlertTriangle, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSnapshot } from "@/moteurCreation/snapshot";
import type { BrouillonVisiteur } from "@/moteurCreation/brouillon/types";
import { chargerBrouillon, sauverBrouillon } from "./stockageBrouillon";
import { genererCodeReprise, interpreterTexteColle, type ResultatImport } from "./codeReprise";

function slugifier(nom: string): string {
  const base = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "sans-nom";
}

function fmtDateFr(iso: string): string {
  return new Date(iso).toLocaleString("fr-CA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FAMILLES_ACQUISITIONS: Array<{ cle: keyof BrouillonVisiteur["acquisitions"]; label: string }> = [
  { cle: "competences", label: "compétences" },
  { cle: "sorts", label: "sorts" },
  { cle: "prieres", label: "prières" },
  { cle: "pieges", label: "pièges" },
  { cle: "recettes", label: "recettes" },
  { cle: "assemblages", label: "assemblages" },
];

function compteAcquisitions(b: BrouillonVisiteur): string {
  return FAMILLES_ACQUISITIONS.map(({ cle, label }) => ({ n: b.acquisitions[cle].length, label }))
    .filter(({ n }) => n > 0)
    .map(({ n, label }) => `${n} ${label}`)
    .join(" · ");
}

/** Carte « Emporter mon brouillon » — génère le code de reprise + fichier .json. */
export function BlocEmporter() {
  const [brouillon, setBrouillon] = useState<BrouillonVisiteur | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [absent, setAbsent] = useState(false);
  const [copie, setCopie] = useState(false);
  const [erreurTelechargement, setErreurTelechargement] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutCopieRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const genererCode = () => {
    const b = chargerBrouillon();
    if (!b) {
      setAbsent(true);
      setBrouillon(null);
      setCode(null);
      return;
    }
    setAbsent(false);
    setErreurTelechargement(null);
    setBrouillon(b);
    setCode(genererCodeReprise(b));
  };

  const copierCode = async () => {
    if (!code) return;
    let succes = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        succes = true;
      }
    } catch {
      succes = false;
    }
    if (!succes) {
      try {
        textareaRef.current?.select();
        succes = document.execCommand("copy");
      } catch {
        succes = false;
      }
    }
    if (succes) {
      if (timeoutCopieRef.current) clearTimeout(timeoutCopieRef.current);
      setCopie(true);
      timeoutCopieRef.current = setTimeout(() => setCopie(false), 2000);
    }
  };

  const telechargerJson = () => {
    if (!brouillon) return;
    try {
      const blob = new Blob([JSON.stringify(brouillon, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hurlevent-brouillon-${slugifier(brouillon.etape1.nom)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setErreurTelechargement(null);
    } catch {
      setErreurTelechargement(
        "Le téléchargement n'a pas fonctionné sur cet appareil — utilise le code de reprise.",
      );
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="font-heading text-lg text-primary">Emporter mon brouillon</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground/90">
          Ton brouillon vit sur cet appareil et peut être perdu (fichier hors-ligne
          redéplacé, mémoire du navigateur effacée). Génère un <strong>code de
          reprise</strong> : colle-le dans tes notes ou envoie-le-toi par message —
          tu pourras reprendre exactement où tu en étais, ici ou sur le site.
        </p>

        <Button onClick={genererCode} className="gap-2">
          Générer mon code de reprise
        </Button>

        {absent && (
          <p className="text-sm text-muted-foreground">Aucun brouillon sur cet appareil.</p>
        )}

        {code && (
          <div className="space-y-3">
            <Textarea
              ref={textareaRef}
              readOnly
              value={code}
              rows={4}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={copierCode} size="sm">
                {copie ? "✓ Copié" : "Copier le code"}
              </Button>
              <Button type="button" onClick={telechargerJson} variant="outline" size="sm">
                Fichier .json
              </Button>
            </div>
            {erreurTelechargement && (
              <p className="text-sm text-destructive">{erreurTelechargement}</p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Si « Copier » ne réagit pas : appuie longuement sur le code → Tout
          sélectionner → Copier. Le fichier .json est un bonus — sur certains
          téléphones il ne se télécharge pas depuis le mode hors-ligne.
        </p>
      </CardContent>
    </Card>
  );
}

/** Aperçu du brouillon interprété, avant tout écrasement du slot unique. */
function ApercuBrouillon({
  resultat,
  onConfirmer,
  onAnnuler,
}: {
  resultat: Extract<ResultatImport, { ok: true }>;
  onConfirmer: () => void;
  onAnnuler: () => void;
}) {
  const b = resultat.brouillon;
  const nom = b.etape1.nom.trim() || "Sans nom";
  const snapshot = getSnapshot();
  const race = snapshot.tables.races.find((r) => r.id === b.etape2.raceId)?.nom ?? "—";
  const classe = snapshot.tables.classes.find((c) => c.id === b.etape4.classeId)?.nom ?? "—";
  const acquisitions = compteAcquisitions(b);
  const existant = chargerBrouillon();

  return (
    <div className="space-y-3 rounded-md border border-border bg-background/50 p-4">
      <p className="font-heading text-sm font-bold text-foreground">Aperçu du brouillon</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Nom</dt>
        <dd>{nom}</dd>
        <dt className="text-muted-foreground">Race</dt>
        <dd>{race}</dd>
        <dt className="text-muted-foreground">Classe</dt>
        <dd>{classe}</dd>
        <dt className="text-muted-foreground">Étape</dt>
        <dd>{b.meta.etapeCourante}</dd>
        {acquisitions && (
          <>
            <dt className="text-muted-foreground">Acquisitions</dt>
            <dd>{acquisitions}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Modifié le</dt>
        <dd>{fmtDateFr(b.meta.modifieLe)}</dd>
      </dl>

      {existant && (
        <div className="flex items-start gap-2.5 rounded-md border border-red-800/50 bg-red-950/25 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-xs text-foreground/90 leading-snug">
            ⚠️ Un brouillon existe déjà sur cet appareil (« {existant.etape1.nom.trim() || "Sans nom"}
            », modifié {fmtDateFr(existant.meta.modifieLe)}). Reprendre celui-ci le{" "}
            <strong>remplacera définitivement</strong>.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onConfirmer} size="sm">
          {existant ? `Remplacer et reprendre "${nom}"` : `Reprendre "${nom}"`}
        </Button>
        <Button type="button" onClick={onAnnuler} variant="outline" size="sm">
          Annuler
        </Button>
      </div>
    </div>
  );
}

/** Section repliée « Reprendre un brouillon (code ou fichier) ». */
export function BlocReprendre() {
  const [ouvert, setOuvert] = useState(false);
  const [texteCollage, setTexteCollage] = useState("");
  const [resultat, setResultat] = useState<ResultatImport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const verifier = () => {
    setResultat(interpreterTexteColle(texteCollage));
  };

  const onFichierChoisi = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    const reader = new FileReader();
    reader.onload = () => {
      const texte = typeof reader.result === "string" ? reader.result : "";
      setTexteCollage(texte);
      setResultat(interpreterTexteColle(texte));
    };
    reader.onerror = () => {
      setResultat({ ok: false, erreur: "Impossible de lire ce fichier sur cet appareil." });
    };
    reader.readAsText(fichier);
  };

  const confirmerReprise = () => {
    if (!resultat?.ok) return;
    sauverBrouillon(resultat.brouillon);
    window.location.reload();
  };

  const annuler = () => {
    setResultat(null);
  };

  return (
    <Card className="bg-card border-border">
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-6 py-4 text-left"
      >
        <span className="font-heading text-sm font-bold text-foreground">
          Reprendre un brouillon (code ou fichier)
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${ouvert ? "rotate-180" : ""}`}
        />
      </button>
      {ouvert && (
        <CardContent className="space-y-4 pt-0">
          {resultat?.ok ? (
            <ApercuBrouillon resultat={resultat} onConfirmer={confirmerReprise} onAnnuler={annuler} />
          ) : (
            <div className="space-y-3">
              <Textarea
                value={texteCollage}
                onChange={(e) => setTexteCollage(e.target.value)}
                placeholder="HV2.…"
                rows={4}
                className="font-mono text-xs"
              />
              {resultat && !resultat.ok && (
                <p className="text-sm text-destructive">{resultat.erreur}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={verifier} disabled={!texteCollage.trim()} size="sm">
                  Vérifier le code
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Ouvrir un .json
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={onFichierChoisi}
                />
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

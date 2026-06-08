import { useEffect, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Download,
  Smartphone,
  Share,
  SquarePlus,
  Check,
  FileText,
  MonitorDown,
  BookOpen,
} from "lucide-react";

/**
 * Page « Téléchargements » (publique).
 * Regroupe l'installation de l'application (PWA) et les ressources du jeu.
 * - Android/Chrome : capture `beforeinstallprompt` -> bouton d'installation natif.
 * - iOS/Safari : pas d'API d'installation -> instructions « Partager -> écran d'accueil ».
 * - Ordinateur : bouton si l'évènement est disponible, sinon repli sur la barre d'adresse.
 * Le manuel PDF pointe vers un fichier déposé dans `public/` (placeholder tant que absent).
 */

type Plateforme = "android" | "ios" | "desktop";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Fichier à déposer plus tard dans artifacts/arlor/public/ (comme les icônes).
const PDF_URL = "/manuel-hurlevent-2026.pdf";

function detecterPlateforme(): Plateforme {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

function dejaInstallee(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(standalone || iosStandalone);
}

export default function Telechargements() {
  const [plateforme, setPlateforme] = useState<Plateforme>(detecterPlateforme);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installee, setInstallee] = useState<boolean>(dejaInstallee);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallee(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const lancerInstallation = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstallee(true);
    setDeferredPrompt(null);
  };

  const plateformes: { id: Plateforme; libelle: string }[] = [
    { id: "android", libelle: "Android / Chrome" },
    { id: "ios", libelle: "iPhone / Safari" },
    { id: "desktop", libelle: "Ordinateur" },
  ];

  return (
    <div className="container py-8 max-w-2xl">
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-2">
          Téléchargements
        </h1>
        <p className="text-muted-foreground">
          Installe l'application et récupère les ressources du jeu.
        </p>
      </div>

      {/* Carte 1 — Installer l'application */}
      <Card className="mb-4 bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 font-heading text-lg">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
              <Smartphone className="h-5 w-5 text-primary" />
            </span>
            Installer l'application
          </CardTitle>
          <p className="pt-2 text-sm text-muted-foreground">
            Hurlevent fonctionne comme une vraie app, hors navigateur, sur ton écran d'accueil.
          </p>
        </CardHeader>
        <CardContent>
          {/* Sélecteur de plateforme */}
          <div className="mb-4 flex flex-wrap gap-2">
            {plateformes.map((p) => {
              const actif = plateforme === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlateforme(p.id)}
                  className={
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors " +
                    (actif
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground")
                  }
                >
                  {p.libelle}
                </button>
              );
            })}
          </div>

          {installee ? (
            <EtatInstallee />
          ) : plateforme === "ios" ? (
            <InstructionsIos />
          ) : plateforme === "android" ? (
            deferredPrompt ? (
              <BoutonInstaller onClick={lancerInstallation}>
                <Download className="h-[18px] w-[18px]" />
                Installer l'application
              </BoutonInstaller>
            ) : (
              <ReplisInstall texte="Ouvre le menu ⋮ de Chrome puis choisis « Installer l'application » (ou « Ajouter à l'écran d'accueil »)." />
            )
          ) : deferredPrompt ? (
            <BoutonInstaller onClick={lancerInstallation}>
              <MonitorDown className="h-[18px] w-[18px]" />
              Installer sur cet ordinateur
            </BoutonInstaller>
          ) : (
            <ReplisInstall texte="Clique sur l'icône d'installation dans la barre d'adresse de ton navigateur (Chrome, Edge)." />
          )}
        </CardContent>
      </Card>

      {/* Carte 2 — Manuel des règles PDF */}
      <Card className="mb-4 bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 font-heading text-lg">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </span>
            Manuel des règles 2026
          </CardTitle>
          <p className="pt-2 text-sm text-muted-foreground">
            Le manuel complet en PDF, à lire hors-ligne ou à imprimer.
          </p>
        </CardHeader>
        <CardContent>
          <a
            href={PDF_URL}
            download
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-transparent px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <Download className="h-[18px] w-[18px]" />
            Télécharger le PDF
          </a>
        </CardContent>
      </Card>

      {/* Carte 3 — espace extensible */}
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        <BookOpen className="h-[18px] w-[18px] shrink-0" />
        <span>Espace extensible : futures ressources (fiches, aides de jeu, calendriers…).</span>
      </div>
    </div>
  );
}

function BoutonInstaller({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
    >
      {children}
    </button>
  );
}

function ReplisInstall({ texte }: { texte: string }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{texte}</p>;
}

function EtatInstallee() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-foreground">
      <Check className="h-[18px] w-[18px] text-primary" />
      Application installée — retrouve l'icône Hurlevent sur ton écran d'accueil.
    </div>
  );
}

function InstructionsIos() {
  const etapes = [
    { ic: <Share className="h-4 w-4 text-primary" />, t: "Touche le bouton Partager dans la barre de Safari." },
    { ic: <SquarePlus className="h-4 w-4 text-primary" />, t: "Choisis « Sur l'écran d'accueil »." },
    { ic: <Check className="h-4 w-4 text-primary" />, t: "Confirme avec « Ajouter ». L'icône Hurlevent apparaît." },
  ];
  return (
    <div>
      <ol className="flex list-none flex-col gap-3 p-0">
        {etapes.map((e, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background">
              {e.ic}
            </span>
            <span className="pt-1 text-sm leading-snug text-foreground">{e.t}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs italic leading-relaxed text-muted-foreground">
        iOS ne permet pas l'installation en un clic — ces 3 étapes prennent 10 secondes.
      </p>
    </div>
  );
}

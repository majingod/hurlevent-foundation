import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { signalerErreur } from "@/lib/filet";

declare const __APP_VERSION__: string;

// C101 : ces 4 chaînes sont testées verbatim (filet.test.ts). Toute retouche
// de texte se fait ici, et nulle part ailleurs.
export const TEXTES_FILET = {
  titre: "Quelque chose a cassé.",
  corps: "Recharge la page pour continuer. Si ça se reproduit, envoie le détail à l'orga.",
  boutonRecharger: "Recharger",
  boutonCopier: "Copier le détail",
} as const;

interface FiletErreurProps {
  children: ReactNode;
}

interface FiletErreurState {
  erreur: Error | null;
}

export default class FiletErreur extends Component<FiletErreurProps, FiletErreurState> {
  state: FiletErreurState = { erreur: null };

  static getDerivedStateFromError(erreur: Error): FiletErreurState {
    return { erreur };
  }

  componentDidCatch(erreur: Error): void {
    signalerErreur(erreur);
  }

  // La stack se COPIE, elle ne s'AFFICHE jamais (D65) : pas de fuite à l'écran,
  // mais un détail complet à envoyer à l'orga si le joueur le souhaite.
  private copierDetail = async (): Promise<void> => {
    const { erreur } = this.state;
    if (!erreur) return;
    const detail = [
      `nom: ${erreur.name}`,
      `message: ${erreur.message}`,
      `route: ${window.location.pathname}`,
      `version: ${__APP_VERSION__}`,
      `user-agent: ${navigator.userAgent}`,
      "",
      erreur.stack ?? "",
    ].join("\n");
    try {
      await navigator.clipboard?.writeText(detail);
    } catch {
      // presse-papiers indisponible (permission, contexte non sécurisé) : silence voulu
    }
  };

  render(): ReactNode {
    if (!this.state.erreur) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-bold">{TEXTES_FILET.titre}</h1>
          <p className="text-sm text-muted-foreground">{TEXTES_FILET.corps}</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => window.location.reload()}>
            {TEXTES_FILET.boutonRecharger}
          </Button>
          <Button variant="outline" onClick={this.copierDetail}>
            {TEXTES_FILET.boutonCopier}
          </Button>
        </div>
      </div>
    );
  }
}

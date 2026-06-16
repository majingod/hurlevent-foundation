import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { ecrireStockage, lireStockage } from "@/components/createur/aide/stockageLocal";

// L1 — Légende statique « ℹ Comprendre les symboles » (style LegendeDynamique) :
// états des personnages + rôles du compte. Repli mémorisé en localStorage.

const STORAGE_KEY = "hv-admin-joueurs-legende";

const Ligne = ({
  symbole,
  texte,
  auto,
}: {
  symbole: React.ReactNode;
  texte: React.ReactNode;
  auto?: boolean;
}) => (
  <div className="flex items-start gap-2">
    <span
      className={`flex shrink-0 items-center gap-1.5 ${auto ? "" : "min-w-[58px]"}`}
    >
      {symbole}
    </span>
    <span className="leading-relaxed text-muted-foreground">{texte}</span>
  </div>
);

const SousTitre = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
    {children}
  </p>
);

const Badge = ({ cls, children }: { cls?: string; children: React.ReactNode }) => (
  <span
    className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] ${
      cls ?? "border-border text-muted-foreground"
    }`}
  >
    {children}
  </span>
);

const LegendeJoueursAdmin = () => {
  const [ouvert, setOuvert] = useState(() => lireStockage(STORAGE_KEY) !== "1");
  const basculer = () =>
    setOuvert((o) => {
      ecrireStockage(STORAGE_KEY, o ? "1" : "0");
      return !o;
    });

  return (
    <div className="mb-3.5 rounded-lg border bg-card/50 text-xs">
      <button
        type="button"
        onClick={basculer}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs text-muted-foreground"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${ouvert ? "rotate-90" : ""}`}
        />
        ℹ Comprendre les symboles
      </button>
      {ouvert && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          <SousTitre>État des personnages</SousTitre>
          <Ligne
            symbole={<span className="h-2 w-2 shrink-0 rounded-full bg-[hsl(140_40%_50%)]" />}
            texte={
              <>
                <b className="text-[hsl(140_40%_55%)]">Finalisé</b> — personnage
                complété et soumis.
              </>
            }
          />
          <Ligne
            symbole={<span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground" />}
            texte={
              <>
                <b className="text-foreground">Verrouillé</b> — figé par le staff,
                non modifiable par le joueur.
              </>
            }
          />
          <Ligne
            symbole={<span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
            texte={
              <>
                <b className="text-primary">En édition</b> — en cours de
                construction par le joueur.
              </>
            }
          />
          <SousTitre>Rôles du compte</SousTitre>
          <Ligne
            auto
            symbole={<Badge>Joueur</Badge>}
            texte="Accès standard à ses propres profils et personnages."
          />
          <Ligne
            auto
            symbole={<Badge cls="border-accent/80 text-[hsl(36_33%_80%)]">Animateur</Badge>}
            texte="Staff : ajuste XP / niveau / banque, voit les fiches."
          />
          <Ligne
            auto
            symbole={<Badge cls="border-primary/50 text-primary">Admin</Badge>}
            texte="Tous les droits, dont la gestion des rôles."
          />
        </div>
      )}
    </div>
  );
};

export default LegendeJoueursAdmin;

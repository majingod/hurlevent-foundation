import { useState } from "react";
import { ChevronRight, Crown, Ban, ShieldCheck, Skull, Trash2 } from "lucide-react";
import { ecrireStockage, lireStockage } from "@/components/createur/aide/stockageLocal";

// L1 — Légende statique « ℹ Comprendre les symboles » : états des personnages,
// profil principal, blocage, rôles du compte et pastilles compteurs.
// Repli mémorisé en localStorage (ouverte à la 1re visite).

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
          <Ligne
            symbole={<Skull className="h-3.5 w-3.5 shrink-0 text-[hsl(348_55%_45%)]" />}
            texte={
              <>
                <b className="text-[hsl(348_55%_55%)]">Mort</b> — personnage décédé
                en jeu.
              </>
            }
          />

          <SousTitre>Profil</SousTitre>
          <Ligne
            symbole={<Crown className="h-3.5 w-3.5 shrink-0 text-primary" />}
            texte={
              <>
                <b className="text-primary">Principal</b> — le profil qui porte le
                rôle staff du compte.
              </>
            }
          />

          <SousTitre>Blocage</SousTitre>
          <Ligne
            auto
            symbole={
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-muted-foreground/50 bg-muted-foreground/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Ban className="h-2.5 w-2.5" /> Bloqué
              </span>
            }
            texte="Élément bloqué par le staff (réversible). Un perso bloqué reste visible au joueur, en lecture seule."
          />
          <Ligne
            symbole={<Ban className="h-4 w-4 shrink-0 text-muted-foreground" />}
            texte={
              <>
                <b className="text-foreground">Bloquer</b> — interdire l'usage d'un
                compte, profil ou personnage. Descend en cascade.
              </>
            }
          />
          <Ligne
            symbole={<ShieldCheck className="h-4 w-4 shrink-0 text-primary" />}
            texte={
              <>
                <b className="text-primary">Débloquer</b> — rendre l'élément de nouveau
                utilisable.
              </>
            }
          />
          <Ligne
            symbole={<Trash2 className="h-4 w-4 shrink-0 text-[hsl(0_70%_62%)]" />}
            texte={
              <>
                <b className="text-[hsl(0_70%_62%)]">Purger</b> — supprimer
                définitivement un élément déjà bloqué. Irréversible.
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

          <SousTitre>Pastilles (compteurs)</SousTitre>
          <Ligne
            auto
            symbole={<Badge cls="border-primary/40 text-primary">5 prof.</Badge>}
            texte="Pastille DORÉE — nombre de profils du compte (ici 5)."
          />
          <Ligne
            auto
            symbole={<Badge cls="border-primary/25 text-foreground">3 pers.</Badge>}
            texte="Pastille NEUTRE — nombre de personnages, du compte ou du profil (ici 3)."
          />
        </div>
      )}
    </div>
  );
};

export default LegendeJoueursAdmin;

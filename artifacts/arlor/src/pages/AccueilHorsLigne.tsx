import { Link } from "react-router-dom";

import { getSnapshot } from "@/moteurCreation/snapshot";

/**
 * Page d'accueil de la cible HORS-LIGNE (`main-hors-ligne.tsx`, `#/`).
 *
 * Sobre, tokens maison (mêmes variables Tailwind que le site) : aucun Layout,
 * menu, auth ni PWA. Explique ce qui marche sans réseau (créer un personnage)
 * et ce qui exige Internet (compte, inscriptions, mes personnages), puis mène
 * au wizard (`#/visiteur`).
 */

/** Site officiel — compte, inscriptions et gestion des personnages en ligne. */
const URL_SITE = "https://gnhurlevent.my.canva.site";

/** `2026-07-03T22:20:11…+00:00` → `3 juillet 2026`. */
function formaterDateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

const AccueilHorsLigne = () => {
  const genereLe = getSnapshot().manifest.genere_le;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-widest text-primary/70">
            Hurlevent — version hors-ligne
          </p>
          <h1 className="font-heading text-4xl text-primary">
            Crée ton personnage, même sans Internet
          </h1>
        </header>

        <div className="mt-6 rounded border border-primary/35 bg-primary/10 px-4 py-3 text-sm text-primary/80">
          📦 Données du jeu figées au&nbsp;
          <strong>{formaterDateFr(genereLe)}</strong>. Ce fichier fonctionne
          entièrement sur ton appareil, sans aucune connexion.
        </div>

        <section className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-heading text-lg text-foreground">
              ✅ Ce qui marche ici
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li>Créer un personnage de A à Z</li>
              <li>Toutes les règles de création embarquées</li>
              <li>
                Brouillon sauvegardé sur cet appareil (aucun réseau requis)
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-heading text-lg text-foreground">
              🌐 Ce qui exige Internet
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li>Créer un compte et s'inscrire aux événements</li>
              <li>Retrouver « mes personnages » enregistrés en ligne</li>
              <li>
                Rendez-vous sur{" "}
                <a
                  href={URL_SITE}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  le site officiel
                </a>
              </li>
            </ul>
          </div>
        </section>

        <div className="mt-10">
          <Link
            to="/visiteur"
            className="inline-flex items-center rounded-lg bg-primary px-6 py-3 font-heading text-base text-primary-foreground transition hover:bg-primary/90"
          >
            Créer mon personnage
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AccueilHorsLigne;

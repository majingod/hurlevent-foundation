import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import type { InscriptionController } from "@/hooks/useInscriptionEvenements";
import {
  estNomPlaceholder,
  TEXTE_INSCRIPTION_SANS_NOM,
  LIBELLE_LIEN_NOMMER,
} from "@/lib/nomPersonnage";
import {
  destinationRefus,
  TITRE_REFUS,
  LIBELLE_COMPRIS,
  LIBELLE_ALLER_CREATEUR,
  LIBELLE_PLUS_TARD,
} from "@/lib/refusInscription";

/**
 * Modales partagées du flux d'inscription : choix du personnage + confirmation
 * de désinscription. Piloté par useInscriptionEvenements. À monter UNE FOIS par
 * surface (page Événements, tableau de bord).
 */
export const ModalesInscription = ({ ctrl }: { ctrl: InscriptionController }) => {
  // s403 — un personnage sans nom (null ou « ... ») reste inscriptible : on le
  // DIT et on donne le chemin, on ne bloque pas. Le filet côté orga est le badge
  // « Sans nom » de la liste des inscrits (AdminEvenements). Le CHECK n'est pas
  // durci : il frapperait des fiches déjà créées.
  const personnageChoisi = ctrl.personnages.find((p) => p.id === ctrl.selectedPersonnage);
  const choisiSansNom = !!personnageChoisi && estNomPlaceholder(personnageChoisi.nom);

  // s404 — [INSCRIPTION-REFUS-MUET] : un refus serveur s'affiche en fenêtre,
  // message mot pour mot ; RC001/RC003 offrent « Aller au créateur » (la route
  // du lien « Nommer ce personnage »). Le personnage cible n'existe que pour le
  // verbe inscription — fail-closed ailleurs.
  const navigate = useNavigate();
  const destinationDuRefus = ctrl.refusServeur
    ? destinationRefus(
        ctrl.refusServeur.code,
        ctrl.refusServeur.verbe === "inscription" ? ctrl.selectedPersonnage : null
      )
    : null;
  const allerAuCreateur = () => {
    ctrl.fermerRefus();
    ctrl.setModalOpen(false);
    if (destinationDuRefus) navigate(destinationDuRefus);
  };

  return (
    <>
      {/* ── Modale d'inscription ── */}
      <Dialog open={ctrl.modalOpen} onOpenChange={ctrl.setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              S'inscrire à {ctrl.selectedEvent?.titre}
            </DialogTitle>
            <DialogDescription>
              Choisissez le personnage avec lequel vous souhaitez participer.
            </DialogDescription>
          </DialogHeader>

          {ctrl.personnages.length === 0 ? (
            <div className="space-y-4 py-4 text-center">
              <p className="text-muted-foreground">
                Vous n'avez pas encore de personnage. Créez-en un d'abord.
              </p>
              <Button asChild>
                <Link to="/personnage/nouveau">Créer un personnage</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2 py-4">
                {ctrl.personnages.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => ctrl.setSelectedPersonnage(p.id)}
                    className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                      ctrl.selectedPersonnage === p.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {p.nom ?? "Personnage sans nom"}
                  </button>
                ))}
              </div>
              {choisiSansNom && personnageChoisi && (
                <p
                  data-testid="inscription-sans-nom"
                  className="-mt-2 mb-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-foreground"
                >
                  {TEXTE_INSCRIPTION_SANS_NOM}{" "}
                  <Link
                    to={`/personnage/nouveau?id=${personnageChoisi.id}`}
                    onClick={() => ctrl.setModalOpen(false)}
                    className="font-medium text-gold-accent underline underline-offset-2"
                  >
                    {LIBELLE_LIEN_NOMMER}
                  </Link>
                </p>
              )}
              <DialogFooter>
                <Button
                  disabled={ctrl.submitting || !ctrl.selectedPersonnage}
                  onClick={ctrl.confirmerInscription}
                >
                  {ctrl.submitting ? "Envoi…" : "Confirmer l'inscription"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirmation de désinscription ── */}
      <AlertDialog
        open={!!ctrl.desinscrireEvent}
        onOpenChange={(open) => {
          if (!open) ctrl.fermerDesinscription();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">
              Se désinscrire de {ctrl.desinscrireEvent?.titre} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ton inscription en attente sera retirée et ta place libérée. Tu pourras te
              réinscrire tant qu'il reste des places.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ctrl.desinscribing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={ctrl.desinscribing}
              onClick={(e) => {
                e.preventDefault();
                ctrl.confirmerDesinscription();
              }}
            >
              {ctrl.desinscribing ? "Désinscription…" : "Se désinscrire"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Refus serveur (s404) : le message du serveur, mot pour mot ── */}
      <AlertDialog
        open={!!ctrl.refusServeur}
        onOpenChange={(open) => {
          if (!open) ctrl.fermerRefus();
        }}
      >
        <AlertDialogContent data-testid="refus-serveur">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">
              {ctrl.refusServeur ? TITRE_REFUS[ctrl.refusServeur.verbe] : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>{ctrl.refusServeur?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {destinationDuRefus ? (
              <>
                <AlertDialogCancel>{LIBELLE_PLUS_TARD}</AlertDialogCancel>
                <AlertDialogAction onClick={allerAuCreateur}>
                  {LIBELLE_ALLER_CREATEUR}
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction onClick={ctrl.fermerRefus}>
                {LIBELLE_COMPRIS}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ModalesInscription;

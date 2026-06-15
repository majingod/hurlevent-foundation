import { Link } from "react-router-dom";
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

/**
 * Modales partagées du flux d'inscription : choix du personnage + confirmation
 * de désinscription. Piloté par useInscriptionEvenements. À monter UNE FOIS par
 * surface (page Événements, tableau de bord).
 */
export const ModalesInscription = ({ ctrl }: { ctrl: InscriptionController }) => {
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
    </>
  );
};

export default ModalesInscription;

/**
 * [VIS-8] Interrupteur du générateur de personnage.
 *
 * ALLUMÉ le 3 août 2026 (s373, décision Fred) : les deux portes 🧭 « Guide-moi »
 * et 🎲 « Surprends-moi » sont ouvertes à tous les joueurs. Le chemin est
 * complet de bout en bout — tirage/choix → composition → application au
 * personnage → wizard déverrouillé — et les deux défauts relevés à l'aperçu
 * s372 sont fermés (étapes verrouillées après le générateur, trait « Inapte à
 * la magie » non grisé), plus la remontée en haut de page à l'arrivée au
 * wizard (aperçu s373).
 *
 * ⚠️ REMETTRE À `false` est le geste de repli : il referme les deux portes
 * sans rien casser (l'accueil disparaît, « Je bâtis moi-même » redevient le
 * seul chemin) et n'affecte AUCUN personnage déjà créé par le générateur —
 * ils sont des personnages ordinaires dès l'application de la composition.
 */
export const GENERATEUR_ACTIF = true;

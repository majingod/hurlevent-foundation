import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Notif } from "@/hooks/useNotifications";

// Rôles d'organisation : voient/cliquent les notifs admin (ex. demande_race_nouvelle).
const STAFF = new Set(["animateur", "admin"]);

// Notifs de race joueur : reference_id = id de la DEMANDE (pas du perso) →
// on résout demande→personnage au clic (seule résolution async, Pattern A).
const TYPES_RACE = new Set(["race_approuvee", "race_refusee"]);

/**
 * Une notif est navigable si on sait lui associer un écran cible.
 * Synchrone : sert à afficher le chevron « toucher pour voir ».
 */
export function estNavigable(notif: Notif, role: string | null): boolean {
  if (TYPES_RACE.has(notif.type)) return true;
  if (notif.type === "demande_race_nouvelle") return STAFF.has(role ?? "");
  // Cimetière : demande de mort (staff) navigable ; mort approuvée (joueur) -> cimetière ;
  // mort refusée -> non-cliquable (le message porte déjà la raison).
  if (notif.type === "demande_mort_nouvelle") return STAFF.has(role ?? "");
  if (notif.type === "mort_approuvee") return true;
  if (notif.type === "mort_refusee") return false;
  if (notif.type === "banque") return true;
  // Convention : toute autre notif portant un reference_id pointe vers un perso.
  return notif.reference_id != null;
}

/**
 * Navigation au clic sur une notif. Source unique type→route.
 * Pattern A : la seule résolution async est demande→personnage (types race).
 */
export function useNaviguerNotif() {
  const navigate = useNavigate();
  const { role } = useAuth();

  return useCallback(
    async (notif: Notif) => {
      // 1. Demande de race (organisation) → écran d'approbations
      if (notif.type === "demande_race_nouvelle") {
        if (STAFF.has(role ?? "")) navigate("/administration/approbations");
        return;
      }

      // 1b. Demande de mort (organisation) -> écran de traitement du cimetière
      if (notif.type === "demande_mort_nouvelle") {
        if (STAFF.has(role ?? "")) navigate("/administration/cimetiere?seg=demandes");
        return;
      }

      // 1c. Mort approuvée (joueur) -> le Cimetière des Héros (la stèle y est listée)
      if (notif.type === "mort_approuvee") {
        navigate("/cimetiere");
        return;
      }

      // 2. Notif de race joueur → résoudre demande→personnage puis fiche
      if (TYPES_RACE.has(notif.type)) {
        if (!notif.reference_id) return;
        const { data } = await supabase
          .from("personnage_races_demandes")
          .select("personnage_id")
          .eq("id", notif.reference_id)
          .maybeSingle();
        if (data?.personnage_id) navigate(`/personnage/${data.personnage_id}`);
        return; // demande absente (orphelin legacy) → no-op gracieux
      }

      // 3. Notif de banque → tableau de bord (le solde y est affiché)
      if (notif.type === "banque") {
        navigate("/tableau-de-bord");
        return;
      }

      // 4. Convention : reference_id présent → fiche du personnage concerné
      if (notif.reference_id) {
        navigate(`/personnage/${notif.reference_id}`);
      }
      // sinon (notif de compte, vieille notif sans ref) → no-op
    },
    [navigate, role],
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PhotoCompo } from "@/lib/acquisCampagne";

/** Photo de compo (frontière des acquis). Fetch uniquement en mode campagne.
 *  data === undefined → chargement ; null → aucune photo (tout scellé, fail-safe).
 *
 *  Le RPC derniere_photo_compo n'est pas encore reflété dans les types Supabase
 *  générés ; d'où le cast `(supabase as any)` (idiome déjà utilisé dans le repo).
 */
export function useDernierePhotoCompo(
  personnageId: string | undefined,
  enabled: boolean,
) {
  return useQuery<PhotoCompo | null>({
    queryKey: ["photo-compo", personnageId],
    enabled: enabled && !!personnageId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "derniere_photo_compo",
        { p_personnage_id: personnageId },
      );
      if (error) throw error;
      return (data ?? null) as PhotoCompo | null;
    },
  });
}

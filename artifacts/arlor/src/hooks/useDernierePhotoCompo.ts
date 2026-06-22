import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PhotoCompo } from "@/lib/acquisCampagne";

/** Photo de compo (frontière des acquis). Fetch uniquement en mode campagne.
 *  data === undefined → chargement ; null → aucune photo (tout scellé, fail-safe).
 */
export function useDernierePhotoCompo(
  personnageId: string | undefined,
  enabled: boolean,
) {
  return useQuery<PhotoCompo | null>({
    queryKey: ["photo-compo", personnageId],
    enabled: enabled && !!personnageId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("derniere_photo_compo", {
        p_personnage_id: personnageId!,
      });
      if (error) throw error;
      return (data ?? null) as PhotoCompo | null;
    },
  });
}

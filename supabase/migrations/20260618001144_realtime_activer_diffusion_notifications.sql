-- Active la diffusion temps réel (Supabase Realtime) sur la table notifications.
-- La RLS « Lecture notifications » reste la barrière : chaque client ne reçoit
-- que les notifs de son compte (user_id = auth.uid()), le staff celles qu'il peut lire.
-- Idempotent : ne ré-ajoute pas la table si elle est déjà dans la publication.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- Lot 1a : 2 helpers de création de notification (ADDITIF — aucun appelant encore).
-- Reproduit à l'identique les INSERT inline actuels (schémas A joueur/profil, B compte-wide, C fan-out staff).

CREATE OR REPLACE FUNCTION public.creer_notification(
  p_message text,
  p_type text DEFAULT 'info',
  p_profil_id uuid DEFAULT NULL,
  p_compte_id uuid DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_statut text DEFAULT 'non_traite'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_compte uuid; v_id uuid;
BEGIN
  IF p_profil_id IS NOT NULL THEN
    SELECT compte_id INTO v_compte FROM profils_joueur WHERE id = p_profil_id;
  ELSE
    v_compte := p_compte_id;
  END IF;
  INSERT INTO notifications (user_id, profil_id, type, message, reference_id, statut)
  VALUES (v_compte, p_profil_id, p_type, p_message, p_reference_id, p_statut)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.creer_notification_staff(
  p_message text,
  p_type text,
  p_reference_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_n integer;
BEGIN
  INSERT INTO notifications (user_id, type, message, reference_id, statut)
  SELECT p.id, p_type, p_message, p_reference_id, 'non_traite'
  FROM profiles p
  WHERE p.role IN ('admin','animateur') AND COALESCE(p.is_active, true) = true;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END; $$;

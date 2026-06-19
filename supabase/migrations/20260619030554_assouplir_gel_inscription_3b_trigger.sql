DROP TRIGGER IF EXISTS trg_bloquer_desinscription_fenetre_gel ON public.inscriptions_evenements;
CREATE TRIGGER trg_bloquer_desinscription_fenetre_gel
  BEFORE DELETE ON public.inscriptions_evenements
  FOR EACH ROW EXECUTE FUNCTION public.trg_bloquer_desinscription_fenetre_gel();

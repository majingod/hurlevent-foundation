-- Migration baseline #3 (récupérée depuis schema_migrations le 17 mai 2026 pour F4)
-- Version : 20260420214843
-- Rôle : Activer security_invoker = true sur 12 vues métier.

ALTER VIEW public.vue_artisanat_etat SET (security_invoker = true);
ALTER VIEW public.vue_artisanat_quotas SET (security_invoker = true);
ALTER VIEW public.vue_cercles_disponibles SET (security_invoker = true);
ALTER VIEW public.vue_competences_maitre_attente SET (security_invoker = true);
ALTER VIEW public.vue_domaines_disponibles SET (security_invoker = true);
ALTER VIEW public.vue_inscriptions_par_evenement SET (security_invoker = true);
ALTER VIEW public.vue_inscriptions_resumees SET (security_invoker = true);
ALTER VIEW public.vue_joueurs_complete SET (security_invoker = true);
ALTER VIEW public.vue_joueurs_maitres SET (security_invoker = true);
ALTER VIEW public.vue_personnage_etat SET (security_invoker = true);
ALTER VIEW public.vue_prochain_evenement SET (security_invoker = true);
ALTER VIEW public.vue_verrou_competences SET (security_invoker = true);

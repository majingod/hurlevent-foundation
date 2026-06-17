import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Mise à jour PWA en mode autoUpdate (vite-plugin-pwa).
 *
 * Plus de bandeau : dès qu'un nouveau bundle est détecté et activé,
 * vite-plugin-pwa (registerType "autoUpdate") recharge la page
 * automatiquement (skipWaiting + clientsClaim + controllerchange).
 *
 * Ce composant reste HEADLESS et ne sert qu'à forcer la DÉTECTION d'une
 * nouvelle version même quand l'app reste ouverte longtemps :
 *  - timer 15 min : filet pour les onglets desktop laissés ouverts ;
 *  - visibilitychange : déclencheur mobile au retour au premier plan
 *    (le timer est suspendu par l'OS quand la PWA est en arrière-plan).
 * Sans ce poll, une PWA ouverte en continu ne verrait la nouvelle version
 * qu'au prochain rechargement manuel.
 *
 * ⚠️ Le reload est app-wide et peut interrompre une saisie en cours.
 * Le wizard est protégé (autosave étape 1, seul écran à texte libre).
 * Pour d'autres formulaires longs : autosave ciblé plus tard si besoin.
 */
export default function PwaAutoUpdater() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registrationRef.current = registration;
      setInterval(() => {
        registration.update().catch(() => {
          // Hors-ligne : on retentera au prochain tick / retour au premier plan.
        });
      }, 15 * 60 * 1000);
    },
  });

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      registrationRef.current?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}

import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

// Tokens Hurlevent (inline pour indépendance totale du thème Tailwind)
const NOIR = "hsl(0 0% 6%)";
const NOIR_PROFOND = "hsl(0 0% 4%)";
const OR = "hsl(43 51% 54%)";
const PARCH = "hsl(36 33% 93%)";
const BORD = "hsl(43 30% 30%)";

/**
 * Bandeau de mise à jour PWA.
 * S'affiche en haut, sur toute la largeur, quand le service worker
 * détecte un nouveau bundle. Aucun rechargement automatique :
 * l'utilisateur clique « Mettre à jour » (registerType: 'prompt').
 */
export default function PwaUpdatePrompt() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        registrationRef.current = registration;
        // Filet pour les onglets desktop laissés ouverts longtemps.
        // (Le vrai déclencheur mobile est visibilitychange ci-dessous :
        // ce timer est suspendu par l'OS quand la PWA est en arrière-plan.)
        setInterval(() => {
          registration.update();
        }, 15 * 60 * 1000);
      }
    },
  });

  // Retour au premier plan (PWA mobile reprise d'arrière-plan) :
  // 1) déclenche une vérification de nouvelle version ;
  // 2) si un SW est déjà en attente (bandeau fermé via ✕ auparavant),
  //    ré-affiche le bandeau — impossible de rester figé indéfiniment.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const reg = registrationRef.current;
      if (!reg) return;
      reg.update().catch(() => {
        // Hors-ligne ou réseau capricieux : on retentera au prochain retour.
      });
      if (reg.waiting) setNeedRefresh(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [setNeedRefresh]);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        paddingTop: "max(12px, env(safe-area-inset-top))",
        background: NOIR,
        borderBottom: `1px solid ${BORD}`,
        boxShadow: "0 2px 12px rgba(0,0,0,.45)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 9999,
          background: OR,
          flexShrink: 0,
          boxShadow: `0 0 0 4px ${OR}22`,
        }}
      />
      <span style={{ flex: 1, color: PARCH, fontSize: 14, lineHeight: 1.3 }}>
        Une nouvelle version de Hurlevent est prête.
      </span>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        style={{
          flexShrink: 0,
          padding: "8px 16px",
          borderRadius: 8,
          border: "none",
          background: OR,
          color: NOIR_PROFOND,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Mettre à jour
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        aria-label="Fermer"
        style={{
          flexShrink: 0,
          padding: 8,
          borderRadius: 8,
          border: "none",
          background: "transparent",
          color: PARCH,
          fontSize: 16,
          lineHeight: 1,
          cursor: "pointer",
          opacity: 0.7,
        }}
      >
        ✕
      </button>
    </div>
  );
}

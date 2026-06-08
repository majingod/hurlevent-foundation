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
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Re-vérifie l'existence d'une nouvelle version toutes les heures
      // (utile : les joueurs gardent l'onglet ouvert longtemps).
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      }
    },
  });

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

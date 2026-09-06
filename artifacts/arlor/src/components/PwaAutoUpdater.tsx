import { useCallback, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw, Sparkles } from "lucide-react";

declare const __APP_VERSION__: string;

/**
 * Mise à jour PWA (autoUpdate) + garde de version découplée du service worker.
 *
 *  1) Poll SW : registration.update() sur intervalle 15 min + retour au premier plan.
 *  2) Garde de version : compare __APP_VERSION__ (injecté au build) au /version.json
 *     servi RÉSEAU (hors précache SW). Si différent → bandeau non-bloquant "Recharger".
 *     Fiable même si le SW reste collé sur un ancien bundle (douleur C12).
 *
 * Le reload n'est JAMAIS automatique. "Plus tard" masque le bandeau ; il réapparaît
 * si une version encore plus récente est déployée, ou au prochain lancement.
 */
export default function PwaAutoUpdater() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const [latest, setLatest] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const { updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registrationRef.current = registration;
      setInterval(() => {
        registration.update().catch(() => {}); // hors-ligne ou SW absent : silence voulu, on retentera au prochain tick
      }, 15 * 60 * 1000);
    },
  });

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      if (data?.version) setLatest(data.version);
    } catch {
      // hors-ligne ou fichier absent (dev) : on ignore, on retentera.
    }
  }, []);

  useEffect(() => {
    checkVersion();
    const id = setInterval(checkVersion, 15 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      registrationRef.current?.update().catch(() => {}); // hors-ligne ou SW absent : silence voulu, on retentera au prochain tick
      checkVersion();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [checkVersion]);

  const recharger = async () => {
    try {
      await registrationRef.current?.update();
    } catch {
      /* noop */
    }
    try {
      await updateServiceWorker(true);
    } catch {
      /* noop */
    }
    // Filet : si aucun worker en attente n'a déclenché le reload, on force.
    window.setTimeout(() => window.location.reload(), 1500);
  };

  const perimee = !!latest && latest !== __APP_VERSION__ && latest !== dismissed;
  if (!perimee) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        background: "hsl(0 0% 7%)",
        borderTop: "2px solid #c9a84c",
        boxShadow: "0 -6px 20px rgba(0,0,0,.5)",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 34,
          height: 34,
          borderRadius: 8,
          background: "rgba(201,168,76,.12)",
          border: "1px solid rgba(201,168,76,.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sparkles size={17} color="#c9a84c" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "hsl(36 33% 93%)",
            fontWeight: 600,
            fontSize: 13.5,
            lineHeight: 1.2,
          }}
        >
          Nouvelle version prête
        </div>
        <div style={{ color: "hsl(36 15% 60%)", fontSize: 11.5, marginTop: 2 }}>
          Recharge pour l'obtenir.
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(latest)}
        style={{
          background: "transparent",
          border: "none",
          color: "hsl(36 15% 60%)",
          fontSize: 12,
          padding: "6px 4px",
          cursor: "pointer",
        }}
      >
        Plus tard
      </button>
      <button
        type="button"
        onClick={recharger}
        style={{
          flexShrink: 0,
          background: "#c9a84c",
          color: "hsl(0 0% 4%)",
          border: "none",
          borderRadius: 8,
          padding: "9px 14px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <RefreshCw size={14} />
        Recharger
      </button>
    </div>
  );
}

import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Pencil, Trash2, Plus, Settings, ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useProfil, type ProfilJoueur } from "@/contexts/ProfilContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import FluxSuppressionCimetiere from "@/components/suppression/FluxSuppressionCimetiere";

// Tokens Hurlevent (écran plein écran autonome -> styles inline, indépendant du layout).
const T = {
  noir: "hsl(0 0% 4%)",
  noir2: "hsl(0 0% 8%)",
  parchemin: "hsl(36 33% 93%)",
  parcheminDim: "hsl(36 20% 70%)",
  or: "hsl(43 51% 54%)",
  orDim: "hsl(43 40% 38%)",
  vinClair: "hsl(348 45% 40%)",
  cinzel: '"Cinzel", serif',
  inter: '"Inter", sans-serif',
};

const initiales = (nom: string) =>
  nom
    .trim()
    .split(/\s+/)
    .map((m) => m[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

function Sigil({ nom, actif }: { nom: string; actif: boolean }) {
  const trait = actif ? T.or : T.orDim;
  return (
    <div style={{ width: 96, height: 104, position: "relative" }}>
      <svg viewBox="0 0 100 110" width="96" height="104">
        <path
          d="M50 4 L94 18 V58 C94 84 74 100 50 108 C26 100 6 84 6 58 V18 Z"
          fill={T.noir2}
          stroke={trait}
          strokeWidth="2.5"
        />
        <path
          d="M50 4 L94 18 V58 C94 84 74 100 50 108 Z"
          fill="hsl(0 0% 0% / .25)"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: 8,
          fontFamily: T.cinzel,
          fontSize: 30,
          color: T.or,
          letterSpacing: 1,
        }}
      >
        {initiales(nom)}
      </div>
    </div>
  );
}

const champStyle: CSSProperties = {
  width: 130,
  padding: "7px 10px",
  borderRadius: 6,
  border: `1px solid ${T.orDim}`,
  background: T.noir2,
  color: T.parchemin,
  fontFamily: T.inter,
  fontSize: 14,
  textAlign: "center",
};

const miniBtn = (couleur: string): CSSProperties => ({
  width: 30,
  height: 30,
  borderRadius: "50%",
  border: `1.5px solid ${couleur}`,
  background: "hsl(0 0% 8% / .9)",
  color: couleur,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
});

export default function QuiJoue() {
  const { profils, switchProfil, ajouterProfil, renommerProfil, apresSuppressionProfil, definirPrincipal, intentGestion } =
    useProfil();
  const navigate = useNavigate();
  const [gestion, setGestion] = useState(intentGestion);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [ajout, setAjout] = useState(false);
  const [valeur, setValeur] = useState("");
  const [busy, setBusy] = useState(false);
  const [profilASupprimer, setProfilASupprimer] = useState<ProfilJoueur | null>(null);

  const reset = () => {
    setEditionId(null);
    setAjout(false);
    setValeur("");
  };

  const choisir = (p: ProfilJoueur) => {
    if (gestion || editionId) return;
    switchProfil(p.id);
    navigate("/tableau-de-bord");
  };

  const validerAjout = async () => {
    setBusy(true);
    const r = await ajouterProfil(valeur);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.message ?? "Échec de l'ajout du profil.");
      return;
    }
    reset();
  };

  const validerRenommage = async (id: string) => {
    setBusy(true);
    const r = await renommerProfil(id, valeur);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.message ?? "Échec du renommage.");
      return;
    }
    reset();
  };

  const lancerSuppression = (p: ProfilJoueur) => {
    // La garde « supprimez d'abord les personnages » est retirée : le flux Cimetière
    // (RPC `creer_steles_et_supprimer`) supprime les personnages en cascade.
    // Le profil principal reste protégé (bouton masqué + backstop RPC PROFIL_PRINCIPAL).
    if (p.est_principal) return;
    setProfilASupprimer(p);
  };

  const definirCommePrincipal = async (p: ProfilJoueur) => {
    setBusy(true);
    const r = await definirPrincipal(p.id);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.message ?? "Échec.");
      return;
    }
    toast.success(
      `« ${p.nom} » est maintenant ton profil principal. Si ton compte a un rôle staff, ce profil portera désormais tes accès.`,
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.noir,
        color: T.parchemin,
        fontFamily: T.inter,
        padding: "40px 16px 56px",
        backgroundImage:
          "radial-gradient(ellipse at 50% -10%, hsl(43 51% 54% / .08), transparent 60%)",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* En-tête */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              fontFamily: T.cinzel,
              fontSize: 12,
              letterSpacing: 4,
              color: T.or,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Hurlevent
          </div>
          <h1
            style={{
              fontFamily: T.cinzel,
              fontSize: 32,
              fontWeight: 700,
              color: T.parchemin,
              margin: 0,
              letterSpacing: 1,
            }}
          >
            {gestion ? "Gérer les profils" : "Qui joue ?"}
          </h1>
          <div
            style={{
              width: 60,
              height: 2,
              background: T.or,
              margin: "12px auto 0",
              opacity: 0.7,
            }}
          />
        </div>

        {/* Grille */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
            justifyItems: "center",
          }}
        >
          {profils.map((p) => {
            const enEdition = editionId === p.id;
            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  padding: 8,
                }}
              >
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => choisir(p)}
                    disabled={gestion || !!editionId}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: gestion ? "default" : "pointer",
                    }}
                  >
                    <Sigil nom={p.nom} actif={false} />
                  </button>

                  {p.est_principal && (
                    <div
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        background: T.or,
                        color: T.noir,
                        borderRadius: "50%",
                        width: 26,
                        height: 26,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: `0 0 0 2px ${T.noir}`,
                      }}
                    >
                      <Crown size={15} strokeWidth={2.4} />
                    </div>
                  )}

                  {gestion && !enEdition && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                        background: "hsl(0 0% 0% / .5)",
                        borderRadius: 8,
                      }}
                    >
                      <button
                        style={miniBtn(T.parchemin)}
                        onClick={() => {
                          setEditionId(p.id);
                          setValeur(p.nom);
                          setAjout(false);
                        }}
                        aria-label="Renommer"
                      >
                        <Pencil size={15} />
                      </button>
                      {!p.est_principal && (
                        <button
                          style={miniBtn(T.or)}
                          onClick={() => definirCommePrincipal(p)}
                          disabled={busy}
                          aria-label="Définir comme profil principal"
                        >
                          <Crown size={15} />
                        </button>
                      )}
                      {!p.est_principal && (
                        <button
                          style={{
                            ...miniBtn(T.vinClair),
                            opacity: p.nb_personnages > 0 ? 0.4 : 1,
                          }}
                          onClick={() => lancerSuppression(p)}
                          disabled={busy}
                          aria-label="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {enEdition ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                    <input
                      autoFocus
                      value={valeur}
                      onChange={(e) => setValeur(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") validerRenommage(p.id);
                        if (e.key === "Escape") reset();
                      }}
                      style={champStyle}
                      maxLength={40}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={miniBtn(T.or)} onClick={() => validerRenommage(p.id)} disabled={busy}>
                        <Check size={15} />
                      </button>
                      <button style={miniBtn(T.parcheminDim)} onClick={reset} disabled={busy}>
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: T.inter, fontSize: 15, fontWeight: 600, color: T.parchemin }}>
                      {p.nom}
                    </div>
                    <div style={{ fontFamily: T.inter, fontSize: 12, color: T.orDim, marginTop: 2 }}>
                      {p.nb_personnages} perso{p.nb_personnages > 1 ? "s" : ""}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Carte ajouter (mode normal) */}
          {!gestion && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                padding: 8,
              }}
            >
              {ajout ? (
                <>
                  <div
                    style={{
                      width: 96,
                      height: 104,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      clipPath: "polygon(50% 0,100% 13%,100% 55%,50% 100%,0 55%,0 13%)",
                      border: `2px dashed ${T.or}`,
                      color: T.or,
                    }}
                  >
                    <Plus size={36} strokeWidth={1.6} />
                  </div>
                  <input
                    autoFocus
                    value={valeur}
                    onChange={(e) => setValeur(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") validerAjout();
                      if (e.key === "Escape") reset();
                    }}
                    placeholder="Nom du profil"
                    style={champStyle}
                    maxLength={40}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={miniBtn(T.or)} onClick={validerAjout} disabled={busy}>
                      <Check size={15} />
                    </button>
                    <button style={miniBtn(T.parcheminDim)} onClick={reset} disabled={busy}>
                      <X size={15} />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => {
                    setAjout(true);
                    setValeur("");
                    setEditionId(null);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 96,
                      height: 104,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      clipPath: "polygon(50% 0,100% 13%,100% 55%,50% 100%,0 55%,0 13%)",
                      border: `2px dashed ${T.orDim}`,
                      color: T.orDim,
                    }}
                  >
                    <Plus size={36} strokeWidth={1.6} />
                  </div>
                  <div style={{ fontFamily: T.inter, fontSize: 15, fontWeight: 600, color: T.parcheminDim }}>
                    Ajouter
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* [VIS-7] Échappatoire hors-ligne : grille vide = chargement réseau échoué.
            Lien DUR (pas de navigate) : estRouteVisiteur vit au-dessus du Router. */}
        {profils.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <p style={{ fontFamily: T.inter, color: T.parcheminDim, fontSize: 14, textAlign: "center" }}>
              Impossible de charger tes profils — pas de connexion ?
            </p>
            <a href="/visiteur" style={{ color: T.or, textDecoration: "underline", fontSize: 14 }}>
              Continuer hors ligne en mode visiteur
            </a>
          </div>
        )}

        {/* Bouton gestion */}
        <div style={{ textAlign: "center", marginTop: 36 }}>
          <button
            onClick={() => {
              setGestion(!gestion);
              reset();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              cursor: "pointer",
              border: `1px solid ${T.orDim}`,
              color: T.parcheminDim,
              fontFamily: T.inter,
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 20px",
              borderRadius: 8,
            }}
          >
            {gestion ? (
              <>
                <ArrowLeft size={16} /> Terminé
              </>
            ) : (
              <>
                <Settings size={16} /> Gérer les profils
              </>
            )}
          </button>
        </div>
      </div>

      <Dialog
        open={!!profilASupprimer}
        onOpenChange={(o) => {
          if (!o) setProfilASupprimer(null);
        }}
      >
        <DialogContent className="max-w-lg border-border bg-card">
          <DialogTitle className="sr-only">Supprimer le profil</DialogTitle>
          {profilASupprimer && (
            <FluxSuppressionCimetiere
              cible="profil"
              idCible={profilASupprimer.id}
              titre={`Supprimer le profil « ${profilASupprimer.nom} »`}
              onAnnuler={() => setProfilASupprimer(null)}
              onSuccess={async () => {
                const id = profilASupprimer.id;
                setProfilASupprimer(null);
                await apresSuppressionProfil(id);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfil } from "@/contexts/ProfilContext";
import { useModeStaff } from "@/contexts/ModeStaffContext";
import { useMenuNavigation } from "@/hooks/useMenuNavigation";
import ClocheNotifications from "@/components/notifications/ClocheNotifications";
import ClocheNotificationsStaff from "@/components/notifications/ClocheNotificationsStaff";
import { useAutresIdentitesNonLues, useRealtimeNotifications } from "@/hooks/useNotifications";
import { Menu, Users, Settings, Crown, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

const Navbar = () => {
  const { user, role, signOut } = useAuth();
  const { profilActif, reinitialiserProfil } = useProfil();
  const { peutBasculer, staffActif, interrupteurOn, setInterrupteur } = useModeStaff();
  const autresIdentitesNonLues = useAutresIdentitesNonLues();
  useRealtimeNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: menuItems } = useMenuNavigation(role);

  const handleSignOut = async () => {
    setOpen(false);
    reinitialiserProfil();
    await signOut();
    navigate("/");
  };

  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-heading text-xl font-bold text-primary">Hurlevent</span>
        </Link>

        <div className="flex items-center gap-2">
          {user && <ClocheNotifications />}
          {user && <ClocheNotificationsStaff />}
          {user && profilActif && (
            <span
              className="flex items-center gap-1.5 rounded-full border px-2 py-1"
              style={{ borderColor: "#5c4d2a", background: "#141414" }}
            >
              <Sigil nom={profilActif.nom} size={20} />
              <span className="text-xs font-semibold" style={{ color: "#f0e6d2" }}>
                {profilActif.nom}
              </span>
            </span>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button aria-label="Menu" className="relative p-2">
              <Menu className="h-6 w-6 text-primary" />
              {autresIdentitesNonLues && (
                <span
                  className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full"
                  style={{ background: "#c9a84c", border: "2px solid #0a0a0a" }}
                  aria-label="Une autre identité a des notifications non lues"
                />
              )}
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-72 border-l bg-[#0a0a0a] p-0"
            style={{ borderColor: "#c9a84c" }}
          >
            <SheetHeader className="px-6 pt-6 pb-4">
              <SheetTitle className="font-heading text-xl font-bold" style={{ color: "#c9a84c" }}>
                Hurlevent
              </SheetTitle>
            </SheetHeader>

            {user && profilActif && (
              <div
                className="mx-4 mb-2 rounded-xl border p-4"
                style={{ borderColor: "#3a3320", background: "#141414" }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="relative">
                    <Sigil nom={profilActif.nom} size={44} />
                    {profilActif.est_principal && (
                      <span
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full"
                        style={{ background: "#c9a84c", color: "#0a0a0a" }}
                      >
                        <Crown size={10} strokeWidth={2.4} />
                      </span>
                    )}
                  </div>
                  <div>
                    <div
                      className="text-[10px] uppercase tracking-wider"
                      style={{ color: "#8a7333" }}
                    >
                      Profil actif
                    </div>
                    <div className="font-heading text-base font-bold" style={{ color: "#f0e6d2" }}>
                      {profilActif.nom}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    reinitialiserProfil();
                  }}
                  className="mb-1.5 flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold"
                  style={{ borderColor: "#3a3320", background: "#1e1e1e", color: "#c9a84c" }}
                >
                  <Users size={16} /> Changer de profil
                  {autresIdentitesNonLues && (
                    <span
                      className="ml-auto h-2.5 w-2.5 rounded-full"
                      style={{ background: "#c9a84c" }}
                      aria-hidden
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    reinitialiserProfil(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold"
                  style={{ borderColor: "#3a3320", background: "#1e1e1e", color: "#f0e6d2" }}
                >
                  <Settings size={16} /> Gérer les profils
                </button>

                {peutBasculer && (
                  <div
                    className="mt-3 flex items-center gap-3 border-t pt-3"
                    style={{ borderColor: "#2a2618" }}
                  >
                    <div className="flex-1">
                      <div
                        className="flex items-center gap-1.5 text-sm font-semibold"
                        style={{ color: "#f0e6d2" }}
                      >
                        <Sparkles size={14} style={{ color: "#c9a84c" }} /> Mode animation
                      </div>
                      <div className="mt-0.5 text-[10.5px]" style={{ color: "#8a8a8a" }}>
                        {staffActif
                          ? "Activé — outils d'animation visibles."
                          : "Désactivé — tu navigues comme un joueur."}
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={interrupteurOn}
                      aria-label="Mode animation"
                      onClick={() => setInterrupteur(!interrupteurOn)}
                      className="relative h-[26px] w-[46px] flex-shrink-0 rounded-full border transition-colors"
                      style={{
                        borderColor: interrupteurOn ? "#c9a84c" : "#3a3320",
                        background: interrupteurOn ? "rgba(201,168,76,.18)" : "#0d0d0d",
                      }}
                    >
                      <span
                        className="absolute top-[2px] h-5 w-5 rounded-full transition-all"
                        style={{
                          left: interrupteurOn ? 22 : 2,
                          background: interrupteurOn ? "#c9a84c" : "#6b6b6b",
                        }}
                      />
                    </button>
                  </div>
                )}
              </div>
            )}

            <nav className="flex flex-1 flex-col gap-1 px-4">
              {menuItems
                ?.filter(item => item.afficher_navbar)
                .filter(item => staffActif || !item.url.startsWith("/administration"))
                .map(item => (
                  <NavItem key={item.id} to={item.url} label={item.libelle} onClick={close} />
                ))}

              <div className="mt-auto pt-8 border-t border-border/30">
                {user ? (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full rounded-md px-4 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/20 active:bg-muted/40"
                    style={{ color: "#d9534f" }}
                  >
                    Déconnexion
                  </button>
                ) : (
                  <NavItem to="/connexion" label="Connexion" onClick={close} />
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
        </div>
      </div>
    </header>
  );
};

const NavItem = ({ to, label, onClick }: { to: string; label: string; onClick: () => void }) => (
  <Link
    to={to}
    onClick={onClick}
    className="rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/20 hover:text-primary"
  >
    {label}
  </Link>
);

const Sigil = ({ nom, size = 44 }: { nom: string; size?: number }) => {
  const init =
    nom
      .trim()
      .split(/\s+/)
      .map((m) => m[0] ?? "")
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  const h = Math.round(size * 1.08);
  return (
    <span style={{ width: size, height: h, position: "relative", display: "inline-block", flexShrink: 0 }}>
      <svg viewBox="0 0 100 110" width={size} height={h}>
        <path
          d="M50 4 L94 18 V58 C94 84 74 100 50 108 C26 100 6 84 6 58 V18 Z"
          fill="#141414"
          stroke="#c9a84c"
          strokeWidth="2.5"
        />
      </svg>
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: Math.round(size * 0.08),
          fontFamily: '"Cinzel", serif',
          fontSize: Math.round(size * 0.31),
          color: "#c9a84c",
          letterSpacing: 1,
        }}
      >
        {init}
      </span>
    </span>
  );
};

export default Navbar;


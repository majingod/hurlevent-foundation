import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfil } from "@/contexts/ProfilContext";
import { useModeStaff } from "@/contexts/ModeStaffContext";
import { useMenuNavigation } from "@/hooks/useMenuNavigation";
import ClocheNotifications from "@/components/notifications/ClocheNotifications";
import ClocheNotificationsStaff from "@/components/notifications/ClocheNotificationsStaff";
import {
  useAutresIdentitesNonLues,
  useRealtimeNotifications,
  useNotifications,
  useNotificationsStaff,
} from "@/hooks/useNotifications";
import { ADMIN_POLES } from "@/components/admin/adminPoles";
import { Menu, Users, Settings, Crown, Sparkles, User } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState, type CSSProperties } from "react";

const Navbar = () => {
  const { user, role, signOut } = useAuth();
  const { profilActif, reinitialiserProfil } = useProfil();
  const { peutBasculer, staffActif, setInterrupteur } = useModeStaff();
  const autresIdentitesNonLues = useAutresIdentitesNonLues();
  const { nbNonLus } = useNotifications();
  const { nbATraiter } = useNotificationsStaff();
  useRealtimeNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: menuItems, sections } = useMenuNavigation(role);

  const menuVisibles = (menuItems ?? []).filter((item) => item.afficher_navbar);
  const menuSansSection = menuVisibles.filter((item) => item.section === null);

  const handleSignOut = async () => {
    setOpen(false);
    reinitialiserProfil();
    await signOut();
    navigate("/");
  };

  const close = () => setOpen(false);

  // Sélecteur d'espace : bascule le mode staff ET atterrit sur l'accueil de l'espace.
  const allerJoueur = () => {
    setInterrupteur(false);
    navigate("/");
  };
  const allerOrga = () => {
    setInterrupteur(true);
    navigate("/administration/dashboard");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-heading text-xl font-bold text-primary">Hurlevent</span>
        </Link>

        <div className="flex items-center gap-2">
          {user && (staffActif ? <ClocheNotificationsStaff /> : <ClocheNotifications />)}
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
            className="flex w-72 flex-col border-l bg-[#0a0a0a] p-0"
            style={{ borderColor: "#c9a84c" }}
          >
            <SheetHeader className="shrink-0 px-6 pt-6 pb-4">
              <SheetTitle className="font-heading text-xl font-bold" style={{ color: "#c9a84c" }}>
                Hurlevent
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto pb-2">

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
              </div>
            )}

            {/* ── Navigation selon l'espace actif ── */}
            {staffActif ? (
              // Mode Organisation : les 3 pôles admin (source = ADMIN_POLES)
              ADMIN_POLES.map((pole) => (
                <div key={pole.label}>
                  <div
                    className="px-[14px] pb-1 pt-4 text-[9.5px] font-bold uppercase tracking-[1.4px]"
                    style={{ color: "#c98a8a" }}
                  >
                    {pole.label}
                  </div>
                  <nav className="flex flex-col gap-1 px-4">
                    {pole.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          to={item.path}
                          onClick={close}
                          className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/20 hover:text-primary"
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" style={{ color: "#8a8a8a" }} />
                          <span>{item.label}</span>
                          {item.id === "approbations" && nbATraiter > 0 && (
                            <span
                              className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[0.66rem] font-bold"
                              style={{ background: "#c9a84c", color: "#0a0a0a" }}
                            >
                              {nbATraiter}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))
            ) : (
              // Mode Joueur : menu joueur (base), sections non-staff uniquement
              <>
                <nav className="flex flex-col gap-1 px-4">
                  {menuSansSection.map((item) => (
                    <NavItem key={item.id} to={item.url} label={item.libelle} onClick={close} boxed />
                  ))}
                </nav>

                {(sections ?? [])
                  .filter((sec) => !sec.est_staff)
                  .map((sec) => {
                    const its = menuVisibles.filter((item) => item.section === sec.slug);
                    if (its.length === 0) return null;
                    return (
                      <div key={sec.slug}>
                        <div
                          className="px-[14px] pb-1 pt-4 text-[9.5px] font-bold uppercase tracking-[1.4px]"
                          style={{ color: "#8a7333" }}
                        >
                          {sec.libelle}
                        </div>
                        <nav className="flex flex-col gap-1 px-4">
                          {its.map((item) => (
                            <NavItem key={item.id} to={item.url} label={item.libelle} onClick={close} />
                          ))}
                        </nav>
                      </div>
                    );
                  })}
              </>
            )}

            </div>

            <div className="shrink-0 border-t border-border/30">
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full px-4 py-3.5 text-left text-sm font-semibold transition-colors hover:bg-muted/20 active:bg-muted/40"
                  style={{ color: "#d9534f" }}
                >
                  Déconnexion
                </button>
              ) : (
                <NavItem to="/connexion" label="Connexion" onClick={close} />
              )}
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </div>

      {/* Ligne 2 — sélecteur d'espace (compte staff sur profil principal) */}
      {user && peutBasculer && (
        <div className="container flex justify-center border-t border-white/5 pb-2.5 pt-1">
          <SelecteurEspace
            staffActif={staffActif}
            nbNonLus={nbNonLus}
            nbATraiter={nbATraiter}
            onJoueur={allerJoueur}
            onOrga={allerOrga}
          />
        </div>
      )}
    </header>
  );
};

// ── Sélecteur d'espace (header) : Joueur / Orga, avec badge des deux côtés ──
const SelecteurEspace = ({
  staffActif,
  nbNonLus,
  nbATraiter,
  onJoueur,
  onOrga,
}: {
  staffActif: boolean;
  nbNonLus: number;
  nbATraiter: number;
  onJoueur: () => void;
  onOrga: () => void;
}) => {
  const seg = (active: boolean, activeColor: string): CSSProperties => ({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    padding: "4px 7px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    background: active
      ? activeColor === "#c98a8a"
        ? "rgba(201,138,138,.16)"
        : "rgba(201,168,76,.18)"
      : "transparent",
    color: active ? activeColor : "#8a8a8a",
  });
  const pastille = (n: number) =>
    n > 0 ? (
      <span
        style={{
          minWidth: 15,
          height: 15,
          borderRadius: 999,
          background: "#c9a84c",
          color: "#0a0a0a",
          fontSize: 9.5,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 4px",
          border: "2px solid #0a0a0a",
        }}
      >
        {n > 9 ? "9+" : n}
      </span>
    ) : null;
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        background: "#0d0d0d",
        border: "1px solid #3a3320",
        borderRadius: 8,
        padding: 2,
      }}
    >
      <button type="button" onClick={onJoueur} aria-label="Mode joueur" style={seg(!staffActif, "#c9a84c")}>
        <span style={{ position: "absolute", top: -7, left: -5 }}>{pastille(nbNonLus)}</span>
        <User size={13} /> Joueur
      </button>
      <button type="button" onClick={onOrga} aria-label="Mode organisation" style={seg(staffActif, "#c98a8a")}>
        <Sparkles size={13} /> Orga
        <span style={{ position: "absolute", top: -7, right: -5 }}>{pastille(nbATraiter)}</span>
      </button>
    </div>
  );
};

const NavItem = ({
  to,
  label,
  onClick,
  boxed = false,
}: {
  to: string;
  label: string;
  onClick: () => void;
  boxed?: boolean;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className={`rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/20 hover:text-primary${
      boxed ? " border" : ""
    }`}
    style={boxed ? { borderColor: "#232323" } : undefined}
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

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronRight,
  Crown,
  Archive,
  ArchiveRestore,
  Skull,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";
import IntroEtape, {
  IntroEtapeItem,
} from "@/components/createur/aide/IntroEtape";
import LegendeJoueursAdmin from "@/components/admin/joueurs/LegendeJoueursAdmin";
import DrawerAjusterAdmin, {
  type CibleAjuster,
} from "@/components/admin/joueurs/DrawerAjusterAdmin";
import DrawerRoleCompte from "@/components/admin/joueurs/DrawerRoleCompte";
import { HistoriqueBanque } from "@/components/personnage/sections/HistoriqueBanque";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Role = "joueur" | "animateur" | "admin";

interface PersoRow {
  id: string;
  nom: string | null;
  niveau: number;
  niveauCorrection: number;
  xpTotal: number;
  xpDepense: number;
  estFinalise: boolean;
  estVerrouille: boolean;
  estMort: boolean;
  estActif: boolean;
}
interface ProfilRow {
  id: string;
  nom: string;
  estPrincipal: boolean;
  estActif: boolean;
  solde: number;
  persos: PersoRow[];
}
interface CompteRow {
  id: string;
  nom: string;
  email: string;
  role: Role;
  isActive: boolean;
  profils: ProfilRow[];
  nbPersos: number;
}

const ROLE_LABEL: Record<Role, string> = {
  joueur: "Joueur",
  animateur: "Animateur",
  admin: "Admin",
};
const ROLE_BADGE: Record<Role, string> = {
  joueur: "border-border text-muted-foreground",
  animateur: "border-accent/80 text-[hsl(36_33%_80%)]",
  admin: "border-primary/50 text-primary",
};

const dotCls = (pe: PersoRow) =>
  pe.estVerrouille
    ? "bg-muted-foreground"
    : pe.estFinalise
      ? "bg-[hsl(140_40%_50%)]"
      : "bg-primary";
const dotTitle = (pe: PersoRow) =>
  pe.estVerrouille ? "Verrouillé" : pe.estFinalise ? "Finalisé" : "En édition";

// Pastille compteur (or = profils, neutre = personnages).
const Pastille = ({
  tone,
  children,
}: {
  tone?: "gold";
  children: React.ReactNode;
}) => (
  <span
    className={`whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] ${
      tone === "gold"
        ? "border-primary/40 text-primary"
        : "border-primary/25 text-foreground"
    }`}
  >
    {children}
  </span>
);

// Badge « Archivé » — n'apparaît que pour un élément retiré (l'actif est silencieux).
const ArchiveBadge = () => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-muted-foreground/50 bg-muted-foreground/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
    <Archive className="h-2.5 w-2.5" /> Archivé
  </span>
);

// Bouton icône Archiver / Réactiver.
const BoutonArchive = ({
  archived,
  disabled,
  onClick,
  title,
}: {
  archived: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
}) => {
  const Icon = archived ? ArchiveRestore : Archive;
  return (
    <button
      type="button"
      disabled={disabled}
      title={title ?? (archived ? "Réactiver" : "Archiver")}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      className={`inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border transition-colors ${
        disabled
          ? "cursor-not-allowed border-border text-muted-foreground/40"
          : archived
            ? "border-primary/60 bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-[15px] w-[15px]" />
    </button>
  );
};

interface RpcStandard {
  succes?: boolean;
  erreurs?: { message?: string }[];
}
interface RpcPerso {
  succes?: boolean;
  raison?: string;
}

const AdminJoueurs = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const estAdmin = role === "admin";

  const [searchTerm, setSearchTerm] = useState("");
  const [openComptes, setOpenComptes] = useState<Set<string>>(new Set());
  const [openProfils, setOpenProfils] = useState<Set<string>>(new Set());
  const [ajusterCle, setAjusterCle] = useState<
    { kind: "banque"; profilId: string } | { kind: "perso"; persoId: string } | null
  >(null);
  const [roleCle, setRoleCle] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState<{
    titre: string;
    description: string;
    danger: boolean;
    action: () => void;
  } | null>(null);

  const { data: comptes, isLoading } = useQuery({
    queryKey: ["admin-joueurs"],
    queryFn: async (): Promise<CompteRow[]> => {
      const [pc, pj, bq, pe] = await Promise.all([
        supabase.from("profiles").select("id, nom_affichage, email, role, is_active"),
        supabase.from("profils_joueur").select("id, compte_id, nom, est_principal, est_actif"),
        supabase.from("vue_banque_joueur").select("joueur_id, solde"),
        supabase
          .from("vue_personnages_admin_complet")
          .select(
            "id, nom, joueur_id, niveau, niveau_correction, xp_total, xp_depense, est_finalise, est_verrouille, est_mort, est_actif",
          ),
      ]);
      if (pc.error) throw pc.error;
      if (pj.error) throw pj.error;
      if (bq.error) throw bq.error;
      if (pe.error) throw pe.error;

      const soldeParProfil = new Map<string, number>();
      (bq.data ?? []).forEach((r) => {
        if (r.joueur_id) soldeParProfil.set(r.joueur_id, r.solde ?? 0);
      });

      const persosParProfil = new Map<string, PersoRow[]>();
      (pe.data ?? []).forEach((r) => {
        if (!r.id || !r.joueur_id) return;
        const row: PersoRow = {
          id: r.id,
          nom: r.nom,
          niveau: r.niveau ?? 1,
          niveauCorrection: r.niveau_correction ?? 0,
          xpTotal: r.xp_total ?? 0,
          xpDepense: r.xp_depense ?? 0,
          estFinalise: !!r.est_finalise,
          estVerrouille: !!r.est_verrouille,
          estMort: !!r.est_mort,
          estActif: r.est_actif !== false,
        };
        const arr = persosParProfil.get(r.joueur_id) ?? [];
        arr.push(row);
        persosParProfil.set(r.joueur_id, arr);
      });

      const profilsParCompte = new Map<string, ProfilRow[]>();
      (pj.data ?? []).forEach((r) => {
        const persos = (persosParProfil.get(r.id) ?? []).sort((a, b) =>
          (a.nom ?? "").localeCompare(b.nom ?? "", "fr"),
        );
        const profil: ProfilRow = {
          id: r.id,
          nom: r.nom,
          estPrincipal: !!r.est_principal,
          estActif: r.est_actif !== false,
          solde: soldeParProfil.get(r.id) ?? 0,
          persos,
        };
        const arr = profilsParCompte.get(r.compte_id) ?? [];
        arr.push(profil);
        profilsParCompte.set(r.compte_id, arr);
      });

      return (pc.data ?? [])
        .map((c): CompteRow => {
          const profils = (profilsParCompte.get(c.id) ?? []).sort((a, b) =>
            a.nom.localeCompare(b.nom, "fr"),
          );
          return {
            id: c.id,
            nom: c.nom_affichage ?? c.email ?? "—",
            email: c.email ?? "",
            role: (c.role ?? "joueur") as Role,
            isActive: c.is_active !== false,
            profils,
            nbPersos: profils.reduce((n, p) => n + p.persos.length, 0),
          };
        })
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    },
  });

  const q = searchTerm.trim().toLowerCase();
  const matchCompte = (c: CompteRow) =>
    c.nom.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q) ||
    c.profils.some(
      (p) =>
        p.nom.toLowerCase().includes(q) ||
        p.persos.some((pe) => (pe.nom ?? "").toLowerCase().includes(q)),
    );

  const comptesAffiches = useMemo(
    () => (comptes ?? []).filter((c) => !q || matchCompte(c)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comptes, q],
  );

  const compteOuvert = (c: CompteRow) =>
    q ? matchCompte(c) : openComptes.has(c.id);
  const profilOuvert = (p: ProfilRow) => (q ? true : openProfils.has(p.id));

  const toggleCompte = (id: string) =>
    setOpenComptes((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleProfil = (id: string) =>
    setOpenProfils((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // ── Archivage (RPC prod, retour standard pour compte/profil, {succes,raison} pour perso) ──
  const lancerArchivage = async (
    fn: string,
    paramNom: string,
    id: string,
    libelleSucces: string,
    perso: boolean,
  ) => {
    try {
      const { data, error } = await supabase.rpc(
        fn as "archiver_personnage",
        { [paramNom]: id } as { p_personnage_id: string },
      );
      if (error) throw error;
      if (perso) {
        const ret = (data ?? {}) as RpcPerso;
        if (ret.succes !== true) {
          toast.error(ret.raison ?? "Action refusée.");
          return;
        }
      } else {
        const ret = (data ?? {}) as RpcStandard;
        if (ret.succes !== true) {
          toast.error(ret.erreurs?.[0]?.message ?? "Action refusée.");
          return;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-joueurs"] });
      toast.success(libelleSucces);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau.");
    }
  };

  const confirmCompte = (c: CompteRow) =>
    setConfirmer(
      c.isActive
        ? {
            danger: true,
            titre: `Archiver le compte « ${c.nom} » ?`,
            description: `⚠️ Le joueur ne pourra plus se connecter (connexion bloquée). Ses ${c.profils.length} profil(s) et ${c.nbPersos} personnage(s) seront aussi archivés.`,
            action: () =>
              lancerArchivage("archiver_compte", "p_compte_id", c.id, "Compte archivé.", false),
          }
        : {
            danger: false,
            titre: `Réactiver le compte « ${c.nom} » ?`,
            description: `Le joueur pourra de nouveau se connecter. Ses ${c.profils.length} profil(s) et ${c.nbPersos} personnage(s) seront réactivés.`,
            action: () =>
              lancerArchivage("desarchiver_compte", "p_compte_id", c.id, "Compte réactivé.", false),
          },
    );
  const confirmProfil = (p: ProfilRow) =>
    setConfirmer(
      p.estActif
        ? {
            danger: true,
            titre: `Archiver le profil « ${p.nom} » ?`,
            description: `Ses ${p.persos.length} personnage(s) seront aussi archivés. Le compte reste actif.`,
            action: () =>
              lancerArchivage("archiver_profil", "p_profil_id", p.id, "Profil archivé.", false),
          }
        : {
            danger: false,
            titre: `Réactiver le profil « ${p.nom} » ?`,
            description: `Ses ${p.persos.length} personnage(s) seront réactivés.`,
            action: () =>
              lancerArchivage("desarchiver_profil", "p_profil_id", p.id, "Profil réactivé.", false),
          },
    );
  const confirmPerso = (pe: PersoRow) =>
    setConfirmer(
      pe.estActif
        ? {
            danger: true,
            titre: `Archiver « ${pe.nom ?? "Sans nom"} » ?`,
            description:
              "Le personnage passera en lecture seule côté joueur (visible, non modifiable, non supprimable).",
            action: () =>
              lancerArchivage(
                "archiver_personnage",
                "p_personnage_id",
                pe.id,
                "Personnage archivé.",
                true,
              ),
          }
        : {
            danger: false,
            titre: `Réactiver « ${pe.nom ?? "Sans nom"} » ?`,
            description: "Le personnage redeviendra modifiable par le joueur.",
            action: () =>
              lancerArchivage(
                "desarchiver_personnage",
                "p_personnage_id",
                pe.id,
                "Personnage réactivé.",
                true,
              ),
          },
    );

  const cibleAjuster: CibleAjuster | null = useMemo(() => {
    if (!ajusterCle || !comptes) return null;
    for (const c of comptes) {
      for (const p of c.profils) {
        if (ajusterCle.kind === "banque" && p.id === ajusterCle.profilId) {
          return {
            mode: "banque",
            profilId: p.id,
            profilNom: p.nom,
            compteNom: c.nom,
            solde: p.solde,
          };
        }
        if (ajusterCle.kind === "perso") {
          for (const pe of p.persos) {
            if (pe.id === ajusterCle.persoId) {
              return {
                mode: "perso",
                persoId: pe.id,
                persoNom: pe.nom,
                profilNom: p.nom,
                niveau: pe.niveau,
                niveauCorrection: pe.niveauCorrection,
                xpTotal: pe.xpTotal,
                xpDepense: pe.xpDepense,
              };
            }
          }
        }
      }
    }
    return null;
  }, [ajusterCle, comptes]);

  const compteRole = useMemo(() => {
    if (!roleCle || !comptes) return null;
    const c = comptes.find((x) => x.id === roleCle);
    return c ? { id: c.id, nom: c.nom, role: c.role } : null;
  }, [roleCle, comptes]);

  return (
    <AdminLayout
      title="Gestion des joueurs"
      searchPlaceholder="Rechercher un compte, profil ou personnage…"
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
    >
      <IntroEtape
        storageKey="hv-admin-joueurs-intro"
        titre="Comment fonctionne cette page ?"
      >
        <IntroEtapeItem n={1}>
          La <b>recherche</b> filtre sur le compte, le nom de profil <i>et</i> le
          nom de personnage ; les comptes qui correspondent se déplient tout
          seuls.
        </IntroEtapeItem>
        <IntroEtapeItem n={2}>
          Touchez un <b>compte</b> pour déplier ses <b>profils de jeu</b>, puis un{" "}
          <b>profil</b> pour déplier ses <b>personnages</b>.
        </IntroEtapeItem>
        <IntroEtapeItem n={3}>
          Touchez le <b>badge de rôle</b> d'un compte (ex. Joueur ▾) pour le
          passer à <b>Animateur</b> ou <b>Admin</b>. Le rôle est au niveau du
          compte, pas du profil.
        </IntroEtapeItem>
        <IntroEtapeItem n={4}>
          Chaque profil a sa <b>banque d'XP du joueur</b> — les XP gagnés aux{" "}
          <b>Mini-GN</b> et aux <b>ouvertures de terrain</b>. C'est distinct de
          l'XP d'un personnage. Bouton <b>Ajuster</b> pour créditer ou débiter
          (le solde peut devenir négatif).
        </IntroEtapeItem>
        <IntroEtapeItem n={5}>
          <b>Voir perso</b> ouvre la fiche du personnage en lecture seule.{" "}
          <b>Ajuster Niv./Xp</b> corrige l'XP (retrait limité à l'XP disponible)
          ou le <b>niveau</b> (jamais sous 1), même sur un personnage{" "}
          <b>verrouillé</b>. Un niveau corrigé est signalé par ✎.
        </IntroEtapeItem>
        <IntroEtapeItem n={6}>
          Les icônes <b>Archiver</b> / <b>Réactiver</b> retirent ou réactivent un
          compte, un profil ou un personnage. Archiver un compte <b>bloque sa
          connexion</b>. L'archivage descend en <b>cascade</b> (compte → profils
          → personnages) et reste <b>réversible</b>.
        </IntroEtapeItem>
      </IntroEtape>

      <LegendeJoueursAdmin />

      <div className="overflow-hidden rounded-2xl border border-primary/10 bg-card/60 backdrop-blur-sm">
        <div className="px-4 pb-1.5 pt-3.5">
          <h2 className="font-heading text-[15px]">
            Liste des joueurs ({comptesAffiches.length})
          </h2>
        </div>
        <div>
          {isLoading ? (
            <p className="py-12 text-center text-muted-foreground">Chargement…</p>
          ) : comptesAffiches.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              Aucun joueur trouvé.
            </p>
          ) : (
            comptesAffiches.map((c) => {
              const ouvert = compteOuvert(c);
              return (
                <div
                  key={c.id}
                  className="border-b border-primary/5 last:border-b-0"
                >
                  <div
                    onClick={() => toggleCompte(c.id)}
                    className="flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-primary/5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`break-words text-[15px] font-semibold leading-tight ${
                            c.isActive ? "" : "text-muted-foreground line-through"
                          }`}
                        >
                          {c.nom}
                        </span>
                        {!c.isActive && <ArchiveBadge />}
                        {estAdmin ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRoleCle(c.id);
                            }}
                            className={`whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] ${ROLE_BADGE[c.role]}`}
                          >
                            {ROLE_LABEL[c.role]}
                            <span className="ml-0.5 text-[9px] opacity-70">▾</span>
                          </button>
                        ) : (
                          <span
                            className={`whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] ${ROLE_BADGE[c.role]}`}
                          >
                            {ROLE_LABEL[c.role]}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 break-all text-xs text-muted-foreground">
                        {c.email}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Pastille tone="gold">{c.profils.length} prof.</Pastille>
                      <Pastille>{c.nbPersos} pers.</Pastille>
                    </div>
                    <BoutonArchive
                      archived={!c.isActive}
                      onClick={() => confirmCompte(c)}
                    />
                    <ChevronRight
                      className={`mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${ouvert ? "rotate-90" : ""}`}
                    />
                  </div>

                  {ouvert && (
                    <div className="bg-[hsl(0_0%_5%)] px-2.5 pb-3 pt-1.5">
                      {c.profils.map((p) => {
                        const neg = p.solde < 0;
                        const pOuvert = profilOuvert(p);
                        return (
                          <div
                            key={p.id}
                            className="my-2 overflow-hidden rounded-xl border border-border"
                          >
                            <div
                              onClick={() => toggleProfil(p.id)}
                              className="flex cursor-pointer items-start justify-between gap-2.5 bg-muted/45 px-3 py-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {p.estPrincipal && (
                                    <Crown
                                      className="h-3.5 w-3.5 shrink-0 text-primary"
                                      aria-label="Profil principal"
                                    />
                                  )}
                                  <span
                                    className={`break-words text-sm font-semibold ${
                                      p.estActif
                                        ? ""
                                        : "text-muted-foreground line-through"
                                    }`}
                                  >
                                    {p.nom}
                                  </span>
                                  <span className="whitespace-nowrap text-[10px] font-normal text-muted-foreground">
                                    profil de jeu
                                  </span>
                                  <Pastille>{p.persos.length} pers.</Pastille>
                                  {!p.estActif && <ArchiveBadge />}
                                </div>
                                <div
                                  className={`mt-0.5 text-xs ${neg ? "" : "text-muted-foreground"}`}
                                >
                                  Banque d'XP :{" "}
                                  <b
                                    className={`tabular-nums ${neg ? "text-[hsl(0_70%_62%)]" : "text-primary"}`}
                                  >
                                    {p.solde}
                                  </b>{" "}
                                  XP
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAjusterCle({ kind: "banque", profilId: p.id });
                                }}
                                className="shrink-0 whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                              >
                                Ajuster
                              </button>
                              <BoutonArchive
                                archived={!p.estActif}
                                disabled={!c.isActive}
                                title={
                                  !c.isActive ? "Réactiver le compte d'abord" : undefined
                                }
                                onClick={() => confirmProfil(p)}
                              />
                              <ChevronRight
                                className={`mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${pOuvert ? "rotate-90" : ""}`}
                              />
                            </div>

                            {pOuvert && (
                              <>
                                <div className="border-t border-border px-3 py-2.5">
                                  <HistoriqueBanque joueurId={p.id} vueAdmin />
                                </div>

                                {p.persos.map((pe) => {
                                  const rest = pe.xpTotal - pe.xpDepense;
                                  const persoArchDisabled = !c.isActive || !p.estActif;
                                  return (
                                    <div
                                      key={pe.id}
                                      className="border-t border-border px-3 py-2.5"
                                    >
                                      <div className="flex items-start gap-2">
                                        {pe.estMort ? (
                                          <Skull
                                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(348_55%_45%)]"
                                            aria-label="Mort"
                                          />
                                        ) : (
                                          <span
                                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotCls(pe)}`}
                                            title={dotTitle(pe)}
                                          />
                                        )}
                                        <span
                                          className={`break-words text-sm font-medium leading-tight ${
                                            pe.nom ? "" : "italic text-muted-foreground"
                                          } ${pe.estActif ? "" : "line-through"}`}
                                        >
                                          {pe.nom ?? "Sans nom"}
                                        </span>
                                        {!pe.estActif && <ArchiveBadge />}
                                      </div>
                                      <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-2 pl-[15px]">
                                        <span className="text-xs tabular-nums">
                                          Niv.{" "}
                                          <b className="text-foreground">
                                            {pe.niveau}
                                          </b>
                                          {pe.niveauCorrection !== 0 && (
                                            <span
                                              className="ml-1 text-[11px] text-primary"
                                              title={`Inclut ${pe.niveauCorrection > 0 ? "+" : ""}${pe.niveauCorrection} de correction manuelle de niveau`}
                                            >
                                              ✎
                                            </span>
                                          )}
                                        </span>
                                        <span className="text-xs tabular-nums text-muted-foreground">
                                          XP rest./tot.{" "}
                                          <b className="text-primary">{rest}</b> /{" "}
                                          {pe.xpTotal}
                                        </span>
                                        <div className="ml-auto flex flex-wrap items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigate(`/personnage/${pe.id}`);
                                            }}
                                            className="whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-foreground"
                                          >
                                            Voir perso
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setAjusterCle({
                                                kind: "perso",
                                                persoId: pe.id,
                                              });
                                            }}
                                            className="whitespace-nowrap rounded-lg border border-primary/50 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary"
                                          >
                                            Ajuster Niv./Xp
                                          </button>
                                          <BoutonArchive
                                            archived={!pe.estActif}
                                            disabled={persoArchDisabled}
                                            title={
                                              persoArchDisabled
                                                ? "Réactiver le profil/compte d'abord"
                                                : undefined
                                            }
                                            onClick={() => confirmPerso(pe)}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <DrawerAjusterAdmin
        cible={cibleAjuster}
        open={ajusterCle !== null && cibleAjuster !== null}
        onOpenChange={(o) => {
          if (!o) setAjusterCle(null);
        }}
      />
      <DrawerRoleCompte
        compte={compteRole}
        open={roleCle !== null && compteRole !== null}
        onOpenChange={(o) => {
          if (!o) setRoleCle(null);
        }}
      />

      <AlertDialog
        open={confirmer !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmer(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">
              {confirmer?.titre}
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              {confirmer?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmer?.danger
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
              onClick={() => confirmer?.action()}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminJoueurs;

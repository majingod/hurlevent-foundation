import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

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
}
interface ProfilRow {
  id: string;
  nom: string;
  solde: number;
  persos: PersoRow[];
}
interface CompteRow {
  id: string;
  nom: string;
  email: string;
  role: Role;
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

const AdminJoueurs = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const estAdmin = role === "admin";

  const [searchTerm, setSearchTerm] = useState("");
  const [openComptes, setOpenComptes] = useState<Set<string>>(new Set());
  const [ajusterCle, setAjusterCle] = useState<
    { kind: "banque"; profilId: string } | { kind: "perso"; persoId: string } | null
  >(null);
  const [roleCle, setRoleCle] = useState<string | null>(null);

  const { data: comptes, isLoading } = useQuery({
    queryKey: ["admin-joueurs"],
    queryFn: async (): Promise<CompteRow[]> => {
      const [pc, pj, bq, pe] = await Promise.all([
        supabase.from("profiles").select("id, nom_affichage, email, role"),
        supabase.from("profils_joueur").select("id, compte_id, nom"),
        supabase.from("vue_banque_joueur").select("joueur_id, solde"),
        supabase
          .from("vue_personnages_admin_complet")
          .select(
            "id, nom, joueur_id, niveau, niveau_correction, xp_total, xp_depense, est_finalise, est_verrouille",
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

  const estOuvert = (c: CompteRow) =>
    q ? matchCompte(c) : openComptes.has(c.id);
  const toggleCompte = (id: string) =>
    setOpenComptes((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Dérive la cible LIVE du drawer Ajuster (après re-fetch -> valeurs fraîches)
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
          Touchez un <b>compte</b> pour le déplier : ses <b>profils de jeu</b>{" "}
          apparaissent, chacun avec sa banque d'XP et ses personnages.
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
          <b>Voir perso</b> ouvre la fiche du personnage en lecture seule.
        </IntroEtapeItem>
        <IntroEtapeItem n={6}>
          <b>Ajuster Niv./Xp</b> corrige l'XP d'un personnage (retrait limité à
          l'XP disponible) ou son <b>niveau</b> (jamais sous 1). Possible même
          sur un personnage <b>verrouillé</b> — c'est un outil staff. Un niveau
          corrigé manuellement est signalé par ✎.
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
              const ouvert = estOuvert(c);
              return (
                <div
                  key={c.id}
                  className="border-b border-primary/5 last:border-b-0"
                >
                  <div
                    onClick={() => toggleCompte(c.id)}
                    className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-primary/5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-[15px] font-semibold leading-tight">
                        {c.nom}
                      </div>
                      <div className="mt-0.5 break-all text-xs text-muted-foreground">
                        {c.email}
                      </div>
                    </div>
                    <div className="flex max-w-[48%] shrink-0 flex-wrap items-center justify-end gap-2">
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
                      <span className="whitespace-nowrap rounded-full border border-primary/25 px-2.5 py-[3px] text-[11px] text-foreground">
                        {c.nbPersos} pers.
                      </span>
                      <ChevronRight
                        className={`h-3.5 w-3.5 self-center text-muted-foreground transition-transform ${ouvert ? "rotate-90" : ""}`}
                      />
                    </div>
                  </div>

                  {ouvert && (
                    <div className="bg-[hsl(0_0%_5%)] px-2.5 pb-3 pt-1.5">
                      {c.profils.map((p) => {
                        const neg = p.solde < 0;
                        return (
                          <div
                            key={p.id}
                            className="my-2 overflow-hidden rounded-xl border border-border"
                          >
                            <div className="flex items-center justify-between gap-2.5 bg-muted/45 px-3 py-2.5">
                              <div className="min-w-0">
                                <div className="break-words text-sm font-semibold">
                                  {p.nom}
                                  <span className="ml-1.5 whitespace-nowrap text-[10px] font-normal text-muted-foreground">
                                    profil de jeu
                                  </span>
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
                                onClick={() =>
                                  setAjusterCle({ kind: "banque", profilId: p.id })
                                }
                                className="shrink-0 whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                              >
                                Ajuster
                              </button>
                            </div>

                            {p.persos.map((pe) => {
                              const rest = pe.xpTotal - pe.xpDepense;
                              return (
                                <div
                                  key={pe.id}
                                  className="border-t border-border px-3 py-2.5"
                                >
                                  <div className="flex items-start gap-2">
                                    <span
                                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotCls(pe)}`}
                                      title={dotTitle(pe)}
                                    />
                                    <span
                                      className={`break-words text-sm font-medium leading-tight ${pe.nom ? "" : "italic text-muted-foreground"}`}
                                    >
                                      {pe.nom ?? "Sans nom"}
                                    </span>
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
                                    <div className="ml-auto flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          navigate(`/personnage/${pe.id}`)
                                        }
                                        className="whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-foreground"
                                      >
                                        Voir perso
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setAjusterCle({
                                            kind: "perso",
                                            persoId: pe.id,
                                          })
                                        }
                                        className="whitespace-nowrap rounded-lg border border-primary/50 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary"
                                      >
                                        Ajuster Niv./Xp
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
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
    </AdminLayout>
  );
};

export default AdminJoueurs;

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import AdminLayout from "@/components/admin/AdminLayout";
import { Loader2, Crown, Sparkles } from "lucide-react";

type StaffRow = Database["public"]["Views"]["vue_journal_staff"]["Row"];

const LABELS: Record<string, string> = {
  acheter_competence: "Achat — Compétence",
  acheter_sort: "Achat — Sort",
  acheter_priere: "Achat — Prière",
  acheter_recette: "Achat — Recette",
  acheter_assemblage: "Achat — Assemblage",
  acheter_piege: "Achat — Piège",
  acheter_trait_racial: "Achat — Trait racial",
  desacheter_competence: "Remboursement — Compétence",
  desacheter_sort: "Remboursement — Sort",
  desacheter_priere: "Remboursement — Prière",
  desacheter_recette: "Remboursement — Recette",
  desacheter_assemblage: "Remboursement — Assemblage",
  desacheter_piege: "Remboursement — Piège",
  sauvegarder_etape_1: "Création — Étape 1",
  sauvegarder_etape_2: "Création — Étape 2",
  sauvegarder_etape_3: "Création — Étape 3",
  sauvegarder_etape_4: "Création — Étape 4",
  avancer_etape: "Création — Progression",
  valider_personnage_final: "Personnage finalisé",
  reouvrir_personnage: "Réouverture du personnage",
  changer_classe_personnage: "Changement de classe",
  creer_demande_race: "Demande de race",
  bloquer: "Blocage",
  desbloquer: "Déblocage",
  purger: "Purge définitive",
};
const labelOf = (a: string | null) => (a && LABELS[a]) || a || "Action";
const ROLE_LABEL: Record<string, string> = { admin: "Admin", animateur: "Animateur" };

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("fr-CA", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

type Chip = { t: string; tone: "bordeaux" | "gold" | "neutre" };
function detailChips(details: StaffRow["details"]): Chip[] {
  const chips: Chip[] = [];
  if (!details || typeof details !== "object") return chips;
  const d = details as Record<string, unknown>;
  if (typeof d.nom === "string") {
    const niv = typeof d.niveau === "number" ? ` · niv ${d.niveau}` : "";
    chips.push({ t: `${d.nom}${niv}`, tone: "gold" });
  }
  if (typeof d.cout_xp === "number") chips.push({ t: `−${d.cout_xp} XP`, tone: "bordeaux" });
  if (typeof d.xp_rembourse === "number" && d.xp_rembourse > 0)
    chips.push({ t: `+${d.xp_rembourse} XP`, tone: "gold" });
  if (typeof d.classe_avant === "string" && typeof d.classe_apres === "string")
    chips.push({ t: `${d.classe_avant} → ${d.classe_apres}`, tone: "neutre" });
  if (typeof d.montant === "number") {
    const pos = d.montant > 0;
    chips.push({ t: `${pos ? "+" : "−"}${Math.abs(d.montant)} XP`, tone: pos ? "gold" : "bordeaux" });
  }
  if (typeof d.description === "string" && d.description.trim())
    chips.push({ t: d.description, tone: "neutre" });
  if (typeof d.solde_apres === "number")
    chips.push({ t: `Solde : ${d.solde_apres}`, tone: "neutre" });
  return chips;
}
const CHIP_CLASS: Record<Chip["tone"], string> = {
  bordeaux: "bg-bordeaux text-white",
  gold: "bg-gold text-black",
  neutre: "bg-muted text-muted-foreground",
};

function RolePill({ role, nom }: { role: string | null; nom: string | null }) {
  const isAdmin = role === "admin";
  const label = (role && ROLE_LABEL[role]) || "Staff";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isAdmin ? "bg-bordeaux text-white" : "bg-gold text-black"
      }`}
    >
      {isAdmin ? <Crown className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
      {label}
      {nom ? ` ${nom}` : ""}
    </span>
  );
}

export default function AdminJournal() {
  const [roleF, setRoleF] = useState<"tout" | "admin" | "animateur">("tout");
  const [search, setSearch] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-journal-staff"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_journal_staff")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      return (data ?? []) as StaffRow[];
    },
  });

  const filtered = useMemo(() => {
    let r = rows ?? [];
    if (roleF !== "tout") r = r.filter((e) => e.acteur_role === roleF);
    const q = search.trim().toLowerCase();
    if (q)
      r = r.filter(
        (e) =>
          (e.acteur_nom ?? "").toLowerCase().includes(q) ||
          (e.cible_nom ?? "").toLowerCase().includes(q) ||
          labelOf(e.action).toLowerCase().includes(q)
      );
    return r;
  }, [rows, roleF, search]);

  const filtres: { k: typeof roleF; l: string }[] = [
    { k: "tout", l: "Tout" },
    { k: "admin", l: "Admin" },
    { k: "animateur", l: "Animateur" },
  ];

  return (
    <AdminLayout
      title="Journal d'audit"
      searchPlaceholder="Acteur, personnage ou action…"
      searchValue={search}
      onSearchChange={setSearch}
    >
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        Toutes les actions du staff sur les personnages des joueurs. Lecture seule.
      </p>

      <div className="flex gap-2 mb-4">
        {filtres.map((f) => (
          <button
            key={f.k}
            onClick={() => setRoleF(f.k)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
              roleF === f.k
                ? "border-primary bg-primary/10 text-primary"
                : "border-primary/15 text-muted-foreground hover:text-primary"
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-heading text-lg text-gold">Aucune entrée</p>
          <p className="text-sm text-muted-foreground">
            Aucune action staff ne correspond à ce filtre.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-primary/10 bg-card/50">
          <table className="w-full border-collapse min-w-[680px]">
            <thead>
              <tr className="text-left">
                <th className="px-3 py-3 text-[0.7rem] uppercase tracking-wide text-gold font-semibold whitespace-nowrap">Date</th>
                <th className="px-3 py-3 text-[0.7rem] uppercase tracking-wide text-gold font-semibold">Acteur</th>
                <th className="px-3 py-3 text-[0.7rem] uppercase tracking-wide text-gold font-semibold">Action</th>
                <th className="px-3 py-3 text-[0.7rem] uppercase tracking-wide text-gold font-semibold">Cible</th>
                <th className="px-3 py-3 text-[0.7rem] uppercase tracking-wide text-gold font-semibold">Détails</th>
                <th className="px-3 py-3 text-[0.7rem] uppercase tracking-wide text-gold font-semibold">Raison</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const chips = detailChips(e.details);
                return (
                  <tr
                    key={e.id ?? `${e.acteur_id}-${e.created_at}`}
                    className="border-t border-primary/10 align-top"
                  >
                    <td className="px-3 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {fmtDate(e.created_at)}
                    </td>
                    <td className="px-3 py-3">
                      <RolePill role={e.acteur_role} nom={e.acteur_nom} />
                    </td>
                    <td className="px-3 py-3 text-sm text-foreground">{labelOf(e.action)}</td>
                    <td className="px-3 py-3 text-sm">
                      <span className="text-gold">{e.cible_nom ?? "—"}</span>
                    </td>
                    <td className="px-3 py-3">
                      {chips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {chips.map((c, i) => (
                            <span
                              key={i}
                              className={`rounded px-2 py-0.5 text-xs font-semibold ${CHIP_CLASS[c.tone]}`}
                            >
                              {c.t}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-foreground max-w-[200px]">
                      {e.raison ? (
                        e.raison
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}

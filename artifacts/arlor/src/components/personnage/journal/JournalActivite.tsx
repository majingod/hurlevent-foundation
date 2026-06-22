import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type JournalRow =
  Database["public"]["Views"]["vue_journal_mon_personnage"]["Row"];

// action RPC -> libellé joueur
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
};
const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  animateur: "Animateur",
};

const labelOf = (a: string | null) => (a && LABELS[a]) || a || "Action";

function pillText(e: JournalRow): string {
  const role = ROLE_LABEL[e.acteur_role ?? ""] ?? "Staff";
  return e.acteur_nom ? `${role} ${e.acteur_nom}` : role;
}

type Chip = { t: string; tone: "bordeaux" | "gold" | "neutre" };

function detailChips(details: JournalRow["details"]): Chip[] {
  const chips: Chip[] = [];
  if (!details || typeof details !== "object") return chips;
  const d = details as Record<string, unknown>;
  if (typeof d.nom === "string") {
    const niv = typeof d.niveau === "number" ? ` · niv ${d.niveau}` : "";
    chips.push({ t: `${d.nom}${niv}`, tone: "gold" });
  }
  if (typeof d.cout_xp === "number")
    chips.push({ t: `−${d.cout_xp} XP`, tone: "bordeaux" });
  if (typeof d.xp_rembourse === "number" && d.xp_rembourse > 0)
    chips.push({ t: `+${d.xp_rembourse} XP`, tone: "gold" });
  if (typeof d.classe_avant === "string" && typeof d.classe_apres === "string")
    chips.push({ t: `${d.classe_avant} → ${d.classe_apres}`, tone: "neutre" });
  if (typeof d.race === "string") chips.push({ t: d.race, tone: "neutre" });
  if (typeof d.xp_total === "number")
    chips.push({ t: `${d.xp_total} XP total`, tone: "neutre" });
  return chips;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `il y a ${Math.max(1, Math.round(diff / 60))} min`;
  if (diff < 86400) return `il y a ${Math.round(diff / 3600)} h`;
  return `il y a ${Math.round(diff / 86400)} j`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("fr-CA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CHIP_CLASS: Record<Chip["tone"], string> = {
  bordeaux: "bg-bordeaux text-white",
  gold: "bg-gold text-black",
  neutre: "bg-muted text-muted-foreground",
};

export default function JournalActivite({
  personnageId,
}: {
  personnageId: string;
}) {
  const [filtre, setFiltre] = useState<"tout" | "toi" | "staff">("tout");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["journal-personnage", personnageId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_journal_mon_personnage")
        .select("*")
        .eq("cible_id", personnageId)
        .order("created_at", { ascending: false });
      return (data ?? []) as JournalRow[];
    },
    enabled: !!personnageId,
  });

  const entries = useMemo(() => {
    const all = rows ?? [];
    if (filtre === "toi")
      return all.filter((e) => e.acteur_role === "proprietaire");
    if (filtre === "staff")
      return all.filter((e) => e.acteur_role !== "proprietaire");
    return all;
  }, [rows, filtre]);

  const filtres: { k: typeof filtre; l: string }[] = [
    { k: "tout", l: "Tout" },
    { k: "toi", l: "Toi" },
    { k: "staff", l: "Staff" },
  ];

  return (
    <div className="space-y-6">
      {/* Légende */}
      <div className="flex gap-5 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gold" /> Toi
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-bordeaux" /> Staff
          (animation)
        </span>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {filtres.map((f) => (
          <Button
            key={f.k}
            size="sm"
            variant={filtre === f.k ? "default" : "outline"}
            onClick={() => setFiltre(f.k)}
            className="rounded-full"
          >
            {f.l}
          </Button>
        ))}
      </div>

      {/* Contenu */}
      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-heading text-lg text-gold">Aucune entrée</p>
          <p className="text-sm text-muted-foreground">
            Les actions importantes apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="space-y-3 border-l border-border pl-5">
          {entries.map((e) => {
            const staff = e.acteur_role !== "proprietaire";
            const chips = detailChips(e.details);
            return (
              <div key={e.id} className="relative">
                <span
                  className={`absolute -left-[1.6rem] top-4 h-3 w-3 rounded-full ring-2 ring-background ${
                    staff ? "bg-bordeaux" : "bg-gold"
                  }`}
                />
                <Card
                  className={`p-3.5 border-l-4 ${
                    staff ? "border-l-bordeaux" : "border-l-gold"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-heading text-base text-foreground">
                      {labelOf(e.action)}
                    </span>
                    {staff && (
                      <span className="shrink-0 rounded-full bg-bordeaux px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        {pillText(e)}
                      </span>
                    )}
                  </div>

                  {chips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
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

                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {staff ? "Modifié par l'animation" : "Par toi"} ·{" "}
                    {timeAgo(e.created_at)} · {fmtDate(e.created_at)}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

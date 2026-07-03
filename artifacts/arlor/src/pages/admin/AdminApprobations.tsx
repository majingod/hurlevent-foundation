import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";

interface CompetenceMaitre {
  id: string;
  personnage_nom: string;
  joueur_nom: string;
  competence_nom: string;
  niveau_acquis: number;
  nom_maitre: string;
  statut_maitre: "non_requis" | "en_attente" | "approuve" | "refuse";
  date_demande: string;
  choix_achat: string | null;
}

interface DemandeRace {
  id: string;
  personnage_id: string;
  personnage_nom: string;
  personnage_niveau: number;
  joueur_id: string;
  joueur_nom: string;
  joueur_email: string;
  race_id: string;
  race_nom: string;
  race_nom_latin: string | null;
  background: string | null;
  date_demande: string;
}

interface InscriptionAttente {
  inscription_id: string;
  evenement_id: string;
  statut: string;
  evenement_titre: string | null;
  date_evenement: string | null;
  personnage_nom: string | null;
  personnage_niveau: number | null;
  race_nom: string | null;
  classe_nom: string | null;
  joueur_nom: string | null;
}

type RpcStandard = { succes?: boolean; erreurs?: { message?: string }[] } | null;

const SEGMENTS = [
  { id: "races", label: "⚜ Races" },
  { id: "competences", label: "⭐ Compétences-maître" },
  { id: "presences", label: "📋 Présences" },
] as const;

const AdminApprobations = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const segment = searchParams.get("seg") ?? "races";
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [refuseId, setRefuseId] = useState<string | null>(null);
  const [refuseReason, setRefuseReason] = useState("");

  // ── Races ──
  const { data: races, isLoading: loadingRaces, refetch: refetchRaces } = useQuery({
    queryKey: ["admin-races-attente"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_demandes_races_attente")
        .select("*")
        .order("date_demande", { ascending: true });
      return (data ?? []) as DemandeRace[];
    },
  });

  // ── Compétences-maître ──
  const { data: competences, isLoading: loadingComp, refetch: refetchComp } = useQuery({
    queryKey: ["admin-competences-maitre"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_competences_maitre_admin")
        .select("*")
        .order("date_demande", { ascending: false });
      return (data ?? []) as CompetenceMaitre[];
    },
  });
  const compEnAttente = competences?.filter((c) => c.statut_maitre === "en_attente") ?? [];

  // ── Présences (Modèle A : marque seulement, XP à la clôture) ──
  const { data: presences, isLoading: loadingPres, refetch: refetchPres } = useQuery({
    queryKey: ["admin-presences-attente"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_inscriptions_par_evenement")
        .select("*")
        .eq("statut", "en_attente")
        .order("date_evenement", { ascending: true });
      return (data ?? []) as InscriptionAttente[];
    },
  });

  const nbRaces = races?.length ?? 0;
  const nbPres = presences?.length ?? 0;

  // ── Handlers races ──
  const approuverRace = async (id: string) => {
    setUpdatingId(id);
    try {
      const { data, error } = await supabase.rpc("approuver_race_demande", { p_demande_id: id });
      if (error) throw error;
      const res = data as unknown as { succes?: boolean; erreur?: string } | null;
      if (res && res.succes === false) throw new Error(res.erreur ?? "Échec de l'approbation.");
      toast.success("Race approuvée !");
      refetchRaces();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'approbation.");
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmerRefus = async (id: string) => {
    if (refuseReason.trim().length < 10) return;
    setUpdatingId(id);
    try {
      const { data, error } = await supabase.rpc("refuser_race_demande", {
        p_demande_id: id,
        p_raison: refuseReason.trim(),
      });
      if (error) throw error;
      const res = data as unknown as { succes?: boolean; erreur?: string } | null;
      if (res && res.succes === false) throw new Error(res.erreur ?? "Échec du refus.");
      toast.success("Race refusée.");
      setRefuseId(null);
      setRefuseReason("");
      refetchRaces();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erreur lors du refus.");
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Handler compétences ──
  const updateStatutComp = async (id: string, statut: "approuve" | "refuse") => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from("personnage_competences")
        .update({ statut_maitre: statut })
        .eq("id", id);
      if (error) throw error;
      toast.success(statut === "approuve" ? "Compétence approuvée !" : "Compétence refusée.");
      refetchComp();
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Handlers présences (changer_statut_inscription) ──
  const marquerPresence = async (inscriptionId: string, statut: "present" | "absent") => {
    setUpdatingId(inscriptionId);
    try {
      const { data, error } = await supabase.rpc("changer_statut_inscription", {
        p_inscription_id: inscriptionId,
        p_nouveau_statut: statut,
      });
      if (error) throw error;
      const res = data as unknown as RpcStandard;
      if (res && res.succes === false) {
        throw new Error(res.erreurs?.[0]?.message ?? "Échec de la mise à jour.");
      }
      toast.success(statut === "present" ? "Présence confirmée." : "Marqué absent.");
      refetchPres();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erreur lors de la mise à jour.");
    } finally {
      setUpdatingId(null);
    }
  };

  const bulkMarquerPresent = async () => {
    if (!presences || presences.length === 0) return;
    setUpdatingId("bulk");
    try {
      await Promise.all(
        presences.map((p) =>
          supabase.rpc("changer_statut_inscription", {
            p_inscription_id: p.inscription_id,
            p_nouveau_statut: "present",
          })
        )
      );
      toast.success(`${presences.length} présence(s) confirmée(s).`);
      refetchPres();
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la confirmation groupée.");
    } finally {
      setUpdatingId(null);
    }
  };

  const reasonValid = refuseReason.trim().length >= 10;

  return (
    <AdminLayout title="File d'approbations" showSearch={false}>
      <p className="-mt-4 mb-6 text-sm text-muted-foreground">
        Tout ce qui attend une décision admin — races, compétences-maître et présences.
      </p>

      {/* Segments (pills) */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SEGMENTS.map((s) => {
          const count = s.id === "races" ? nbRaces : s.id === "competences" ? compEnAttente.length : nbPres;
          const active = segment === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSearchParams({ seg: s.id })}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                active
                  ? "bg-primary text-primary-foreground border border-primary"
                  : "bg-card text-muted-foreground border border-border hover:border-primary hover:text-foreground"
              }`}
            >
              {s.label}
              {count > 0 && (
                <span
                  className={`inline-flex items-center justify-center rounded-full px-1.5 min-w-[18px] h-[18px] text-[0.66rem] font-bold ${
                    active ? "bg-background text-primary" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── RACES ── */}
      {segment === "races" && (
        loadingRaces ? (
          <p className="text-center py-12 text-muted-foreground">Chargement…</p>
        ) : nbRaces === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <span className="block text-4xl opacity-50 mb-2">⚜</span>Aucune demande de race en attente.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(races ?? []).map((d) => {
              const open = refuseId === d.id;
              return (
                <div key={d.id} className="rounded-lg border border-primary/10 bg-card/50 backdrop-blur-sm p-4">
                  <div className="flex items-start gap-3.5 flex-wrap">
                    <div className="w-[42px] h-[42px] rounded-lg flex items-center justify-center text-xl shrink-0 bg-secondary/20 border border-secondary/40">
                      🐾
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-semibold flex items-center gap-2.5 flex-wrap">
                        {d.personnage_nom}
                        <span className="text-[0.66rem] font-semibold px-2.5 py-0.5 rounded-full bg-secondary/20 border border-secondary/50 text-[#d98a98]">
                          {d.race_nom}
                          {d.race_nom_latin ? ` · ${d.race_nom_latin}` : ""}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Joueur <span className="text-foreground font-medium">{d.joueur_nom}</span> · Nv {d.personnage_niveau}
                      </div>
                      {d.background ? (
                        <div className="text-sm text-muted-foreground mt-2.5 bg-muted border-l-2 border-primary rounded-r-md px-3 py-2.5 leading-relaxed italic whitespace-pre-wrap">
                          {d.background}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground/80 mt-2.5 bg-muted border-l-2 border-border rounded-r-md px-3 py-2.5 italic">
                          Aucun historique fourni.
                        </div>
                      )}
                    </div>
                  </div>

                  {!open && (
                    <div className="flex gap-2.5 mt-3.5 flex-wrap">
                      <button
                        onClick={() => approuverRace(d.id)}
                        disabled={updatingId === d.id}
                        className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold border border-green-500/50 text-green-400 hover:bg-green-500/10 disabled:opacity-40"
                      >
                        ✓ Approuver
                      </button>
                      <button
                        onClick={() => {
                          setRefuseReason("");
                          setRefuseId(d.id);
                        }}
                        disabled={updatingId === d.id}
                        className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                      >
                        ✕ Refuser
                      </button>
                    </div>
                  )}

                  {/* Refus inline */}
                  {open && (
                    <div className="mt-3">
                      <textarea
                        value={refuseReason}
                        onChange={(e) => setRefuseReason(e.target.value)}
                        rows={3}
                        autoFocus
                        placeholder="Raison du refus (≥ 10 caractères, transmise au joueur)…"
                        className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm resize-y min-h-[62px] focus:outline-none focus:border-red-500"
                      />
                      <p className={`text-xs mt-1.5 ${reasonValid ? "text-green-400" : "text-red-400"}`}>
                        {refuseReason.trim().length} / 10 caractères minimum
                      </p>
                      <div className="flex gap-2.5 mt-2.5 flex-wrap">
                        <button
                          onClick={() => confirmerRefus(d.id)}
                          disabled={!reasonValid || updatingId === d.id}
                          className="rounded-lg px-3 py-1.5 text-[0.76rem] font-semibold border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                        >
                          Confirmer le refus
                        </button>
                        <button
                          onClick={() => {
                            setRefuseId(null);
                            setRefuseReason("");
                          }}
                          className="rounded-lg px-3 py-1.5 text-[0.76rem] font-semibold bg-muted text-muted-foreground border border-border"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── COMPÉTENCES-MAÎTRE ── */}
      {segment === "competences" && (
        loadingComp ? (
          <p className="text-center py-12 text-muted-foreground">Chargement…</p>
        ) : compEnAttente.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <span className="block text-4xl opacity-50 mb-2">⭐</span>Aucune compétence-maître en attente.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {compEnAttente.map((comp) => (
              <div key={comp.id} className="rounded-lg border border-primary/10 bg-card/50 backdrop-blur-sm p-4">
                <div className="flex items-start gap-3.5 flex-wrap">
                  <div className="w-[42px] h-[42px] rounded-lg flex items-center justify-center text-xl shrink-0 bg-secondary/20 border border-secondary/40">
                    ⭐
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-semibold flex items-center gap-2.5 flex-wrap">
                      {comp.personnage_nom}
                      <span className="text-[0.66rem] font-semibold px-2.5 py-0.5 rounded-full bg-purple-400/15 border border-purple-400/40 text-purple-400">
                        Maître requis
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Compétence <span className="text-foreground font-medium">{comp.competence_nom}</span>{comp.choix_achat ? <> — <span className="text-primary font-semibold">{comp.choix_achat}</span></> : null} · Nv {comp.niveau_acquis} · maître : <span className="text-foreground font-medium">{comp.nom_maitre}</span> · joueur {comp.joueur_nom}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2.5 mt-3.5 flex-wrap">
                  <button
                    onClick={() => updateStatutComp(comp.id, "approuve")}
                    disabled={updatingId === comp.id}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold border border-green-500/50 text-green-400 hover:bg-green-500/10 disabled:opacity-40"
                  >
                    ✓ Approuver
                  </button>
                  <button
                    onClick={() => updateStatutComp(comp.id, "refuse")}
                    disabled={updatingId === comp.id}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                  >
                    ✕ Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── PRÉSENCES (Modèle A) ── */}
      {segment === "presences" && (
        loadingPres ? (
          <p className="text-center py-12 text-muted-foreground">Chargement…</p>
        ) : nbPres === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <span className="block text-4xl opacity-50 mb-2">📋</span>Aucune présence en attente.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap rounded-lg border border-dashed border-primary/40 bg-primary/[0.06] px-4 py-3 text-sm">
              <span><span className="text-primary font-semibold">{nbPres}</span> présence(s) non confirmée(s)</span>
              <button
                onClick={bulkMarquerPresent}
                disabled={updatingId === "bulk"}
                className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.76rem] font-semibold border border-green-500/50 text-green-400 hover:bg-green-500/10 disabled:opacity-40"
              >
                ✓ Tout marquer présent
              </button>
            </div>

            {(presences ?? []).map((p) => (
              <div key={p.inscription_id} className="rounded-lg border border-primary/10 bg-card/50 backdrop-blur-sm p-4">
                <div className="flex items-start gap-3.5 flex-wrap">
                  <div className="w-[42px] h-[42px] rounded-lg flex items-center justify-center text-xl shrink-0 bg-secondary/20 border border-secondary/40">
                    📋
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-semibold flex items-center gap-2.5 flex-wrap">
                      {p.personnage_nom ?? "Sans personnage"}
                      <span className="text-[0.66rem] font-semibold px-2.5 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/40 text-yellow-500">
                        Récompense à la clôture
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Inscrit au <span className="text-foreground font-medium">{p.evenement_titre ?? "événement"}</span>
                      {p.personnage_niveau != null ? ` · Nv ${p.personnage_niveau}` : ""}
                      {p.race_nom ? ` · ${p.race_nom}` : ""}
                      {p.joueur_nom ? ` · joueur ${p.joueur_nom}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2.5 mt-3.5 flex-wrap">
                  <button
                    onClick={() => marquerPresence(p.inscription_id, "present")}
                    disabled={updatingId === p.inscription_id}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold border border-green-500/50 text-green-400 hover:bg-green-500/10 disabled:opacity-40"
                  >
                    ✓ Présent
                  </button>
                  <button
                    onClick={() => marquerPresence(p.inscription_id, "absent")}
                    disabled={updatingId === p.inscription_id}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                  >
                    ✕ Absent
                  </button>
                </div>
              </div>
            ))}

            <p className="text-xs text-muted-foreground italic mt-1">
              L'XP et les niveaux sont versés à la <span className="text-foreground">clôture de l'événement</span> (page Événements), pas ici.{" "}
              <button onClick={() => navigate("/administration/evenements")} className="text-primary underline underline-offset-2">
                Aller aux événements
              </button>
            </p>
          </div>
        )
      )}
    </AdminLayout>
  );
};

export default AdminApprobations;

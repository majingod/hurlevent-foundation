import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import SteleMemorial, {
  type SteleMemorialData,
} from "@/components/cimetiere/SteleMemorial";
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

interface DemandeMort {
  id: string;
  personnage_id: string;
  epitaphe: string | null;
  statut: string;
  created_at: string;
  personnage_nom: string | null;
  race_nom: string | null;
  classe_nom: string | null;
  niveau: number | null;
  joueur_id: string | null;
}

interface SteleRow extends SteleMemorialData {
  personnage_id_origine: string | null;
  created_at: string | null;
}

interface PersoVivant {
  id: string;
  nom: string;
  joueur_nom: string | null;
  race_nom: string | null;
  classe_nom: string | null;
  niveau: number | null;
}

type RpcRes = { succes?: boolean; erreur?: string; message?: string } | null;

const SEGMENTS = [
  { id: "demandes", label: "🪦 Demandes de mort" },
  { id: "ajout", label: "➕ Ajouter une stèle" },
  { id: "steles", label: "📜 Stèles" },
] as const;

const AdminCimetiere = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const segment = searchParams.get("seg") ?? "demandes";
  const [busyId, setBusyId] = useState<string | null>(null);
  const [apercu, setApercu] = useState<SteleRow | null>(null);

  // ── Demandes en attente ──
  const {
    data: demandes,
    isLoading: loadingDem,
    refetch: refetchDem,
  } = useQuery({
    queryKey: ["admin-morts-attente"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_demandes_morts_attente")
        .select("*")
        .order("created_at", { ascending: true });
      return (data ?? []) as DemandeMort[];
    },
  });

  // ── Persos vivants (pour stèle directe) ──
  const { data: vivants, refetch: refetchVivants } = useQuery({
    queryKey: ["admin-persos-vivants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_personnages_admin_complet")
        .select("id, nom, joueur_nom, race_nom, classe_nom, niveau")
        .eq("est_mort", false)
        .eq("est_finalise", true)
        .order("nom", { ascending: true });
      return (data ?? []) as PersoVivant[];
    },
  });

  // ── Stèles existantes ──
  const {
    data: steles,
    isLoading: loadingSteles,
    refetch: refetchSteles,
  } = useQuery({
    queryKey: ["admin-cimetiere"],
    queryFn: async () => {
      const { data } = await supabase.from("vue_cimetiere").select("*");
      return (data ?? []) as SteleRow[];
    },
  });

  const refetchAll = () => {
    refetchDem();
    refetchVivants();
    refetchSteles();
  };

  // ── États inline demandes ──
  const [approuveId, setApprouveId] = useState<string | null>(null);
  const [epitapheFinale, setEpitapheFinale] = useState("");
  const [refuseId, setRefuseId] = useState<string | null>(null);
  const [refuseRaison, setRefuseRaison] = useState("");

  const ouvrirApprouver = (d: DemandeMort) => {
    setRefuseId(null);
    setEpitapheFinale(d.epitaphe ?? "");
    setApprouveId(d.id);
  };

  const confirmerApprouver = async (id: string) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.rpc("approuver_mort_demande", {
        p_demande_id: id,
        p_epitaphe_finale: epitapheFinale.trim() || undefined,
      });
      if (error) throw error;
      const res = data as unknown as RpcRes;
      if (res && res.succes === false)
        throw new Error(res.erreur ?? "Échec de l'approbation.");
      toast.success("Mort approuvée — la stèle est gravée.");
      setApprouveId(null);
      refetchAll();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmerRefus = async (id: string) => {
    if (refuseRaison.trim().length < 10) return;
    setBusyId(id);
    try {
      const { data, error } = await supabase.rpc("refuser_mort_demande", {
        p_demande_id: id,
        p_raison: refuseRaison.trim(),
      });
      if (error) throw error;
      const res = data as unknown as RpcRes;
      if (res && res.succes === false)
        throw new Error(res.erreur ?? "Échec du refus.");
      toast.success("Demande refusée.");
      setRefuseId(null);
      setRefuseRaison("");
      refetchDem();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusyId(null);
    }
  };

  // ── Stèle directe ──
  const [persoId, setPersoId] = useState("");
  const [epitapheDirecte, setEpitapheDirecte] = useState("");
  const [confirmDirecte, setConfirmDirecte] = useState(false);
  const persoChoisi = vivants?.find((v) => v.id === persoId) ?? null;

  const creerSteleDirecte = async () => {
    if (!persoId) return;
    setBusyId("directe");
    try {
      const { data, error } = await supabase.rpc("creer_stele_directe", {
        p_personnage_id: persoId,
        p_epitaphe: epitapheDirecte.trim() || undefined,
      });
      if (error) throw error;
      const res = data as unknown as RpcRes;
      if (res && res.succes === false)
        throw new Error(res.erreur ?? "Échec de la création.");
      toast.success("Stèle créée.");
      setPersoId("");
      setEpitapheDirecte("");
      setConfirmDirecte(false);
      refetchAll();
      setSearchParams({ seg: "steles" });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusyId(null);
    }
  };

  // ── Édition / suppression stèle ──
  const [editId, setEditId] = useState<string | null>(null);
  const [editEpitaphe, setEditEpitaphe] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editJoueur, setEditJoueur] = useState("");
  const [supprId, setSupprId] = useState<string | null>(null);

  const ouvrirEdition = (st: SteleRow) => {
    setEditEpitaphe(st.epitaphe ?? "");
    setEditDate(st.date_mort ? st.date_mort.slice(0, 10) : "");
    setEditJoueur(st.joueur_nom ?? "");
    setEditId(st.id);
  };

  const enregistrerEdition = async (id: string) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.rpc("modifier_stele", {
        p_cimetiere_id: id,
        p_epitaphe: editEpitaphe.trim() || undefined,
        p_date_mort: editDate ? new Date(editDate).toISOString() : undefined,
        p_joueur_nom: editJoueur.trim() || undefined,
      });
      if (error) throw error;
      const res = data as unknown as RpcRes;
      if (res && res.succes === false)
        throw new Error(res.erreur ?? "Échec.");
      toast.success("Stèle mise à jour.");
      setEditId(null);
      refetchSteles();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusyId(null);
    }
  };

  const supprimerStele = async (id: string) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.rpc("supprimer_stele", {
        p_cimetiere_id: id,
      });
      if (error) throw error;
      const res = data as unknown as RpcRes;
      if (res && res.succes === false)
        throw new Error(res.erreur ?? "Échec.");
      toast.success("Stèle supprimée.");
      setSupprId(null);
      refetchSteles();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusyId(null);
    }
  };

  const nbDem = demandes?.length ?? 0;
  const nbSteles = steles?.length ?? 0;
  const refusValid = refuseRaison.trim().length >= 10;

  return (
    <AdminLayout title="Cimetière des Héros" showSearch={false}>
      <p className="-mt-4 mb-6 text-sm text-muted-foreground">
        Demandes de mort, ajout direct de stèles et gestion du mémorial.
      </p>

      {/* Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SEGMENTS.map((sg) => {
          const count =
            sg.id === "demandes" ? nbDem : sg.id === "steles" ? nbSteles : null;
          const active = segment === sg.id;
          return (
            <button
              key={sg.id}
              onClick={() => setSearchParams({ seg: sg.id })}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                active
                  ? "bg-primary text-primary-foreground border border-primary"
                  : "bg-card text-muted-foreground border border-border hover:border-primary hover:text-foreground"
              }`}
            >
              {sg.label}
              {count != null && count > 0 && (
                <span
                  className={`inline-flex items-center justify-center rounded-full px-1.5 min-w-[18px] h-[18px] text-[0.66rem] font-bold ${
                    active
                      ? "bg-background text-primary"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── DEMANDES ── */}
      {segment === "demandes" &&
        (loadingDem ? (
          <p className="text-center py-12 text-muted-foreground">Chargement…</p>
        ) : nbDem === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <span className="block text-4xl opacity-50 mb-2">🪦</span>Aucune
            demande de mort en attente.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(demandes ?? []).map((d) => {
              const enApprouve = approuveId === d.id;
              const enRefus = refuseId === d.id;
              return (
                <div
                  key={d.id}
                  className="rounded-lg border border-primary/10 bg-card/50 backdrop-blur-sm p-4"
                >
                  <div className="flex items-start gap-3.5 flex-wrap">
                    <div className="w-[42px] h-[42px] rounded-lg flex items-center justify-center text-xl shrink-0 bg-secondary/20 border border-secondary/40">
                      🪦
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-semibold">{d.personnage_nom}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {d.race_nom ?? "—"} · {d.classe_nom ?? "—"} · Nv{" "}
                        {d.niveau ?? "—"}
                      </div>
                      {d.epitaphe ? (
                        <div className="text-sm text-muted-foreground mt-2.5 bg-muted border-l-2 border-primary rounded-r-md px-3 py-2.5 leading-relaxed italic whitespace-pre-wrap">
                          « {d.epitaphe} »
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground/80 mt-2.5 italic">
                          Aucune épitaphe proposée.
                        </div>
                      )}
                    </div>
                  </div>

                  {!enApprouve && !enRefus && (
                    <div className="flex gap-2.5 mt-3.5 flex-wrap">
                      <button
                        onClick={() => ouvrirApprouver(d)}
                        disabled={busyId === d.id}
                        className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold border border-green-500/50 text-green-400 hover:bg-green-500/10 disabled:opacity-40"
                      >
                        ✓ Approuver
                      </button>
                      <button
                        onClick={() => {
                          setApprouveId(null);
                          setRefuseRaison("");
                          setRefuseId(d.id);
                        }}
                        disabled={busyId === d.id}
                        className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                      >
                        ✕ Refuser
                      </button>
                    </div>
                  )}

                  {/* Approbation inline (épitaphe finale éditable) */}
                  {enApprouve && (
                    <div className="mt-3">
                      <label className="text-xs text-muted-foreground">
                        Épitaphe finale (gravée sur la stèle)
                      </label>
                      <textarea
                        value={epitapheFinale}
                        onChange={(e) => setEpitapheFinale(e.target.value)}
                        rows={3}
                        autoFocus
                        placeholder="Épitaphe (laisser vide = aucune)…"
                        className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2.5 text-sm resize-y min-h-[62px] focus:outline-none focus:border-primary"
                      />
                      <div className="flex gap-2.5 mt-2.5 flex-wrap">
                        <button
                          onClick={() => confirmerApprouver(d.id)}
                          disabled={busyId === d.id}
                          className="rounded-lg px-3 py-1.5 text-[0.76rem] font-semibold border border-green-500/50 text-green-400 hover:bg-green-500/10 disabled:opacity-40"
                        >
                          Confirmer & graver la stèle
                        </button>
                        <button
                          onClick={() => setApprouveId(null)}
                          className="rounded-lg px-3 py-1.5 text-[0.76rem] font-semibold bg-muted text-muted-foreground border border-border"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Refus inline */}
                  {enRefus && (
                    <div className="mt-3">
                      <textarea
                        value={refuseRaison}
                        onChange={(e) => setRefuseRaison(e.target.value)}
                        rows={3}
                        autoFocus
                        placeholder="Raison du refus (≥ 10 caractères, transmise au joueur)…"
                        className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm resize-y min-h-[62px] focus:outline-none focus:border-red-500"
                      />
                      <p
                        className={`text-xs mt-1.5 ${
                          refusValid ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {refuseRaison.trim().length} / 10 caractères minimum
                      </p>
                      <div className="flex gap-2.5 mt-2.5 flex-wrap">
                        <button
                          onClick={() => confirmerRefus(d.id)}
                          disabled={!refusValid || busyId === d.id}
                          className="rounded-lg px-3 py-1.5 text-[0.76rem] font-semibold border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                        >
                          Confirmer le refus
                        </button>
                        <button
                          onClick={() => {
                            setRefuseId(null);
                            setRefuseRaison("");
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
        ))}

      {/* ── AJOUT DIRECT ── */}
      {segment === "ajout" && (
        <div className="rounded-lg border border-primary/10 bg-card/50 backdrop-blur-sm p-4 max-w-xl">
          <p className="text-sm text-muted-foreground mb-4">
            Crée une stèle directement pour un personnage vivant.{" "}
            <span className="text-red-400">
              Le personnage sera marqué comme mort
            </span>{" "}
            — action définitive.
          </p>

          <label className="text-xs text-muted-foreground">
            Personnage vivant
          </label>
          <select
            value={persoId}
            onChange={(e) => setPersoId(e.target.value)}
            className="w-full mt-1 mb-4 bg-background border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
          >
            <option value="">— Choisir —</option>
            {(vivants ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.nom}
                {v.joueur_nom ? ` (${v.joueur_nom})` : ""} · Nv {v.niveau ?? "?"}
              </option>
            ))}
          </select>

          <label className="text-xs text-muted-foreground">
            Épitaphe (optionnelle)
          </label>
          <textarea
            value={epitapheDirecte}
            onChange={(e) => setEpitapheDirecte(e.target.value)}
            rows={3}
            placeholder="Épitaphe gravée sur la stèle…"
            className="w-full mt-1 mb-4 bg-background border border-border rounded-md px-3 py-2.5 text-sm resize-y min-h-[62px] focus:outline-none focus:border-primary"
          />

          <button
            onClick={() => setConfirmDirecte(true)}
            disabled={!persoId || busyId === "directe"}
            className="rounded-lg px-4 py-2 text-sm font-semibold border border-primary/50 text-primary hover:bg-primary/10 disabled:opacity-40"
          >
            Créer la stèle
          </button>
        </div>
      )}

      {/* ── STÈLES ── */}
      {segment === "steles" &&
        (loadingSteles ? (
          <p className="text-center py-12 text-muted-foreground">Chargement…</p>
        ) : nbSteles === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <span className="block text-4xl opacity-50 mb-2">📜</span>Aucune
            stèle pour l'instant.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(steles ?? []).map((st) => {
              const enEdit = editId === st.id;
              return (
                <div
                  key={st.id}
                  className="rounded-lg border border-primary/10 bg-card/50 backdrop-blur-sm p-4"
                >
                  <div className="flex items-start gap-3.5 flex-wrap">
                    <div className="w-[42px] h-[42px] rounded-lg flex items-center justify-center text-xl shrink-0 bg-secondary/20 border border-secondary/40">
                      {(st.snapshot?.race_emoji as string | undefined) ?? "🪦"}
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-semibold">{st.nom}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {(st.snapshot?.race_nom as string | undefined) ?? "—"} ·{" "}
                        {(st.snapshot?.classe_nom as string | undefined) ?? "—"}
                        {st.joueur_nom ? ` · incarné par ${st.joueur_nom}` : ""}
                      </div>
                      {st.epitaphe ? (
                        <div className="text-sm text-muted-foreground mt-2 italic">
                          « {st.epitaphe} »
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {!enEdit && (
                    <div className="flex gap-2.5 mt-3.5 flex-wrap">
                      <button
                        onClick={() => setApercu(st)}
                        className="rounded-lg px-3 py-1.5 text-[0.76rem] font-semibold bg-muted text-muted-foreground border border-border hover:text-foreground"
                      >
                        👁 Aperçu
                      </button>
                      <button
                        onClick={() => ouvrirEdition(st)}
                        disabled={busyId === st.id}
                        className="rounded-lg px-3 py-1.5 text-[0.76rem] font-semibold border border-primary/50 text-primary hover:bg-primary/10 disabled:opacity-40"
                      >
                        ✎ Modifier
                      </button>
                      <button
                        onClick={() => setSupprId(st.id)}
                        disabled={busyId === st.id}
                        className="rounded-lg px-3 py-1.5 text-[0.76rem] font-semibold border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                      >
                        🗑 Supprimer
                      </button>
                    </div>
                  )}

                  {enEdit && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Épitaphe
                        </label>
                        <textarea
                          value={editEpitaphe}
                          onChange={(e) => setEditEpitaphe(e.target.value)}
                          rows={2}
                          className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        <div className="flex-1 min-w-[140px]">
                          <label className="text-xs text-muted-foreground">
                            Date de mort
                          </label>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                          />
                        </div>
                        <div className="flex-1 min-w-[140px]">
                          <label className="text-xs text-muted-foreground">
                            Incarné par
                          </label>
                          <input
                            type="text"
                            value={editJoueur}
                            onChange={(e) => setEditJoueur(e.target.value)}
                            placeholder="Nom du joueur"
                            className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2.5 flex-wrap">
                        <button
                          onClick={() => enregistrerEdition(st.id)}
                          disabled={busyId === st.id}
                          className="rounded-lg px-3 py-1.5 text-[0.76rem] font-semibold border border-green-500/50 text-green-400 hover:bg-green-500/10 disabled:opacity-40"
                        >
                          Enregistrer
                        </button>
                        <button
                          onClick={() => setEditId(null)}
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
        ))}

      {/* Aperçu mémorial */}
      <SteleMemorial stele={apercu} onClose={() => setApercu(null)} />

      {/* Confirm stèle directe */}
      <AlertDialog
        open={confirmDirecte}
        onOpenChange={(o) => {
          if (!o) setConfirmDirecte(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Créer la stèle ?</AlertDialogTitle>
            <AlertDialogDescription>
              {persoChoisi?.nom ?? "Ce personnage"} sera marqué comme mort et une
              stèle sera gravée au cimetière. Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={creerSteleDirecte}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm suppression stèle */}
      <AlertDialog
        open={supprId !== null}
        onOpenChange={(o) => {
          if (!o) setSupprId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette stèle ?</AlertDialogTitle>
            <AlertDialogDescription>
              La stèle sera retirée du cimetière. Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => supprId && supprimerStele(supprId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminCimetiere;

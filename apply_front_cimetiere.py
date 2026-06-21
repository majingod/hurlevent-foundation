#!/usr/bin/env python3
import sys, pathlib
ROOT = pathlib.Path("artifacts/arlor/src")

def patch(relpath, edits):
    p = ROOT / relpath
    s = p.read_text(encoding="utf-8")
    for i, (old, new) in enumerate(edits):
        n = s.count(old)
        if n != 1:
            print(f"❌ {relpath} ancre #{i+1}: {n} (attendu 1)"); print("  ", repr(old[:70])); sys.exit(1)
        s = s.replace(old, new)
    p.write_text(s, encoding="utf-8"); print(f"✓ {relpath} ({len(edits)})")

FP = "components/personnage/FichePersonnageView.tsx"
patch(FP, [
    # 1. type générique etatEdition : + demande_mort_epitaphe
    ("""  const { data: etatEdition } = useQuery<{
    etat: string;
    raison: string;
    evenement_bloquant_id: string | null;
  } | null>({""",
     """  const { data: etatEdition } = useQuery<{
    etat: string;
    raison: string;
    evenement_bloquant_id: string | null;
    demande_mort_epitaphe: string | null;
  } | null>({"""),
    # 2. cast retour etatEdition
    ("""      return (data ?? null) as {
        etat: string;
        raison: string;
        evenement_bloquant_id: string | null;
      } | null;""",
     """      return (data ?? null) as {
        etat: string;
        raison: string;
        evenement_bloquant_id: string | null;
        demande_mort_epitaphe: string | null;
      } | null;"""),
    # 3. supprimer la query personnage_morts_demandes (état pending lu via etat_edition)
    ("""  // CIMETIÈRE PR2 — admissibilité « Demander la mort » (joueur propriétaire, fiche route).
  // (a) Demande déjà en attente ? RLS : le propriétaire lit ses propres demandes.
  const { data: demandeMortAttente } = useQuery({
    queryKey: ["demande-mort-attente", personnageId],
    enabled: mode === "route" && !!personnageId,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnage_morts_demandes")
        .select("id, epitaphe, created_at")
        .eq("personnage_id", personnageId!)
        .eq("statut", "en_attente")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // (b) A vécu au moins un événement (statut 'present') ? Condition d'admissibilité.""",
     """  // CIMETIÈRE — l'état « demande en attente » provient de etat_edition (etat='mort_en_attente').
  // La stèle vit dans `cimetiere` (statut en_attente), cachée du public.

  // A vécu au moins un événement (statut 'present') ? Condition d'admissibilité."""),
    # 4. invalidate -> etat-edition
    ('      await queryClient.invalidateQueries({ queryKey: ["demande-mort-attente", personnageId] });',
     '      await queryClient.invalidateQueries({ queryKey: ["etat-edition", personnageId] });'),
    # 5. branche pending de la Card -> etatEdition
    ("""          {demandeMortAttente ? (
            <div className="rounded-xl border border-gold/35 bg-card p-4 flex gap-3 items-start">
              <span className="text-xl mt-0.5">⏳</span>
              <div className="min-w-0">
                <p className="font-heading font-bold text-gold">Demande de mort en attente</p>
                <p className="mt-1.5 text-sm text-foreground/90">
                  Un animateur examinera bientôt ta demande pour <b>{fiche.nom}</b>. Tu seras notifié de la décision.
                </p>
                {demandeMortAttente.epitaphe && (
                  <p className="mt-2.5 border-l-2 border-gold pl-3 text-sm italic text-muted-foreground">
                    « {demandeMortAttente.epitaphe} »
                  </p>
                )}
              </div>
            </div>
          ) : !aVecuEvenement ? (""",
     """          {etatEdition?.etat === "mort_en_attente" ? (
            <div className="rounded-xl border border-gold/35 bg-card p-4 flex gap-3 items-start">
              <span className="text-xl mt-0.5">⏳</span>
              <div className="min-w-0">
                <p className="font-heading font-bold text-gold">Demande de mort en attente</p>
                <p className="mt-1.5 text-sm text-foreground/90">
                  Un animateur examinera bientôt ta demande pour <b>{fiche.nom}</b>. Tu seras notifié de la décision.
                </p>
                {etatEdition?.demande_mort_epitaphe && (
                  <p className="mt-2.5 border-l-2 border-gold pl-3 text-sm italic text-muted-foreground">
                    « {etatEdition.demande_mort_epitaphe} »
                  </p>
                )}
              </div>
            </div>
          ) : !aVecuEvenement ? ("""),
])

AC = "pages/admin/AdminCimetiere.tsx"
patch(AC, [
    ('await supabase.rpc("approuver_mort_demande", {\n        p_demande_id: id,',
     'await supabase.rpc("approuver_mort_demande", {\n        p_stele_id: id,'),
    ('await supabase.rpc("refuser_mort_demande", {\n        p_demande_id: id,',
     'await supabase.rpc("refuser_mort_demande", {\n        p_stele_id: id,'),
])

print("\n✅ Patchs front appliqués.")

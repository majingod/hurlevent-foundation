import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATS_ENCYCLO } from "@/components/encyclopedie/EncyclopedieNav";
import { useNavigate } from "react-router-dom";

type Resultat = {
  type: string;
  id: string;
  titre: string;
  sous_titre: string | null;
  categorie: string | null;
  snippet: string | null;
  rang: number;
};

// Type renvoyé par le RPC → clé de catégorie v2 (14 catégories ; "regle" est traité à part).
const TYPE_TO_CLE: Record<string, string> = {
  lore: "lore",
  bestiaire: "bestiaire",
  religion: "religions",
  competence: "competences",
  sort: "sorts",
  priere: "prieres",
  race: "race",
  trait_racial: "trait_racial",
  classe: "classe",
  forge: "forge",
  joaillerie: "joaillerie",
  alchimie: "alchimie",
  assemblages: "assemblages",
  pieges: "pieges",
};
const byCle = (cle: string) => CATS_ENCYCLO.find((c) => c.cle === cle);

/**
 * Recherche globale de l'encyclopédie. Enveloppe le hub : affiche `children`
 * tant que la requête fait < 2 caractères, sinon les résultats du RPC.
 */
export function EncyclopedieRecherche({
  onPick,
  children,
}: {
  onPick: (cle: string, id: string) => void;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<Resultat[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let annule = false;
    setSearching(true);
    (supabase as any)
      .rpc("rechercher_encyclopedie", { p_terme: debounced })
      .then(({ data, error }: any) => {
        if (annule) return;
        if (error) {
          console.error("[rechercher_encyclopedie]", error);
          setResults([]);
        } else {
          setResults((data ?? []) as Resultat[]);
        }
        setSearching(false);
      });
    return () => {
      annule = true;
    };
  }, [debounced]);

  const actif = debounced.trim().length >= 2;

  return (
    <div>
      <div className="relative mb-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher dans toute l'encyclopédie…"
          className="w-full rounded-lg border border-border bg-card pl-10 pr-3 py-2.5 text-sm text-foreground outline-none focus:border-gold"
        />
      </div>

      {searching && (
        <p className="text-muted-foreground text-center py-3 text-sm">Recherche en cours…</p>
      )}

      {actif ? (
        results.length === 0 && !searching ? (
          <p className="text-muted-foreground text-center py-4 text-sm">
            Aucun résultat pour « {debounced} ».
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {results.map((r) => {
              if (r.type === "regle") {
                return (
                  <button
                    key={`regle-${r.id}`}
                    onClick={() => navigate("/regles")}
                    className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-left transition-all hover:border-gold"
                    style={{ background: "rgba(201,168,76,0.06)" }}
                  >
                    <span className="text-lg leading-none">📜</span>
                    <span className="min-w-0 flex-grow">
                      <span className="block font-heading text-sm text-foreground truncate">
                        {r.titre}
                      </span>
                      {r.sous_titre && (
                        <span className="block text-xs text-muted-foreground truncate">
                          {r.sous_titre}
                        </span>
                      )}
                    </span>
                    <span className="ml-auto text-[10px] text-gold border border-border rounded px-1.5 py-px whitespace-nowrap">
                      Règles
                    </span>
                  </button>
                );
              }
              const c = byCle(TYPE_TO_CLE[r.type] ?? "");
              if (!c) return null;
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => onPick(c.cle, r.id)}
                  className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-left transition-all hover:border-gold"
                  style={{ background: "rgba(201,168,76,0.06)" }}
                >
                  <span className="text-lg leading-none">{c.emoji}</span>
                  <span className="min-w-0 flex-grow">
                    <span className="block font-heading text-sm text-foreground truncate">
                      {r.titre}
                    </span>
                    {r.sous_titre && (
                      <span className="block text-xs text-muted-foreground truncate">
                        {r.sous_titre}
                      </span>
                    )}
                  </span>
                  <span className="ml-auto text-[10px] text-gold border border-border rounded px-1.5 py-px whitespace-nowrap">
                    {c.label}
                  </span>
                </button>
              );
            })}
          </div>
        )
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </div>
  );
}

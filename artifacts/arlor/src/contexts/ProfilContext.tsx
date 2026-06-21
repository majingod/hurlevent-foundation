import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase, setProfilActifHeader } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ProfilJoueur {
  id: string;
  compte_id: string;
  nom: string;
  avatar_url: string | null;
  est_principal: boolean;
  cree_le: string;
  nb_personnages: number;
}

interface ProfilContextType {
  profils: ProfilJoueur[];
  profilActif: ProfilJoueur | null;
  /** Profil actif courant = la valeur à utiliser comme `joueur_id` partout. */
  joueurId: string | null;
  loadingProfils: boolean;
  switchProfil: (id: string) => void;
  rechargerProfils: () => Promise<void>;
  ajouterProfil: (nom: string) => Promise<{ ok: boolean; message?: string }>;
  renommerProfil: (id: string, nom: string) => Promise<{ ok: boolean; message?: string }>;
  /** Nettoyage local après suppression d'un profil par le flux Cimetière (RPC). */
  apresSuppressionProfil: (id: string) => Promise<void>;
  definirPrincipal: (id: string) => Promise<{ ok: boolean; message?: string }>;
  reinitialiserProfil: (gestion?: boolean) => void;
  intentGestion: boolean;
}

const ProfilContext = createContext<ProfilContextType>({
  profils: [],
  profilActif: null,
  joueurId: null,
  loadingProfils: true,
  switchProfil: () => {},
  rechargerProfils: async () => {},
  ajouterProfil: async () => ({ ok: false }),
  renommerProfil: async () => ({ ok: false }),
  apresSuppressionProfil: async () => {},
  definirPrincipal: async () => ({ ok: false }),
  reinitialiserProfil: () => {},
  intentGestion: false,
});

export const useProfil = () => useContext(ProfilContext);

// Persistance par compte : un reload garde le profil ; une nouvelle session (onglet
// fermé / nouveau login) repart sans profil => l'écran « Qui joue ? » réapparaît.
const cleStorage = (compteId: string) => `hv_profil_actif:${compteId}`;

export const ProfilProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [profils, setProfils] = useState<ProfilJoueur[]>([]);
  const [profilActifId, setProfilActifId] = useState<string | null>(null);
  const [loadingProfils, setLoadingProfils] = useState(true);

  const chargerProfils = useCallback(async (): Promise<ProfilJoueur[]> => {
    if (!user) {
      setProfils([]);
      return [];
    }
    // RLS profils_joueur : compte_id = auth.uid() -> on ne voit que ses propres profils.
    const { data: profilsData, error } = await supabase
      .from("profils_joueur")
      .select("id, compte_id, nom, avatar_url, est_principal, cree_le")
      .eq("compte_id", user.id)
      .order("est_principal", { ascending: false })
      .order("cree_le", { ascending: true });

    if (error || !profilsData) {
      setProfils([]);
      return [];
    }

    // Compteur de personnages par profil. RLS « Lecture personnages » =
    // compte_voit_joueur(joueur_id) -> le compte voit les persos de tous ses profils.
    const ids = profilsData.map((p) => p.id);
    const comptes: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: persos } = await supabase
        .from("personnages")
        .select("id, joueur_id")
        .in("joueur_id", ids);
      (persos ?? []).forEach((p: { joueur_id: string }) => {
        comptes[p.joueur_id] = (comptes[p.joueur_id] ?? 0) + 1;
      });
    }

    const enrichis: ProfilJoueur[] = profilsData.map((p) => ({
      ...p,
      nb_personnages: comptes[p.id] ?? 0,
    }));
    setProfils(enrichis);
    return enrichis;
  }, [user]);

  // Chargement initial + résolution du profil actif.
  useEffect(() => {
    let annule = false;
    const init = async () => {
      if (!user) {
        setProfils([]);
        setProfilActifId(null);
        setLoadingProfils(false);
        return;
      }
      setLoadingProfils(true);
      const liste = await chargerProfils();
      if (annule) return;
      // « Sans skip » : on ne sélectionne PAS le principal d'office.
      // On ne restaure que si sessionStorage contient un profil valide (reload même session).
      const stocke = sessionStorage.getItem(cleStorage(user.id));
      const valide = stocke && liste.some((p) => p.id === stocke) ? stocke : null;
      setProfilActifId(valide);
      setLoadingProfils(false);
    };
    init();
    return () => {
      annule = true;
    };
  }, [user, chargerProfils]);

  const switchProfil = useCallback(
    (id: string) => {
      if (!user) return;
      sessionStorage.setItem(cleStorage(user.id), id);
      setProfilActifId(id);
    },
    [user],
  );

  const [intentGestion, setIntentGestion] = useState(false);

  // « Changer / Gérer les profils » : vide le profil actif -> l'écran « Qui joue ? » réapparaît.
  // gestion=true => QuiJoue s'ouvre directement en mode gestion.
  const reinitialiserProfil = useCallback(
    (gestion: boolean = false) => {
      if (user) sessionStorage.removeItem(cleStorage(user.id));
      setIntentGestion(gestion);
      setProfilActifId(null);
    },
    [user],
  );

  const rechargerProfils = useCallback(async () => {
    await chargerProfils();
  }, [chargerProfils]);

  const ajouterProfil = useCallback(
    async (nom: string) => {
      if (!user) return { ok: false, message: "Non connecté." };
      const nomNet = nom.trim();
      if (!nomNet) return { ok: false, message: "Le nom ne peut pas être vide." };
      const { error } = await supabase.from("profils_joueur").insert({
        compte_id: user.id,
        nom: nomNet,
        est_principal: false,
      });
      if (error) return { ok: false, message: error.message };
      await chargerProfils();
      return { ok: true };
    },
    [user, chargerProfils],
  );

  const renommerProfil = useCallback(
    async (id: string, nom: string) => {
      const nomNet = nom.trim();
      if (!nomNet) return { ok: false, message: "Le nom ne peut pas être vide." };
      const { error } = await supabase
        .from("profils_joueur")
        .update({ nom: nomNet })
        .eq("id", id);
      if (error) return { ok: false, message: error.message };
      await chargerProfils();
      return { ok: true };
    },
    [chargerProfils],
  );

  // La suppression elle-même passe désormais par le flux Cimetière
  // (`creer_steles_et_supprimer`, RPC atomique avec cascade). Ici on ne fait que
  // le nettoyage local de la session après un succès.
  const apresSuppressionProfil = useCallback(
    async (id: string) => {
      if (user) {
        const stocke = sessionStorage.getItem(cleStorage(user.id));
        if (stocke === id) {
          sessionStorage.removeItem(cleStorage(user.id));
          setProfilActifId(null);
        }
      }
      await chargerProfils();
    },
    [user, chargerProfils],
  );

  const definirPrincipal = useCallback(
    async (id: string) => {
      // Appel direct (ne jamais assigner supabase.rpc à une variable : détache `this`).
      const { data, error } = await supabase.rpc("definir_profil_principal", {
        p_profil_id: id,
      });
      if (error) return { ok: false, message: error.message };
      const res = data as
        | { succes?: boolean; erreurs?: { message?: string }[] }
        | null;
      if (!res?.succes) {
        return { ok: false, message: res?.erreurs?.[0]?.message ?? "Échec." };
      }
      await chargerProfils();
      return { ok: true };
    },
    [chargerProfils],
  );

  const profilActif = profils.find((p) => p.id === profilActifId) ?? null;
  const joueurId = profilActif?.id ?? null;

  // Pose le header x-hv-profil-actif à chaque changement de profil actif.
  useEffect(() => {
    setProfilActifHeader(profilActif?.id ?? null);
  }, [profilActif?.id]);

  return (
    <ProfilContext.Provider
      value={{
        profils,
        profilActif,
        joueurId,
        loadingProfils,
        switchProfil,
        rechargerProfils,
        ajouterProfil,
        renommerProfil,
        apresSuppressionProfil,
        definirPrincipal,
        reinitialiserProfil,
        intentGestion,
      }}
    >
      {children}
    </ProfilContext.Provider>
  );
};

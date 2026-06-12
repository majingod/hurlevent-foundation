import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: string | null;
  loading: boolean;
  /** Rôle en cours de chargement (fetch en arrière-plan, ne bloque pas le boot). */
  roleLoading: boolean;
  /** Boot anormalement long (> 6 s) : l'UI peut proposer « Réessayer ». */
  bootLent: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  loading: true,
  roleLoading: true,
  bootLent: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [bootLent, setBootLent] = useState(false);

  const fetchRole = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("role, nom_affichage")
        .eq("id", userId)
        .single();

      if (data) {
        setRole(data.role ?? "joueur");
        if (!data.nom_affichage) {
          const { data: userData } = await supabase.auth.getUser();
          const email = userData.user?.email;
          if (email) {
            await supabase
              .from("profiles")
              .update({ nom_affichage: email })
              .eq("id", userId);
          }
        }
        return data.role ?? "joueur";
      }
      setRole("joueur");
      return "joueur";
    } finally {
      // Le rôle ne bloque plus le boot : ProtectedRoute consomme ce flag
      // pour attendre seulement sur les routes à requiredRole.
      setRoleLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      // getSession() peut déclencher un refresh de token RÉSEAU (token expiré
      // à la réouverture de la PWA). Sans filet, ça peut pendre des minutes
      // sur radio mobile capricieuse. Passé 6 s, on signale le boot lent :
      // App affiche alors un bouton « Réessayer » sous le spinner.
      const timerBootLent = setTimeout(() => {
        if (isMounted) setBootLent(true);
      }, 6000);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Arrière-plan : ne bloque plus le premier rendu.
          fetchRole(session.user.id);
        } else {
          setRoleLoading(false);
        }
      } finally {
        clearTimeout(timerBootLent);
        if (isMounted) {
          setBootLent(false);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchRole(session.user.id);
        } else {
          setRole(null);
          setRoleLoading(false);
        }
        setBootLent(false);
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, roleLoading, bootLent, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

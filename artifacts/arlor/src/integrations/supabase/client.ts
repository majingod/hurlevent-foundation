import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// AUDIT-ADMIN-MODE-ROLE : canal « admin mode ».
// Quand actif, le fetch ci-dessous ajoute le header x-hv-canal:admin, lu par
// la fonction SQL log_audit pour taguer les actions en rôle « admin »
// (visibles au feed staff) même sur le propre perso de l'admin.
// Garde-fou côté serveur : sans effet si l'acteur n'est pas réellement admin.
let canalAdmin = false;
// Pilote le header x-hv-canal:admin. Désormais commandé par le mode staff global
// (ModeStaffContext), plus par chaque page : un seul point de vérité.
export const setModeStaff = (actif: boolean) => { canalAdmin = actif; };

// Identité du profil actif, posée par ProfilContext à chaque changement.
// Header x-hv-profil-actif sur TOUTES les requêtes : signal neutre, lu plus tard
// par le back (Lot 2.3). Sans effet sur les droits tant que 2.3 n'est pas gravé.
let profilActifId: string | null = null;
export const setProfilActifHeader = (id: string | null) => { profilActifId = id; };

const fetchAvecCanal: typeof fetch = (input, init = {}) => {
  const headers = new Headers(init.headers);
  if (canalAdmin) headers.set('x-hv-canal', 'admin');
  if (profilActifId) headers.set('x-hv-profil-actif', profilActifId);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: fetchAvecCanal,
  },
});

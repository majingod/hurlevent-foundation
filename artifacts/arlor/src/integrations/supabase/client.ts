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
export const setCanalAdmin = (actif: boolean) => { canalAdmin = actif; };

const fetchAvecCanal: typeof fetch = (input, init = {}) => {
  const headers = new Headers(init.headers);
  if (canalAdmin) headers.set('x-hv-canal', 'admin');
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

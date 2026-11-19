import { supabase } from '@/integrations/supabase/client';

export async function signInAdminWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Mot de passe incorrect ou connexion indisponible.');
}
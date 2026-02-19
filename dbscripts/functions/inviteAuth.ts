import { supabase } from "../../src/integrations/supabase/client";

export async function createUserFromInvite(token: string, password: string) {
  const { data, error } = await supabase.rpc("create_user_from_invite", { p_token: token, p_password: password });
  if (error) return { data: null, error };
  return { data, error: null };
}


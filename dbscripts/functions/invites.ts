import { supabase } from "../../src/integrations/supabase/client";

export async function createInvite(invite: {
  token: string;
  email: string;
  full_name: string;
  role: string;
  created_by: string;
}) {
  const { error } = await supabase.from("invites").insert({
    token: invite.token,
    email: invite.email,
    full_name: invite.full_name,
    role: invite.role,
    created_by: invite.created_by,
  });
  if (error) throw error;
}

export async function fetchInvites() {
  const { data, error } = await supabase.from("invites").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchInviteByToken(token: string) {
  const { data, error } = await supabase.from("invites").select("*").eq("token", token).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function markInviteUsed(token: string) {
  const { error } = await supabase.from("invites").update({ used: true, used_at: new Date().toISOString() }).eq("token", token);
  if (error) throw error;
}


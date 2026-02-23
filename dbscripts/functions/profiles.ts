import { supabase } from "../../src/integrations/supabase/client";

export async function fetchAllProfiles() {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  return data || [];
}

export async function fetchProfilesBySelect(fields: string) {
  const { data } = await supabase.from("profiles").select(fields) as { data: any[] | null };
  return data || [];
}

export async function fetchProfileByUserId(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function fetchProfileName(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function updateProfile(userId: string, updates: Record<string, any>) {
  const { error } = await supabase
    .from("profiles")
    .update(updates as any)
    .eq("user_id", userId);
  if (error) throw error;
}

// Fetch profiles for users that have a specific role in user_roles table.
export async function fetchProfilesByRole(role: string) {
  // First fetch user_ids for the role, then fetch profiles for those users.
  const { data: rolesData, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", role);
  if (rolesError) throw rolesError;
  const userIds = (rolesData || []).map((r: any) => r.user_id).filter(Boolean);
  if (userIds.length === 0) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, email")
    .in("user_id", userIds as string[]);
  return profiles || [];
}

import { supabase } from "@/integrations/supabase/client";

export async function fetchAllUserRoles() {
  const { data } = await supabase.from("user_roles").select("*");
  return data || [];
}

export async function fetchUserRole(userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function updateUserRole(roleId: string, newRole: string) {
  const { error } = await supabase
    .from("user_roles")
    .update({ role: newRole as any })
    .eq("id", roleId);
  if (error) throw error;
}

export async function insertUserRole(userId: string, role: string) {
  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role: role as any });
  if (error) throw error;
}

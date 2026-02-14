import { supabase } from "@/integrations/supabase/client";

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

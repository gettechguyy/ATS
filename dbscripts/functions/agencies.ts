import { supabase } from "../../src/integrations/supabase/client";

export async function fetchAgencies() {
  const { data, error } = await supabase
    .from("agencies")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    // Table or column may not exist yet; return empty so UI does not crash
    console.warn("fetchAgencies failed (run agency migrations if needed):", error.message);
    return [];
  }
  return data ?? [];
}

export async function createAgency(payload: { name: string; type?: "in" | "out" }) {
  const { data, error } = await supabase
    .from("agencies")
    .insert({ name: payload.name.trim(), type: payload.type ?? "out" })
    .select("id, name, type, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function updateAgency(id: string, payload: { name?: string; type?: "in" | "out" }) {
  const updates: Record<string, unknown> = {};
  if (payload.name !== undefined) updates.name = payload.name.trim();
  if (payload.type !== undefined) updates.type = payload.type;
  if (Object.keys(updates).length === 0) return;
  const { error } = await supabase.from("agencies").update(updates as any).eq("id", id);
  if (error) throw error;
}

export async function updateProfileAgency(userId: string, agencyId: string | null) {
  const { error } = await supabase
    .from("profiles")
    .update({ agency_id: agencyId } as any)
    .eq("user_id", userId);
  if (error) throw error;
}

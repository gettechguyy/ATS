import { supabase } from "../../src/integrations/supabase/client";

const AGENCIES_SORT_COLUMNS = ["name", "type", "is_active"] as const;

export type FetchAgenciesOpts = {
  sortBy?: (typeof AGENCIES_SORT_COLUMNS)[number];
  order?: "asc" | "desc";
};

/** Full list; sorting runs in Postgres. */
export async function fetchAgencies(opts?: FetchAgenciesOpts) {
  const raw =
    opts?.sortBy && AGENCIES_SORT_COLUMNS.includes(opts.sortBy as any) ? opts.sortBy : "name";
  const sortBy = raw === "name" ? "name_sort" : raw;
  const ascending = opts?.order === "asc";
  const { data, error } = await supabase.from("agencies").select("*").order(sortBy, { ascending });
  if (error) {
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

export async function updateAgency(id: string, payload: { name?: string; type?: "in" | "out"; is_active?: boolean }) {
  const updates: Record<string, unknown> = {};
  if (payload.name !== undefined) updates.name = payload.name.trim();
  if (payload.type !== undefined) updates.type = payload.type;
  if (payload.is_active !== undefined) updates.is_active = payload.is_active;
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

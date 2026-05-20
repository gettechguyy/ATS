import { supabase } from "../../src/integrations/supabase/client";

const db = supabase as any;

export type HierarchyProfileRow = {
  id: string;
  user_id: string;
  full_name: string;
  is_active?: boolean | null;
  manager_profile_id: string | null;
  team_lead_profile_id: string | null;
  team_id?: string | null;
};

export function isMissingHierarchyColumnError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? "").toLowerCase();
  return (
    msg.includes("manager_profile_id") ||
    msg.includes("team_lead_profile_id") ||
    msg.includes("team_id") ||
    msg.includes("schema cache")
  );
}

function normalizeProfileRow(p: Record<string, unknown>): HierarchyProfileRow {
  return {
    id: String(p.id),
    user_id: String(p.user_id),
    full_name: String(p.full_name ?? ""),
    is_active: p.is_active as boolean | null | undefined,
    manager_profile_id: (p.manager_profile_id as string | null) ?? null,
    team_lead_profile_id: (p.team_lead_profile_id as string | null) ?? null,
    team_id: (p.team_id as string | null) ?? null,
  };
}

/** Loads profiles with hierarchy fields; falls back if migrations are not applied yet. */
export async function fetchProfilesWithHierarchyFields(
  companyId: string
): Promise<HierarchyProfileRow[]> {
  const withTeam = "id, user_id, full_name, manager_profile_id, team_lead_profile_id, team_id, is_active";
  const withHierarchy = "id, user_id, full_name, manager_profile_id, team_lead_profile_id, is_active";
  const minimal = "id, user_id, full_name, is_active";

  for (const fields of [withTeam, withHierarchy, minimal]) {
    const { data, error } = await db.from("profiles").select(fields).eq("company_id", companyId);
    if (!error) {
      return (data || []).map((p: Record<string, unknown>) => normalizeProfileRow(p));
    }
    if (!isMissingHierarchyColumnError(error)) throw error;
  }
  return [];
}

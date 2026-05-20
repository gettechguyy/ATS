import { supabase } from "../../src/integrations/supabase/client";
import { getTestCacheForCompany, isTestCacheOwner, mergeCachedTeamRecords } from "../../src/lib/testDataCache";

const db = supabase as any;

export type TeamRecord = {
  id: string;
  company_id: string;
  name: string;
  manager_profile_id: string | null;
  team_lead_profile_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  __testCache?: boolean;
};

export async function fetchTeamRecords(
  companyId: string,
  opts?: { managerProfileId?: string; activeOnly?: boolean }
): Promise<TeamRecord[]> {
  let q = db.from("teams").select("*").eq("company_id", companyId).order("name", { ascending: true });
  if (opts?.activeOnly !== false) q = q.eq("is_active", true);
  if (opts?.managerProfileId) q = q.eq("manager_profile_id", opts.managerProfileId);
  const { data, error } = await q;
  if (error) {
    const msg = String((error as { message?: string }).message ?? "");
    const missingTable =
      (error as { code?: string }).code === "42P01" ||
      msg.includes("teams") ||
      msg.includes("schema cache");
    if (missingTable) {
      return mergeCachedTeamRecords([], companyId);
    }
    throw error;
  }
  return mergeCachedTeamRecords((data || []) as TeamRecord[], companyId);
}

export async function fetchTeamRecordById(teamId: string, companyId: string): Promise<TeamRecord | null> {
  if (teamId.startsWith("tc-team-")) {
    const all = await fetchTeamRecords(companyId, { activeOnly: false });
    return all.find((t) => t.id === teamId) ?? null;
  }
  const { data, error } = await db
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as TeamRecord;
  const cached = await fetchTeamRecords(companyId, { activeOnly: false });
  return cached.find((t) => t.id === teamId) ?? null;
}

async function syncTeamLeadProfile(team: TeamRecord): Promise<void> {
  if (!team.team_lead_profile_id) return;
  const updates: Record<string, string | null> = {};
  if (team.manager_profile_id) updates.manager_profile_id = team.manager_profile_id;
  const { error } = await db
    .from("profiles")
    .update(updates)
    .eq("id", team.team_lead_profile_id)
    .eq("company_id", team.company_id);
  if (error) throw error;
}

/** Set recruiters on this team; clears team_id for removed members. */
export async function assignRecruitersToTeam(
  teamId: string,
  companyId: string,
  recruiterProfileIds: string[]
): Promise<void> {
  const team = await fetchTeamRecordById(teamId, companyId);
  if (!team) throw new Error("Team not found");
  if (team.__testCache) return;

  const tlId = team.team_lead_profile_id;
  const { data: current, error: curErr } = await db
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("team_id", teamId);
  if (curErr) throw curErr;

  const nextSet = new Set(recruiterProfileIds);
  const toClear = (current || []).map((r: any) => r.id).filter((id: string) => !nextSet.has(id));

  for (const id of toClear) {
    const { error } = await db
      .from("profiles")
      .update({ team_id: null, team_lead_profile_id: null })
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) throw error;
  }

  for (const id of recruiterProfileIds) {
    const { error } = await db
      .from("profiles")
      .update({
        team_id: teamId,
        team_lead_profile_id: tlId,
      })
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) throw error;
  }
}

export async function createTeamRecord(input: {
  companyId: string;
  name: string;
  managerProfileId?: string | null;
  teamLeadProfileId?: string | null;
}): Promise<TeamRecord> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("teams")
    .insert({
      company_id: input.companyId,
      name: input.name.trim(),
      manager_profile_id: input.managerProfileId ?? null,
      team_lead_profile_id: input.teamLeadProfileId ?? null,
      is_active: true,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw error;
  const team = data as TeamRecord;
  await syncTeamLeadProfile(team);
  return team;
}

export async function updateTeamRecord(
  teamId: string,
  companyId: string,
  updates: {
    name?: string;
    managerProfileId?: string | null;
    teamLeadProfileId?: string | null;
    isActive?: boolean;
  }
): Promise<TeamRecord> {
  if (teamId.startsWith("tc-team-")) {
    throw new Error("Edit test teams from the Test data panel");
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.managerProfileId !== undefined) patch.manager_profile_id = updates.managerProfileId;
  if (updates.teamLeadProfileId !== undefined) patch.team_lead_profile_id = updates.teamLeadProfileId;
  if (updates.isActive !== undefined) patch.is_active = updates.isActive;

  const { data, error } = await db
    .from("teams")
    .update(patch)
    .eq("id", teamId)
    .eq("company_id", companyId)
    .select("*")
    .single();
  if (error) throw error;
  const team = data as TeamRecord;
  await syncTeamLeadProfile(team);
  return team;
}

export async function deleteTeamRecord(teamId: string, companyId: string): Promise<void> {
  if (teamId.startsWith("tc-team-")) return;
  await db.from("profiles").update({ team_id: null }).eq("team_id", teamId).eq("company_id", companyId);
  const { error } = await db.from("teams").delete().eq("id", teamId).eq("company_id", companyId);
  if (error) throw error;
}

/** team_lead profile id -> team name for charts and labels */
export async function loadTeamNamesByTeamLeadProfileId(
  companyId: string
): Promise<Map<string, string>> {
  try {
    const teams = await fetchTeamRecords(companyId, { activeOnly: false });
    const map = new Map<string, string>();
    for (const t of teams) {
      if (t.team_lead_profile_id) map.set(t.team_lead_profile_id, t.name);
    }
    return map;
  } catch {
    return teamNamesFromCacheOnly(companyId);
  }
}

function teamNamesFromCacheOnly(companyId: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!isTestCacheOwner()) return map;
  for (const t of getTestCacheForCompany(companyId).teams) {
    if (t.team_lead_profile_id) map.set(t.team_lead_profile_id, t.name);
  }
  return map;
}

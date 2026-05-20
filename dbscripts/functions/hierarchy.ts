import { supabase } from "../../src/integrations/supabase/client";

const db = supabase as any;

/** Visible recruiters + candidates for manager / team lead scoping. */
export type HierarchyScope = {
  teamLeadProfileIds: string[];
  recruiterUserIds: string[];
  candidateIds: string[];
};

const EMPTY_SCOPE: HierarchyScope = {
  teamLeadProfileIds: [],
  recruiterUserIds: [],
  candidateIds: [],
};

function unique(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter(Boolean) as string[])];
}

function mergeScopes(scopes: HierarchyScope[]): HierarchyScope {
  return {
    teamLeadProfileIds: unique(scopes.flatMap((s) => s.teamLeadProfileIds)),
    recruiterUserIds: unique(scopes.flatMap((s) => s.recruiterUserIds)),
    candidateIds: unique(scopes.flatMap((s) => s.candidateIds)),
  };
}

/** Team lead: candidates assigned to TL + recruiters on those candidates + profile-linked recruiters. */
export async function resolveTeamLeadScope(
  teamLeadProfileId: string,
  companyId: string
): Promise<HierarchyScope> {
  if (!teamLeadProfileId || !companyId) return { ...EMPTY_SCOPE };

  const { data: candRows, error: candErr } = await db
    .from("candidates")
    .select("id, recruiter_id")
    .eq("company_id", companyId)
    .eq("team_lead_id", teamLeadProfileId);
  if (candErr) throw candErr;

  const candidateIds = unique((candRows || []).map((r: any) => r.id));
  const recruiterFromCandidates = unique((candRows || []).map((r: any) => r.recruiter_id));

  const { data: profRows, error: profErr } = await db
    .from("profiles")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("team_lead_profile_id", teamLeadProfileId);
  if (profErr) throw profErr;

  const recruiterFromProfiles = unique((profRows || []).map((r: any) => r.user_id));

  return {
    teamLeadProfileIds: [teamLeadProfileId],
    recruiterUserIds: unique([...recruiterFromCandidates, ...recruiterFromProfiles]),
    candidateIds,
  };
}

/** Manager: all team leads reporting to this manager + their teams. */
export async function resolveManagerScope(
  managerProfileId: string,
  companyId: string
): Promise<HierarchyScope> {
  if (!managerProfileId || !companyId) return { ...EMPTY_SCOPE };

  const { data: tlRows, error: tlErr } = await db
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("manager_profile_id", managerProfileId);
  if (tlErr) throw tlErr;

  const teamLeadProfileIds = unique((tlRows || []).map((r: any) => r.id));
  if (teamLeadProfileIds.length === 0) return { ...EMPTY_SCOPE };

  const scopes = await Promise.all(
    teamLeadProfileIds.map((tlId) => resolveTeamLeadScope(tlId, companyId))
  );
  return mergeScopes(scopes);
}

/** PostgREST OR filter for candidates visible in a hierarchy scope. */
export function applyHierarchyScopeToCandidatesQuery(q: any, scope: HierarchyScope): any {
  const parts: string[] = [];
  if (scope.teamLeadProfileIds.length) {
    parts.push(`team_lead_id.in.(${scope.teamLeadProfileIds.join(",")})`);
  }
  if (scope.recruiterUserIds.length) {
    parts.push(`recruiter_id.in.(${scope.recruiterUserIds.join(",")})`);
  }
  if (parts.length === 0) {
    return q.eq("id", "00000000-0000-0000-0000-000000000000");
  }
  return q.or(parts.join(","));
}

/** Profile ids of team leads under a manager. */
export async function fetchTeamLeadProfileIdsForManager(
  managerProfileId: string,
  companyId: string
): Promise<string[]> {
  const scope = await resolveManagerScope(managerProfileId, companyId);
  return scope.teamLeadProfileIds;
}

export type HierarchyUserRow = {
  id: string;
  user_id: string;
  role: string;
  manager_profile_id?: string | null;
  team_lead_profile_id?: string | null;
};

/** Manager may edit/password/deactivate their team leads and recruiters. */
export function isUserManagedByManager(
  managerProfileId: string,
  target: HierarchyUserRow,
  teamLeadProfileIdsUnderManager: Set<string>,
  recruiterUserIdsUnderManager: Set<string>
): boolean {
  if (target.role === "team_lead") {
    return (
      target.manager_profile_id === managerProfileId || teamLeadProfileIdsUnderManager.has(target.id)
    );
  }
  if (target.role === "recruiter") {
    return recruiterUserIdsUnderManager.has(target.user_id);
  }
  return false;
}

/** Team lead may manage recruiters on their team. */
export function isUserManagedByTeamLead(
  teamLeadProfileId: string,
  target: HierarchyUserRow,
  recruiterIdsUnderTL: Set<string>
): boolean {
  return (
    target.role === "recruiter" &&
    (target.team_lead_profile_id === teamLeadProfileId || recruiterIdsUnderTL.has(target.user_id))
  );
}

export function canManageTeamUser(opts: {
  isAdmin: boolean;
  isManager: boolean;
  isTeamLead: boolean;
  isAgencyScope: boolean;
  callerProfileId?: string;
  teamLeadProfileIdsUnderManager: Set<string>;
  recruiterUserIdsUnderManager: Set<string>;
  recruiterIdsUnderTL: Set<string>;
  target: HierarchyUserRow;
}): boolean {
  const { target } = opts;
  if (opts.isAdmin) return target.role !== "candidate";
  if (opts.isAgencyScope) return target.role === "recruiter" || target.role === "agency_admin";
  if (opts.isManager && opts.callerProfileId) {
    return isUserManagedByManager(
      opts.callerProfileId,
      target,
      opts.teamLeadProfileIdsUnderManager,
      opts.recruiterUserIdsUnderManager
    );
  }
  if (opts.isTeamLead && opts.callerProfileId) {
    return isUserManagedByTeamLead(opts.callerProfileId, target, opts.recruiterIdsUnderTL);
  }
  return false;
}

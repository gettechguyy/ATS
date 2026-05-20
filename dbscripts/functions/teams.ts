import { supabase } from "../../src/integrations/supabase/client";
import {
  buildTestCacheHierarchyForest,
  getCachedRecruiterMetricCounts,
  isTestCacheOwner,
  mergeCachedHierarchyPeople,
} from "../../src/lib/testDataCache";
import { fetchProfilesWithHierarchyFields } from "./profileHierarchy";
import { loadTeamNamesByTeamLeadProfileId } from "./teamRecords";

const db = supabase as any;

export type TeamMetricKind = "submissions" | "screen_calls" | "interviews" | "offers";

export type TeamHierarchyNode = {
  key: string;
  profileId: string;
  userId: string;
  name: string;
  role: "manager" | "team_lead" | "recruiter";
  value: number;
  managerProfileId?: string | null;
  teamLeadProfileId?: string | null;
  children: TeamHierarchyNode[];
};

export type TeamHierarchyViewer =
  | { role: "admin"; companyId: string }
  | { role: "manager"; companyId: string; profileId: string }
  | { role: "team_lead"; companyId: string; profileId: string }
  | { role: "recruiter"; companyId: string; profileId: string; userId: string };

type ProfileRow = {
  id: string;
  user_id: string;
  full_name: string;
  manager_profile_id: string | null;
  team_lead_profile_id: string | null;
  is_active?: boolean | null;
};

async function fetchAllRows<T>(createQuery: () => any, pageSize = 1000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await createQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data as T[]) || [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

/** team_lead profile id -> recruiter user_ids from candidate assignments */
async function loadRecruiterUserIdsByTeamLead(
  companyId: string
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  const rows = await fetchAllRows<{ team_lead_id: string | null; recruiter_id: string | null }>(() =>
    db.from("candidates").select("team_lead_id, recruiter_id").eq("company_id", companyId)
  );
  for (const r of rows) {
    if (!r.team_lead_id || !r.recruiter_id) continue;
    if (!map.has(r.team_lead_id)) map.set(r.team_lead_id, new Set());
    map.get(r.team_lead_id)!.add(r.recruiter_id);
  }
  return map;
}

function recruitersForTeamLead(
  tlProfileId: string,
  allRecruiters: (ProfileRow & { role: string })[],
  fromCandidates: Map<string, Set<string>>
): (ProfileRow & { role: string })[] {
  const userIds = new Set<string>();
  for (const r of allRecruiters) {
    if (r.team_lead_profile_id === tlProfileId) userIds.add(r.user_id);
  }
  for (const uid of fromCandidates.get(tlProfileId) || []) userIds.add(uid);
  const byUser = new Map(allRecruiters.map((r) => [r.user_id, r]));
  return [...userIds].map((uid) => {
    const found = byUser.get(uid);
    if (found) return found;
    return {
      id: `cand-rec-${uid}`,
      user_id: uid,
      full_name: "Recruiter",
      manager_profile_id: null,
      team_lead_profile_id: tlProfileId,
      role: "recruiter",
    } as ProfileRow & { role: string };
  });
}

async function loadCompanyProfiles(companyId: string): Promise<(ProfileRow & { role: string })[]> {
  const profiles = await fetchProfilesWithHierarchyFields(companyId);
  const { data: roles, error: rErr } = await db.from("user_roles").select("user_id, role");
  if (rErr) throw rErr;
  const roleByUser = new Map((roles || []).map((r: any) => [r.user_id, r.role as string]));
  return profiles
    .filter((p) => p.is_active !== false)
    .map((p) => ({
      ...p,
      role: roleByUser.get(p.user_id) || "recruiter",
    }))
    .filter((p) => ["manager", "team_lead", "recruiter"].includes(p.role));
}

function applyDateRange(q: any, col: string, startISO: string | null, endISO: string | null) {
  let x = q;
  if (startISO) x = x.gte(col, startISO);
  if (endISO) x = x.lte(col, endISO);
  return x;
}

/** Per-recruiter user_id counts for the selected metric and date range. */
async function countByRecruiterUserId(
  companyId: string,
  metric: TeamMetricKind,
  startISO: string | null,
  endISO: string | null
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const bump = (uid: string | null | undefined) => {
    if (!uid) return;
    counts.set(uid, (counts.get(uid) ?? 0) + 1);
  };

  if (metric === "submissions") {
    const rows = await fetchAllRows<any>(() =>
      applyDateRange(
        db.from("submissions").select("recruiter_id, created_at").eq("company_id", companyId),
        "created_at",
        startISO,
        endISO
      )
    );
    rows.forEach((r) => bump(r.recruiter_id));
  } else if (metric === "screen_calls") {
    const rows = await fetchAllRows<any>(() =>
      applyDateRange(
        db
          .from("submissions")
          .select("recruiter_id, created_at, status, screen_scheduled_at")
          .eq("company_id", companyId)
          .or('status.eq."Screen Call",screen_scheduled_at.not.is.null'),
        "created_at",
        startISO,
        endISO
      )
    );
    rows.forEach((r) => bump(r.recruiter_id));
  } else if (metric === "interviews") {

    const rows = await fetchAllRows<any>(() =>
      applyDateRange(
        db.from("interviews").select("created_by, scheduled_at").eq("company_id", companyId),
        "scheduled_at",
        startISO,
        endISO
      )
    );
    rows.forEach((r) => bump(r.created_by));
  } else {
    const rows = await fetchAllRows<any>(() =>
      applyDateRange(
        db.from("offers").select("created_by, offered_at").eq("company_id", companyId),
        "offered_at",
        startISO,
        endISO
      )
    );
    rows.forEach((r) => bump(r.created_by));
  }

  const cached = getCachedRecruiterMetricCounts(companyId, metric, startISO, endISO);
  cached.forEach((n, uid) => counts.set(uid, (counts.get(uid) ?? 0) + n));
  return counts;
}

function sumForRecruiters(recruiterUserIds: string[], counts: Map<string, number>): number {
  let n = 0;
  for (const id of recruiterUserIds) n += counts.get(id) ?? 0;
  return n;
}

function buildRecruiterNode(p: ProfileRow & { role: string }, counts: Map<string, number>): TeamHierarchyNode {
  return {
    key: `recruiter-${p.id}`,
    profileId: p.id,
    userId: p.user_id,
    name: p.full_name || "Recruiter",
    role: "recruiter",
    value: counts.get(p.user_id) ?? 0,
    teamLeadProfileId: p.team_lead_profile_id,
    children: [],
  };
}

function buildTeamLeadNode(
  tl: ProfileRow & { role: string },
  recruiters: (ProfileRow & { role: string })[],
  counts: Map<string, number>,
  teamNameByTl?: Map<string, string>
): TeamHierarchyNode {
  const children = recruiters.map((r) => buildRecruiterNode(r, counts));
  const recruiterIds = [...recruiters.map((r) => r.user_id), tl.user_id];
  const teamLabel = teamNameByTl?.get(tl.id);
  const displayName = teamLabel
    ? `${teamLabel} (${tl.full_name || "Team Lead"})`
    : tl.full_name || "Team Lead";
  return {
    key: `tl-${tl.id}`,
    profileId: tl.id,
    userId: tl.user_id,
    name: displayName,
    role: "team_lead",
    managerProfileId: tl.manager_profile_id,
    value: sumForRecruiters(recruiterIds, counts),
    children,
  };
}

function buildManagerNode(
  mgr: ProfileRow & { role: string },
  teamLeads: (ProfileRow & { role: string })[],
  allRecruiters: (ProfileRow & { role: string })[],
  counts: Map<string, number>,
  recruitersByTl: Map<string, Set<string>>,
  teamNameByTl?: Map<string, string>
): TeamHierarchyNode {
  const tls = teamLeads.filter((tl) => tl.manager_profile_id === mgr.id);
  const children = tls.map((tl) => {
    const recsForTl = recruitersForTeamLead(tl.id, allRecruiters, recruitersByTl);
    return buildTeamLeadNode(tl, recsForTl, counts, teamNameByTl);
  });
  const allRecruiterIdsUnder = [
    mgr.user_id,
    ...children.flatMap((c) => [c.userId, ...c.children.map((ch) => ch.userId)]),
  ];
  return {
    key: `mgr-${mgr.id}`,
    profileId: mgr.id,
    userId: mgr.user_id,
    name: mgr.full_name || "Manager",
    role: "manager",
    value: sumForRecruiters(allRecruiterIdsUnder, counts),
    children,
  };
}

function buildAdminForest(
  people: (ProfileRow & { role: string })[],
  counts: Map<string, number>,
  recruitersByTl: Map<string, Set<string>>,
  teamNameByTl?: Map<string, string>
): TeamHierarchyNode[] {
  const managers = people.filter((p) => p.role === "manager");
  const teamLeads = people.filter((p) => p.role === "team_lead");
  const recruiters = people.filter((p) => p.role === "recruiter");

  const mgrNodes = managers.map((m) =>
    buildManagerNode(m, teamLeads, recruiters, counts, recruitersByTl, teamNameByTl)
  );

  const orphanTls = teamLeads.filter((tl) => !tl.manager_profile_id);
  if (orphanTls.length) {
    mgrNodes.push({
      key: "mgr-unassigned",
      profileId: "unassigned",
      userId: "",
      name: "Unassigned teams",
      role: "manager",
      value: orphanTls.reduce((s, tl) => {
        const recs = recruitersForTeamLead(tl.id, recruiters, recruitersByTl);
        return s + sumForRecruiters(recs.map((r) => r.user_id), counts);
      }, 0),
      children: orphanTls.map((tl) =>
        buildTeamLeadNode(
          tl,
          recruitersForTeamLead(tl.id, recruiters, recruitersByTl),
          counts,
          teamNameByTl
        )
      ),
    });
  }

  const orphanRecruiters = recruiters.filter((r) => {
    if (r.team_lead_profile_id) return false;
    for (const set of recruitersByTl.values()) {
      if (set.has(r.user_id)) return false;
    }
    return true;
  });
  if (orphanRecruiters.length) {
    mgrNodes.push({
      key: "recruiters-unassigned",
      profileId: "recruiters-unassigned",
      userId: "",
      name: "Unassigned recruiters",
      role: "manager",
      value: sumForRecruiters(orphanRecruiters.map((r) => r.user_id), counts),
      children: orphanRecruiters.map((r) => buildRecruiterNode(r, counts)),
    });
  }

  return mgrNodes;
}

export async function fetchTeamHierarchyStats(
  viewer: TeamHierarchyViewer,
  metric: TeamMetricKind,
  startDate?: Date | null,
  endDate?: Date | null
): Promise<TeamHierarchyNode[]> {
  const startISO = startDate ? startDate.toISOString() : null;
  const endISO = endDate ? endDate.toISOString() : null;
  let people: (ProfileRow & { role: string })[] = [];
  try {
    people = await loadCompanyProfiles(viewer.companyId);
  } catch {
    people = [];
  }
  people = mergeCachedHierarchyPeople(people, viewer.companyId);
  const recruitersByTl = await loadRecruiterUserIdsByTeamLead(viewer.companyId);
  const teamNameByTl = await loadTeamNamesByTeamLeadProfileId(viewer.companyId);
  const counts = await countByRecruiterUserId(viewer.companyId, metric, startISO, endISO);

  if (viewer.role === "admin") {
    let forest = buildAdminForest(people, counts, recruitersByTl, teamNameByTl);
    if (isTestCacheOwner()) {
      const cacheForest = buildTestCacheHierarchyForest(viewer.companyId, counts, teamNameByTl);
      if (cacheForest.length > 0) forest = cacheForest;
    }
    return forest;
  }

  const recruiters = people.filter((p) => p.role === "recruiter");
  const teamLeads = people.filter((p) => p.role === "team_lead");

  if (viewer.role === "manager") {
    const myTls = teamLeads.filter((tl) => tl.manager_profile_id === viewer.profileId);
    return myTls.map((tl) =>
      buildTeamLeadNode(
        tl,
        recruitersForTeamLead(tl.id, recruiters, recruitersByTl),
        counts,
        teamNameByTl
      )
    );
  }

  if (viewer.role === "team_lead") {
    const recs = recruitersForTeamLead(viewer.profileId, recruiters, recruitersByTl);
    return recs.map((r) => buildRecruiterNode(r, counts));
  }

  const me = people.find((p) => p.id === viewer.profileId);
  const myTlId = me?.team_lead_profile_id ?? null;
  if (myTlId) {
    const peers = recruitersForTeamLead(myTlId, recruiters, recruitersByTl);
    return peers.map((r) => buildRecruiterNode(r, counts));
  }
  return [
    buildRecruiterNode(
      {
        id: viewer.profileId,
        user_id: viewer.userId,
        full_name: me?.full_name || "You",
        manager_profile_id: null,
        team_lead_profile_id: null,
        role: "recruiter",
      },
      counts
    ),
  ];
}

/** Nodes to render in the bar chart for current expand state. */
export function getChartNodes(
  forest: TeamHierarchyNode[],
  expandedManagers: Set<string>,
  expandedTeamLeads: Set<string>,
  viewerRole: TeamHierarchyViewer["role"]
): TeamHierarchyNode[] {
  if (viewerRole === "team_lead" || viewerRole === "recruiter") {
    return forest;
  }

  if (viewerRole === "manager") {
    const out: TeamHierarchyNode[] = [];
    for (const tl of forest) {
      if (expandedTeamLeads.has(tl.key)) {
        out.push(...(tl.children.length ? tl.children : [tl]));
      } else {
        out.push(tl);
      }
    }
    return out.length ? out : forest;
  }

  const out: TeamHierarchyNode[] = [];
  for (const mgr of forest) {
    if (!expandedManagers.has(mgr.key)) {
      out.push(mgr);
      continue;
    }
    for (const tl of mgr.children) {
      if (expandedTeamLeads.has(tl.key)) {
        out.push(...(tl.children.length ? tl.children : [tl]));
      } else {
        out.push(tl);
      }
    }
  }
  return out.length ? out : forest;
}

export const METRIC_LABELS: Record<TeamMetricKind, string> = {
  submissions: "Applications",
  screen_calls: "Screen calls",
  interviews: "Interviews",
  offers: "Offers",
};

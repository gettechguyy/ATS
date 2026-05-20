import { getStoredSession } from "@/lib/authApi";

/** Only this account can seed and see local test data. */
export const TEST_CACHE_OWNER_EMAIL = "yash@thetechguyy.com";

const STORAGE_KEY = "app_test_data_cache_v1";
export const TEST_CACHE_ID_PREFIX = "tc-";

export function isTestCacheOwner(email?: string | null): boolean {
  if (!email) {
    const session = getStoredSession();
    return session?.email?.trim().toLowerCase() === TEST_CACHE_OWNER_EMAIL;
  }
  return email.trim().toLowerCase() === TEST_CACHE_OWNER_EMAIL;
}

export function isTestCacheId(id: string | null | undefined): boolean {
  return !!id && id.startsWith(TEST_CACHE_ID_PREFIX);
}

function newTestId(kind: "candidate" | "user" | "application" | "team"): string {
  return `${TEST_CACHE_ID_PREFIX}${kind}-${crypto.randomUUID()}`;
}

export type TestCacheStore = {
  companyId: string;
  candidates: Record<string, any>[];
  users: Record<string, any>[];
  applications: Record<string, any>[];
  teams: Record<string, any>[];
};

function emptyStore(companyId: string): TestCacheStore {
  return { companyId, candidates: [], users: [], applications: [], teams: [] };
}

export function loadTestCache(): TestCacheStore | null {
  if (!isTestCacheOwner()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TestCacheStore;
    if (!parsed.teams) parsed.teams = [];
    return parsed;
  } catch {
    return null;
  }
}

function saveTestCache(store: TestCacheStore): void {
  if (!isTestCacheOwner()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getTestCacheForCompany(companyId: string): TestCacheStore {
  const store = loadTestCache();
  if (!store || store.companyId !== companyId) return emptyStore(companyId);
  return store;
}

export function clearTestCache(): void {
  if (!isTestCacheOwner()) return;
  localStorage.removeItem(STORAGE_KEY);
}

export function addTestCandidate(
  companyId: string,
  input: {
    first_name: string;
    last_name?: string;
    email?: string;
    status?: string;
    technology?: string;
    recruiter_id?: string | null;
  }
): Record<string, any> {
  const store = getTestCacheForCompany(companyId);
  const now = new Date().toISOString();
  const row = {
    id: newTestId("candidate"),
    company_id: companyId,
    first_name: input.first_name.trim(),
    last_name: input.last_name?.trim() || null,
    email: input.email?.trim() || null,
    phone: null,
    status: input.status || "New",
    technology: input.technology?.trim() || "Java",
    recruiter_id: input.recruiter_id ?? null,
    team_lead_id: null,
    agency_id: null,
    visa_status: "Other",
    created_at: now,
    updated_at: now,
    __testCache: true,
  };
  store.candidates.unshift(row);
  saveTestCache(store);
  return row;
}

function syncCachedTeamLeadManager(
  store: TestCacheStore,
  teamLeadProfileId: string | null | undefined,
  managerProfileId: string | null | undefined
): void {
  if (!teamLeadProfileId || teamLeadProfileId === "none") return;
  const tl = store.users.find((u) => u.id === teamLeadProfileId);
  if (tl) tl.manager_profile_id = managerProfileId ?? null;
}

export function addTestUser(
  companyId: string,
  input: {
    full_name: string;
    email: string;
    role?: string;
    manager_profile_id?: string | null;
    team_lead_profile_id?: string | null;
  }
): Record<string, any> {
  const store = getTestCacheForCompany(companyId);
  const now = new Date().toISOString();
  const userId = newTestId("user");
  const role = input.role || "recruiter";
  const row = {
    id: newTestId("user"),
    user_id: userId,
    company_id: companyId,
    full_name: input.full_name.trim(),
    email: input.email.trim(),
    linked_candidate_id: null,
    is_active: true,
    created_at: now,
    updated_at: now,
    role,
    manager_profile_id:
      role === "team_lead" ? input.manager_profile_id ?? null : null,
    team_lead_profile_id:
      role === "recruiter" ? input.team_lead_profile_id ?? null : null,
    team_id: null as string | null,
    __testCache: true,
  };
  store.users.unshift(row);
  saveTestCache(store);
  return row;
}

export type TestCacheCreatorRef =
  | { kind: "session"; userId: string; profileId?: string; fullName?: string; role?: string }
  | { kind: "cached_user"; profileId: string };

/** Resolve app user id + metadata for submission attribution. */
export function resolveTestCacheCreator(
  companyId: string,
  ref: TestCacheCreatorRef
): {
  userId: string;
  profileId: string | null;
  role: string;
  fullName: string;
} | null {
  if (ref.kind === "session") {
    return {
      userId: ref.userId,
      profileId: ref.profileId ?? null,
      role: ref.role ?? "recruiter",
      fullName: ref.fullName ?? "You",
    };
  }
  const u = getTestCacheForCompany(companyId).users.find((x) => x.id === ref.profileId);
  if (!u) return null;
  return {
    userId: u.user_id,
    profileId: u.id,
    role: u.role || "recruiter",
    fullName: u.full_name || "User",
  };
}

export function addTestApplication(
  companyId: string,
  input: {
    candidate_id: string;
    client_name: string;
    position?: string;
    status?: string;
    /** Who created this application (recruiter, team lead, or manager). */
    createdBy: TestCacheCreatorRef;
  }
): Record<string, any> {
  const store = getTestCacheForCompany(companyId);
  const now = new Date().toISOString();
  const creator = resolveTestCacheCreator(companyId, input.createdBy);
  if (!creator) throw new Error("Created-by user not found in cache");

  const candidate =
    store.candidates.find((c) => c.id === input.candidate_id) ||
    loadTestCache()?.candidates.find((c) => c.id === input.candidate_id);

  const row = {
    id: newTestId("application"),
    company_id: companyId,
    candidate_id: input.candidate_id,
    recruiter_id: creator.userId,
    created_by_user_id: creator.userId,
    created_by_profile_id: creator.profileId,
    created_by_role: creator.role,
    created_by_name: creator.fullName,
    client_name: input.client_name.trim(),
    position: input.position?.trim() || "Test Role",
    status: input.status || "Applied",
    job_portal: "Test",
    created_at: now,
    updated_at: now,
    screen_scheduled_at: input.status === "Screen Call" ? now : null,
    candidates: candidate
      ? {
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          email: candidate.email,
          recruiter_id: creator.userId,
          agency_id: candidate.agency_id ?? null,
        }
      : null,
    __testCache: true,
  };
  store.applications.unshift(row);
  saveTestCache(store);
  return row;
}

/** Build hierarchy forest from cache only (when DB has no managers/TLs yet). */
export function buildTestCacheHierarchyForest(
  companyId: string,
  counts: Map<string, number>,
  teamNameByTl: Map<string, string>
): import("../../dbscripts/functions/teams").TeamHierarchyNode[] {
  if (!isTestCacheOwner()) return [];
  const store = getTestCacheForCompany(companyId);
  for (const t of store.teams) {
    syncCachedTeamLeadManager(store, t.team_lead_profile_id, t.manager_profile_id);
  }
  const teamLeads = store.users.filter((u) => u.role === "team_lead");
  const recruiters = store.users.filter((u) => u.role === "recruiter");
  const managers = store.users.filter((u) => u.role === "manager");
  if (!teamLeads.length && !recruiters.length && !managers.length) return [];

  const recruitersByTl = new Map<string, Set<string>>();
  for (const r of recruiters) {
    const tlId = r.team_lead_profile_id;
    if (!tlId) continue;
    if (!recruitersByTl.has(tlId)) recruitersByTl.set(tlId, new Set());
    recruitersByTl.get(tlId)!.add(r.user_id);
  }
  for (const t of store.teams) {
    if (!t.team_lead_profile_id) continue;
    if (t.team_lead_profile_id && t.name) teamNameByTl.set(t.team_lead_profile_id, t.name);
  }

  const sum = (ids: string[]) => ids.reduce((s, id) => s + (counts.get(id) ?? 0), 0);

  const buildRec = (u: Record<string, any>) => ({
    key: `recruiter-${u.id}`,
    profileId: u.id,
    userId: u.user_id,
    name: u.full_name || "Recruiter",
    role: "recruiter" as const,
    value: counts.get(u.user_id) ?? 0,
    teamLeadProfileId: u.team_lead_profile_id,
    children: [] as import("../../dbscripts/functions/teams").TeamHierarchyNode[],
  });

  const buildTl = (tl: Record<string, any>) => {
    const recs = recruiters.filter((r) => r.team_lead_profile_id === tl.id);
    const recIds = [...recs.map((r) => r.user_id), tl.user_id];
    const label = teamNameByTl.get(tl.id);
    return {
      key: `tl-${tl.id}`,
      profileId: tl.id,
      userId: tl.user_id,
      name: label ? `${label} (${tl.full_name || "Team Lead"})` : tl.full_name || "Team Lead",
      role: "team_lead" as const,
      managerProfileId: tl.manager_profile_id,
      value: sum(recIds),
      children: recs.map(buildRec),
    };
  };

  const nodes: import("../../dbscripts/functions/teams").TeamHierarchyNode[] = [];

  for (const m of managers) {
    const tls = teamLeads.filter((tl) => tl.manager_profile_id === m.id);
    const children = tls.map(buildTl);
    const allIds = [m.user_id, ...children.flatMap((c) => [c.userId, ...c.children.map((ch) => ch.userId)])];
    nodes.push({
      key: `mgr-${m.id}`,
      profileId: m.id,
      userId: m.user_id,
      name: m.full_name || "Manager",
      role: "manager",
      value: sum(allIds),
      children,
    });
  }

  const orphanTls = teamLeads.filter((tl) => !tl.manager_profile_id);
  if (orphanTls.length) {
    const children = orphanTls.map(buildTl);
    nodes.push({
      key: "mgr-unassigned",
      profileId: "unassigned",
      userId: "",
      name: "Test / unassigned teams",
      role: "manager",
      value: sum(children.flatMap((c) => [c.userId, ...c.children.map((ch) => ch.userId)])),
      children,
    });
  }

  return nodes;
}

/** Include cached hierarchy users so Teams charts can attribute test applications. */
export function mergeCachedHierarchyPeople<T extends Record<string, any>>(
  people: T[],
  companyId: string
): T[] {
  if (!isTestCacheOwner() || !companyId) return people;
  const cached = getTestCacheForCompany(companyId).users
    .filter((u) => ["recruiter", "team_lead", "manager"].includes(u.role))
    .map(
      (u) =>
        ({
          id: u.id,
          user_id: u.user_id,
          full_name: u.full_name,
          manager_profile_id: u.manager_profile_id ?? null,
          team_lead_profile_id: u.team_lead_profile_id ?? null,
          role: u.role,
          __testCache: true,
        }) as T
    );
  const ids = new Set(people.map((p) => p.id));
  return [...cached.filter((c) => !ids.has(c.id)), ...people];
}

export function addTestTeam(
  companyId: string,
  input: {
    name: string;
    manager_profile_id?: string | null;
    team_lead_profile_id?: string | null;
  }
): Record<string, any> {
  const store = getTestCacheForCompany(companyId);
  const now = new Date().toISOString();
  const row = {
    id: newTestId("team"),
    company_id: companyId,
    name: input.name.trim(),
    manager_profile_id: input.manager_profile_id ?? null,
    team_lead_profile_id: input.team_lead_profile_id ?? null,
    is_active: true,
    created_at: now,
    updated_at: now,
    __testCache: true,
  };
  store.teams.unshift(row);
  syncCachedTeamLeadManager(store, row.team_lead_profile_id, row.manager_profile_id);
  saveTestCache(store);
  return row;
}

export function assignTestRecruitersToTeam(
  companyId: string,
  teamId: string,
  recruiterProfileIds: string[]
): void {
  const store = getTestCacheForCompany(companyId);
  const team = store.teams.find((t) => t.id === teamId);
  if (!team) return;
  const next = new Set(recruiterProfileIds);
  store.users = store.users.map((u) => {
    if (u.role !== "recruiter") return u;
    if (next.has(u.id)) {
      return {
        ...u,
        team_id: teamId,
        team_lead_profile_id: team.team_lead_profile_id,
      };
    }
    if (u.team_id === teamId) {
      return { ...u, team_id: null, team_lead_profile_id: null };
    }
    return u;
  });
  saveTestCache(store);
}

export function mergeCachedTeamRecords<T extends Record<string, any>>(
  teams: T[],
  companyId: string
): T[] {
  if (!isTestCacheOwner() || !companyId) return teams;
  const cached = getTestCacheForCompany(companyId).teams as T[];
  const ids = new Set(teams.map((t) => t.id));
  const extra = cached.filter((t) => !ids.has(t.id));
  return [...extra, ...teams];
}

export function removeTestCacheItem(
  companyId: string,
  kind: "candidate" | "user" | "application" | "team",
  id: string
): void {
  const store = getTestCacheForCompany(companyId);
  if (kind === "candidate") {
    store.candidates = store.candidates.filter((c) => c.id !== id);
    store.applications = store.applications.filter((a) => a.candidate_id !== id);
  } else if (kind === "user") {
    store.users = store.users.filter((u) => u.id !== id);
  } else if (kind === "team") {
    store.teams = store.teams.filter((t) => t.id !== id);
    store.users = store.users.map((u) =>
      u.team_id === id ? { ...u, team_id: null, team_lead_profile_id: null } : u
    );
  } else {
    store.applications = store.applications.filter((a) => a.id !== id);
  }
  saveTestCache(store);
}

function inDateRange(iso: string | null | undefined, start?: Date | null, end?: Date | null): boolean {
  if (!start && !end) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (start && t < start.getTime()) return false;
  if (end && t > end.getTime()) return false;
  return true;
}

function matchesSearch(text: string, search?: string): boolean {
  if (!search?.trim()) return true;
  return text.toLowerCase().includes(search.trim().toLowerCase());
}

// ——— Merge helpers (only active for test cache owner) ———

export function mergeCachedProfiles<T extends Record<string, any>>(
  profiles: T[],
  companyId: string
): T[] {
  if (!isTestCacheOwner()) return profiles;
  const cached = getTestCacheForCompany(companyId).users;
  if (!cached.length) return profiles;
  const ids = new Set(profiles.map((p) => p.id));
  const extra = cached.filter((u) => !ids.has(u.id)) as T[];
  return [...extra, ...profiles];
}

export function mergeCachedCandidatesList<T extends Record<string, any>>(
  data: T[],
  total: number,
  companyId: string,
  opts?: { search?: string; status?: string }
): { data: T[]; total: number } {
  if (!isTestCacheOwner()) return { data, total };
  let cached = getTestCacheForCompany(companyId).candidates as T[];
  if (opts?.status && opts.status !== "all") {
    cached = cached.filter((c) => c.status === opts.status);
  }
  if (opts?.search?.trim()) {
    cached = cached.filter((c) => {
      const blob = `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase();
      return matchesSearch(blob, opts.search);
    });
  }
  const ids = new Set(data.map((c) => c.id));
  const extra = cached.filter((c) => !ids.has(c.id));
  return { data: [...extra, ...data], total: total + extra.length };
}

export function mergeCachedCandidatesBasic<T extends Record<string, any>>(
  data: T[],
  companyId?: string | null
): T[] {
  if (!isTestCacheOwner() || !companyId) return data;
  const cached = getTestCacheForCompany(companyId).candidates.map((c) => ({
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    recruiter_id: c.recruiter_id,
    team_lead_id: c.team_lead_id,
    agency_id: c.agency_id,
    technology: c.technology,
    __testCache: true,
  })) as T[];
  const ids = new Set(data.map((c) => c.id));
  return [...cached.filter((c) => !ids.has(c.id)), ...data];
}

export function getCachedCandidateById(
  id: string,
  companyId?: string
): Record<string, any> | null {
  if (!isTestCacheOwner() || !isTestCacheId(id)) return null;
  const store = loadTestCache();
  if (!store) return null;
  if (companyId && store.companyId !== companyId) return null;
  return store.candidates.find((c) => c.id === id) ?? null;
}

export function mergeCachedSubmissionsPaginated(
  data: Record<string, any>[],
  total: number,
  companyId: string,
  opts?: { search?: string; status?: string; candidateId?: string }
): { data: Record<string, any>[]; total: number } {
  if (!isTestCacheOwner()) return { data, total };
  let cached = getTestCacheForCompany(companyId).applications;
  if (opts?.candidateId) cached = cached.filter((a) => a.candidate_id === opts.candidateId);
  if (opts?.status && opts.status !== "all") cached = cached.filter((a) => a.status === opts.status);
  if (opts?.search?.trim()) {
    cached = cached.filter(
      (a) =>
        matchesSearch(a.client_name || "", opts.search) ||
        matchesSearch(a.position || "", opts.search)
    );
  }
  const ids = new Set(data.map((a) => a.id));
  const extra = cached.filter((a) => !ids.has(a.id));
  return { data: [...extra, ...data], total: total + extra.length };
}

export function mergeCachedApplicationSummaries(
  rows: {
    candidateId: string;
    candidateName: string;
    recruiterId: string | null;
    agencyId: string | null;
    applicationCount: number;
  }[],
  companyId: string
): typeof rows {
  if (!isTestCacheOwner()) return rows;
  const store = getTestCacheForCompany(companyId);
  const countByCandidate = new Map<string, number>();
  for (const a of store.applications) {
    countByCandidate.set(a.candidate_id, (countByCandidate.get(a.candidate_id) ?? 0) + 1);
  }
  const byId = new Map(rows.map((r) => [r.candidateId, r]));
  for (const c of store.candidates) {
    const extra = countByCandidate.get(c.id) ?? 0;
    if (extra === 0) continue;
    const existing = byId.get(c.id);
    if (existing) {
      existing.applicationCount += extra;
    } else {
      const row = {
        candidateId: c.id,
        candidateName: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—",
        recruiterId: c.recruiter_id ?? null,
        agencyId: c.agency_id ?? null,
        applicationCount: extra,
      };
      byId.set(c.id, row);
      rows.push(row);
    }
  }
  return rows;
}

export function mergeCachedCandidateStats(
  stats: Record<string, { applicationsCount: number; screenCount: number; interviewCount: number; lastApplicationAt: string | null }>,
  companyId: string
): typeof stats {
  if (!isTestCacheOwner()) return stats;
  const apps = getTestCacheForCompany(companyId).applications;
  for (const a of apps) {
    const cid = a.candidate_id;
    if (!stats[cid]) {
      stats[cid] = { applicationsCount: 0, screenCount: 0, interviewCount: 0, lastApplicationAt: null };
    }
    stats[cid].applicationsCount += 1;
    if (a.status === "Screen Call" || a.screen_scheduled_at) stats[cid].screenCount += 1;
    if (!stats[cid].lastApplicationAt || a.created_at > stats[cid].lastApplicationAt!) {
      stats[cid].lastApplicationAt = a.created_at;
    }
  }
  return stats;
}

export function applyCachedDashboardStats(
  stats: Record<string, any>,
  companyId: string,
  startDate?: Date | null,
  endDate?: Date | null
): Record<string, any> {
  if (!isTestCacheOwner()) return stats;
  const store = getTestCacheForCompany(companyId);
  const candidates = store.candidates.filter((c) => true);
  const apps = store.applications.filter((a) => inDateRange(a.created_at, startDate, endDate));

  const next = { ...stats };
  next.totalCandidates = (next.totalCandidates ?? 0) + candidates.length;
  next.totalSubmissions = (next.totalSubmissions ?? 0) + apps.length;
  for (const c of candidates) {
    const st = c.status || "New";
    if (next.candidatesByStatus && st in next.candidatesByStatus) {
      next.candidatesByStatus[st] = (next.candidatesByStatus[st] ?? 0) + 1;
    }
  }
  next.totalAssessments =
    (next.totalAssessments ?? 0) + apps.filter((a) => a.status === "Assessment").length;
  next.totalScreenCalls =
    (next.totalScreenCalls ?? 0) +
    apps.filter((a) => a.status === "Screen Call" || a.screen_scheduled_at).length;
  return next;
}

/** Extra per-recruiter counts for Teams metrics. */
export function getCachedRecruiterMetricCounts(
  companyId: string,
  metric: "submissions" | "screen_calls" | "interviews" | "offers",
  startISO: string | null,
  endISO: string | null
): Map<string, number> {
  const counts = new Map<string, number>();
  if (!isTestCacheOwner()) return counts;
  const start = startISO ? new Date(startISO) : null;
  const end = endISO ? new Date(endISO) : null;
  const apps = getTestCacheForCompany(companyId).applications;
  for (const a of apps) {
    if (!inDateRange(a.created_at, start, end)) continue;
    const uid = a.recruiter_id;
    if (!uid) continue;
    if (metric === "submissions") {
      counts.set(uid, (counts.get(uid) ?? 0) + 1);
    } else if (metric === "screen_calls" && (a.status === "Screen Call" || a.screen_scheduled_at)) {
      counts.set(uid, (counts.get(uid) ?? 0) + 1);
    }
  }
  return counts;
}

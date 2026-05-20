import { supabase } from "../../src/integrations/supabase/client";
import {
  getCachedCandidateById,
  isTestCacheId,
  mergeCachedCandidateStats,
  mergeCachedCandidatesBasic,
  mergeCachedCandidatesList,
  removeTestCacheItem,
  loadTestCache,
} from "../../src/lib/testDataCache";
import { applyHierarchyScopeToCandidatesQuery, type HierarchyScope } from "./hierarchy";

/** Avoids Supabase client "excessively deep" generic inference on chained builders. */
const db = supabase as any;

export async function fetchCandidates(companyId: string) {
  const { data, error } = await db
    .from("candidates")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Only candidates assigned to this recruiter (recruiter_id = recruiterId). */
export async function fetchCandidatesByRecruiter(recruiterId: string, companyId: string) {
  const { data, error } = await db
    .from("candidates")
    .select("*")
    .eq("recruiter_id", recruiterId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

const CANDIDATES_SORT_COLUMNS = ["first_name", "last_name", "email", "created_at", "status"] as const;
export type CandidatesPageOpts = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  sortBy?: string;
  order?: "asc" | "desc";
  /** Multi-tenant scope (required for list queries) */
  companyId?: string;
  /** undefined = all, null = no agency assigned, string = that agency */
  agencyId?: string | null;
  /** when true, only candidates with agency_id IS NOT NULL (used when filter is "Agency" but no specific agency chosen) */
  agencyNotNullOnly?: boolean;
  /** undefined = all, null = unassigned recruiter, string = that recruiter */
  recruiterId?: string | null;
  technology?: string | null;
};

function candidateOrderColumn(sortField: string): string {
  if (sortField === "first_name") return "first_name_sort";
  if (sortField === "last_name") return "last_name_sort";
  return sortField;
}

function buildCandidatesQuery(
  recruiterId?: string | null,
  agencyId?: string | null,
  agencyNotNullOnly?: boolean,
  sortBy?: string,
  order?: "asc" | "desc",
  technology?: string | null,
  companyId?: string | null
) {
  const rawCol = sortBy && CANDIDATES_SORT_COLUMNS.includes(sortBy as any) ? sortBy : "created_at";
  const col = candidateOrderColumn(rawCol);
  const asc = order === "asc";
  let q: any = db.from("candidates").select("*", { count: "exact" }).order(col, { ascending: asc });
  if (companyId) q = q.eq("company_id", companyId);
  if (recruiterId !== undefined && recruiterId !== null) q = q.eq("recruiter_id", recruiterId);
  else if (recruiterId === null) q = q.is("recruiter_id", null);
  // Agency: specific ID takes precedence, then null (None), then agencyNotNullOnly (Agency filter but no selection)
  const hasSpecificAgency = agencyId != null && String(agencyId).trim() !== "";
  if (hasSpecificAgency) q = q.eq("agency_id", agencyId);
  else if (agencyId === null) q = q.is("agency_id", null);
  else if (agencyNotNullOnly) q = q.not("agency_id", "is", null);
  if (technology != null && technology !== "") q = (q as any).eq("technology", technology);
  return q;
}

/** Server-side paginated + optional search, status, sort, agencyId, recruiterId, technology. Returns { data, total } */
export async function fetchCandidatesPaginated(opts: CandidatesPageOpts) {
  const { page, pageSize, search, status, sortBy, order, agencyId, agencyNotNullOnly, recruiterId, technology, companyId } = opts;
  if (!companyId) throw new Error("companyId is required");
  let q = buildCandidatesQuery(recruiterId, agencyId, agencyNotNullOnly, sortBy, order, technology ?? undefined, companyId);
  if (status && status !== "all") q = q.eq("status", status as any);
  if (search && search.trim()) {
    const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
    const term = `%${safe}%`;
    q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`);
  }
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return mergeCachedCandidatesList(data ?? [], count ?? 0, companyId, { search, status });
}

export async function fetchCandidatesByRecruiterPaginated(recruiterId: string, opts: CandidatesPageOpts) {
  const { page, pageSize, search, status, sortBy, order, agencyId, agencyNotNullOnly, technology, companyId } = opts;
  if (!companyId) throw new Error("companyId is required");
  let q = buildCandidatesQuery(recruiterId, agencyId ?? undefined, agencyNotNullOnly, sortBy, order, technology ?? undefined, companyId);
  if (status && status !== "all") q = q.eq("status", status as any);
  if (search && search.trim()) {
    const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
    const term = `%${safe}%`;
    q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`);
  }
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return mergeCachedCandidatesList(data ?? [], count ?? 0, companyId, { search, status });
}

/** Team lead or manager: candidates for assigned TLs and their recruiters. */
export async function fetchCandidatesPaginatedForScope(scope: HierarchyScope, opts: CandidatesPageOpts) {
  const { page, pageSize, search, status, sortBy, order, agencyId, agencyNotNullOnly, technology, companyId } = opts;
  if (!companyId) throw new Error("companyId is required");
  let q = buildCandidatesQuery(undefined, agencyId ?? undefined, agencyNotNullOnly, sortBy, order, technology ?? undefined, companyId);
  q = applyHierarchyScopeToCandidatesQuery(q, scope);
  if (status && status !== "all") q = q.eq("status", status as any);
  if (search && search.trim()) {
    const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
    const term = `%${safe}%`;
    q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`);
  }
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return mergeCachedCandidatesList(data ?? [], count ?? 0, companyId, { search, status });
}

export async function fetchCandidateById(id: string, companyId?: string) {
  if (isTestCacheId(id)) {
    return getCachedCandidateById(id, companyId);
  }
  let q = db.from("candidates").select("*").eq("id", id);
  if (companyId) q = q.eq("company_id", companyId);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data;
}

/** Candidates visible to a manager or team lead (for dropdowns). */
export async function fetchCandidatesBasicForScope(scope: HierarchyScope, companyId: string) {
  if (!scope.candidateIds.length && !scope.recruiterUserIds.length) return [];
  let q: any = db
    .from("candidates")
    .select("id, first_name, last_name, email, recruiter_id, team_lead_id, agency_id, technology");
  q = q.eq("company_id", companyId);
  q = applyHierarchyScopeToCandidatesQuery(q, scope);
  const { data } = await q;
  return data || [];
}

export async function fetchCandidatesBasic(agencyId?: string | null, companyId?: string | null) {
  let q: any = db
    .from("candidates")
    .select("id, first_name, last_name, email, recruiter_id, team_lead_id, agency_id, technology");
  if (companyId != null) q = q.eq("company_id", companyId);
  if (agencyId != null) q = q.eq("agency_id", agencyId);
  const { data } = await q;
  return mergeCachedCandidatesBasic(data || [], companyId ?? "");
}

/** Distinct technology values for filter dropdown.
 * Optionally scoped by agency and/or recruiter.
 */
export async function fetchCandidateTechnologies(
  agencyId?: string | null,
  recruiterId?: string | null,
  companyId?: string | null
): Promise<string[]> {
  let q = db.from("candidates").select("technology");
  if (companyId != null) q = q.eq("company_id", companyId);
  if (agencyId != null) q = q.eq("agency_id", agencyId);
  if (recruiterId !== undefined) {
    if (recruiterId === null) q = q.is("recruiter_id", null);
    else q = q.eq("recruiter_id", recruiterId);
  }
  const { data } = await q;
  const set = new Set<string>();
  (data || []).forEach((r: any) => {
    const t = r?.technology?.trim();
    if (t) set.add(t);
  });
  return Array.from(set).sort();
}

/** Candidates assigned to this team lead (team_lead_id = profile id). */
export async function fetchCandidatesByTeamLead(teamLeadProfileId: string, companyId?: string) {
  let q: any = db
    .from("candidates")
    .select("id, first_name, last_name, email, recruiter_id, team_lead_id, agency_id")
    .eq("team_lead_id", teamLeadProfileId);
  if (companyId) q = q.eq("company_id", companyId);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

const VISA_STATUSES = ["OPT", "H1B", "GC", "Citizen", "Other"] as const;

export async function createCandidate(candidate: {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  recruiter_id: string;
  company_id: string;
  status?: string;
  visa_status?: string | null;
  agency_id?: string | null;
}) {
  const { data, error } = await db.from("candidates").insert({
    first_name: candidate.first_name,
    last_name: candidate.last_name || null,
    email: candidate.email || null,
    phone: candidate.phone || null,
    recruiter_id: candidate.recruiter_id,
    company_id: candidate.company_id,
    agency_id: candidate.agency_id ?? null,
    status: (candidate.status || "New") as any,
    visa_status: candidate.visa_status || "Other",
  }).select("id").single();
  if (error) throw error;
  return data;
}

export async function updateCandidate(id: string, updates: Record<string, any>) {
  const { error } = await db.from("candidates").update(updates).eq("id", id);
  if (error) throw error;
}

export async function updateCandidateStatus(id: string, status: string) {
  const { error } = await db
    .from("candidates")
    .update({ status: status as any })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCandidate(id: string) {
  if (isTestCacheId(id)) {
    const store = loadTestCache();
    if (store?.companyId) removeTestCacheItem(store.companyId, "candidate", id);
    return;
  }
  const { error } = await db.from("candidates").delete().eq("id", id);
  if (error) throw error;
}

export async function updateCandidateResumeUrl(id: string, resumeUrl: string | null) {
  const updateObj: Record<string, any> = { resume_url: resumeUrl };
  const { error } = await db
    .from("candidates")
    .update(updateObj)
    .eq("id", id);
  if (error) throw error;
}

export async function updateCandidateCoverLetterUrl(id: string, coverLetterUrl: string | null) {
  const updateObj: Record<string, any> = { cover_letter_url: coverLetterUrl };
  const { error } = await db
    .from("candidates")
    .update(updateObj)
    .eq("id", id);
  if (error) throw error;
}

export async function updateCandidateIdUrl(id: string, idUrl: string) {
  const updateObj: Record<string, any> = { id_copy_url: idUrl };
  const { error } = await db
    .from("candidates")
    .update(updateObj)
    .eq("id", id);
  if (error) throw error;
}

export async function updateCandidateVisaUrl(id: string, visaUrl: string) {
  const updateObj: Record<string, any> = { visa_copy_url: visaUrl };
  const { error } = await db
    .from("candidates")
    .update(updateObj)
    .eq("id", id);
  if (error) throw error;
}

export type CandidateStats = {
  applicationsCount: number;
  screenCount: number;
  interviewCount: number;
  lastApplicationAt: string | null;
};

/**
 * Per-candidate counts for the Candidates Activity table.
 * Head counts per candidate match detail/Applications totals (same company_id + candidate_id filters).
 */
export async function fetchCandidateStats(
  candidateIds: string[],
  companyId: string
): Promise<Record<string, CandidateStats>> {
  const result: Record<string, CandidateStats> = {};
  candidateIds.forEach((id) => {
    result[id] = { applicationsCount: 0, screenCount: 0, interviewCount: 0, lastApplicationAt: null };
  });
  if (candidateIds.length === 0 || !companyId) return result;

  await Promise.all(
    candidateIds.map(async (candidateId) => {
      const [appsRes, screensRes, interviewsRes, latestRes] = await Promise.all([
        db
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("candidate_id", candidateId),
        db
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("candidate_id", candidateId)
          .or("status.eq.Screen Call,screen_scheduled_at.not.is.null"),
        db
          .from("interviews")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("candidate_id", candidateId),
        db
          .from("submissions")
          .select("created_at")
          .eq("company_id", companyId)
          .eq("candidate_id", candidateId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (appsRes.error) throw appsRes.error;
      if (screensRes.error) throw screensRes.error;
      if (interviewsRes.error) throw interviewsRes.error;
      if (latestRes.error) throw latestRes.error;

      result[candidateId].applicationsCount = appsRes.count ?? 0;
      result[candidateId].screenCount = screensRes.count ?? 0;
      result[candidateId].interviewCount = interviewsRes.count ?? 0;
      if (latestRes.data?.created_at) {
        result[candidateId].lastApplicationAt = latestRes.data.created_at;
      }
    })
  );

  return mergeCachedCandidateStats(result, companyId);
}

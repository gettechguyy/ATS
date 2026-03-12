import { supabase } from "../../src/integrations/supabase/client";

export async function fetchCandidates() {
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Only candidates assigned to this recruiter (recruiter_id = recruiterId). */
export async function fetchCandidatesByRecruiter(recruiterId: string) {
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("recruiter_id", recruiterId)
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
  /** undefined = all, null = no agency assigned, string = that agency */
  agencyId?: string | null;
  /** when true, only candidates with agency_id IS NOT NULL (used when filter is "Agency" but no specific agency chosen) */
  agencyNotNullOnly?: boolean;
  /** undefined = all, null = unassigned recruiter, string = that recruiter */
  recruiterId?: string | null;
  technology?: string | null;
};

function buildCandidatesQuery(recruiterId?: string | null, agencyId?: string | null, agencyNotNullOnly?: boolean, sortBy?: string, order?: "asc" | "desc", technology?: string | null) {
  const col = sortBy && CANDIDATES_SORT_COLUMNS.includes(sortBy as any) ? sortBy : "created_at";
  const asc = order === "asc";
  let q = supabase.from("candidates").select("*", { count: "exact" }).order(col, { ascending: asc });
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
  const { page, pageSize, search, status, sortBy, order, agencyId, agencyNotNullOnly, recruiterId, technology } = opts;
  let q = buildCandidatesQuery(recruiterId, agencyId, agencyNotNullOnly, sortBy, order, technology ?? undefined);
  if (status && status !== "all") q = q.eq("status", status);
  if (search && search.trim()) {
    const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
    const term = `%${safe}%`;
    q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`);
  }
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function fetchCandidatesByRecruiterPaginated(recruiterId: string, opts: CandidatesPageOpts) {
  const { page, pageSize, search, status, sortBy, order, agencyId, agencyNotNullOnly, technology } = opts;
  let q = buildCandidatesQuery(recruiterId, agencyId ?? undefined, agencyNotNullOnly, sortBy, order, technology ?? undefined);
  if (status && status !== "all") q = q.eq("status", status);
  if (search && search.trim()) {
    const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
    const term = `%${safe}%`;
    q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`);
  }
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function fetchCandidateById(id: string) {
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchCandidatesBasic(agencyId?: string | null) {
  let q = supabase
    .from("candidates")
    .select("id, first_name, last_name, email, recruiter_id, team_lead_id, agency_id, technology");
  if (agencyId != null) q = q.eq("agency_id", agencyId);
  const { data } = await q;
  return data || [];
}

/** Distinct technology values for filter dropdown (optionally scoped by agency). */
export async function fetchCandidateTechnologies(agencyId?: string | null): Promise<string[]> {
  let q = supabase.from("candidates").select("technology");
  if (agencyId != null) q = q.eq("agency_id", agencyId);
  const { data } = await q;
  const set = new Set<string>();
  (data || []).forEach((r: any) => {
    const t = r?.technology?.trim();
    if (t) set.add(t);
  });
  return Array.from(set).sort();
}

/** Candidates assigned to this team lead (team_lead_id = profile id). */
export async function fetchCandidatesByTeamLead(teamLeadProfileId: string) {
  const { data, error } = await supabase
    .from("candidates")
    .select("id, first_name, last_name, email, recruiter_id, team_lead_id, agency_id")
    .eq("team_lead_id", teamLeadProfileId)
    .order("created_at", { ascending: false });
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
  status?: string;
  visa_status?: string | null;
}) {
  const { data, error } = await supabase.from("candidates").insert({
    first_name: candidate.first_name,
    last_name: candidate.last_name || null,
    email: candidate.email || null,
    phone: candidate.phone || null,
    recruiter_id: candidate.recruiter_id,
    status: (candidate.status || "New") as any,
    visa_status: candidate.visa_status || "Other",
  }).select("id").single();
  if (error) throw error;
  return data;
}

export async function updateCandidate(id: string, updates: Record<string, any>) {
  const { error } = await supabase.from("candidates").update(updates).eq("id", id);
  if (error) throw error;
}

export async function updateCandidateStatus(id: string, status: string) {
  const { error } = await supabase
    .from("candidates")
    .update({ status: status as any })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCandidate(id: string) {
  const { error } = await supabase.from("candidates").delete().eq("id", id);
  if (error) throw error;
}

export async function updateCandidateResumeUrl(id: string, resumeUrl: string | null) {
  const updateObj: Record<string, any> = { resume_url: resumeUrl };
  const { error } = await supabase
    .from("candidates")
    .update(updateObj)
    .eq("id", id);
  if (error) throw error;
}

export async function updateCandidateCoverLetterUrl(id: string, coverLetterUrl: string | null) {
  const updateObj: Record<string, any> = { cover_letter_url: coverLetterUrl };
  const { error } = await supabase
    .from("candidates")
    .update(updateObj)
    .eq("id", id);
  if (error) throw error;
}

export async function updateCandidateIdUrl(id: string, idUrl: string) {
  const updateObj: Record<string, any> = { id_copy_url: idUrl };
  const { error } = await supabase
    .from("candidates")
    .update(updateObj)
    .eq("id", id);
  if (error) throw error;
}

export async function updateCandidateVisaUrl(id: string, visaUrl: string) {
  const updateObj: Record<string, any> = { visa_copy_url: visaUrl };
  const { error } = await supabase
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

/** Get applications count, screen count, interview count, and last application date for each candidate id. */
export async function fetchCandidateStats(candidateIds: string[]): Promise<Record<string, CandidateStats>> {
  const result: Record<string, CandidateStats> = {};
  candidateIds.forEach((id) => {
    result[id] = { applicationsCount: 0, screenCount: 0, interviewCount: 0, lastApplicationAt: null };
  });
  if (candidateIds.length === 0) return result;

  const [subsRes, intRes] = await Promise.all([
    supabase.from("submissions").select("id, candidate_id, status, screen_scheduled_at, created_at").in("candidate_id", candidateIds),
    supabase.from("interviews").select("id, candidate_id").in("candidate_id", candidateIds),
  ]);
  const subs = subsRes.data || [];
  const interviews = intRes.data || [];

  subs.forEach((s: any) => {
    const cid = s.candidate_id;
    if (!result[cid]) return;
    result[cid].applicationsCount += 1;
    if (s.status === "Screen Call" || s.screen_scheduled_at) result[cid].screenCount += 1;
    if (!result[cid].lastApplicationAt || (s.created_at && s.created_at > result[cid].lastApplicationAt!)) {
      result[cid].lastApplicationAt = s.created_at || null;
    }
  });
  interviews.forEach((i: any) => {
    const cid = i.candidate_id;
    if (result[cid]) result[cid].interviewCount += 1;
  });
  return result;
}

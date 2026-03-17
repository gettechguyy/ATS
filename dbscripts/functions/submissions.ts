import { supabase } from "../../src/integrations/supabase/client";

export async function fetchSubmissions() {
  const { data, error } = await supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, email, recruiter_id, agency_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Submissions created by / assigned to this recruiter. */
export async function fetchSubmissionsByRecruiter(recruiterId: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, email, recruiter_id, agency_id)")
    .eq("recruiter_id", recruiterId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchSubmissionById(id: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, email, recruiter_id, agency_id)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchSubmissionsByCandidate(candidateId: string) {
  const { data } = await supabase
    .from("submissions")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  return data || [];
}

/** Matches DB enum submission_status for type-safe .eq("status", ...) */
type SubmissionStatusFilter =
  | "Applied"
  | "Vendor Responded"
  | "Screen Call"
  | "Interview"
  | "Rejected"
  | "Offered";

const SUBMISSIONS_SORT_COLUMNS = ["created_at", "client_name", "position", "status"] as const;
export type SubmissionsPageOpts = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  sortBy?: string;
  order?: "asc" | "desc";
  candidateId?: string | null;
};

function buildSubmissionsQuery(recruiterId?: string, candidateId?: string, sortBy?: string, order?: "asc" | "desc") {
  const col = sortBy && SUBMISSIONS_SORT_COLUMNS.includes(sortBy as any) ? sortBy : "created_at";
  const asc = order === "asc";
  let q = supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, email, recruiter_id, agency_id)", { count: "exact" })
    .order(col, { ascending: asc });
  if (recruiterId) q = q.eq("recruiter_id", recruiterId);
  if (candidateId) q = q.eq("candidate_id", candidateId);
  return q;
}

/** Server-side paginated submissions. Optional search, status, sort, candidateId. */
export async function fetchSubmissionsPaginated(opts: SubmissionsPageOpts) {
  const { page, pageSize, search, status, sortBy, order, candidateId } = opts;
  let q = buildSubmissionsQuery(undefined, candidateId ?? undefined, sortBy, order);
  if (status && status !== "all") q = q.eq("status", status as SubmissionStatusFilter);
  if (search && search.trim()) {
    const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
    const term = `%${safe}%`;
    q = q.or(`client_name.ilike.${term},position.ilike.${term}`);
  }
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function fetchSubmissionsByRecruiterPaginated(recruiterId: string, opts: SubmissionsPageOpts) {
  const { page, pageSize, search, status, sortBy, order, candidateId } = opts;
  let q = buildSubmissionsQuery(recruiterId, candidateId ?? undefined, sortBy, order);
  if (status && status !== "all") q = q.eq("status", status as SubmissionStatusFilter);
  if (search && search.trim()) {
    const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
    const term = `%${safe}%`;
    q = q.or(`client_name.ilike.${term},position.ilike.${term}`);
  }
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

/** Paginated submissions for all candidates currently assigned to this recruiter (candidates.recruiter_id = recruiterId). */
export async function fetchSubmissionsForRecruiterCandidatesPaginated(recruiterId: string, opts: SubmissionsPageOpts) {
  const { page, pageSize, search, status, sortBy, order, candidateId } = opts;
  const col = sortBy && SUBMISSIONS_SORT_COLUMNS.includes(sortBy as any) ? sortBy : "created_at";
  const asc = order === "asc";
  let q = supabase
    .from("submissions")
    .select("*, candidates!inner(first_name, last_name, email, recruiter_id, agency_id)", { count: "exact" })
    .eq("candidates.recruiter_id", recruiterId)
    .order(col, { ascending: asc });

  if (candidateId) q = q.eq("candidate_id", candidateId);
  if (status && status !== "all") q = q.eq("status", status as SubmissionStatusFilter);
  if (search && search.trim()) {
    const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
    const term = `%${safe}%`;
    q = q.or(`client_name.ilike.${term},position.ilike.${term}`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function fetchSubmissionsByCandidatePaginated(candidateId: string, opts: SubmissionsPageOpts) {
  const { page, pageSize, search, status, sortBy, order } = opts;
  let q = buildSubmissionsQuery(undefined, candidateId, sortBy, order);
  if (status && status !== "all") q = q.eq("status", status as SubmissionStatusFilter);
  if (search && search.trim()) {
    const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
    const term = `%${safe}%`;
    q = q.or(`client_name.ilike.${term},position.ilike.${term}`);
  }
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

/** All submissions whose candidate is assigned to this agency (e.g. for Screens). */
export async function fetchSubmissionsByAgency(agencyId: string) {
  const { data: candidateRows } = await supabase.from("candidates").select("id").eq("agency_id", agencyId);
  const candidateIds = (candidateRows || []).map((c: any) => c.id);
  if (candidateIds.length === 0) return [];
  const { data, error } = await supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, email, recruiter_id, agency_id)")
    .in("candidate_id", candidateIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Submissions for an agency: only submissions whose candidate is assigned to this agency. Optional candidateId filter. */
export async function fetchSubmissionsByAgencyPaginated(agencyId: string, opts: SubmissionsPageOpts) {
  const { data: candidateRows } = await supabase.from("candidates").select("id").eq("agency_id", agencyId);
  const candidateIds = (candidateRows || []).map((c: any) => c.id);
  if (candidateIds.length === 0) return { data: [], total: 0 };
  const { page, pageSize, search, status, sortBy, order, candidateId: filterCandidateId } = opts;
  const col = sortBy && SUBMISSIONS_SORT_COLUMNS.includes(sortBy as any) ? sortBy : "created_at";
  const asc = order === "asc";
  const idsToUse = filterCandidateId && candidateIds.includes(filterCandidateId) ? [filterCandidateId] : candidateIds;
  let q = supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, email, recruiter_id, agency_id)", { count: "exact" })
    .in("candidate_id", idsToUse)
    .order(col, { ascending: asc });
  if (status && status !== "all") q = q.eq("status", status as SubmissionStatusFilter);
  if (search && search.trim()) {
    const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
    const term = `%${safe}%`;
    q = q.or(`client_name.ilike.${term},position.ilike.${term}`);
  }
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

/** Submissions for a Team Lead:
 *  - any submission whose candidate.team_lead_id = teamLeadProfileId
 *  - OR any submission whose recruiter_id is assigned to any candidate of the team lead
 */
export async function fetchSubmissionsByTeamLead(teamLeadProfileId: string) {
  // select submissions where candidate has team_lead_id = teamLeadProfileId
  const { data, error } = await supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, email, team_lead_id, recruiter_id, agency_id)")
    .or(`candidate_id.in.(select id from candidates where team_lead_id.eq.${teamLeadProfileId}),recruiter_id.in.(select recruiter_id from candidates where team_lead_id.eq.${teamLeadProfileId})`)
    .order("created_at", { ascending: false });
  // Fallback: if supabase does not support subqueries in .or, run two queries and merge
  if (error) {
    // Fetch candidate IDs for the team lead first to avoid complex nested type inference
    const candRes: any = await (supabase as any).from("candidates").select("id").eq("team_lead_id", teamLeadProfileId);
    const candidateIds = (candRes.data || []).map((r: any) => r.id);

    const byCandidate: any = await (supabase as any)
      .from("submissions")
      .select("*, candidates(first_name, last_name, email, team_lead_id, recruiter_id, agency_id)")
      .in("candidate_id", candidateIds.length ? candidateIds : []);

    const recruiterRes: any = await (supabase as any).from("candidates").select("recruiter_id").eq("team_lead_id", teamLeadProfileId);
    const recruiterIds = (recruiterRes.data || []).map((r: any) => r.recruiter_id).filter(Boolean);

    const byRecruiter: any = await (supabase as any)
      .from("submissions")
      .select("*, candidates(first_name, last_name, email, team_lead_id, recruiter_id, agency_id)")
      .in("recruiter_id", recruiterIds.length ? recruiterIds : []);

    const merged = [...(byCandidate.data || []), ...(byRecruiter.data || [])];
    // dedupe by submission id
    const map = new Map<string, any>();
    merged.forEach((s: any) => map.set(s.id, s));
    return Array.from(map.values()).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  if (error) throw error;
  return data || [];
}

export async function createSubmission(submission: {
  candidate_id: string;
  recruiter_id: string;
  client_name: string;
  position: string;
  job_link?: string | null;
  job_portal?: string | null;
  status?: string;
  rate?: number | null;
  rate_type?: string | null;
  job_description?: string | null;
  job_type?: string | null;
  city?: string | null;
  state?: string | null;
}): Promise<{ id: string } | void> {
  const insertObj: Record<string, any> = {
    candidate_id: submission.candidate_id,
    recruiter_id: submission.recruiter_id,
    client_name: submission.client_name,
    position: submission.position,
    status: (submission.status || "Applied") as any,
  };
  if (submission.job_link !== undefined) insertObj.job_link = submission.job_link;
  if (submission.job_portal !== undefined) insertObj.job_portal = submission.job_portal;
   // Optional Vendor Responded details when creating directly in that status
  if (submission.rate !== undefined) insertObj.rate = submission.rate;
  if (submission.rate_type !== undefined) insertObj.rate_type = submission.rate_type;
  if (submission.job_description !== undefined) insertObj.job_description = submission.job_description;
  if (submission.job_type !== undefined) insertObj.job_type = submission.job_type;
  if (submission.city !== undefined) insertObj.city = submission.city;
  if (submission.state !== undefined) insertObj.state = submission.state;

  const { data, error } = await supabase.from("submissions").insert(insertObj as any).select("id").single();
  if (error) throw error;

  const { count } = await supabase.from("submissions").select("id", { count: "exact", head: true }).eq("candidate_id", submission.candidate_id);
  if (count === 1) {
    await supabase.from("candidates").update({ status: "In Marketing" as any }).eq("id", submission.candidate_id);
  }
  return data as { id: string };
}

export async function updateSubmissionStatus(id: string, status: string) {
  const { error } = await supabase
    .from("submissions")
    .update({ status: status as any })
    .eq("id", id);
  if (error) throw error;
}

export async function updateSubmission(id: string, fields: Record<string, any>) {
  // Only include keys that are explicitly provided (avoid overwriting unrelated columns with null)
  const updateObj: Record<string, any> = {};
  for (const key of Object.keys(fields)) {
    if (fields[key] !== undefined) {
      updateObj[key] = fields[key];
    }
  }

  if (Object.keys(updateObj).length === 0) return;

  const { error } = await supabase
    .from("submissions")
    .update(updateObj)
    .eq("id", id);
  if (error) throw error;
}

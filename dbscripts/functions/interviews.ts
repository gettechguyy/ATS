import { supabase } from "../../src/integrations/supabase/client";

export async function fetchAllInterviews(companyId: string) {
  const { data, error } = await supabase
    .from("interviews")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))")
    .eq("company_id", companyId)
    .order("scheduled_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Interviews for the given candidate (for candidate role). */
export async function fetchInterviewsByCandidate(candidateId: string) {
  const { data, error } = await supabase
    .from("interviews")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))")
    .eq("candidate_id", candidateId)
    .order("scheduled_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Interviews created by this recruiter (uses created_by for fast fetch). */
export async function fetchInterviewsByRecruiter(recruiterId: string, companyId: string) {
  const { data, error } = await supabase
    .from("interviews")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))")
    .eq("created_by", recruiterId)
    .eq("company_id", companyId)
    .order("scheduled_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

const INTERVIEWS_SORT_COLUMNS = [
  "scheduled_at",
  "round_number",
  "created_at",
  "mode",
  "status",
  "submission_client_name",
  "submission_position",
] as const;
export type InterviewsPageOpts = { page: number; pageSize: number; sortBy?: string; order?: "asc" | "desc" };

function resolveInterviewsSortColumn(sortBy?: string): string {
  return sortBy && INTERVIEWS_SORT_COLUMNS.includes(sortBy as any) ? sortBy : "scheduled_at";
}

function applyInterviewsOrder(q: any, column: string, ascending: boolean): any {
  if (column === "submission_client_name") {
    return q.order("client_name_sort", { ascending, foreignTable: "submissions" });
  }
  if (column === "submission_position") {
    return q.order("position", { ascending, foreignTable: "submissions" });
  }
  return q.order(column, { ascending });
}

/** Server-side paginated. */
export async function fetchAllInterviewsPaginated(companyId: string, opts: InterviewsPageOpts) {
  const { page, pageSize, sortBy, order } = opts;
  const column = resolveInterviewsSortColumn(sortBy);
  const ascending = order === "asc";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let q = supabase
    .from("interviews")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))", { count: "exact" })
    .eq("company_id", companyId);
  q = applyInterviewsOrder(q, column, ascending);
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function fetchInterviewsByCandidatePaginated(candidateId: string, opts: InterviewsPageOpts) {
  const { page, pageSize, sortBy, order } = opts;
  const column = resolveInterviewsSortColumn(sortBy);
  const ascending = order === "asc";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let q = supabase
    .from("interviews")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))", { count: "exact" })
    .eq("candidate_id", candidateId);
  q = applyInterviewsOrder(q, column, ascending);
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

/** Recruiter interviews: filter by created_by only (no submission_id list). Requires interviews.created_by column. */
export async function fetchInterviewsByRecruiterPaginated(recruiterId: string, companyId: string, opts: InterviewsPageOpts) {
  const { page, pageSize, sortBy, order } = opts;
  const column = resolveInterviewsSortColumn(sortBy);
  const ascending = order === "asc";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let q = supabase
    .from("interviews")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))", { count: "exact" })
    .eq("created_by", recruiterId)
    .eq("company_id", companyId);
  q = applyInterviewsOrder(q, column, ascending);
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

/** Interviews for submissions whose candidate is assigned to this agency. Uses created_by to avoid long submission_id lists. */
export async function fetchInterviewsByAgencyPaginated(agencyId: string, companyId: string, opts: InterviewsPageOpts) {
  const { data: candidateRows } = await supabase
    .from("candidates")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("company_id", companyId);
  const candidateIds = (candidateRows || []).map((c: { id: string }) => c.id);
  if (candidateIds.length === 0) return { data: [], total: 0 };
  const { data: subs } = await supabase
    .from("submissions")
    .select("id, recruiter_id")
    .eq("company_id", companyId)
    .in("candidate_id", candidateIds);
  const submissionIds = (subs || []).map((x: { id: string }) => x.id);
  if (submissionIds.length === 0) return { data: [], total: 0 };
  const recruiterIds = [...new Set((subs || []).map((x: { recruiter_id: string | null }) => x.recruiter_id).filter(Boolean))] as string[];
  const submissionIdSet = new Set(submissionIds);
  const { page, pageSize, sortBy, order } = opts;
  const column = resolveInterviewsSortColumn(sortBy);
  const ascending = order === "asc";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  if (recruiterIds.length === 0) {
    let q = supabase
      .from("interviews")
      .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))", { count: "exact" })
      .eq("company_id", companyId)
      .in("submission_id", submissionIds);
    q = applyInterviewsOrder(q, column, ascending);
    const { data, error, count } = await q.range(from, to);
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }
  let q = supabase
    .from("interviews")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))")
    .eq("company_id", companyId)
    .in("created_by", recruiterIds);
  q = applyInterviewsOrder(q, column, ascending);
  const { data: rawData, error } = await q;
  if (error) throw error;
  const filtered = (rawData ?? []).filter((i: any) => submissionIdSet.has(i.submission_id));
  const total = filtered.length;
  const data = filtered.slice(from, to + 1);
  return { data, total };
}

export async function fetchInterviewsBySubmission(submissionId: string) {
  const { data } = await supabase
    .from("interviews")
    .select("*")
    .eq("submission_id", submissionId)
    .order("round_number", { ascending: true });
  return data || [];
}

export async function createInterview(interview: {
  submission_id: string;
  candidate_id: string;
  created_by: string | null;
  round_number: number;
  mode: string;
  scheduled_at: string;
  virtual_link?: string | null;
  interview_questions_url?: string | null;
}) {
  const { error } = await supabase.from("interviews").insert({
    submission_id: interview.submission_id,
    candidate_id: interview.candidate_id,
    created_by: interview.created_by ?? null,
    round_number: interview.round_number,
    status: "Scheduled" as any,
    mode: interview.mode as any,
    scheduled_at: interview.scheduled_at,
    virtual_link: interview.virtual_link || null,
    interview_questions_url: interview.interview_questions_url ?? null,
    feedback: null,
  });
  if (error) throw error;
}

export async function updateInterviewStatus(interviewId: string, status: string) {
  const { error } = await supabase
    .from("interviews")
    .update({ status: status as any })
    .eq("id", interviewId);
  if (error) throw error;
}

export async function updateInterviewFeedback(interviewId: string, feedback: string) {
  const { error } = await supabase
    .from("interviews")
    .update({ feedback })
    .eq("id", interviewId);
  if (error) throw error;
}

export async function rescheduleInterview(
  interviewId: string,
  oldDate: string | null,
  newDate: string,
  changedBy: string
) {
  // Log the reschedule
  await supabase.from("interview_reschedule_logs").insert({
    interview_id: interviewId,
    old_date: oldDate,
    new_date: newDate,
    changed_by: changedBy,
  });

  // Update interview
  const { error } = await supabase
    .from("interviews")
    .update({ scheduled_at: newDate, status: "Rescheduled" as any })
    .eq("id", interviewId);
  if (error) throw error;
}

import { supabase } from "../../src/integrations/supabase/client";

export async function fetchSubmissions() {
  const { data, error } = await supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, email)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Submissions created by / assigned to this recruiter. */
export async function fetchSubmissionsByRecruiter(recruiterId: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, email)")
    .eq("recruiter_id", recruiterId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchSubmissionById(id: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, email)")
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

/** Submissions for a Team Lead:
 *  - any submission whose candidate.team_lead_id = teamLeadProfileId
 *  - OR any submission whose recruiter_id is assigned to any candidate of the team lead
 */
export async function fetchSubmissionsByTeamLead(teamLeadProfileId: string) {
  // select submissions where candidate has team_lead_id = teamLeadProfileId
  const { data, error } = await supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, email, team_lead_id)")
    .or(`candidate_id.in.(select id from candidates where team_lead_id.eq.${teamLeadProfileId}),recruiter_id.in.(select recruiter_id from candidates where team_lead_id.eq.${teamLeadProfileId})`)
    .order("created_at", { ascending: false });
  // Fallback: if supabase does not support subqueries in .or, run two queries and merge
  if (error) {
    // Fetch candidate IDs for the team lead first to avoid complex nested type inference
    const candRes: any = await (supabase as any).from("candidates").select("id").eq("team_lead_id", teamLeadProfileId);
    const candidateIds = (candRes.data || []).map((r: any) => r.id);

    const byCandidate: any = await (supabase as any)
      .from("submissions")
      .select("*, candidates(first_name, last_name, email, team_lead_id)")
      .in("candidate_id", candidateIds.length ? candidateIds : []);

    const recruiterRes: any = await (supabase as any).from("candidates").select("recruiter_id").eq("team_lead_id", teamLeadProfileId);
    const recruiterIds = (recruiterRes.data || []).map((r: any) => r.recruiter_id).filter(Boolean);

    const byRecruiter: any = await (supabase as any)
      .from("submissions")
      .select("*, candidates(first_name, last_name, email, team_lead_id)")
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
}) {
  const insertObj: Record<string, any> = {
    candidate_id: submission.candidate_id,
    recruiter_id: submission.recruiter_id,
    client_name: submission.client_name,
    position: submission.position,
    status: (submission.status || "Applied") as any,
  };
  if (submission.job_link !== undefined) insertObj.job_link = submission.job_link;
  if (submission.job_portal !== undefined) insertObj.job_portal = submission.job_portal;

  const { error } = await supabase.from("submissions").insert(insertObj as any);
  if (error) throw error;
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

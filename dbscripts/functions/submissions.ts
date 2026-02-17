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

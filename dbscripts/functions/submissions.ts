import { supabase } from "@/integrations/supabase/client";

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
  status?: string;
}) {
  const { error } = await supabase.from("submissions").insert({
    candidate_id: submission.candidate_id,
    recruiter_id: submission.recruiter_id,
    client_name: submission.client_name,
    position: submission.position,
    status: (submission.status || "Applied") as any,
  });
  if (error) throw error;
}

export async function updateSubmissionStatus(id: string, status: string) {
  const { error } = await supabase
    .from("submissions")
    .update({ status: status as any })
    .eq("id", id);
  if (error) throw error;
}

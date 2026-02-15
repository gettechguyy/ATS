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

export async function fetchCandidateById(id: string) {
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchCandidatesBasic() {
  const { data } = await supabase
    .from("candidates")
    .select("id, first_name, last_name, email");
  return data || [];
}

export async function createCandidate(candidate: {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  recruiter_id: string;
  status?: string;
}) {
  const { error } = await supabase.from("candidates").insert({
    first_name: candidate.first_name,
    last_name: candidate.last_name || null,
    email: candidate.email || null,
    phone: candidate.phone || null,
    recruiter_id: candidate.recruiter_id,
    status: (candidate.status || "New") as any,
  });
  if (error) throw error;
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

export async function updateCandidateResumeUrl(id: string, resumeUrl: string) {
  const { error } = await supabase
    .from("candidates")
    .update({ resume_url: resumeUrl })
    .eq("id", id);
  if (error) throw error;
}

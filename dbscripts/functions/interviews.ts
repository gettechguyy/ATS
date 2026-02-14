import { supabase } from "@/integrations/supabase/client";

export async function fetchAllInterviews() {
  const { data, error } = await supabase
    .from("interviews")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))")
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

/** Interviews for submissions created by this recruiter. */
export async function fetchInterviewsByRecruiter(recruiterId: string) {
  const { data: subs } = await supabase.from("submissions").select("id").eq("recruiter_id", recruiterId);
  const ids = (subs || []).map((x: { id: string }) => x.id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("interviews")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))")
    .in("submission_id", ids)
    .order("scheduled_at", { ascending: false });
  if (error) throw error;
  return data;
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
  round_number: number;
  mode: string;
  scheduled_at: string;
  virtual_link?: string | null;
}) {
  const { error } = await supabase.from("interviews").insert({
    submission_id: interview.submission_id,
    candidate_id: interview.candidate_id,
    round_number: interview.round_number,
    status: "Scheduled" as any,
    mode: interview.mode as any,
    scheduled_at: interview.scheduled_at,
    virtual_link: interview.virtual_link || null,
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

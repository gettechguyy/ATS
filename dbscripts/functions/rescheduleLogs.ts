import { supabase } from "../../src/integrations/supabase/client";

export async function fetchRescheduleLogsByInterviewIds(interviewIds: string[]) {
  const { data } = await supabase
    .from("interview_reschedule_logs")
    .select("*")
    .in("interview_id", interviewIds)
    .order("changed_at", { ascending: false });
  return data || [];
}

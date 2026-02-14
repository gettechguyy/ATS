import { supabase } from "@/integrations/supabase/client";

export type DashboardStatsOptions = {
  role: "admin" | "recruiter" | "candidate" | "manager";
  userId?: string;
  linkedCandidateId?: string | null;
};

export async function fetchDashboardStats(options?: DashboardStatsOptions) {
  const role = options?.role ?? "recruiter";
  const recruiterId = (role === "recruiter" && options?.userId) ? options.userId : null;
  const candidateId = (role === "candidate" && options?.linkedCandidateId) ? options.linkedCandidateId : null;

  const isRecruiterScoped = role === "recruiter" && recruiterId;
  const isCandidateScoped = role === "candidate" && candidateId;

  const emptyStats = () => ({
    totalCandidates: 0,
    candidatesByStatus: { New: 0, "In Marketing": 0, Placed: 0, Backout: 0, "On Bench": 0, "In Training": 0 },
    totalSubmissions: 0,
    totalInterviews: 0,
    scheduledInterviews: 0,
    passedInterviews: 0,
    totalOffers: 0,
    pendingOffers: 0,
    acceptedOffers: 0,
  });

  if (role === "candidate" && !candidateId) return emptyStats();

  let candidatesQuery = supabase.from("candidates").select("id, status, recruiter_id");
  let submissionsQuery = supabase.from("submissions").select("id, status, candidate_id, recruiter_id");
  let interviewsQuery = supabase.from("interviews").select("id, scheduled_at, status, submission_id, candidate_id");
  let offersQuery = supabase.from("offers").select("id, status, candidate_id");

  if (isRecruiterScoped) {
    candidatesQuery = candidatesQuery.eq("recruiter_id", recruiterId);
    submissionsQuery = submissionsQuery.eq("recruiter_id", recruiterId);
  }
  if (isCandidateScoped) {
    submissionsQuery = submissionsQuery.eq("candidate_id", candidateId);
    interviewsQuery = interviewsQuery.eq("candidate_id", candidateId);
    offersQuery = offersQuery.eq("candidate_id", candidateId);
  }

  let c: any[];
  let s: any[];
  let i: any[];
  let o: any[];

  if (isRecruiterScoped) {
    const [candidatesRes, submissionsRes] = await Promise.all([candidatesQuery, submissionsQuery]);
    c = candidatesRes.data || [];
    s = submissionsRes.data || [];
    const submissionIds = s.map((x: any) => x.id);
    if (submissionIds.length > 0) {
      const [intRes, offRes] = await Promise.all([
        supabase.from("interviews").select("id, scheduled_at, status").in("submission_id", submissionIds),
        supabase.from("offers").select("id, status").in("submission_id", submissionIds),
      ]);
      i = intRes.data || [];
      o = offRes.data || [];
    } else {
      i = [];
      o = [];
    }
  } else {
    const [candidatesRes, submissionsRes, interviewsRes, offersRes] = await Promise.all([
      candidatesQuery,
      submissionsQuery,
      interviewsQuery,
      offersQuery,
    ]);
    c = candidatesRes.data || [];
    s = submissionsRes.data || [];
    i = interviewsRes.data || [];
    o = offersRes.data || [];
  }


  return {
    totalCandidates: c.length,
    candidatesByStatus: {
      New: c.filter((x: any) => x.status === "New").length,
      "In Marketing": c.filter((x: any) => x.status === "In Marketing").length,
      Placed: c.filter((x: any) => x.status === "Placed").length,
      Backout: c.filter((x: any) => x.status === "Backout").length,
      "On Bench": c.filter((x: any) => x.status === "On Bench").length,
      "In Training": c.filter((x: any) => x.status === "In Training").length,
    },
    totalSubmissions: s.length,
    totalInterviews: i.length,
    scheduledInterviews: i.filter((x: any) => x.status === "Scheduled").length,
    passedInterviews: i.filter((x: any) => x.status === "Passed").length,
    totalOffers: o.length,
    pendingOffers: o.filter((x: any) => x.status === "Pending").length,
    acceptedOffers: o.filter((x: any) => x.status === "Accepted").length,
  };
}

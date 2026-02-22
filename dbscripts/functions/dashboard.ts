import { supabase } from "../../src/integrations/supabase/client";

export type DashboardStatsOptions = {
  role: "admin" | "recruiter" | "candidate" | "manager" | "team_lead";
  userId?: string;
  linkedCandidateId?: string | null;
  // Optional date range (inclusive). Can be Date or ISO string.
  startDate?: string | Date | null;
  endDate?: string | Date | null;
};

export async function fetchDashboardStats(options?: DashboardStatsOptions) {
  const role = options?.role ?? "recruiter";
  const recruiterId = (role === "recruiter" && options?.userId) ? options.userId : null;
  const candidateId = (role === "candidate" && options?.linkedCandidateId) ? options.linkedCandidateId : null;

  const isRecruiterScoped = role === "recruiter" && recruiterId;
  const isCandidateScoped = role === "candidate" && candidateId;
  const isTeamLeadScoped = role === "team_lead" && options?.userId;

  const emptyStats = () => ({
    totalCandidates: 0,
    candidatesByStatus: { New: 0, "In Marketing": 0, Placed: 0, Backout: 0, "On Bench": 0, "In Training": 0 },
    totalSubmissions: 0,
    totalInterviews: 0,
    scheduledInterviews: 0,
    totalScreenCalls: 0,
    scheduledScreens: 0,
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

  // Apply optional date filters to submissions/interviews/offers.
  const toISO = (d?: string | Date | null) => {
    if (!d) return null;
    return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
  };
  const startISO = toISO(options?.startDate);
  const endISO = toISO(options?.endDate);

  if (startISO) {
    // submissions and offers use created_at, interviews use scheduled_at
    submissionsQuery = submissionsQuery.gte("created_at", startISO);
    offersQuery = offersQuery.gte("created_at", startISO);
    interviewsQuery = interviewsQuery.gte("scheduled_at", startISO);
  }
  if (endISO) {
    submissionsQuery = submissionsQuery.lte("created_at", endISO);
    offersQuery = offersQuery.lte("created_at", endISO);
    interviewsQuery = interviewsQuery.lte("scheduled_at", endISO);
  }
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
        // apply date filters when querying by submission ids as well
        (() => {
          let q = supabase.from("interviews").select("id, scheduled_at, status").in("submission_id", submissionIds);
          if (startISO) q = q.gte("scheduled_at", startISO);
          if (endISO) q = q.lte("scheduled_at", endISO);
          return q;
        })(),
        (() => {
          let q = supabase.from("offers").select("id, status").in("submission_id", submissionIds);
          if (startISO) q = q.gte("created_at", startISO);
          if (endISO) q = q.lte("created_at", endISO);
          return q;
        })(),
      ]);
      i = intRes.data || [];
      o = offRes.data || [];
    } else {
      i = [];
      o = [];
    }
  } else {
  if (isTeamLeadScoped) {
    // Limit candidates to those owned by team lead (team_lead_id = recruiterId (profile id))
    const teamLeadId = options?.userId!;
    const candidatesRes: any = await (supabase as any).from("candidates").select("id").eq("team_lead_id", teamLeadId);
    const candidateIds = (candidatesRes.data || []).map((r: any) => r.id);
    // submissions where candidate_id in candidateIds OR recruiter_id in (distinct recruiter_ids for those candidates)
    const recruiterRes: any = await (supabase as any).from("candidates").select("distinct recruiter_id").in("id", candidateIds).neq("recruiter_id", null);
    const recruiterIds = (recruiterRes.data || []).map((r: any) => r.recruiter_id).filter(Boolean);
    const submissionsRes: any = await (supabase as any).from("submissions").select("*").or(`${candidateIds.length ? `candidate_id.in.(${candidateIds.join(",")})` : ''}${candidateIds.length && recruiterIds.length ? ',' : ''}${recruiterIds.length ? `recruiter_id.in.(${recruiterIds.join(",")})` : ''}`);
    s = submissionsRes.data || [];
    // fetch interviews/offers for those submissions
    const submissionIds = s.map((x:any)=>x.id);
    if (submissionIds.length>0) {
      const intRes = await supabase.from("interviews").select("id, scheduled_at, status").in("submission_id", submissionIds);
      const offRes = await supabase.from("offers").select("id, status").in("submission_id", submissionIds);
      i = intRes.data || [];
      o = offRes.data || [];
    } else {
      i = [];
      o = [];
    }
    // candidates list limited
    c = (await supabase.from("candidates").select("id, status, recruiter_id").in("id", candidateIds)).data || [];
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
    // screen calls are tracked on the submissions row (status === 'Screen Call' or screen_scheduled_at set)
    totalScreenCalls: s.filter((x: any) => x.status === "Screen Call" || x.screen_scheduled_at).length,
    totalInterviews: i.length,
    scheduledInterviews: i.filter((x: any) => x.status === "Scheduled").length,
    scheduledScreens: s.filter((x: any) => Boolean(x.screen_scheduled_at)).length,
    passedInterviews: i.filter((x: any) => x.status === "Passed").length,
    totalOffers: o.length,
    pendingOffers: o.filter((x: any) => x.status === "Pending").length,
    acceptedOffers: o.filter((x: any) => x.status === "Accepted").length,
  };
}

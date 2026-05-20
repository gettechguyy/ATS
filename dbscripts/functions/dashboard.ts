import { supabase } from "../../src/integrations/supabase/client";
import { applyCachedDashboardStats } from "../../src/lib/testDataCache";
import { resolveManagerScope, resolveTeamLeadScope } from "./hierarchy";

/** Avoids Supabase client "excessively deep" generic inference on chained builders. */
const db = supabase as any;

/** PostgREST/Supabase caps each response at ~1000 rows by default; paginate to aggregate full totals. */
async function fetchAllRows<T>(createQuery: () => any, pageSize = 1000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await createQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data as T[]) || [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

export type DashboardStatsOptions = {
  role: "admin" | "recruiter" | "candidate" | "manager" | "team_lead" | "agency_admin";
  /** Required for multi-tenant isolation */
  companyId: string;
  userId?: string;
  linkedCandidateId?: string | null;
  agencyId?: string | null;
  // Optional inclusive range as UTC instants. Client should send boundaries for US Eastern calendar days.
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  // Optional filters for admin / agency_admin dashboard.
  filterCandidateId?: string | null;
  filterTechnology?: string | null;
  filterRecruiterId?: string | null;
};

export async function fetchDashboardStats(options?: DashboardStatsOptions) {
  const roleRaw = options?.role ?? "recruiter";
  const role = typeof roleRaw === "string" ? roleRaw.toLowerCase() : roleRaw;
  const recruiterId = (role === "recruiter" && options?.userId) ? options.userId : null;
  const candidateId = (role === "candidate" && options?.linkedCandidateId) ? options.linkedCandidateId : null;
  const agencyId = (role === "agency_admin" && options?.agencyId) ? options.agencyId : null;

  const isRecruiterScoped = role === "recruiter" && recruiterId;
  const isCandidateScoped = role === "candidate" && candidateId;
  const isTeamLeadScoped = role === "team_lead" && options?.userId;
  const isManagerScoped = role === "manager" && options?.userId;
  const isAgencyScoped = role === "agency_admin" && agencyId;

  const emptyStats = () => ({
    totalCandidates: 0,
    candidatesByStatus: { New: 0, "Ready For Assign": 0, "Ready For Marketing": 0, "In Marketing": 0, Placed: 0, Backout: 0, "On Bench": 0, "In Training": 0 },
    totalSubmissions: 0,
    totalInterviews: 0,
    scheduledInterviews: 0,
    totalAssessments: 0,
    totalScreenCalls: 0,
    scheduledScreens: 0,
    passedInterviews: 0,
    totalOffers: 0,
    pendingOffers: 0,
    acceptedOffers: 0,
  });

  if (role === "candidate" && !candidateId) return emptyStats();
  if (role === "agency_admin" && !agencyId) return emptyStats();
  if (role === "recruiter" && !recruiterId) return emptyStats();
  if (!options?.companyId) return emptyStats();
  const companyId = options.companyId;

  const toISO = (d?: string | Date | null) => {
    if (!d) return null;
    return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
  };
  const startISO = toISO(options?.startDate);
  const endISO = toISO(options?.endDate);

  const filterCandidateId = options?.filterCandidateId ?? null;
  const filterTechnology = options?.filterTechnology ?? null;
  const filterRecruiterId = options?.filterRecruiterId ?? null;
  const hasFilter = !!(filterCandidateId || filterTechnology || filterRecruiterId);

  /** Fresh builder each call so we can paginate with `.range` (avoids the default ~1000 row cap). */
  const buildCandidatesQuery = () => {
    let q: any = db.from("candidates").select("id, status, recruiter_id").eq("company_id", companyId);
    if (isRecruiterScoped) q = q.eq("recruiter_id", recruiterId!);
    if (isAgencyScoped) q = q.eq("agency_id", agencyId!);
    if (filterCandidateId) q = q.eq("id", filterCandidateId);
    if (filterRecruiterId) q = q.eq("recruiter_id", filterRecruiterId);
    if (filterTechnology) q = (q as any).eq("technology", filterTechnology);
    return q;
  };

  const buildSubmissionsQuery = () => {
    let q: any = db
      .from("submissions")
      .select("id, status, candidate_id, recruiter_id, screen_scheduled_at, created_at")
      .eq("company_id", companyId);
    if (startISO) q = q.gte("created_at", startISO);
    if (endISO) q = q.lte("created_at", endISO);
    if (isRecruiterScoped) q = q.eq("recruiter_id", recruiterId!);
    if (isCandidateScoped) q = q.eq("candidate_id", candidateId!);
    return q;
  };

  const buildInterviewsQuery = () => {
    let q: any = db
      .from("interviews")
      .select("id, scheduled_at, status, created_by, candidate_id, submission_id")
      .eq("company_id", companyId);
    if (startISO) q = q.gte("scheduled_at", startISO);
    if (endISO) q = q.lte("scheduled_at", endISO);
    if (isRecruiterScoped) q = q.eq("created_by", recruiterId!);
    if (isCandidateScoped) q = q.eq("candidate_id", candidateId!);
    return q;
  };

  const buildOffersQuery = () => {
    let q: any = db
      .from("offers")
      .select("id, status, created_by, candidate_id, submission_id")
      .eq("company_id", companyId);
    if (startISO) q = q.gte("offered_at", startISO);
    if (endISO) q = q.lte("offered_at", endISO);
    if (isRecruiterScoped) q = q.eq("created_by", recruiterId!);
    if (isCandidateScoped) q = q.eq("candidate_id", candidateId!);
    return q;
  };

  let c: any[];
  let s: any[];
  let i: any[];
  let o: any[];
  // Optional aggregated submissions count from RPC (get_candidate_application_counts)
  let aggregatedSubmissionsTotal: number | null = null;

  if (isAgencyScoped) {
    // Agency admin: only candidates assigned to their agency and submissions for those candidates. Use created_by for interviews/offers to avoid long submission_id lists.
    c = await fetchAllRows(buildCandidatesQuery);
    const candidateIds = c.map((x: any) => x.id);
    if (candidateIds.length === 0) {
      s = [];
      i = [];
      o = [];
    } else {
      const buildAgencySubmissions = () => {
        let subQ = db
          .from("submissions")
          .select("id, status, candidate_id, recruiter_id, screen_scheduled_at, created_at")
          .eq("company_id", companyId)
          .in("candidate_id", candidateIds);
        if (startISO) subQ = subQ.gte("created_at", startISO);
        if (endISO) subQ = subQ.lte("created_at", endISO);
        return subQ;
      };
      s = await fetchAllRows(buildAgencySubmissions);
      const submissionIds = s.map((x: any) => x.id);
      const recruiterIds = [...new Set((s || []).map((x: any) => x.recruiter_id).filter(Boolean))];
      if (submissionIds.length > 0 && recruiterIds.length > 0) {
        const subSet = new Set(submissionIds);
        const intRows = await fetchAllRows(() => {
          let intQ = db
            .from("interviews")
            .select("id, scheduled_at, status, submission_id, created_by")
            .eq("company_id", companyId)
            .in("created_by", recruiterIds);
          if (startISO) intQ = intQ.gte("scheduled_at", startISO);
          if (endISO) intQ = intQ.lte("scheduled_at", endISO);
          return intQ;
        });
        const offRows = await fetchAllRows(() => {
          let offQ = db
            .from("offers")
            .select("id, status, submission_id, created_by")
            .eq("company_id", companyId)
            .in("created_by", recruiterIds);
          if (startISO) offQ = offQ.gte("created_at", startISO);
          if (endISO) offQ = offQ.lte("created_at", endISO);
          return offQ;
        });
        i = intRows.filter((x: any) => subSet.has(x.submission_id));
        o = offRows.filter((x: any) => subSet.has(x.submission_id));
      } else if (submissionIds.length > 0) {
        i = await fetchAllRows(() => {
          let intQ = db
            .from("interviews")
            .select("id, scheduled_at, status, submission_id")
            .eq("company_id", companyId)
            .in("submission_id", submissionIds);
          if (startISO) intQ = intQ.gte("scheduled_at", startISO);
          if (endISO) intQ = intQ.lte("scheduled_at", endISO);
          return intQ;
        });
        o = await fetchAllRows(() => {
          let offQ = db
            .from("offers")
            .select("id, status, submission_id")
            .eq("company_id", companyId)
            .in("submission_id", submissionIds);
          if (startISO) offQ = offQ.gte("created_at", startISO);
          if (endISO) offQ = offQ.lte("created_at", endISO);
          return offQ;
        });
      } else {
        i = [];
        o = [];
      }
    }
  } else if (isRecruiterScoped) {
    // Recruiter: use created_by only for interviews/offers (no submission_id list).
    const [cRows, sRows, iRows, oRows] = await Promise.all([
      fetchAllRows(buildCandidatesQuery),
      fetchAllRows(buildSubmissionsQuery),
      fetchAllRows(buildInterviewsQuery),
      fetchAllRows(buildOffersQuery),
    ]);
    c = cRows;
    s = sRows;
    i = iRows;
    o = oRows;

    // Also use aggregated submissions-by-candidate RPC so recruiter dashboard totalSubmissions
    // matches the Applications page logic. Only when no date range or technology/recruiter
    // filters are applied, to avoid mismatches.
    if (!startISO && !endISO && !filterTechnology && !filterRecruiterId) {
      const { data, error } = await db.rpc("get_candidate_application_counts", {
        p_recruiter_id: recruiterId,
        p_agency_id: null,
        p_status: null,
        p_search: null,
        p_candidate_id: filterCandidateId ?? null,
        p_offset: 0,
        p_limit: 200000,
        p_company_id: companyId,
      });
      if (!error && Array.isArray(data)) {
        aggregatedSubmissionsTotal = data.reduce(
          (sum: number, row: any) => sum + Number(row.application_count || 0),
          0
        );
      }
    }
  } else if (isManagerScoped || isTeamLeadScoped) {
    const scope = isManagerScoped
      ? await resolveManagerScope(options!.userId!, companyId)
      : await resolveTeamLeadScope(options!.userId!, companyId);
    const candidateIds = scope.candidateIds;
    const recruiterIds = scope.recruiterUserIds;
    if (candidateIds.length === 0 && recruiterIds.length === 0) {
      c = [];
      s = [];
      i = [];
      o = [];
    } else {
      const orParts: string[] = [];
      if (candidateIds.length) orParts.push(`candidate_id.in.(${candidateIds.join(",")})`);
      if (recruiterIds.length) orParts.push(`recruiter_id.in.(${recruiterIds.join(",")})`);
      s = await fetchAllRows(() => {
        let q = db.from("submissions").select("*").eq("company_id", companyId);
        if (orParts.length === 1) q = q.or(orParts[0]);
        else if (orParts.length > 1) q = q.or(orParts.join(","));
        return q;
      });
      const submissionIds = s.map((x: any) => x.id);
      const subSet = new Set(submissionIds);
      if (submissionIds.length > 0 && recruiterIds.length > 0) {
        const intRows = await fetchAllRows(() =>
          db
            .from("interviews")
            .select("id, scheduled_at, status, submission_id")
            .eq("company_id", companyId)
            .in("created_by", recruiterIds)
        );
        const offRows = await fetchAllRows(() =>
          db
            .from("offers")
            .select("id, status, submission_id")
            .eq("company_id", companyId)
            .in("created_by", recruiterIds)
        );
        i = intRows.filter((x: any) => subSet.has(x.submission_id));
        o = offRows.filter((x: any) => subSet.has(x.submission_id));
      } else if (submissionIds.length > 0) {
        i = await fetchAllRows(() =>
          db
            .from("interviews")
            .select("id, scheduled_at, status")
            .eq("company_id", companyId)
            .in("submission_id", submissionIds)
        );
        o = await fetchAllRows(() =>
          db
            .from("offers")
            .select("id, status")
            .eq("company_id", companyId)
            .in("submission_id", submissionIds)
        );
      } else {
        i = [];
        o = [];
      }
      if (candidateIds.length) {
        c = await fetchAllRows(() =>
          db
            .from("candidates")
            .select("id, status, recruiter_id")
            .eq("company_id", companyId)
            .in("id", candidateIds)
        );
      } else {
        c = [];
      }
    }
  } else {
    if (hasFilter) {
      c = await fetchAllRows(buildCandidatesQuery);
      const candidateIds = c.map((x: any) => x.id);

      if (filterCandidateId || filterTechnology) {
        // When filtering by candidate/technology (and optionally recruiter), restrict submissions
        // to those candidates, and if a recruiter is also selected, only submissions created by
        // that recruiter. This ensures a single candidate view can never exceed the recruiter total.
        if (candidateIds.length === 0) {
          s = [];
          i = [];
          o = [];
        } else {
          const [sRows, iRows, oRows] = await Promise.all([
            fetchAllRows(() => {
              let subQ = buildSubmissionsQuery().in("candidate_id", candidateIds);
              if (filterRecruiterId) subQ = subQ.eq("recruiter_id", filterRecruiterId);
              return subQ;
            }),
            fetchAllRows(() => buildInterviewsQuery().in("candidate_id", candidateIds)),
            fetchAllRows(() => buildOffersQuery().in("candidate_id", candidateIds)),
          ]);
          s = sRows;
          i = iRows;
          o = oRows;
        }
      } else {
        // Only recruiter filter: submissions/interviews/offers created by that recruiter.
        const [sRows, iRows, oRows] = await Promise.all([
          fetchAllRows(() => buildSubmissionsQuery().eq("recruiter_id", filterRecruiterId!)),
          fetchAllRows(() => buildInterviewsQuery().eq("created_by", filterRecruiterId!)),
          fetchAllRows(() => buildOffersQuery().eq("created_by", filterRecruiterId!)),
        ]);
        s = sRows;
        i = iRows;
        o = oRows;
      }
    } else {
      const [cRows, sRows, iRows, oRows] = await Promise.all([
        fetchAllRows(buildCandidatesQuery),
        fetchAllRows(buildSubmissionsQuery),
        fetchAllRows(buildInterviewsQuery),
        fetchAllRows(buildOffersQuery),
      ]);
      c = cRows;
      s = sRows;
      i = iRows;
      o = oRows;
    }
  }

  const stats = {
    totalCandidates: c.length,
    candidatesByStatus: {
      New: c.filter((x: any) => x.status === "New").length,
      "Ready For Assign": c.filter((x: any) => x.status === "Ready For Assign").length,
      "Ready For Marketing": c.filter((x: any) => x.status === "Ready For Marketing").length,
      "In Marketing": c.filter((x: any) => x.status === "In Marketing").length,
      Placed: c.filter((x: any) => x.status === "Placed").length,
      Backout: c.filter((x: any) => x.status === "Backout").length,
      "On Bench": c.filter((x: any) => x.status === "On Bench").length,
      "In Training": c.filter((x: any) => x.status === "In Training").length,
    },
    totalSubmissions: aggregatedSubmissionsTotal ?? s.length,
    totalAssessments: s.filter((x: any) => x.status === "Assessment").length,
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
  return applyCachedDashboardStats(
    stats,
    companyId,
    startISO ? new Date(startISO) : null,
    endISO ? new Date(endISO) : null
  );
}

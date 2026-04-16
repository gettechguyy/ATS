import { supabase } from "../../src/integrations/supabase/client";

/** Matches DB enum submission_status for type-safe .eq("status", ...) */
type SubmissionStatusFilter =
  | "Applied"
  | "Vendor Responded"
  | "Assessment"
  | "Screen Call"
  | "Interview"
  | "Rejected"
  | "Offered";

const SUBMISSIONS_SORT_COLUMNS = ["created_at", "client_name", "position", "status"] as const;

/** DB column for ORDER BY: case-insensitive A–Z for client names (see migration `*_sort` columns). */
function submissionOrderColumn(sortField: string): string {
  if (sortField === "client_name") return "client_name_sort";
  return sortField;
}

/** Allowed `sortBy` values for `fetchSpecialSubmissionsPage` (includes screen list columns). */
const SPECIAL_SUBMISSIONS_SORT_COLUMNS = [
  "created_at",
  "client_name",
  "position",
  "status",
  "screen_scheduled_at",
  "screen_mode",
  "candidate_first_name",
  "assessment_end_date",
] as const;

function applySpecialSubmissionsOrder(q: any, col: string, asc: boolean): any {
  // Use denormalized `candidate_first_name_sort` on submissions — PostgREST ordering by
  // `foreignTable: candidates` does not reliably order parent rows (see migration 20260416130000).
  if (col === "candidate_first_name") {
    return q.order("candidate_first_name_sort", { ascending: asc });
  }
  return q.order(submissionOrderColumn(col), { ascending: asc });
}

function compareMergedSpecialSubmissionRows(a: any, b: any, col: string): number {
  const str = (v: unknown) => (v == null ? "" : String(v));
  switch (col) {
    case "screen_scheduled_at":
    case "created_at": {
      const ta = new Date(a[col] ?? 0).getTime();
      const tb = new Date(b[col] ?? 0).getTime();
      return ta - tb;
    }
    case "assessment_end_date": {
      const da = str(a[col]);
      const db = str(b[col]);
      return da.localeCompare(db, undefined, { sensitivity: "base" });
    }
    case "client_name":
      return str(a.client_name_sort ?? a.client_name).localeCompare(str(b.client_name_sort ?? b.client_name), undefined, {
        sensitivity: "base",
      });
    case "position":
    case "status":
    case "screen_mode":
      return str(a[col]).localeCompare(str(b[col]), undefined, { sensitivity: "base" });
    case "candidate_first_name": {
      const na = str(a.candidate_first_name_sort ?? a.candidates?.first_name_sort ?? a.candidates?.first_name);
      const nb = str(b.candidate_first_name_sort ?? b.candidates?.first_name_sort ?? b.candidates?.first_name);
      return na.localeCompare(nb, undefined, { sensitivity: "base" });
    }
    default:
      return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
  }
}

/** PostgREST typically caps each response at ~1000 rows; batch `.range()` calls to load larger windows. */
const POSTGREST_MAX_ROWS = 1000;

async function fetchWithRangeBatched<T>(
  createQuery: () => any,
  from: number,
  to: number
): Promise<{ data: T[]; count: number | null }> {
  if (to < from) return { data: [], count: 0 };
  const span = to - from + 1;
  if (span <= POSTGREST_MAX_ROWS) {
    const { data, error, count } = await createQuery().range(from, to);
    if (error) throw error;
    return { data: (data as T[]) ?? [], count: count ?? null };
  }
  const all: T[] = [];
  let totalCount: number | null = null;
  for (let start = from; start <= to; start += POSTGREST_MAX_ROWS) {
    const end = Math.min(start + POSTGREST_MAX_ROWS - 1, to);
    const { data, error, count } = await createQuery().range(start, end);
    if (error) throw error;
    if (totalCount === null) totalCount = count ?? null;
    const chunk = (data as T[]) ?? [];
    all.push(...chunk);
    if (chunk.length === 0) break;
    if (chunk.length < end - start + 1) break;
  }
  return { data: all, count: totalCount };
}

/** Load every row for a query factory (no practical upper bound except DB size). */
async function fetchAllRowsForQuery(createQuery: () => any): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += POSTGREST_MAX_ROWS) {
    const { data, error } = await createQuery().range(from, from + POSTGREST_MAX_ROWS - 1);
    if (error) throw error;
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < POSTGREST_MAX_ROWS) break;
  }
  return rows;
}

function aggregateCountsByCandidate(rows: { candidate_id: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const id = r.candidate_id;
    if (!id) continue;
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}

async function candidateIdsMatchingNameSearch(term: string): Promise<string[]> {
  const safe = term.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
  if (!safe) return [];
  const t = `%${safe}%`;
  const rows = await fetchAllRowsForQuery(() =>
    supabase.from("candidates").select("id").or(`first_name.ilike.${t},last_name.ilike.${t}`)
  );
  return rows.map((r: any) => r.id).filter(Boolean);
}

function applySubmissionFiltersMinimal(
  q: any,
  opts: { status?: string; candidateId?: string | null; search?: string; nameCandidateIds?: string[] }
) {
  let x = q;
  if (opts.candidateId) x = x.eq("candidate_id", opts.candidateId);
  if (opts.status && opts.status !== "all") x = x.eq("status", opts.status as SubmissionStatusFilter);
  if (opts.search && opts.search.trim()) {
    const safe = opts.search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
    const term = `%${safe}%`;
    const parts = [`client_name.ilike.${term}`, `position.ilike.${term}`];
    const ids = opts.nameCandidateIds ?? [];
    if (ids.length) {
      const chunkSize = 150;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const slice = ids.slice(i, i + chunkSize);
        parts.push(`candidate_id.in.(${slice.join(",")})`);
      }
    }
    x = x.or(parts.join(","));
  }
  return x;
}

export type CandidateApplicationSummaryRow = {
  candidateId: string;
  candidateName: string;
  recruiterId: string | null;
  agencyId: string | null;
  applicationCount: number;
};

export type ApplicationSummariesContext =
  | { mode: "admin" }
  | { mode: "recruiter"; recruiterId: string }
  | { mode: "agency"; agencyId: string }
  | { mode: "team_lead"; teamLeadProfileId: string };

export type ApplicationSummariesOpts = {
  search?: string;
  status?: string;
  sortBy?: string;
  order?: "asc" | "desc";
  candidateId?: string | null;
};

/**
 * Count-only path for the Applications list: loads lightweight `candidate_id` rows (batched),
 * aggregates per candidate, then loads candidate display fields. Does not load full submission rows.
 */
export async function fetchCandidateApplicationSummaries(
  ctx: ApplicationSummariesContext,
  opts: ApplicationSummariesOpts = {}
): Promise<CandidateApplicationSummaryRow[]> {
  const { search, status, sortBy, order, candidateId } = opts;
  const rawCol = sortBy && SUBMISSIONS_SORT_COLUMNS.includes(sortBy as any) ? sortBy : "created_at";
  const orderCol = submissionOrderColumn(rawCol);
  const asc = order === "asc";

  let nameIds: string[] = [];
  if (search && search.trim()) {
    nameIds = await candidateIdsMatchingNameSearch(search);
  }

  const filterOpts = { status, candidateId: candidateId ?? undefined, search, nameCandidateIds: nameIds };

  let minimalRows: { candidate_id: string }[] = [];

  if (ctx.mode === "admin") {
    const createQuery = () => {
      let q = supabase.from("submissions").select("candidate_id").order(orderCol, { ascending: asc });
      return applySubmissionFiltersMinimal(q, filterOpts);
    };
    minimalRows = await fetchAllRowsForQuery(createQuery);
  } else if (ctx.mode === "recruiter") {
    minimalRows = await fetchAllRowsForQuery(() => {
      const inner = supabase
        .from("submissions")
        .select("candidate_id, candidates!inner(recruiter_id)")
        .eq("candidates.recruiter_id", ctx.recruiterId)
        .order(orderCol, { ascending: asc });
      return applySubmissionFiltersMinimal(inner, filterOpts);
    });
  } else if (ctx.mode === "agency") {
    const { data: candidateRows } = await supabase.from("candidates").select("id").eq("agency_id", ctx.agencyId);
    const allIds = (candidateRows || []).map((c: any) => c.id);
    if (allIds.length === 0) return [];
    const filterId =
      candidateId && allIds.includes(candidateId) ? candidateId : null;
    const idsToUse = filterId ? [filterId] : allIds;
    const createQuery = () => {
      let q = supabase.from("submissions").select("candidate_id").in("candidate_id", idsToUse).order(orderCol, { ascending: asc });
      return applySubmissionFiltersMinimal(q, { ...filterOpts, candidateId: filterId ?? undefined });
    };
    minimalRows = await fetchAllRowsForQuery(createQuery);
  } else {
    const tl = ctx.teamLeadProfileId;
    const candRes: any = await (supabase as any).from("candidates").select("id").eq("team_lead_id", tl);
    const tlCandidateIds = (candRes.data || []).map((r: any) => r.id);
    const recruiterRes: any = await (supabase as any).from("candidates").select("recruiter_id").eq("team_lead_id", tl);
    const recruiterIds = (recruiterRes.data || []).map((r: any) => r.recruiter_id).filter(Boolean);

    const run = async (builder: () => any) => fetchAllRowsForQuery(builder);
    let a: { id?: string; candidate_id: string }[] = [];
    let b: { id?: string; candidate_id: string }[] = [];
    if (tlCandidateIds.length) {
      a = await run(() => {
        let q = (supabase as any)
          .from("submissions")
          .select("id, candidate_id")
          .in("candidate_id", tlCandidateIds)
          .order(orderCol, { ascending: asc });
        return applySubmissionFiltersMinimal(q, filterOpts);
      });
    }
    if (recruiterIds.length) {
      b = await run(() => {
        let q = (supabase as any)
          .from("submissions")
          .select("id, candidate_id")
          .in("recruiter_id", recruiterIds)
          .order(orderCol, { ascending: asc });
        return applySubmissionFiltersMinimal(q, filterOpts);
      });
    }
    const seen = new Set<string>();
    const merged: { candidate_id: string }[] = [];
    for (const row of [...a, ...b]) {
      const sid = row.id;
      if (sid && seen.has(sid)) continue;
      if (sid) seen.add(sid);
      merged.push({ candidate_id: row.candidate_id });
    }
    minimalRows = merged;
  }

  const counts = aggregateCountsByCandidate(minimalRows);
  let candidateKeys = [...counts.keys()].filter((id) => (counts.get(id) ?? 0) > 0);
  if (candidateKeys.length === 0) return [];

  const metaRows: any[] = [];
  const chunkSize = 500;
  for (let i = 0; i < candidateKeys.length; i += chunkSize) {
    const slice = candidateKeys.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("candidates")
      .select("id, first_name, last_name, first_name_sort, last_name_sort, recruiter_id, agency_id")
      .in("id", slice);
    if (error) throw error;
    metaRows.push(...(data ?? []));
  }

  const rows: CandidateApplicationSummaryRow[] = metaRows.map((c: any) => ({
    candidateId: c.id,
    candidateName: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—",
    recruiterId: c.recruiter_id ?? null,
    agencyId: c.agency_id ?? null,
    applicationCount: counts.get(c.id) ?? 0,
  }));

  rows.sort((a, b) => {
    if (sortBy === "client_name" || sortBy === "position" || sortBy === "status") {
      return (a.candidateName || "").localeCompare(b.candidateName || "", undefined, { sensitivity: "base" });
    }
    if (order === "asc") return a.applicationCount - b.applicationCount;
    return b.applicationCount - a.applicationCount;
  });

  return rows;
}

/** Full submission rows for one candidate (sheet / detail); batched to avoid row caps. */
export async function fetchSubmissionsByCandidateWithDetails(
  candidateId: string,
  opts?: { status?: string; search?: string }
) {
  const status = opts?.status;
  const search = opts?.search;
  let nameIds: string[] = [];
  if (search && search.trim()) {
    nameIds = await candidateIdsMatchingNameSearch(search);
  }
  const createQuery = () => {
    let q = supabase
      .from("submissions")
      .select("*, candidates(first_name, last_name, first_name_sort, last_name_sort, email, recruiter_id, agency_id)")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });
    return applySubmissionFiltersMinimal(q, { status, search, nameCandidateIds: nameIds });
  };
  return fetchAllRowsForQuery(createQuery);
}

export async function fetchSubmissions() {
  const { data, error } = await supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, first_name_sort, last_name_sort, email, recruiter_id, agency_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Submissions created by / assigned to this recruiter. */
export async function fetchSubmissionsByRecruiter(recruiterId: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, first_name_sort, last_name_sort, email, recruiter_id, agency_id)")
    .eq("recruiter_id", recruiterId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchSubmissionById(id: string) {
  const { data, error } = await supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, first_name_sort, last_name_sort, email, recruiter_id, agency_id)")
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

export type SubmissionsPageOpts = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  sortBy?: string;
  order?: "asc" | "desc";
  candidateId?: string | null;
};

function buildSubmissionsQuery(recruiterId?: string, candidateId?: string, sortBy?: string, order?: "asc" | "desc") {
  const rawCol = sortBy && SUBMISSIONS_SORT_COLUMNS.includes(sortBy as any) ? sortBy : "created_at";
  const col = submissionOrderColumn(rawCol);
  const asc = order === "asc";
  let q = supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, first_name_sort, last_name_sort, email, recruiter_id, agency_id)", { count: "exact" })
    .order(col, { ascending: asc });
  if (recruiterId) q = q.eq("recruiter_id", recruiterId);
  if (candidateId) q = q.eq("candidate_id", candidateId);
  return q;
}

/** Server-side paginated submissions. Optional search, status, sort, candidateId. */
export async function fetchSubmissionsPaginated(opts: SubmissionsPageOpts) {
  const { page, pageSize, search, status, sortBy, order, candidateId } = opts;
  const createQuery = () => {
    let q = buildSubmissionsQuery(undefined, candidateId ?? undefined, sortBy, order);
    if (status && status !== "all") q = q.eq("status", status as SubmissionStatusFilter);
    if (search && search.trim()) {
      const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
      const term = `%${safe}%`;
      q = q.or(`client_name.ilike.${term},position.ilike.${term}`);
    }
    return q;
  };
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count } = await fetchWithRangeBatched(createQuery, from, to);
  return { data: data ?? [], total: count ?? 0 };
}

export async function fetchSubmissionsByRecruiterPaginated(recruiterId: string, opts: SubmissionsPageOpts) {
  const { page, pageSize, search, status, sortBy, order, candidateId } = opts;
  const createQuery = () => {
    let q = buildSubmissionsQuery(recruiterId, candidateId ?? undefined, sortBy, order);
    if (status && status !== "all") q = q.eq("status", status as SubmissionStatusFilter);
    if (search && search.trim()) {
      const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
      const term = `%${safe}%`;
      q = q.or(`client_name.ilike.${term},position.ilike.${term}`);
    }
    return q;
  };
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count } = await fetchWithRangeBatched(createQuery, from, to);
  return { data: data ?? [], total: count ?? 0 };
}

/** Paginated submissions for all candidates currently assigned to this recruiter (candidates.recruiter_id = recruiterId). */
export async function fetchSubmissionsForRecruiterCandidatesPaginated(recruiterId: string, opts: SubmissionsPageOpts) {
  const { page, pageSize, search, status, sortBy, order, candidateId } = opts;
  const rawCol = sortBy && SUBMISSIONS_SORT_COLUMNS.includes(sortBy as any) ? sortBy : "created_at";
  const col = submissionOrderColumn(rawCol);
  const asc = order === "asc";
  const createQuery = () => {
    let q = supabase
      .from("submissions")
      .select("*, candidates!inner(first_name, last_name, first_name_sort, last_name_sort, email, recruiter_id, agency_id)", { count: "exact" })
      .eq("candidates.recruiter_id", recruiterId)
      .order(col, { ascending: asc });

    if (candidateId) q = q.eq("candidate_id", candidateId);
    if (status && status !== "all") q = q.eq("status", status as SubmissionStatusFilter);
    if (search && search.trim()) {
      const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
      const term = `%${safe}%`;
      q = q.or(`client_name.ilike.${term},position.ilike.${term}`);
    }
    return q;
  };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count } = await fetchWithRangeBatched(createQuery, from, to);
  return { data: data ?? [], total: count ?? 0 };
}

export async function fetchSubmissionsByCandidatePaginated(candidateId: string, opts: SubmissionsPageOpts) {
  const { page, pageSize, search, status, sortBy, order } = opts;
  const createQuery = () => {
    let q = buildSubmissionsQuery(undefined, candidateId, sortBy, order);
    if (status && status !== "all") q = q.eq("status", status as SubmissionStatusFilter);
    if (search && search.trim()) {
      const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
      const term = `%${safe}%`;
      q = q.or(`client_name.ilike.${term},position.ilike.${term}`);
    }
    return q;
  };
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count } = await fetchWithRangeBatched(createQuery, from, to);
  return { data: data ?? [], total: count ?? 0 };
}

/** Client/position ILIKE plus candidate name matches (batched ID lookup). */
async function buildSearchOrClause(search?: string): Promise<string | null> {
  if (!search?.trim()) return null;
  const nameIds = await candidateIdsMatchingNameSearch(search);
  const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
  const term = `%${safe}%`;
  const parts = [`client_name.ilike.${term}`, `position.ilike.${term}`];
  for (let i = 0; i < nameIds.length; i += 150) {
    parts.push(`candidate_id.in.(${nameIds.slice(i, i + 150).join(",")})`);
  }
  return parts.join(",");
}

export type SpecialSubmissionsKind = "vendor_responded" | "screen_call" | "assessment";

export type SpecialSubmissionsRoleContext =
  | { role: "admin" }
  | { role: "recruiter"; recruiterId: string }
  | { role: "agency"; agencyId: string }
  | { role: "team_lead"; teamLeadProfileId: string }
  | { role: "candidate"; linkedCandidateId: string };

/**
 * Server-paginated special lists (no full-table fetch).
 * - vendor_responded: Vendor Responded OR Assessment OR Screen Call OR scheduled screen (screen_scheduled_at set).
 * - screen_call: Screen Call OR scheduled screen (same rows as the Screens page).
 * - assessment: status Assessment only (Assessments page).
 *
 * Sorting uses `.order()` before `.range()` so pages reflect global order (not client-sorted slices).
 * Team-lead path merges two queries then sorts in memory by the same column before slicing to the page.
 */
export async function fetchSpecialSubmissionsPage(
  kind: SpecialSubmissionsKind,
  ctx: SpecialSubmissionsRoleContext,
  opts: SubmissionsPageOpts
): Promise<{ data: any[]; total: number }> {
  const { page, pageSize, search, sortBy, order, candidateId } = opts;
  const defaultSort =
    kind === "screen_call"
      ? "screen_scheduled_at"
      : kind === "assessment"
        ? "assessment_end_date"
        : "created_at";
  const col =
    sortBy && SPECIAL_SUBMISSIONS_SORT_COLUMNS.includes(sortBy as any) ? sortBy : defaultSort;
  const asc = order === "asc";
  const searchOr = await buildSearchOrClause(search);

  /** Submissions page: vendor work + assessment + anything that counts as a screen call. */
  const vendorPlusScreenOr =
    'status.eq."Vendor Responded",status.eq."Assessment",status.eq."Screen Call",screen_scheduled_at.not.is.null';

  const applyKindFilter = (q: any) => {
    if (kind === "vendor_responded") {
      return q.or(vendorPlusScreenOr);
    }
    if (kind === "assessment") {
      return q.eq("status", "Assessment");
    }
    return q.or('status.eq."Screen Call",screen_scheduled_at.not.is.null');
  };

  const mergeTeamLeadRows = async (buildFiltered: (q: any) => any) => {
    const tl = (ctx as { role: "team_lead"; teamLeadProfileId: string }).teamLeadProfileId;
    const candRes: any = await (supabase as any).from("candidates").select("id").eq("team_lead_id", tl);
    const tlCandidateIds = (candRes.data || []).map((r: any) => r.id);
    const recruiterRes: any = await (supabase as any).from("candidates").select("recruiter_id").eq("team_lead_id", tl);
    const recruiterIds = (recruiterRes.data || []).map((r: any) => r.recruiter_id).filter(Boolean);

    const run = (inCol: "candidate_id" | "recruiter_id", ids: string[]) => {
      if (!ids.length) return Promise.resolve([] as any[]);
      return fetchAllRowsForQuery(() => {
        let q = supabase
          .from("submissions")
          .select("*, candidates(first_name, last_name, first_name_sort, last_name_sort, email, team_lead_id, recruiter_id, agency_id)")
          .in(inCol, ids);
        q = applySpecialSubmissionsOrder(q, col, asc);
        q = buildFiltered(q);
        return q;
      });
    };

    const [a, b] = await Promise.all([run("candidate_id", tlCandidateIds), run("recruiter_id", recruiterIds)]);
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const s of [...a, ...b]) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      merged.push(s);
    }
    merged.sort((x, y) => {
      const c = compareMergedSpecialSubmissionRows(x, y, col);
      return asc ? c : -c;
    });
    if (candidateId) {
      const f = merged.filter((s) => s.candidate_id === candidateId);
      const total = f.length;
      const from = (page - 1) * pageSize;
      return { data: f.slice(from, from + pageSize), total };
    }
    const total = merged.length;
    const from = (page - 1) * pageSize;
    return { data: merged.slice(from, from + pageSize), total };
  };

  if (ctx.role === "team_lead") {
    return mergeTeamLeadRows((q) => {
      let x = applyKindFilter(q);
      if (searchOr) x = x.or(searchOr);
      return x;
    });
  }

  if (ctx.role === "admin") {
    const createQuery = () => {
      let q = supabase
        .from("submissions")
        .select("*, candidates(first_name, last_name, first_name_sort, last_name_sort, email, recruiter_id, agency_id)", { count: "exact" });
      q = applySpecialSubmissionsOrder(q, col, asc);
      q = applyKindFilter(q);
      if (candidateId) q = q.eq("candidate_id", candidateId);
      if (searchOr) q = q.or(searchOr);
      return q;
    };
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count } = await fetchWithRangeBatched(createQuery, from, to);
    return { data: data ?? [], total: count ?? 0 };
  }

  if (ctx.role === "recruiter") {
    const createQuery = () => {
      let q = supabase
        .from("submissions")
        .select("*, candidates!inner(first_name, last_name, first_name_sort, last_name_sort, email, recruiter_id, agency_id)", { count: "exact" })
        .eq("candidates.recruiter_id", ctx.recruiterId);
      q = applySpecialSubmissionsOrder(q, col, asc);
      q = applyKindFilter(q);
      if (candidateId) q = q.eq("candidate_id", candidateId);
      if (searchOr) q = q.or(searchOr);
      return q;
    };
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count } = await fetchWithRangeBatched(createQuery, from, to);
    return { data: data ?? [], total: count ?? 0 };
  }

  if (ctx.role === "agency") {
    const { data: candidateRows } = await supabase.from("candidates").select("id").eq("agency_id", ctx.agencyId);
    const allIds = (candidateRows || []).map((c: any) => c.id);
    if (allIds.length === 0) return { data: [], total: 0 };
    const idsToUse = candidateId && allIds.includes(candidateId) ? [candidateId] : allIds;
    const createQuery = () => {
      let q = supabase
        .from("submissions")
        .select("*, candidates(first_name, last_name, first_name_sort, last_name_sort, email, recruiter_id, agency_id)", { count: "exact" })
        .in("candidate_id", idsToUse);
      q = applySpecialSubmissionsOrder(q, col, asc);
      q = applyKindFilter(q);
      if (searchOr) q = q.or(searchOr);
      return q;
    };
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count } = await fetchWithRangeBatched(createQuery, from, to);
    return { data: data ?? [], total: count ?? 0 };
  }

  const createQuery = () => {
    let q = supabase
      .from("submissions")
      .select("*, candidates(first_name, last_name, first_name_sort, last_name_sort, email, recruiter_id, agency_id)", { count: "exact" })
      .eq("candidate_id", ctx.linkedCandidateId);
    q = applySpecialSubmissionsOrder(q, col, asc);
    q = applyKindFilter(q);
    if (searchOr) q = q.or(searchOr);
    return q;
  };
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count } = await fetchWithRangeBatched(createQuery, from, to);
  return { data: data ?? [], total: count ?? 0 };
}

/** All submissions whose candidate is assigned to this agency (e.g. for Screens). */
export async function fetchSubmissionsByAgency(agencyId: string) {
  const { data: candidateRows } = await supabase.from("candidates").select("id").eq("agency_id", agencyId);
  const candidateIds = (candidateRows || []).map((c: any) => c.id);
  if (candidateIds.length === 0) return [];
  const { data, error } = await supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, first_name_sort, last_name_sort, email, recruiter_id, agency_id)")
    .in("candidate_id", candidateIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Submissions for an agency: only submissions whose candidate is assigned to this agency. Optional candidateId filter. */
export async function fetchSubmissionsByAgencyPaginated(agencyId: string, opts: SubmissionsPageOpts) {
  const { data: candidateRows } = await supabase.from("candidates").select("id").eq("agency_id", agencyId);
  const candidateIds = (candidateRows || []).map((c: any) => c.id);
  if (candidateIds.length === 0) return { data: [], total: 0 };
  const { page, pageSize, search, status, sortBy, order, candidateId: filterCandidateId } = opts;
  const rawCol = sortBy && SUBMISSIONS_SORT_COLUMNS.includes(sortBy as any) ? sortBy : "created_at";
  const col = submissionOrderColumn(rawCol);
  const asc = order === "asc";
  const idsToUse = filterCandidateId && candidateIds.includes(filterCandidateId) ? [filterCandidateId] : candidateIds;
  const createQuery = () => {
    let q = supabase
      .from("submissions")
      .select("*, candidates(first_name, last_name, first_name_sort, last_name_sort, email, recruiter_id, agency_id)", { count: "exact" })
      .in("candidate_id", idsToUse)
      .order(col, { ascending: asc });
    if (status && status !== "all") q = q.eq("status", status as SubmissionStatusFilter);
    if (search && search.trim()) {
      const safe = search.trim().replace(/[%_\\]/g, "\\$&").replace(/,/g, " ");
      const term = `%${safe}%`;
      q = q.or(`client_name.ilike.${term},position.ilike.${term}`);
    }
    return q;
  };
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count } = await fetchWithRangeBatched(createQuery, from, to);
  return { data: data ?? [], total: count ?? 0 };
}

/** Submissions for a Team Lead:
 *  - any submission whose candidate.team_lead_id = teamLeadProfileId
 *  - OR any submission whose recruiter_id is assigned to any candidate of the team lead
 */
export async function fetchSubmissionsByTeamLead(teamLeadProfileId: string) {
  // select submissions where candidate has team_lead_id = teamLeadProfileId
  const { data, error } = await supabase
    .from("submissions")
    .select("*, candidates(first_name, last_name, first_name_sort, last_name_sort, email, team_lead_id, recruiter_id, agency_id)")
    .or(`candidate_id.in.(select id from candidates where team_lead_id.eq.${teamLeadProfileId}),recruiter_id.in.(select recruiter_id from candidates where team_lead_id.eq.${teamLeadProfileId})`)
    .order("created_at", { ascending: false });
  // Fallback: if supabase does not support subqueries in .or, run two queries and merge
  if (error) {
    // Fetch candidate IDs for the team lead first to avoid complex nested type inference
    const candRes: any = await (supabase as any).from("candidates").select("id").eq("team_lead_id", teamLeadProfileId);
    const candidateIds = (candRes.data || []).map((r: any) => r.id);

    const byCandidate: any = await (supabase as any)
      .from("submissions")
      .select("*, candidates(first_name, last_name, first_name_sort, last_name_sort, email, team_lead_id, recruiter_id, agency_id)")
      .in("candidate_id", candidateIds.length ? candidateIds : []);

    const recruiterRes: any = await (supabase as any).from("candidates").select("recruiter_id").eq("team_lead_id", teamLeadProfileId);
    const recruiterIds = (recruiterRes.data || []).map((r: any) => r.recruiter_id).filter(Boolean);

    const byRecruiter: any = await (supabase as any)
      .from("submissions")
      .select("*, candidates(first_name, last_name, first_name_sort, last_name_sort, email, team_lead_id, recruiter_id, agency_id)")
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
  rate?: number | null;
  rate_type?: string | null;
  job_description?: string | null;
  job_type?: string | null;
  city?: string | null;
  state?: string | null;
}): Promise<{ id: string } | void> {
  const insertObj: Record<string, any> = {
    candidate_id: submission.candidate_id,
    recruiter_id: submission.recruiter_id,
    client_name: submission.client_name,
    position: submission.position,
    status: (submission.status || "Applied") as any,
  };
  if (submission.job_link !== undefined) insertObj.job_link = submission.job_link;
  if (submission.job_portal !== undefined) insertObj.job_portal = submission.job_portal;
   // Optional Vendor Responded details when creating directly in that status
  if (submission.rate !== undefined) insertObj.rate = submission.rate;
  if (submission.rate_type !== undefined) insertObj.rate_type = submission.rate_type;
  if (submission.job_description !== undefined) insertObj.job_description = submission.job_description;
  if (submission.job_type !== undefined) insertObj.job_type = submission.job_type;
  if (submission.city !== undefined) insertObj.city = submission.city;
  if (submission.state !== undefined) insertObj.state = submission.state;

  const { data, error } = await supabase.from("submissions").insert(insertObj as any).select("id").single();
  if (error) throw error;

  const { count } = await supabase.from("submissions").select("id", { count: "exact", head: true }).eq("candidate_id", submission.candidate_id);
  if (count === 1) {
    await supabase.from("candidates").update({ status: "In Marketing" as any }).eq("id", submission.candidate_id);
  }
  return data as { id: string };
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

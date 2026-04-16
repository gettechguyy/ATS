import { supabase } from "../../src/integrations/supabase/client";

export async function fetchAllOffers() {
  const { data, error } = await supabase
    .from("offers")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))")
    .order("offered_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Offers for the given candidate (for candidate role). */
export async function fetchOffersByCandidate(candidateId: string) {
  const { data, error } = await supabase
    .from("offers")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))")
    .eq("candidate_id", candidateId)
    .order("offered_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Offers created by this recruiter (uses created_by for fast fetch). */
export async function fetchOffersByRecruiter(recruiterId: string) {
  const { data, error } = await supabase
    .from("offers")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))")
    .eq("created_by", recruiterId)
    .order("offered_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

const OFFERS_SORT_COLUMNS = [
  "offered_at",
  "salary",
  "tentative_start_date",
  "created_at",
  "status",
  "submission_client_name",
  "submission_position",
] as const;
export type OffersPageOpts = { page: number; pageSize: number; sortBy?: string; order?: "asc" | "desc" };

function resolveOffersSortColumn(sortBy?: string): string {
  return sortBy && OFFERS_SORT_COLUMNS.includes(sortBy as any) ? sortBy : "offered_at";
}

function applyOffersOrder(q: any, column: string, ascending: boolean): any {
  if (column === "submission_client_name") {
    return q.order("client_name_sort", { ascending, foreignTable: "submissions" });
  }
  if (column === "submission_position") {
    return q.order("position", { ascending, foreignTable: "submissions" });
  }
  return q.order(column, { ascending });
}

export async function fetchAllOffersPaginated(opts: OffersPageOpts) {
  const { page, pageSize, sortBy, order } = opts;
  const column = resolveOffersSortColumn(sortBy);
  const ascending = order === "asc";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let q = supabase
    .from("offers")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))", { count: "exact" });
  q = applyOffersOrder(q, column, ascending);
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

export async function fetchOffersByCandidatePaginated(candidateId: string, opts: OffersPageOpts) {
  const { page, pageSize, sortBy, order } = opts;
  const column = resolveOffersSortColumn(sortBy);
  const ascending = order === "asc";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let q = supabase
    .from("offers")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))", { count: "exact" })
    .eq("candidate_id", candidateId);
  q = applyOffersOrder(q, column, ascending);
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

/** Recruiter offers: filter by created_by only (no submission_id list). Requires offers.created_by column. */
export async function fetchOffersByRecruiterPaginated(recruiterId: string, opts: OffersPageOpts) {
  const { page, pageSize, sortBy, order } = opts;
  const column = resolveOffersSortColumn(sortBy);
  const ascending = order === "asc";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let q = supabase
    .from("offers")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))", { count: "exact" })
    .eq("created_by", recruiterId);
  q = applyOffersOrder(q, column, ascending);
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}

/** Offers for submissions whose candidate is assigned to this agency. Uses created_by to avoid long submission_id lists. */
export async function fetchOffersByAgencyPaginated(agencyId: string, opts: OffersPageOpts) {
  const { data: candidateRows } = await supabase.from("candidates").select("id").eq("agency_id", agencyId);
  const candidateIds = (candidateRows || []).map((c: { id: string }) => c.id);
  if (candidateIds.length === 0) return { data: [], total: 0 };
  const { data: subs } = await supabase.from("submissions").select("id, recruiter_id").in("candidate_id", candidateIds);
  const submissionIds = (subs || []).map((x: { id: string }) => x.id);
  if (submissionIds.length === 0) return { data: [], total: 0 };
  const recruiterIds = [...new Set((subs || []).map((x: { recruiter_id: string | null }) => x.recruiter_id).filter(Boolean))] as string[];
  const submissionIdSet = new Set(submissionIds);
  const { page, pageSize, sortBy, order } = opts;
  const column = resolveOffersSortColumn(sortBy);
  const ascending = order === "asc";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  if (recruiterIds.length === 0) {
    let q = supabase
      .from("offers")
      .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))", { count: "exact" })
      .in("submission_id", submissionIds);
    q = applyOffersOrder(q, column, ascending);
    const { data, error, count } = await q.range(from, to);
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }
  let q = supabase
    .from("offers")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))")
    .in("created_by", recruiterIds);
  q = applyOffersOrder(q, column, ascending);
  const { data: rawData, error } = await q;
  if (error) throw error;
  const filtered = (rawData ?? []).filter((o: any) => submissionIdSet.has(o.submission_id));
  const total = filtered.length;
  const data = filtered.slice(from, to + 1);
  return { data, total };
}

export async function fetchOffersBySubmission(submissionId: string) {
  const { data } = await supabase
    .from("offers")
    .select("*")
    .eq("submission_id", submissionId)
    .order("offered_at", { ascending: false });
  return data || [];
}

export async function createOffer(offer: {
  submission_id: string;
  candidate_id: string;
  created_by: string | null;
  salary: number;
  job_description?: string | null;
  job_description_url?: string | null;
  tentative_start_date?: string | null;
  additional_notes?: string | null;
}) {
  const { error } = await supabase.from("offers").insert({
    submission_id: offer.submission_id,
    candidate_id: offer.candidate_id,
    created_by: offer.created_by ?? null,
    salary: offer.salary,
    status: "Pending" as any,
    job_description: offer.job_description ?? null,
    job_description_url: offer.job_description_url ?? null,
    tentative_start_date: offer.tentative_start_date ?? null,
    additional_notes: offer.additional_notes ?? null,
  });
  if (error) throw error;
}

export async function updateOfferStatus(offerId: string, status: string) {
  const { error } = await supabase
    .from("offers")
    .update({ status: status as any })
    .eq("id", offerId);
  if (error) throw error;
}

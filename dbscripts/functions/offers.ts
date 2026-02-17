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

/** Offers for submissions created by this recruiter. */
export async function fetchOffersByRecruiter(recruiterId: string) {
  const { data: subs } = await supabase.from("submissions").select("id").eq("recruiter_id", recruiterId);
  const ids = (subs || []).map((x: { id: string }) => x.id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("offers")
    .select("*, submissions(id, client_name, position, recruiter_id, candidates(first_name, last_name))")
    .in("submission_id", ids)
    .order("offered_at", { ascending: false });
  if (error) throw error;
  return data;
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
  salary: number;
  job_description?: string | null;
  job_description_url?: string | null;
  tentative_start_date?: string | null;
  additional_notes?: string | null;
}) {
  const { error } = await supabase.from("offers").insert({
    submission_id: offer.submission_id,
    candidate_id: offer.candidate_id,
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

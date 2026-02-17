import { supabase, STORAGE_BUCKET } from "../../src/integrations/supabase/client";

/** Upload path: candidate resume/<candidate_id>/<filename> for clean bucket structure */
export async function uploadResume(candidateId: string, file: File) {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `candidate resume/${candidateId}/${Date.now()}.${ext}`;

  if (!STORAGE_BUCKET) throw new Error("STORAGE_BUCKET is not configured. Set VITE_SUPABASE_BUCKET in your .env and restart the dev server.");
  // quick existence check for clearer error message
  const { error: listErr } = await supabase.storage.from(STORAGE_BUCKET).list("", { limit: 1 });
  if (listErr && /Bucket not found/i.test(listErr.message || "")) {
    throw new Error(`Bucket "${STORAGE_BUCKET}" not found. Make sure the bucket exists in Supabase and VITE_SUPABASE_BUCKET matches the bucket name.`);
  }

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

/** Upload candidate document to candidateDetails/<candidateId>/<folder>/<filename> */
export async function uploadCandidateDocument(candidateId: string, file: File, folder = "id") {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `candidateDetails/${candidateId}/${folder}/${Date.now()}.${ext}`;

  if (!STORAGE_BUCKET) throw new Error("STORAGE_BUCKET is not configured. Set VITE_SUPABASE_BUCKET in your .env and restart the dev server.");
  const { error: listErr } = await supabase.storage.from(STORAGE_BUCKET).list("", { limit: 1 });
  if (listErr && /Bucket not found/i.test(listErr.message || "")) {
    throw new Error(`Bucket "${STORAGE_BUCKET}" not found. Make sure the bucket exists in Supabase and VITE_SUPABASE_BUCKET matches the bucket name.`);
  }

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

/** Upload path: screencallresume/<submission_id>/<filename> */
export async function uploadScreenCallFile(submissionId: string, file: File, folder = "resume") {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `screencall${folder === "questions" ? "/questions" : "/resume"}/${submissionId}/${Date.now()}.${ext}`;

  if (!STORAGE_BUCKET) throw new Error("STORAGE_BUCKET is not configured. Set VITE_SUPABASE_BUCKET in your .env and restart the dev server.");
  const { error: listErr } = await supabase.storage.from(STORAGE_BUCKET).list("", { limit: 1 });
  if (listErr && /Bucket not found/i.test(listErr.message || "")) {
    throw new Error(`Bucket "${STORAGE_BUCKET}" not found. Make sure the bucket exists in Supabase and VITE_SUPABASE_BUCKET matches the bucket name.`);
  }

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

/** Upload path: offers/<submission_id>/<filename> */
export async function uploadOfferFile(submissionId: string, file: File) {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `offers/${submissionId}/${Date.now()}.${ext}`;

  if (!STORAGE_BUCKET) throw new Error("STORAGE_BUCKET is not configured. Set VITE_SUPABASE_BUCKET in your .env and restart the dev server.");
  const { error: listErr } = await supabase.storage.from(STORAGE_BUCKET).list("", { limit: 1 });
  if (listErr && /Bucket not found/i.test(listErr.message || "")) {
    throw new Error(`Bucket "${STORAGE_BUCKET}" not found. Make sure the bucket exists in Supabase and VITE_SUPABASE_BUCKET matches the bucket name.`);
  }

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

/** Upload path: vendor/job_description/<submission_id>/<filename> */
export async function uploadVendorJobDescription(submissionId: string, file: File) {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `vendor/job_description/${submissionId}/${Date.now()}.${ext}`;

  if (!STORAGE_BUCKET) throw new Error("STORAGE_BUCKET is not configured. Set VITE_SUPABASE_BUCKET in your .env and restart the dev server.");
  const { error: listErr } = await supabase.storage.from(STORAGE_BUCKET).list("", { limit: 1 });
  if (listErr && /Bucket not found/i.test(listErr.message || "")) {
    throw new Error(`Bucket "${STORAGE_BUCKET}" not found. Make sure the bucket exists in Supabase and VITE_SUPABASE_BUCKET matches the bucket name.`);
  }

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

/** Upload path: interview/interview_questions/<submission_id>/<filename> */
export async function uploadInterviewQuestions(submissionId: string, file: File) {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `interview/interview_questions/${submissionId}/${Date.now()}.${ext}`;

  if (!STORAGE_BUCKET) throw new Error("STORAGE_BUCKET is not configured. Set VITE_SUPABASE_BUCKET in your .env and restart the dev server.");
  const { error: listErr } = await supabase.storage.from(STORAGE_BUCKET).list("", { limit: 1 });
  if (listErr && /Bucket not found/i.test(listErr.message || "")) {
    throw new Error(`Bucket "${STORAGE_BUCKET}" not found. Make sure the bucket exists in Supabase and VITE_SUPABASE_BUCKET matches the bucket name.`);
  }

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

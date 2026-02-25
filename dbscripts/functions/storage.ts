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

/** Upload cover letter: candidateDetails/<candidate_id>/cover_letter/<filename> */
export async function uploadCoverLetter(candidateId: string, file: File) {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `candidateDetails/${candidateId}/cover_letter/${Date.now()}.${ext}`;

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

/** Delete all resume files for a candidate and return number deleted */
export async function deleteCandidateResumes(candidateId: string) {
  if (!STORAGE_BUCKET) throw new Error("STORAGE_BUCKET is not configured.");
  const prefix = `candidate resume/${candidateId}/`;
  const { data: list, error: listErr } = await supabase.storage.from(STORAGE_BUCKET).list(`candidate resume/${candidateId}`, { limit: 1000 });
  if (listErr) throw listErr;
  if (!list || list.length === 0) return 0;
  const paths = list.map((f: any) => `${prefix}${f.name}`);
  const { error: delErr } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  if (delErr) throw delErr;
  return paths.length;
}

/** Delete all cover letter files for a candidate and return number deleted */
export async function deleteCandidateCoverLetters(candidateId: string) {
  if (!STORAGE_BUCKET) throw new Error("STORAGE_BUCKET is not configured.");
  const folder = `candidateDetails/${candidateId}/cover_letter`;
  const prefix = `${folder}/`;
  const { data: list, error: listErr } = await supabase.storage.from(STORAGE_BUCKET).list(folder, { limit: 1000 });
  if (listErr) throw listErr;
  if (!list || list.length === 0) return 0;
  const paths = list.map((f: any) => `${prefix}${f.name}`);
  const { error: delErr } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  if (delErr) throw delErr;
  return paths.length;
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

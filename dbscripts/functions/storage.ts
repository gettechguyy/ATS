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

/** Upload path: assessment/<submission_id>/<filename> */
export async function uploadAssessmentAttachment(submissionId: string, file: File) {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `assessment/${submissionId}/${Date.now()}.${ext}`;

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

const LOGO_IMAGE_RE = /\.(png|jpe?g|webp|svg)$/i;

/** Public URL for a known logo object path */
export function getTenantLogoPublicUrl(objectPath: string): string {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

const LOGO_FILE_CANDIDATES = ["logo.png", "logo.webp", "logo.jpg", "logo.jpeg", "logo.svg"];

async function probeLogoUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Find logo file under logo/{tenantId}/ and return its public URL */
export async function resolveTenantLogoFromStorage(tenantId: string): Promise<string | null> {
  if (!STORAGE_BUCKET || !tenantId) return null;
  const folder = `logo/${tenantId}`;

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(folder, { limit: 20 });
  if (!error && data?.length) {
    const file = data.find((f) => f.name && LOGO_IMAGE_RE.test(f.name));
    if (file?.name) {
      const url = getTenantLogoPublicUrl(`${folder}/${file.name}`);
      if (await probeLogoUrl(url)) return url;
    }
  }

  for (const name of LOGO_FILE_CANDIDATES) {
    const url = getTenantLogoPublicUrl(`${folder}/${name}`);
    if (await probeLogoUrl(url)) return url;
  }

  return null;
}

/** Delete all logo files under logo/{tenantId}/ */
export async function deleteTenantLogoFromStorage(tenantId: string): Promise<number> {
  if (!STORAGE_BUCKET) {
    throw new Error(
      "STORAGE_BUCKET is not configured. Set VITE_SUPABASE_BUCKET in your .env and restart the dev server."
    );
  }
  if (!tenantId) return 0;

  const folder = `logo/${tenantId}`;
  const prefix = `${folder}/`;
  const paths = new Set<string>();

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(folder, { limit: 100 });
  if (!error && data?.length) {
    for (const f of data) {
      if (f.name) paths.add(`${prefix}${f.name}`);
    }
  }

  for (const name of LOGO_FILE_CANDIDATES) {
    paths.add(`${prefix}${name}`);
  }

  if (paths.size === 0) return 0;

  const { data: removed, error: delErr } = await supabase.storage.from(STORAGE_BUCKET).remove([...paths]);
  if (delErr) {
    throw new Error(
      `${delErr.message} — run supabase/migrations/20260520140000_tenant_logo_delete_policy.sql if delete is blocked.`
    );
  }

  return (removed ?? []).length;
}

/** Upload tenant logo to logo/{tenantId}/logo.<ext> (company or agency id) */
export async function uploadTenantLogo(tenantId: string, file: File) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const safeExt = ["png", "jpg", "jpeg", "webp", "svg"].includes(ext) ? ext : "png";
  const path = `logo/${tenantId}/logo.${safeExt}`;

  if (!STORAGE_BUCKET) {
    throw new Error(
      "STORAGE_BUCKET is not configured. Set VITE_SUPABASE_BUCKET in your .env and restart the dev server."
    );
  }
  const { error: listErr } = await supabase.storage.from(STORAGE_BUCKET).list("", { limit: 1 });
  if (listErr && /Bucket not found/i.test(listErr.message || "")) {
    throw new Error(
      `Bucket "${STORAGE_BUCKET}" not found. Make sure the bucket exists in Supabase and VITE_SUPABASE_BUCKET matches the bucket name.`
    );
  }

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (uploadError) throw uploadError;

  return getTenantLogoPublicUrl(path);
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

import { supabase } from "../../src/integrations/supabase/client";

export async function uploadResume(candidateId: string, file: File) {
  const ext = file.name.split(".").pop();
  const path = `resumes/${candidateId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
  return urlData.publicUrl;
}

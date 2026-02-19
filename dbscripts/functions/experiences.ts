import { supabase } from "../../src/integrations/supabase/client";

export async function fetchExperiencesByCandidate(candidateId: string) {
  const { data, error } = await supabase
    .from("candidate_experiences")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createExperience(exp: {
  candidate_id: string;
  company?: string | null;
  role?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  current?: boolean;
  technologies?: string | null;
  responsibilities?: string | null;
}) {
  const { error } = await supabase.from("candidate_experiences").insert({
    candidate_id: exp.candidate_id,
    company: exp.company ?? null,
    role: exp.role ?? null,
    start_date: exp.start_date ?? null,
    end_date: exp.end_date ?? null,
    current: exp.current ?? false,
    technologies: exp.technologies ?? null,
    responsibilities: exp.responsibilities ?? null,
  });
  if (error) throw error;
}

export async function deleteExperience(id: string) {
  const { error } = await supabase.from("candidate_experiences").delete().eq("id", id);
  if (error) throw error;
}


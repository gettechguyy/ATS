import { supabase } from "../../src/integrations/supabase/client";

export async function fetchEducationsByCandidate(candidateId: string) {
  const { data, error } = await supabase
    .from("candidate_educations")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createEducation(ed: {
  candidate_id: string;
  degree?: string | null;
  institution?: string | null;
  field_of_study?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  graduation_year?: string | null;
  notes?: string | null;
}) {
  const { error } = await supabase.from("candidate_educations").insert({
    candidate_id: ed.candidate_id,
    degree: ed.degree ?? null,
    institution: ed.institution ?? null,
    field_of_study: ed.field_of_study ?? null,
    start_date: ed.start_date ?? null,
    end_date: ed.end_date ?? null,
    graduation_year: ed.graduation_year ?? null,
    notes: ed.notes ?? null,
  });
  if (error) throw error;
}

export async function deleteEducation(id: string) {
  const { error } = await supabase.from("candidate_educations").delete().eq("id", id);
  if (error) throw error;
}


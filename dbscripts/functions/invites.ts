import { supabase } from "../../src/integrations/supabase/client";

export async function createInvite(invite: {
  token: string;
  email: string;
  full_name: string;
  role: string;
  created_by: string;
  company_id: string;
  candidate_id?: string | null;
}) {
  const { error } = await supabase.from("invites").insert({
    token: invite.token,
    email: invite.email,
    full_name: invite.full_name,
    role: invite.role,
    created_by: invite.created_by,
    company_id: invite.company_id,
    ...(invite.candidate_id != null && { candidate_id: invite.candidate_id }),
  });
  if (error) throw error;
}

const INVITES_SORT_COLUMNS = ["email", "full_name", "used", "created_at"] as const;

export type FetchInvitesOpts = {
  sortBy?: (typeof INVITES_SORT_COLUMNS)[number];
  order?: "asc" | "desc";
};

/** Full list (Invites page has no pagination); sorting is applied in Postgres, not in the browser. */
export async function fetchInvites(companyId: string, opts?: FetchInvitesOpts) {
  const raw =
    opts?.sortBy && INVITES_SORT_COLUMNS.includes(opts.sortBy) ? opts.sortBy : "created_at";
  const sortBy = raw === "full_name" ? "full_name_sort" : raw;
  const ascending = opts?.order === "asc";
  const { data, error } = await supabase
    .from("invites")
    .select("*")
    .eq("company_id", companyId)
    .order(sortBy, { ascending });
  if (error) throw error;
  return data || [];
}

export async function fetchInviteByToken(token: string) {
  const { data, error } = await supabase.from("invites").select("*").eq("token", token).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function markInviteUsed(token: string) {
  const { error } = await supabase.from("invites").update({ used: true, used_at: new Date().toISOString() }).eq("token", token);
  if (error) throw error;
}


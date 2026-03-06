import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "app_session";

export interface SessionUser {
  user_id: string;
  email: string;
  profile: {
    id: string;
    user_id: string;
    full_name: string;
    email: string;
    linked_candidate_id: string | null;
    is_active: boolean | null;
    created_at: string;
    updated_at: string;
    agency_id?: string | null;
  } | null;
  role: string;
}

export function getStoredSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function setStoredSession(data: SessionUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function clearStoredSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<{ data: SessionUser | null; error: Error | null }> {
  const trimmedEmail = email?.trim()?.toLowerCase();
  if (!trimmedEmail || !password) {
    return { data: null, error: new Error("Valid email and password required") };
  }
  const { data, error } = await supabase.rpc("login", {
    p_email: trimmedEmail,
    p_password: password,
  });
  if (error) return { data: null, error: error as Error };
  const payload = data as unknown as SessionUser | null;
  if (!payload?.user_id) return { data: null, error: new Error("Invalid email or password") };

  // Ensure agency_id is present for agency_admin (login RPC must return it; see migration 20260223100001)
  if (payload.role === "agency_admin" && payload.profile && (payload.profile.agency_id == null || payload.profile.agency_id === "")) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("user_id", payload.user_id)
      .maybeSingle();
    if (profileRow?.agency_id != null) {
      payload.profile.agency_id = profileRow.agency_id;
    }
  }

  return { data: payload, error: null };
}

export async function createAppUser(
  adminUserId: string,
  email: string,
  password: string,
  fullName: string,
  role: string,
  agencyId?: string | null
): Promise<{ data: { user_id: string } | null; error: Error | null }> {
  const trimmedEmail = email?.trim()?.toLowerCase();
  if (!trimmedEmail || !password || !fullName?.trim()) {
    return { data: null, error: new Error("Email, password, and full name required") };
  }
  // Use only 5-param RPC (no p_agency_id) so it works with existing DB; set agency_id in a second step
  const { data, error } = await supabase.rpc("create_app_user", {
    p_admin_user_id: adminUserId,
    p_email: trimmedEmail,
    p_password: password,
    p_full_name: fullName.trim(),
    p_role: role,
  });
  if (error) return { data: null, error: error as Error };
  const payload = data as { user_id: string } | null;
  if (!payload?.user_id) return { data: payload ?? null, error: null };

  if (agencyId != null && agencyId !== "") {
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ agency_id: agencyId })
      .eq("user_id", payload.user_id);
    if (updateErr) {
      return { data: null, error: new Error(updateErr.message || "User created but failed to set agency") };
    }
  }
  return { data: payload, error: null };
}

export async function updateAppUserPassword(
  adminUserId: string,
  targetUserId: string,
  password: string
): Promise<{ data: any | null; error: Error | null }> {
  if (!adminUserId || !targetUserId || !password) {
    return { data: null, error: new Error("adminUserId, targetUserId and password required") };
  }
  const { data, error } = await (supabase.rpc as (name: string, args: object) => ReturnType<typeof supabase.rpc>)(
    "update_app_user_password",
    {
      p_admin_user_id: adminUserId,
      p_target_user_id: targetUserId,
      p_password: password,
    }
  );
  if (error) return { data: null, error: error as Error };
  return { data: data ?? null, error: null };
}

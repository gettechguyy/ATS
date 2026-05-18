import { supabase } from "../../src/integrations/supabase/client";

export type NotificationRow = {
  id: string;
  company_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export async function fetchNotificationsForUser(
  userId: string,
  companyId: string,
  opts?: { limit?: number; unreadOnly?: boolean }
) {
  const limit = opts?.limit ?? 50;
  let q = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.unreadOnly) {
    q = q.is("read_at", null);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function fetchUnreadNotificationCount(userId: string, companyId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string, companyId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .is("read_at", null);
  if (error) throw error;
}

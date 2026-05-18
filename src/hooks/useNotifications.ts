import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchNotificationsForUser,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from "../../dbscripts/functions/notifications";
import { toast } from "sonner";

export function useNotifications(userId: string | undefined, companyId: string | undefined, enabled: boolean) {
  const queryClient = useQueryClient();
  const canRun = enabled && !!userId && !!companyId;

  const listKey = ["notifications", userId, companyId];
  const countKey = ["notifications-unread", userId, companyId];

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => fetchNotificationsForUser(userId!, companyId!, { limit: 20 }),
    enabled: canRun,
    refetchInterval: canRun ? 60_000 : false,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: countKey,
    queryFn: () => fetchUnreadNotificationCount(userId!, companyId!),
    enabled: canRun,
    refetchInterval: canRun ? 30_000 : false,
  });

  useEffect(() => {
    if (!canRun) return;

    const channel = supabase
      .channel(`notifications:${userId}:${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          queryClient.invalidateQueries({ queryKey: listKey });
          queryClient.invalidateQueries({ queryKey: countKey });
          if (row?.title) {
            toast.info(row.title, { description: row.body });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: listKey });
          queryClient.invalidateQueries({ queryKey: countKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canRun, userId, companyId, queryClient, listKey, countKey]);

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
      queryClient.invalidateQueries({ queryKey: countKey });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(userId!, companyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
      queryClient.invalidateQueries({ queryKey: countKey });
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markRead,
    markAllRead,
  };
}

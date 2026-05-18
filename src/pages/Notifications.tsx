import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNotifications } from "@/hooks/useNotifications";
import { CheckCheck, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatInAppDateTime } from "@/lib/appTimezone";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchNotificationsForUser } from "../../dbscripts/functions/notifications";

function typeLabel(type: string) {
  switch (type) {
    case "candidate_created":
      return "New candidate";
    case "interview_scheduled":
      return "Interview";
    case "offer_created":
      return "Offer";
    default:
      return "Activity";
  }
}

export default function Notifications() {
  const { user, profile, isAdmin } = useAuth();
  const companyId = profile?.company_id;
  const userId = user?.id;

  const { data: allNotifications, isLoading } = useQuery({
    queryKey: ["notifications-all", userId, companyId],
    queryFn: () => fetchNotificationsForUser(userId!, companyId!, { limit: 200 }),
    enabled: !!userId && !!companyId && isAdmin,
  });

  const { unreadCount, markRead, markAllRead } = useNotifications(userId, companyId, isAdmin);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <PageShell>
      <PageHeader
        title="Activity"
        description="Real-time updates when candidates, interviews, and offers are added to your company."
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-4 w-4" />
              Mark all as read
            </Button>
          ) : undefined
        }
        badge={
          unreadCount > 0 ? (
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
              {unreadCount} unread
            </span>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : !allNotifications?.length ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <Bell className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {allNotifications.map((n) => {
                const unread = !n.read_at;
                const row = (
                  <div
                    className={cn(
                      "flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between",
                      unread && "bg-primary/[0.04]"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {typeLabel(n.type)}
                        </span>
                        {unread ? (
                          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            New
                          </span>
                        ) : null}
                      </div>
                      <p className={cn("mt-1 text-base", unread ? "font-semibold" : "font-medium")}>{n.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatInAppDateTime(n.created_at)}
                      </span>
                      {n.link ? (
                        <Button variant="outline" size="sm" className="h-8" asChild>
                          <Link
                            to={n.link}
                            onClick={() => {
                              if (unread) markRead.mutate(n.id);
                            }}
                          >
                            View
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );

                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        to={n.link}
                        className="block hover:bg-muted/30"
                        onClick={() => {
                          if (unread) markRead.mutate(n.id);
                        }}
                      >
                        {row}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="block w-full text-left hover:bg-muted/30"
                        onClick={() => {
                          if (unread) markRead.mutate(n.id);
                        }}
                      >
                        {row}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

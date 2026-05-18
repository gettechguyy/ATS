import { Link } from "react-router-dom";
import { Bell, CheckCheck, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { formatInAppDateTime } from "@/lib/appTimezone";

type NotificationBellProps = {
  userId: string;
  companyId: string;
};

function typeAccent(type: string) {
  switch (type) {
    case "candidate_created":
      return "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300";
    case "interview_scheduled":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "offer_created":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    default:
      return "bg-primary/15 text-primary";
  }
}

export function NotificationBell({ userId, companyId }: NotificationBellProps) {
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications(
    userId,
    companyId,
    true
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <AnimatePresence>
            {unreadCount > 0 ? (
              <motion.span
                key={unreadCount}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground ring-2 ring-background"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <DropdownMenuLabel className="flex items-center gap-2 p-0 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Notifications
            {unreadCount > 0 ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                {unreadCount} new
              </span>
            ) : null}
          </DropdownMenuLabel>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          ) : null}
        </div>
        <ScrollArea className="max-h-[320px]">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up. New candidate, interview, and offer activity will appear here.
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {notifications.map((n) => {
                const unread = !n.read_at;
                const inner = (
                  <div
                    className={cn(
                      "flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                      unread && "bg-primary/5"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                        typeAccent(n.type)
                      )}
                    >
                      {n.type === "candidate_created" ? "C" : n.type === "interview_scheduled" ? "I" : "O"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm", unread ? "font-semibold text-foreground" : "font-medium")}>
                        {n.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground/80">
                        {formatInAppDateTime(n.created_at)}
                      </p>
                    </div>
                    {unread ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                  </div>
                );

                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        to={n.link}
                        onClick={() => {
                          if (unread) markRead.mutate(n.id);
                        }}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => {
                          if (unread) markRead.mutate(n.id);
                        }}
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <DropdownMenuSeparator className="m-0" />
        <div className="p-2">
          <Button variant="outline" size="sm" className="w-full rounded-lg" asChild>
            <Link to="/notifications">View all notifications</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

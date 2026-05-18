import { cn } from "@/lib/utils";

export type StatusTone =
  | "neutral"
  | "primary"
  | "info"
  | "violet"
  | "warning"
  | "success"
  | "danger";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral:
    "border-slate-200/90 bg-gradient-to-b from-slate-50 to-slate-100/90 text-slate-700 dark:border-slate-600/50 dark:from-slate-800/80 dark:to-slate-800/40 dark:text-slate-200",
  primary:
    "border-primary/25 bg-gradient-to-b from-primary/12 to-primary/6 text-[hsl(217,70%,38%)] dark:border-primary/35 dark:from-primary/20 dark:to-primary/10 dark:text-[hsl(217,90%,78%)]",
  info:
    "border-[hsl(199,70%,75%)] bg-gradient-to-b from-[hsl(199,90%,96%)] to-[hsl(199,80%,92%)] text-[hsl(199,70%,32%)] dark:border-[hsl(199,50%,40%)] dark:from-[hsl(199,50%,18%)] dark:to-[hsl(199,45%,14%)] dark:text-[hsl(199,80%,75%)]",
  violet:
    "border-[hsl(270,55%,82%)] bg-gradient-to-b from-[hsl(270,70%,97%)] to-[hsl(270,60%,93%)] text-[hsl(270,55%,38%)] dark:border-[hsl(270,40%,45%)] dark:from-[hsl(270,45%,20%)] dark:to-[hsl(270,40%,16%)] dark:text-[hsl(270,75%,82%)]",
  warning:
    "border-[hsl(32,85%,78%)] bg-gradient-to-b from-[hsl(32,95%,96%)] to-[hsl(32,90%,91%)] text-[hsl(32,75%,32%)] dark:border-[hsl(32,55%,40%)] dark:from-[hsl(32,50%,18%)] dark:to-[hsl(32,45%,14%)] dark:text-[hsl(32,90%,75%)]",
  success:
    "border-[hsl(152,50%,72%)] bg-gradient-to-b from-[hsl(152,60%,96%)] to-[hsl(152,55%,90%)] text-[hsl(152,55%,28%)] dark:border-[hsl(152,40%,38%)] dark:from-[hsl(152,45%,18%)] dark:to-[hsl(152,40%,14%)] dark:text-[hsl(152,65%,78%)]",
  danger:
    "border-[hsl(0,70%,82%)] bg-gradient-to-b from-[hsl(0,85%,97%)] to-[hsl(0,80%,93%)] text-[hsl(0,65%,38%)] dark:border-[hsl(0,50%,42%)] dark:from-[hsl(0,45%,20%)] dark:to-[hsl(0,40%,16%)] dark:text-[hsl(0,75%,80%)]",
};

export const STATUS_BADGE_BASE =
  "inline-flex min-h-[26px] min-w-[4.5rem] max-w-[11.5rem] items-center justify-center rounded-full border px-3 py-1 text-center text-[11px] font-semibold leading-tight tracking-wide shadow-sm whitespace-nowrap";

const STATUS_TONE_MAP: Record<string, StatusTone> = {
  New: "neutral",
  "Ready For Assign": "neutral",
  "Ready For Marketing": "violet",
  "In Marketing": "info",
  Placed: "success",
  Backout: "danger",
  "On Bench": "warning",
  "In Training": "primary",

  Applied: "neutral",
  "Vendor Responded": "info",
  Assessment: "primary",
  "Screen Call": "violet",
  Interview: "warning",
  Rejected: "danger",
  Offered: "success",

  Pending: "warning",
  Accepted: "success",
  Declined: "danger",

  Scheduled: "info",
  Passed: "success",
  Failed: "danger",
  Cancelled: "neutral",
  Completed: "success",
  "No Show": "danger",
};

export function getStatusTone(status: string): StatusTone {
  return STATUS_TONE_MAP[status] ?? "neutral";
}

export function getStatusBadgeClassName(status: string, className?: string): string {
  const tone = getStatusTone(status);
  return cn(STATUS_BADGE_BASE, TONE_CLASSES[tone], className);
}

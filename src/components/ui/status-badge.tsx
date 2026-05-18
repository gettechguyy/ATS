import { getStatusBadgeClassName } from "@/lib/statusStyles";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (!status) return <span className="text-muted-foreground">—</span>;

  return (
    <span className={getStatusBadgeClassName(status, className)} title={status}>
      {status}
    </span>
  );
}

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { fadeUp, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/30 px-8 py-16 text-center",
        className
      )}
      initial={fadeUp.initial}
      animate={fadeUp.animate}
      transition={spring}
    >
      <motion.div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-primary"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon className="h-7 w-7" />
      </motion.div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <motion.div className="mt-6">{action}</motion.div> : null}
    </motion.div>
  );
}

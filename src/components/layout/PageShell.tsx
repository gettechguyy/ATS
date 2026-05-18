import { motion } from "framer-motion";
import { fadeUp, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
};

/** Animated page wrapper — use inside routed pages for consistent entrance */
export function PageShell({ children, className }: PageShellProps) {
  return (
    <motion.div
      className={cn("relative min-w-0", className)}
      initial={fadeUp.initial}
      animate={fadeUp.animate}
      transition={{ ...spring, delay: 0.02 }}
    >
      {children}
    </motion.div>
  );
}

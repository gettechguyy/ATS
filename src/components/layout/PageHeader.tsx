import { motion } from "framer-motion";
import { fadeUp, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, badge, className }: PageHeaderProps) {
  return (
    <motion.div
      className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}
      initial={fadeUp.initial}
      animate={fadeUp.animate}
      transition={spring}
    >
      <motion.div className="space-y-1.5" variants={fadeUp} initial="initial" animate="animate">
        <motion.div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {badge}
        </motion.div>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </motion.div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </motion.div>
  );
}

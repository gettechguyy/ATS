import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

const accentMap: Record<string, string> = {
  "text-info": "from-cyan-500/20 to-cyan-500/5 text-cyan-600 dark:text-cyan-400",
  "text-primary": "from-primary/20 to-[hsl(var(--brand-violet)/0.08)] text-primary dark:text-[hsl(217,96%,72%)]",
  "text-success": "from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  "text-warning": "from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400",
  "text-destructive": "from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400",
};

export function StatCard({
  title,
  value,
  icon: Icon,
  color = "text-primary",
  isLoading,
  index = 0,
}: {
  title: string;
  value?: number;
  icon: LucideIcon;
  color?: string;
  isLoading?: boolean;
  index?: number;
}) {
  const accent = accentMap[color] ?? accentMap["text-primary"];

  return (
    <motion.div variants={staggerItem} custom={index}>
      <Card className="group relative overflow-hidden border-border/60 bg-card/80 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/10">
        <motion.div
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-60 blur-2xl transition-opacity group-hover:opacity-100"
          style={{ background: "linear-gradient(135deg, hsl(var(--brand-primary) / 0.18), transparent)" }}
        />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <motion.div
            className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br", accent)}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <Icon className="h-4 w-4" />
          </motion.div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-9 w-20" />
          ) : (
            <motion.p
              className="text-3xl font-bold tabular-nums tracking-tight text-foreground"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              key={value}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
            >
              {value ?? 0}
            </motion.p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

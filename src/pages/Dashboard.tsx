import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Calendar as CalendarIcon, Gift, TrendingUp, Briefcase, CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fetchDashboardStats } from "../../dbscripts/functions/dashboard";

type DatePreset = "all" | "today" | "yesterday" | "this_week" | "last_week" | "custom";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function getRangeForPreset(
  preset: DatePreset,
  customRange: DateRange | undefined
): { from: Date; to: Date } | null {
  const now = new Date();
  if (preset === "all") return null;
  if (preset === "custom" && customRange?.from && customRange?.to)
    return { from: customRange.from, to: customRange.to };
  if (preset === "today") {
    return { from: startOfDay(now), to: endOfDay(now) };
  }
  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y) };
  }
  if (preset === "this_week") {
    const day = now.getDay();
    const sun = new Date(now);
    sun.setDate(now.getDate() - day);
    const sat = new Date(sun);
    sat.setDate(sun.getDate() + 6);
    return { from: startOfDay(sun), to: endOfDay(sat) };
  }
  if (preset === "last_week") {
    const day = now.getDay();
    const lastSun = new Date(now);
    lastSun.setDate(now.getDate() - day - 7);
    const lastSat = new Date(lastSun);
    lastSat.setDate(lastSun.getDate() + 6);
    return { from: startOfDay(lastSun), to: endOfDay(lastSat) };
  }
  return null;
}

export default function Dashboard() {
  const { user, isAdmin, isRecruiter, isCandidate, isManager, role, profile } = useAuth();
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [customOpen, setCustomOpen] = useState(false);

  const dateRange = useMemo(
    () => getRangeForPreset(datePreset, customRange),
    [datePreset, customRange]
  );
  const fromDate = dateRange ? dateRange.from.toISOString() : null;
  const toDate = dateRange ? dateRange.to.toISOString() : null;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", user?.id, role, profile?.linked_candidate_id, fromDate, toDate],
    queryFn: () =>
      fetchDashboardStats({
        role: role ?? "recruiter",
        userId: user?.id,
        linkedCandidateId: profile?.linked_candidate_id ?? null,
        fromDate: fromDate ?? undefined,
        toDate: toDate ?? undefined,
      }),
    enabled: !!user,
  });

  const dateFilterEl = (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={datePreset}
        onValueChange={(v) => {
          setDatePreset(v as DatePreset);
          if (v !== "custom") setCustomOpen(false);
        }}
      >
        <SelectTrigger className="w-[160px]">
          <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Date filter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All time</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="yesterday">Yesterday</SelectItem>
          <SelectItem value="this_week">This Week</SelectItem>
          <SelectItem value="last_week">Last Week</SelectItem>
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>
      {datePreset === "custom" && (
        <Dialog open={customOpen} onOpenChange={setCustomOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-[200px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {customRange?.from && customRange?.to
                ? `${customRange.from.toLocaleDateString()} – ${customRange.to.toLocaleDateString()}`
                : "Pick From and To dates"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-fit border rounded-lg p-0 gap-0 overflow-hidden">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle className="text-base">Select date range</DialogTitle>
            </DialogHeader>
            <div className="p-4 pt-2">
              <Calendar
                mode="range"
                selected={customRange}
                onSelect={setCustomRange}
                numberOfMonths={1}
                defaultMonth={customRange?.from ?? new Date()}
                classNames={{
                  day_today: "bg-muted text-muted-foreground font-medium",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  day_range_middle: "bg-muted/70 text-foreground",
                }}
              />
              <p className="text-xs text-muted-foreground text-center mt-2">From → To (selected range)</p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );

  // Candidate-specific dashboard
  if (isCandidate) {
    return (
      <div>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Dashboard</h1>
            <p className="text-sm text-muted-foreground">Your recruitment progress</p>
          </div>
          {dateFilterEl}
        </div>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-8 w-16" /></CardContent></Card>)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="My Submissions" value={stats?.totalSubmissions} icon={FileText} color="text-info" />
            <StatCard title="Interviews" value={stats?.totalInterviews} icon={CalendarIcon} color="text-warning" />
            <StatCard title="Offers" value={stats?.totalOffers} icon={Gift} color="text-success" />
            <StatCard title="Pending Offers" value={stats?.pendingOffers} icon={Gift} color="text-warning" />
          </div>
        )}
      </div>
    );
  }

  const statCards = [
    { title: "Total Candidates", value: stats?.totalCandidates, icon: Users, color: "text-info" },
    { title: "In Marketing", value: stats?.candidatesByStatus?.["In Marketing"], icon: TrendingUp, color: "text-success" },
    { title: "Total Submissions", value: stats?.totalSubmissions, icon: FileText, color: "text-info" },
    { title: "Interviews Scheduled", value: stats?.scheduledInterviews, icon: Calendar, color: "text-warning" },
    { title: "Interviews Passed", value: stats?.passedInterviews, icon: Calendar, color: "text-success" },
    { title: "Total Offers", value: stats?.totalOffers, icon: Gift, color: "text-success" },
    { title: "Pending Offers", value: stats?.pendingOffers, icon: Gift, color: "text-warning" },
    { title: "Placements", value: stats?.candidatesByStatus?.Placed, icon: Briefcase, color: "text-success" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isAdmin ? "Admin Dashboard" : isManager ? "Manager Dashboard" : "My Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Overview of all activity" : isManager ? "Read-only overview" : "Your recruiting progress"}
          </p>
        </div>
        {dateFilterEl}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <StatCard key={card.title} {...card} isLoading={isLoading} />
        ))}
      </div>

      {stats && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Candidates by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.candidatesByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Badge variant="outline">{status}</Badge>
                  <span className="text-lg font-bold text-foreground">{count as number}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Pipeline Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {[
                { label: "Submissions", count: stats.totalSubmissions },
                { label: "Interviews", count: stats.totalInterviews },
                { label: "Offers", count: stats.totalOffers },
                { label: "Placed", count: stats.candidatesByStatus.Placed },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center gap-2">
                  <div className="text-center">
                    <p className="text-xl font-bold text-foreground">{step.count}</p>
                    <p className="text-xs text-muted-foreground">{step.label}</p>
                  </div>
                  {i < 3 && <span className="text-muted-foreground">→</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, isLoading }: {
  title: string;
  value?: number;
  icon: any;
  color: string;
  isLoading?: boolean;
}) {
  return (
    <Card className="stat-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-bold text-foreground">{value ?? 0}</p>
        )}
      </CardContent>
    </Card>
  );
}

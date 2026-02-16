import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Calendar as CalendarIcon, Gift, TrendingUp, Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { fetchDashboardStats } from "../../dbscripts/functions/dashboard";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, subDays } from "date-fns";

export default function Dashboard() {
  const { user, isAdmin, isRecruiter, isCandidate, isManager, role, profile } = useAuth();
  const [dateRange, setDateRange] = useState<{ from?: Date | null; to?: Date | null } | undefined>(undefined);

  const { data: stats, isLoading } = useQuery({
    queryKey: [
      "dashboard-stats",
      user?.id,
      role,
      profile?.linked_candidate_id,
      dateRange?.from ? dateRange.from.toISOString() : null,
      dateRange?.to ? dateRange.to.toISOString() : null,
    ],
    queryFn: () =>
      fetchDashboardStats({
        role: role ?? "recruiter",
        userId: user?.id,
        linkedCandidateId: profile?.linked_candidate_id ?? null,
        startDate: dateRange?.from ?? null,
        endDate: dateRange?.to ?? null,
      }),
    enabled: !!user,
  });

  const selectPreset = (preset: "today" | "yesterday" | "thisWeek" | "lastWeek") => {
    const now = new Date();
    let from: Date | undefined;
    let to: Date | undefined;
    if (preset === "today") {
      from = startOfDay(now);
      to = endOfDay(now);
    } else if (preset === "yesterday") {
      const yesterday = subDays(now, 1);
      from = startOfDay(yesterday);
      to = endOfDay(yesterday);
    } else if (preset === "thisWeek") {
      from = startOfWeek(now, { weekStartsOn: 1 });
      to = endOfWeek(now, { weekStartsOn: 1 });
    } else if (preset === "lastWeek") {
      const lastWeekStart = subDays(startOfWeek(now, { weekStartsOn: 1 }), 7);
      from = startOfWeek(lastWeekStart, { weekStartsOn: 1 });
      to = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
    }
    setDateRange({ from, to });
  };

  const rangeLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return "All time";
    const f = format(dateRange.from, "MMM d, yyyy");
    const t = format(dateRange.to, "MMM d, yyyy");
    return f === t ? f : `${f} — ${t}`;
  }, [dateRange]);

  // Candidate-specific dashboard
  if (isCandidate) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">My Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your recruitment progress</p>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => selectPreset("today")}>Today</Button>
            <Button variant="outline" size="sm" onClick={() => selectPreset("yesterday")}>Yesterday</Button>
            <Button variant="outline" size="sm" onClick={() => selectPreset("thisWeek")}>This Week</Button>
            <Button variant="outline" size="sm" onClick={() => selectPreset("lastWeek")}>Last Week</Button>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm">{rangeLabel}</Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto">
              <Calendar
                mode="range"
                selected={dateRange as any}
                onSelect={(r: any) => setDateRange(r)}
              />
            </PopoverContent>
          </Popover>
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
    { title: "Interviews Scheduled", value: stats?.scheduledInterviews, icon: CalendarIcon, color: "text-warning" },
    { title: "Interviews Passed", value: stats?.passedInterviews, icon: CalendarIcon, color: "text-success" },
    { title: "Total Offers", value: stats?.totalOffers, icon: Gift, color: "text-success" },
    { title: "Pending Offers", value: stats?.pendingOffers, icon: Gift, color: "text-warning" },
    { title: "Placements", value: stats?.candidatesByStatus?.Placed, icon: Briefcase, color: "text-success" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {isAdmin ? "Admin Dashboard" : isManager ? "Manager Dashboard" : "My Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "Overview of all activity" : isManager ? "Read-only overview" : "Your recruiting progress"}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => selectPreset("today")}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => selectPreset("yesterday")}>Yesterday</Button>
          <Button variant="outline" size="sm" onClick={() => selectPreset("thisWeek")}>This Week</Button>
          <Button variant="outline" size="sm" onClick={() => selectPreset("lastWeek")}>Last Week</Button>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm">{rangeLabel}</Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto">
            <Calendar
              mode="range"
              selected={dateRange as any}
              onSelect={(r: any) => setDateRange(r)}
            />
          </PopoverContent>
        </Popover>
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

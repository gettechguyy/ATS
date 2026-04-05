import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Calendar as CalendarIcon, Gift, TrendingUp, Briefcase, ClipboardList } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { fetchDashboardStats } from "../../dbscripts/functions/dashboard";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  easternPresetLastWeek,
  easternPresetThisWeek,
  easternPresetToday,
  easternPresetYesterday,
  easternRangeForDashboardFilter,
  formatInAppTimeZone,
} from "@/lib/appTimezone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { fetchCandidatesBasic } from "../../dbscripts/functions/candidates";
import { fetchProfilesByRole } from "../../dbscripts/functions/profiles";

export default function Dashboard() {
  const { user, isAdmin, isRecruiter, isCandidate, isManager, isAgencyAdmin, role, profile } = useAuth();
  const [dateRange, setDateRange] = useState<{ from?: Date | null; to?: Date | null } | undefined>(undefined);
  const [filterCandidateId, setFilterCandidateId] = useState<string>("");
  const [filterTechnology, setFilterTechnology] = useState<string>("");
  const [filterRecruiterId, setFilterRecruiterId] = useState<string>("");

  const effectiveRole = (typeof role === "string" ? role.toLowerCase() : role) ?? "recruiter";
  const dashboardUserId =
    effectiveRole === "team_lead"
      ? profile?.id
      : effectiveRole === "recruiter"
        ? user?.id
        : profile?.id ?? user?.id;

  const showFilterDropdowns = isAdmin || isAgencyAdmin;
  const filterAgencyId = isAgencyAdmin ? profile?.agency_id ?? null : undefined;

  const { data: filterCandidates } = useQuery({
    queryKey: ["dashboard-filter-candidates", filterAgencyId],
    queryFn: () => fetchCandidatesBasic(filterAgencyId ?? undefined),
    enabled: showFilterDropdowns,
  });
  const { data: filterRecruiters } = useQuery({
    queryKey: ["dashboard-filter-recruiters", filterAgencyId],
    queryFn: () => fetchProfilesByRole("recruiter", filterAgencyId ?? undefined),
    enabled: showFilterDropdowns,
  });
  const technologyOptions = useMemo(() => {
    if (!filterCandidates?.length) return [];
    const set = new Set<string>();
    (filterCandidates as any[]).forEach((c: any) => {
      const t = c?.technology?.trim();
      if (t) set.add(t);
    });
    return Array.from(set).sort();
  }, [filterCandidates]);

  const dashboardDateFilter = useMemo(
    () => easternRangeForDashboardFilter(dateRange),
    [dateRange]
  );

  const { data: stats, isLoading } = useQuery({
    queryKey: [
      "dashboard-stats",
      effectiveRole,
      dashboardUserId,
      profile?.linked_candidate_id,
      profile?.agency_id,
      dashboardDateFilter.start ? dashboardDateFilter.start.toISOString() : null,
      dashboardDateFilter.end ? dashboardDateFilter.end.toISOString() : null,
      showFilterDropdowns ? filterCandidateId : null,
      showFilterDropdowns ? filterTechnology : null,
      showFilterDropdowns ? filterRecruiterId : null,
    ],
    queryFn: () =>
      fetchDashboardStats({
        role: effectiveRole as any,
        userId: dashboardUserId ?? undefined,
        linkedCandidateId: profile?.linked_candidate_id ?? null,
        agencyId: isAgencyAdmin ? profile?.agency_id ?? null : null,
        startDate: dashboardDateFilter.start,
        endDate: dashboardDateFilter.end,
        filterCandidateId: showFilterDropdowns && filterCandidateId ? filterCandidateId : null,
        filterTechnology: showFilterDropdowns && filterTechnology ? filterTechnology : null,
        filterRecruiterId: showFilterDropdowns && filterRecruiterId ? filterRecruiterId : null,
      }),
    enabled: !!user,
  });

  const selectPreset = (preset: "today" | "yesterday" | "thisWeek" | "lastWeek") => {
    if (preset === "today") setDateRange(easternPresetToday());
    else if (preset === "yesterday") setDateRange(easternPresetYesterday());
    else if (preset === "thisWeek") setDateRange(easternPresetThisWeek());
    else setDateRange(easternPresetLastWeek());
  };

  const rangeLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return "All time";
    const f = formatInAppTimeZone(dateRange.from, "MMM d, yyyy");
    const t = formatInAppTimeZone(dateRange.to, "MMM d, yyyy");
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
            <StatCard title="My Applications" value={stats?.totalSubmissions} icon={FileText} color="text-info" />
            <StatCard title="Assessments" value={stats?.totalAssessments} icon={ClipboardList} color="text-primary" />
            <StatCard title="Screen Calls" value={stats?.totalScreenCalls} icon={CalendarIcon} color="text-info" />
            <StatCard title="Interviews" value={stats?.totalInterviews} icon={CalendarIcon} color="text-warning" />
            <StatCard title="Offers" value={stats?.totalOffers} icon={Gift} color="text-success" />
          </div>
        )}
      </div>
    );
  }

  const statCards = [
    { title: "Total Candidates", value: stats?.totalCandidates, icon: Users, color: "text-info" },
    { title: "In Marketing", value: stats?.candidatesByStatus?.["In Marketing"], icon: TrendingUp, color: "text-success" },
    { title: "Total Applications", value: stats?.totalSubmissions, icon: FileText, color: "text-info" },
    { title: "Assessments", value: stats?.totalAssessments, icon: ClipboardList, color: "text-primary" },
    { title: "Screen Calls", value: stats?.totalScreenCalls, icon: CalendarIcon, color: "text-info" },
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
          {isAdmin ? "Admin Dashboard" : isManager ? "Manager Dashboard" : isAgencyAdmin ? "Agency Dashboard" : "My Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "Overview of all activity" : isManager ? "Read-only overview" : isAgencyAdmin ? "Your agency's candidates and submissions" : "Your recruiting progress"}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-2">
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
        {showFilterDropdowns && (
          <div className="flex flex-wrap items-center gap-3 border-l pl-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Candidate</Label>
              <Select value={filterCandidateId || "all"} onValueChange={(v) => setFilterCandidateId(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder="All candidates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All candidates</SelectItem>
                  {(filterCandidates || []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Technology</Label>
              <Select value={filterTechnology || "all"} onValueChange={(v) => setFilterTechnology(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {technologyOptions.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Recruiter</Label>
              <Select value={filterRecruiterId || "all"} onValueChange={(v) => setFilterRecruiterId(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="All recruiters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All recruiters</SelectItem>
                  {(filterRecruiters || []).map((r: any) => (
                    <SelectItem key={r.user_id} value={r.user_id}>
                      {r.full_name || r.email || r.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
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
          {(() => {
            const steps = [
              { label: "Applications", count: stats.totalSubmissions },
              { label: "Assessments", count: stats.totalAssessments },
              { label: "Screen Calls", count: stats.totalScreenCalls },
              { label: "Interviews", count: stats.totalInterviews },
              { label: "Offers", count: stats.totalOffers },
              { label: "Placed", count: stats.candidatesByStatus.Placed },
            ];
            return steps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground">{step.count}</p>
                  <p className="text-xs text-muted-foreground">{step.label}</p>
                </div>
                {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
              </div>
            ));
          })()}
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

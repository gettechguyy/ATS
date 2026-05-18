import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Calendar as CalendarIcon, Gift, TrendingUp, Briefcase, ClipboardList } from "lucide-react";
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
import { PageHeader } from "@/components/layout/PageHeader";
import { PageShell } from "@/components/layout/PageShell";
import { StatCard } from "@/components/premium/StatCard";
import { staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

const pipelineColors = [
  "from-[hsl(217,96%,58%)] to-[hsl(270,85%,62%)]",
  "from-[hsl(270,85%,62%)] to-[hsl(340,82%,58%)]",
  "from-[hsl(187,92%,48%)] to-[hsl(199,89%,48%)]",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-500",
  "from-rose-500 to-pink-500",
];

export default function Dashboard() {
  const { user, isAdmin, isCandidate, isManager, isAgencyAdmin, isMasterCompany, role, profile } = useAuth();
  const isAgencyScope = isAgencyAdmin && isMasterCompany;
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

  const showFilterDropdowns = isAdmin || isAgencyScope;
  const filterAgencyId = isAgencyScope ? profile?.agency_id ?? null : undefined;

  const { data: filterCandidates } = useQuery({
    queryKey: ["dashboard-filter-candidates", filterAgencyId, profile?.company_id],
    queryFn: () => fetchCandidatesBasic(filterAgencyId ?? undefined, profile?.company_id ?? undefined),
    enabled: showFilterDropdowns && !!profile?.company_id,
  });
  const { data: filterRecruiters } = useQuery({
    queryKey: ["dashboard-filter-recruiters", filterAgencyId, profile?.company_id],
    queryFn: () => fetchProfilesByRole("recruiter", filterAgencyId ?? undefined, profile?.company_id ?? undefined),
    enabled: showFilterDropdowns && !!profile?.company_id,
  });
  const technologyOptions = useMemo(() => {
    if (!filterCandidates?.length) return [];
    const set = new Set<string>();
    (filterCandidates as { technology?: string }[]).forEach((c) => {
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
      profile?.company_id,
      dashboardDateFilter.start ? dashboardDateFilter.start.toISOString() : null,
      dashboardDateFilter.end ? dashboardDateFilter.end.toISOString() : null,
      showFilterDropdowns ? filterCandidateId : null,
      showFilterDropdowns ? filterTechnology : null,
      showFilterDropdowns ? filterRecruiterId : null,
    ],
    queryFn: () =>
      fetchDashboardStats({
        role: effectiveRole as "admin" | "recruiter" | "candidate" | "manager" | "team_lead" | "agency_admin",
        companyId: profile!.company_id!,
        userId: dashboardUserId ?? undefined,
        linkedCandidateId: profile?.linked_candidate_id ?? null,
        agencyId: isAgencyScope ? profile?.agency_id ?? null : null,
        startDate: dashboardDateFilter.start,
        endDate: dashboardDateFilter.end,
        filterCandidateId: showFilterDropdowns && filterCandidateId ? filterCandidateId : null,
        filterTechnology: showFilterDropdowns && filterTechnology ? filterTechnology : null,
        filterRecruiterId: showFilterDropdowns && filterRecruiterId ? filterRecruiterId : null,
      }),
    enabled: !!user && !!profile?.company_id,
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

  const dateFilters = (
    <motion.div className="flex flex-wrap items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {(["today", "yesterday", "thisWeek", "lastWeek"] as const).map((p) => (
        <Button key={p} variant="outline" size="sm" className="rounded-lg" onClick={() => selectPreset(p)}>
          {p === "today" ? "Today" : p === "yesterday" ? "Yesterday" : p === "thisWeek" ? "This Week" : "Last Week"}
        </Button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="rounded-lg text-muted-foreground">
            {rangeLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto rounded-xl border-border/60 p-0 shadow-xl">
          <Calendar mode="range" selected={dateRange as { from?: Date; to?: Date }} onSelect={(r) => setDateRange(r)} />
        </PopoverContent>
      </Popover>
    </motion.div>
  );

  if (isCandidate) {
    const cards = [
      { title: "My Applications", value: stats?.totalSubmissions, icon: FileText, color: "text-info" },
      { title: "Assessments", value: stats?.totalAssessments, icon: ClipboardList, color: "text-primary" },
      { title: "Screen Calls", value: stats?.totalScreenCalls, icon: CalendarIcon, color: "text-info" },
      { title: "Interviews", value: stats?.totalInterviews, icon: CalendarIcon, color: "text-warning" },
      { title: "Offers", value: stats?.totalOffers, icon: Gift, color: "text-success" },
    ];
    return (
      <PageShell>
        <PageHeader title="My Dashboard" description="Your recruitment progress at a glance" actions={dateFilters} />
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {cards.map((c, i) => (
            <StatCard key={c.title} {...c} isLoading={isLoading} index={i} />
          ))}
        </motion.div>
      </PageShell>
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

  const pipelineSteps = stats
    ? [
        { label: "Applications", count: stats.totalSubmissions },
        { label: "Assessments", count: stats.totalAssessments },
        { label: "Screen Calls", count: stats.totalScreenCalls },
        { label: "Interviews", count: stats.totalInterviews },
        { label: "Offers", count: stats.totalOffers },
        { label: "Placed", count: stats.candidatesByStatus.Placed },
      ]
    : [];

  const maxPipeline = Math.max(...pipelineSteps.map((s) => s.count ?? 0), 1);

  return (
    <PageShell>
      <PageHeader
        title={
          isAdmin ? "Admin Dashboard" : isManager ? "Manager Dashboard" : isAgencyScope ? "Agency Dashboard" : "Recruiting Dashboard"
        }
        description={
          isAdmin
            ? "Real-time overview of hiring activity across your organization"
            : isManager
              ? "Read-only overview of team performance"
              : isAgencyScope
                ? "Your agency's candidates and submissions"
                : "Your recruiting pipeline and velocity"
        }
        actions={dateFilters}
      />

      {showFilterDropdowns && (
        <motion.div
          className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-xs text-muted-foreground">Candidate</Label>
            <Select value={filterCandidateId || "all"} onValueChange={(v) => setFilterCandidateId(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-[180px] rounded-lg">
                <SelectValue placeholder="All candidates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All candidates</SelectItem>
                {(filterCandidates || []).map((c: { id: string; first_name?: string; last_name?: string; email?: string }) => (
                  <SelectItem key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <motion.div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-xs text-muted-foreground">Technology</Label>
            <Select value={filterTechnology || "all"} onValueChange={(v) => setFilterTechnology(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-[140px] rounded-lg">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {technologyOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-xs text-muted-foreground">Recruiter</Label>
            <Select value={filterRecruiterId || "all"} onValueChange={(v) => setFilterRecruiterId(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-[160px] rounded-lg">
                <SelectValue placeholder="All recruiters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All recruiters</SelectItem>
                {(filterRecruiters || []).map((r: { user_id: string; full_name?: string; email?: string }) => (
                  <SelectItem key={r.user_id} value={r.user_id}>
                    {r.full_name || r.email || r.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>
      )}

      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {statCards.map((card, i) => (
          <StatCard key={card.title} {...card} isLoading={isLoading} index={i} />
        ))}
      </motion.div>

      {stats && (
        <motion.div
          className="mt-8 grid gap-6 lg:grid-cols-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Candidates by status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.candidatesByStatus).map(([status, count]) => (
                  <motion.div
                    key={status}
                    className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50"
                    whileHover={{ scale: 1.02 }}
                  >
                    <Badge variant="outline">{status}</Badge>
                    <span className="text-lg font-bold tabular-nums">{count as number}</span>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Hiring funnel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pipelineSteps.map((step, i) => (
                <div key={step.label} className="space-y-1.5">
                  <motion.div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{step.label}</span>
                    <span className="font-semibold tabular-nums">{step.count}</span>
                  </motion.div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted/60">
                    <motion.div
                      className={cn("h-full rounded-full bg-gradient-to-r", pipelineColors[i % pipelineColors.length])}
                      initial={{ width: 0 }}
                      animate={{ width: `${((step.count ?? 0) / maxPipeline) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </PageShell>
  );
}

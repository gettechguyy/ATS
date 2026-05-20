import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronRight, UsersRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  easternPresetLastWeek,
  easternPresetThisWeek,
  easternPresetToday,
  easternPresetYesterday,
  easternRangeForDashboardFilter,
  formatInAppTimeZone,
} from "@/lib/appTimezone";
import {
  fetchTeamHierarchyStats,
  getChartNodes,
  METRIC_LABELS,
  type TeamHierarchyNode,
  type TeamHierarchyViewer,
  type TeamMetricKind,
} from "../../dbscripts/functions/teams";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageShell } from "@/components/layout/PageShell";
import { cn } from "@/lib/utils";

const chartConfig = {
  value: { label: "Count", color: "hsl(var(--primary))" },
};

function roleLabel(role: TeamHierarchyNode["role"]) {
  if (role === "manager") return "Manager";
  if (role === "team_lead") return "Team Lead";
  return "Recruiter";
}

function HierarchyRow({
  node,
  depth,
  expandedManagers,
  expandedTeamLeads,
  onToggleManager,
  onToggleTeamLead,
  viewerRole,
}: {
  node: TeamHierarchyNode;
  depth: number;
  expandedManagers: Set<string>;
  expandedTeamLeads: Set<string>;
  onToggleManager: (key: string) => void;
  onToggleTeamLead: (key: string) => void;
  viewerRole: TeamHierarchyViewer["role"];
}) {
  const isManager = node.role === "manager";
  const isTl = node.role === "team_lead";
  const canExpand =
    (viewerRole === "admin" && isManager && node.children.length > 0) ||
    ((viewerRole === "admin" || viewerRole === "manager") && isTl && node.children.length > 0);
  const expanded = isManager
    ? expandedManagers.has(node.key)
    : isTl
      ? expandedTeamLeads.has(node.key)
      : false;

  const handleToggle = () => {
    if (isManager) onToggleManager(node.key);
    else if (isTl) onToggleTeamLead(node.key);
  };

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm transition-colors hover:bg-muted/50",
          canExpand && "cursor-pointer"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={canExpand ? handleToggle : undefined}
      >
        {canExpand ? (
          <button
            type="button"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <span className="font-medium">{node.name}</span>
          <span className="ml-2 text-xs text-muted-foreground">{roleLabel(node.role)}</span>
        </div>
        <span className="tabular-nums font-semibold text-primary">{node.value}</span>
      </div>
      {expanded &&
        node.children.map((child) => (
          <HierarchyRow
            key={child.key}
            node={child}
            depth={depth + 1}
            expandedManagers={expandedManagers}
            expandedTeamLeads={expandedTeamLeads}
            onToggleManager={onToggleManager}
            onToggleTeamLead={onToggleTeamLead}
            viewerRole={viewerRole}
          />
        ))}
    </>
  );
}

export default function Teams() {
  const { user, profile, role, isAdmin, isManager, isTeamLead, isRecruiter } = useAuth();
  const effectiveRole = (typeof role === "string" ? role.toLowerCase() : role) ?? "recruiter";

  const [metric, setMetric] = useState<TeamMetricKind>("submissions");
  const [dateRange, setDateRange] = useState<{ from?: Date | null; to?: Date | null } | undefined>(
    undefined
  );
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const [expandedTeamLeads, setExpandedTeamLeads] = useState<Set<string>>(new Set());

  const dashboardDateFilter = useMemo(
    () => easternRangeForDashboardFilter(dateRange),
    [dateRange]
  );

  const viewer = useMemo((): TeamHierarchyViewer | null => {
    if (!profile?.company_id) return null;
    if (isAdmin) return { role: "admin", companyId: profile.company_id };
    if (isManager && profile.id)
      return { role: "manager", companyId: profile.company_id, profileId: profile.id };
    if (isTeamLead && profile.id)
      return { role: "team_lead", companyId: profile.company_id, profileId: profile.id };
    if (isRecruiter && profile.id && user?.id)
      return {
        role: "recruiter",
        companyId: profile.company_id,
        profileId: profile.id,
        userId: user.id,
      };
    return null;
  }, [profile, isAdmin, isManager, isTeamLead, isRecruiter, user?.id]);

  const { data: forest = [], isLoading, isError, error } = useQuery({
    queryKey: [
      "team-hierarchy",
      viewer?.role,
      profile?.id,
      profile?.company_id,
      metric,
      dashboardDateFilter.start?.toISOString() ?? null,
      dashboardDateFilter.end?.toISOString() ?? null,
    ],
    queryFn: () =>
      fetchTeamHierarchyStats(
        viewer!,
        metric,
        dashboardDateFilter.start,
        dashboardDateFilter.end
      ),
    enabled: !!viewer,
  });

  const chartNodes = useMemo(
    () =>
      getChartNodes(
        forest,
        expandedManagers,
        expandedTeamLeads,
        viewer?.role ?? "recruiter"
      ),
    [forest, expandedManagers, expandedTeamLeads, viewer?.role]
  );

  const chartData = useMemo(
    () =>
      chartNodes.map((n) => ({
        name: n.name.length > 28 ? `${n.name.slice(0, 26)}…` : n.name,
        fullName: n.name,
        value: n.value,
        role: roleLabel(n.role),
      })),
    [chartNodes]
  );

  const hasDateFilter = !!(dashboardDateFilter.start || dashboardDateFilter.end);
  const allCountsZero =
    chartNodes.length > 0 && chartNodes.every((n) => n.value === 0);

  const toggleManager = (key: string) => {
    setExpandedManagers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleTeamLead = (key: string) => {
    setExpandedTeamLeads((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

  const drillHint =
    effectiveRole === "admin"
      ? "Expand a manager to see team leads, then expand a team to see recruiters."
      : effectiveRole === "manager"
        ? "Expand a team to see individual recruiters. Collapsed bars show combined team totals."
        : effectiveRole === "team_lead"
          ? "Progress for each recruiter on your team."
          : "Progress for recruiters on your team.";

  if (!isAdmin && !isManager && !isTeamLead && !isRecruiter) {
    return (
      <PageShell>
        <PageHeader title="Teams" description="Team progress is not available for your role." />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Teams"
        description="Hierarchy progress with drill-down by manager, team lead, and recruiter."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={metric} onValueChange={(v) => setMetric(v as TeamMetricKind)}>
          <SelectTrigger className="w-[180px] rounded-lg">
            <SelectValue placeholder="Metric" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(METRIC_LABELS) as TeamMetricKind[]).map((k) => (
              <SelectItem key={k} value={k}>
                {METRIC_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(["today", "yesterday", "thisWeek", "lastWeek"] as const).map((p) => (
          <Button key={p} variant="outline" size="sm" className="rounded-lg" onClick={() => selectPreset(p)}>
            {p === "today"
              ? "Today"
              : p === "yesterday"
                ? "Yesterday"
                : p === "thisWeek"
                  ? "This Week"
                  : "Last Week"}
          </Button>
        ))}
        <Button
          variant={!hasDateFilter ? "secondary" : "ghost"}
          size="sm"
          className="rounded-lg"
          onClick={() => setDateRange(undefined)}
        >
          All time
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="rounded-lg text-muted-foreground">
              {rangeLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto rounded-xl border-border/60 p-0 shadow-xl">
            <Calendar
              mode="range"
              selected={dateRange as { from?: Date; to?: Date }}
              onSelect={(r) => setDateRange(r)}
            />
          </PopoverContent>
        </Popover>
      </div>

      <p className="text-sm text-muted-foreground">{drillHint}</p>

      {isError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Could not load team stats: {(error as Error)?.message ?? "Unknown error"}. Apply Supabase
          migrations{" "}
          <code className="text-xs">20260519120000_user_hierarchy_profiles.sql</code> and{" "}
          <code className="text-xs">20260519140000_teams_table.sql</code>, or use test cache (refresh
          after adding manager → team lead → team).
        </p>
      ) : null}

      {allCountsZero && hasDateFilter ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Organization is listed below, but counts are 0 for {rangeLabel}. Click{" "}
          <strong>All time</strong> (clear the date by opening the calendar and clearing the range)
          or widen the range — cached test applications use the time you created them.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">
              {METRIC_LABELS[metric]}
              {isLoading ? "…" : ""}
            </CardTitle>
            <CardDescription>
              {chartNodes.length} {chartNodes.length === 1 ? "bar" : "bars"} in current view
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 && !isLoading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {forest.length === 0
                  ? "No teams to display. Add managers/team leads in User Management, or test cache users as team lead."
                  : "No bars in this view — expand a row in Organization or clear the date filter."}
              </p>
            ) : (
              <ChartContainer config={chartConfig} className="aspect-[4/3] min-h-[280px] w-full">
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => {
                          const p = payload?.[0]?.payload as { fullName?: string; role?: string };
                          return p?.fullName ? `${p.fullName} (${p.role})` : "";
                        }}
                      />
                    }
                  />
                  <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Organization</CardTitle>
            <CardDescription>Click rows with arrows to drill down; chart updates to match.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[420px] overflow-y-auto">
            {forest.length === 0 && !isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No teams to display.</p>
            ) : (
              forest.map((node) => (
                <HierarchyRow
                  key={node.key}
                  node={node}
                  depth={0}
                  expandedManagers={expandedManagers}
                  expandedTeamLeads={expandedTeamLeads}
                  onToggleManager={toggleManager}
                  onToggleTeamLead={toggleTeamLead}
                  viewerRole={viewer?.role ?? "recruiter"}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

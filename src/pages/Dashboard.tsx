import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Calendar, Gift, TrendingUp, Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { fetchDashboardStats } from "../../dbscripts/functions/dashboard";

export default function Dashboard() {
  const { user, isAdmin, isRecruiter, isCandidate, isManager, role, profile } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", user?.id, role, profile?.linked_candidate_id],
    queryFn: () =>
      fetchDashboardStats({
        role: role ?? "recruiter",
        userId: user?.id,
        linkedCandidateId: profile?.linked_candidate_id ?? null,
      }),
    enabled: !!user,
  });

  // Candidate-specific dashboard
  if (isCandidate) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">My Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your recruitment progress</p>
        </div>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-8 w-16" /></CardContent></Card>)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="My Submissions" value={stats?.totalSubmissions} icon={FileText} color="text-info" />
            <StatCard title="Interviews" value={stats?.totalInterviews} icon={Calendar} color="text-warning" />
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {isAdmin ? "Admin Dashboard" : isManager ? "Manager Dashboard" : "My Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "Overview of all activity" : isManager ? "Read-only overview" : "Your recruiting progress"}
        </p>
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
